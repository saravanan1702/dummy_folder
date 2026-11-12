import { z } from "zod";
import { ApiError, authed, readJson } from "@/lib/api";
import { priceIdFor, stripe, stripeConfigured } from "@/lib/billing";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";

const schema = z.object({ plan: z.enum(["PRO", "BUSINESS"]) });

/** Starts a Stripe Checkout session for a paid plan. Only the workspace owner manages billing. */
export const POST = authed(
  async ({ req, workspace, user }) => {
    const { plan } = await readJson(req, schema);
    if (!stripeConfigured()) throw new ApiError(503, "Billing isn't set up yet. Add your Stripe keys to enable upgrades.");
    const price = priceIdFor(plan);
    if (!price) throw new ApiError(503, `No Stripe price is configured for the ${plan} plan.`);

    const base = appUrl(req);

    // Already subscribed: plan changes happen in the billing portal so proration is handled by Stripe.
    if (workspace.stripeSubscriptionId && workspace.stripeCustomerId) {
      const portal = await stripe().billingPortal.sessions.create({
        customer: workspace.stripeCustomerId,
        return_url: `${base}/app/settings/billing`,
      });
      return { url: portal.url };
    }

    let customerId = workspace.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe().customers.create({
        email: user.email,
        name: workspace.name,
        metadata: { workspaceId: workspace.id },
      });
      customerId = customer.id;
      await db.workspace.update({ where: { id: workspace.id }, data: { stripeCustomerId: customerId } });
    }

    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      client_reference_id: workspace.id,
      subscription_data: { metadata: { workspaceId: workspace.id } },
      allow_promotion_codes: true,
      success_url: `${base}/app/settings/billing?upgraded=1`,
      cancel_url: `${base}/app/settings/billing`,
    });
    if (!session.url) throw new ApiError(502, "Stripe did not return a checkout link.");
    return { url: session.url };
  },
  { roles: ["OWNER"] },
);

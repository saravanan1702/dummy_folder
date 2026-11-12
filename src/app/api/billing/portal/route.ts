import { ApiError, authed } from "@/lib/api";
import { stripe, stripeConfigured } from "@/lib/billing";
import { appUrl } from "@/lib/env";

/** Opens the Stripe customer portal (update card, change plan, cancel, invoices). */
export const POST = authed(
  async ({ req, workspace }) => {
    if (!stripeConfigured()) throw new ApiError(503, "Billing isn't set up yet.");
    if (!workspace.stripeCustomerId) throw new ApiError(400, "This workspace has no billing account yet.");
    const portal = await stripe().billingPortal.sessions.create({
      customer: workspace.stripeCustomerId,
      return_url: `${appUrl(req)}/app/settings/billing`,
    });
    return { url: portal.url };
  },
  { roles: ["OWNER"] },
);

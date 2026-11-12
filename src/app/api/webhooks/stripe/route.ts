import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { stripe, stripeConfigured, workspaceBillingFrom } from "@/lib/billing";
import { db } from "@/lib/db";

async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const workspace =
    (sub.metadata?.workspaceId
      ? await db.workspace.findUnique({ where: { id: sub.metadata.workspaceId } })
      : null) ?? (await db.workspace.findUnique({ where: { stripeCustomerId: customerId } }));
  if (!workspace) return;

  // An old, cancelled subscription must not downgrade a workspace that already has a newer one.
  const billing = workspaceBillingFrom(sub);
  if (!billing.stripeSubscriptionId && workspace.stripeSubscriptionId && workspace.stripeSubscriptionId !== sub.id) {
    return;
  }
  await db.workspace.update({
    where: { id: workspace.id },
    data: { ...billing, stripeCustomerId: customerId },
  });
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeConfigured() || !secret) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          await syncSubscription(await stripe().subscriptions.retrieve(id));
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        // Re-read so out-of-order deliveries can't leave us on a stale state.
        await syncSubscription(await stripe().subscriptions.retrieve(event.data.object.id));
        break;
    }
  } catch (err) {
    console.error("[stripe] webhook handling failed", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

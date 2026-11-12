import Stripe from "stripe";
import { PLANS, type PlanId } from "@/config/plans";

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured");
  // STRIPE_API_BASE lets tests point the SDK at a local stub; leave unset in production.
  const base = process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null;
  client ??= base
    ? new Stripe(key, { host: base.hostname, port: Number(base.port) || undefined, protocol: base.protocol.replace(":", "") as "http" | "https" })
    : new Stripe(key);
  return client;
}

export function priceIdFor(plan: PlanId): string | null {
  const env = PLANS[plan].stripePriceEnv;
  return env ? process.env[env] || null : null;
}

/** Maps a Stripe price id back to one of our plans. */
export function planForPrice(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const plan of Object.values(PLANS)) {
    if (plan.stripePriceEnv && process.env[plan.stripePriceEnv] === priceId) return plan.id;
  }
  return null;
}

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

/** Plan + billing fields a workspace should have for a given subscription state. */
export function workspaceBillingFrom(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const paidPlan = planForPrice(item?.price?.id);
  const active = ACTIVE_STATUSES.has(sub.status);
  return {
    plan: (active && paidPlan ? paidPlan : "FREE") as PlanId,
    stripeSubscriptionId: active ? sub.id : null,
    subscriptionStatus: sub.status,
    currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
  };
}

export type PlanId = "FREE" | "PRO" | "BUSINESS";

export interface PlanDef {
  id: PlanId;
  name: string;
  /** Monthly price in USD, display only. The amount charged comes from the Stripe price. */
  price: number;
  blurb: string;
  limits: {
    contacts: number;
    seats: number;
    /** Channels in addition to the built-in website chat. */
    channels: number;
    flows: number;
    broadcastsPerMonth: number;
  };
  features: string[];
  /** Name of the env var holding the Stripe price id for this plan. */
  stripePriceEnv?: string;
}

const UNLIMITED = 1_000_000_000;

export const PLANS: Record<PlanId, PlanDef> = {
  FREE: {
    id: "FREE",
    name: "Free",
    price: 0,
    blurb: "Everything you need to launch your first chatbot.",
    limits: { contacts: 1_000, seats: 1, channels: 1, flows: 10, broadcastsPerMonth: 5 },
    features: [
      "Up to 1,000 contacts",
      "Website chat + 1 messaging channel",
      "Visual flow builder",
      "10 automation flows",
      "Live chat inbox",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    price: 29,
    blurb: "For growing businesses that sell and support in chat.",
    limits: { contacts: 10_000, seats: 5, channels: 10, flows: UNLIMITED, broadcastsPerMonth: UNLIMITED },
    features: [
      "Up to 10,000 contacts",
      "All channels",
      "Unlimited flows & broadcasts",
      "5 team seats",
      "Webhooks & REST API",
    ],
    stripePriceEnv: "STRIPE_PRICE_PRO",
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    price: 99,
    blurb: "Scale with bigger audiences and a larger team.",
    limits: { contacts: 100_000, seats: 25, channels: 50, flows: UNLIMITED, broadcastsPerMonth: UNLIMITED },
    features: [
      "Up to 100,000 contacts",
      "All channels",
      "Unlimited flows & broadcasts",
      "25 team seats",
      "Priority support",
    ],
    stripePriceEnv: "STRIPE_PRICE_BUSINESS",
  },
};

export const PLAN_ORDER: PlanId[] = ["FREE", "PRO", "BUSINESS"];

export function planOf(id: string | null | undefined): PlanDef {
  return PLANS[(id as PlanId) ?? "FREE"] ?? PLANS.FREE;
}

export function isUnlimited(n: number) {
  return n >= UNLIMITED;
}

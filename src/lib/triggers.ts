import { z } from "zod";

const keywordConfig = z.object({
  keywords: z
    .array(z.string().trim().min(1).max(60))
    .min(1, "Add at least one keyword")
    .max(30)
    .transform((list) => [...new Set(list.map((k) => k.toLowerCase()))]),
  match: z.enum(["contains", "exact", "starts_with"]),
});

const refConfig = z.object({
  ref: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{1,40}$/, "Use up to 40 letters, numbers, dashes or underscores"),
});

const defaultReplyConfig = z.object({ frequency: z.enum(["always", "daily"]) });

/** Trigger type + its type-specific config. */
export const triggerInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("KEYWORD"), config: keywordConfig }),
  z.object({ type: z.literal("REF_LINK"), config: refConfig }),
  z.object({ type: z.literal("WELCOME"), config: z.object({}).default({}) }),
  z.object({ type: z.literal("DEFAULT_REPLY"), config: defaultReplyConfig.default({ frequency: "always" }) }),
]);

export const triggerConfigFor = {
  KEYWORD: keywordConfig,
  REF_LINK: refConfig,
  WELCOME: z.object({}),
  DEFAULT_REPLY: defaultReplyConfig,
} as const;

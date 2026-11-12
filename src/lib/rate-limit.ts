import { db } from "./db";
import { ApiError } from "./api";

/**
 * Fixed-window rate limiter stored in Postgres so it holds across instances.
 * Returns the number of hits in the current window (including this one).
 */
export async function hit(key: string, windowSeconds: number): Promise<number> {
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < now()
        THEN now() + make_interval(secs => ${windowSeconds}) ELSE "RateLimit"."resetAt" END
    RETURNING "count"`;
  return Number(rows[0]?.count ?? 1);
}

/** Throws a 429 when `limit` is exceeded within the window. */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const count = await hit(key, windowSeconds);
  if (count > limit) {
    throw new ApiError(429, "Too many requests. Please slow down and try again shortly.");
  }
}

export async function purgeExpiredRateLimits() {
  await db.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < now() - interval '1 hour'`;
}

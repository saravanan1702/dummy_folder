import { db } from "../db";
import { purgeExpiredRateLimits } from "../rate-limit";

export type JobType = "flow.resume" | "broadcast.start" | "broadcast.batch";

const MAX_ATTEMPTS = 3;

export async function enqueue(type: JobType, payload: Record<string, unknown>, runAt: Date = new Date()) {
  await db.job.create({ data: { type, payload: payload as object, runAt } });
}

interface ClaimedJob {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
}

async function claim(limit: number): Promise<ClaimedJob[]> {
  // SKIP LOCKED lets several app instances poll the same queue without double-processing.
  return db.$queryRaw<ClaimedJob[]>`
    UPDATE "Job" SET "status" = 'RUNNING', "lockedAt" = now(), "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT "id" FROM "Job"
      WHERE ("status" = 'PENDING' AND "runAt" <= now())
         OR ("status" = 'RUNNING' AND "lockedAt" < now() - interval '10 minutes')
      ORDER BY "runAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "type", "payload", "attempts"`;
}

async function run(job: ClaimedJob) {
  switch (job.type) {
    case "flow.resume": {
      const { resumeRun } = await import("./runner");
      await resumeRun(String(job.payload.runId));
      return;
    }
    case "broadcast.start": {
      const { startBroadcast } = await import("./broadcast");
      await startBroadcast(String(job.payload.broadcastId));
      return;
    }
    case "broadcast.batch": {
      const { sendBroadcastBatch } = await import("./broadcast");
      await sendBroadcastBatch(String(job.payload.broadcastId), (job.payload.cursor as string | null) ?? null);
      return;
    }
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

/** Processes due jobs. Returns how many were handled. Safe to call concurrently. */
export async function processDueJobs(opts: { batch?: number; budgetMs?: number } = {}): Promise<number> {
  const batch = opts.batch ?? 10;
  const deadline = Date.now() + (opts.budgetMs ?? 20_000);
  let handled = 0;

  while (Date.now() < deadline) {
    const jobs = await claim(batch);
    if (jobs.length === 0) break;
    for (const job of jobs) {
      try {
        await run(job);
        await db.job.update({ where: { id: job.id }, data: { status: "DONE", lockedAt: null, lastError: null } });
      } catch (err) {
        const message = err instanceof Error ? err.message.slice(0, 1000) : "Job failed";
        console.error(`[jobs] ${job.type} ${job.id} failed (attempt ${job.attempts}):`, message);
        const retry = job.attempts < MAX_ATTEMPTS;
        await db.job.update({
          where: { id: job.id },
          data: {
            status: retry ? "PENDING" : "FAILED",
            lockedAt: null,
            lastError: message,
            runAt: retry ? new Date(Date.now() + job.attempts * 30_000) : undefined,
          },
        });
      }
      handled++;
    }
  }
  return handled;
}

let lastCleanup = 0;

/** One scheduler tick: run due jobs and occasionally prune old bookkeeping rows. */
export async function tick(): Promise<{ processed: number }> {
  const processed = await processDueJobs();
  if (Date.now() - lastCleanup > 3_600_000) {
    lastCleanup = Date.now();
    await db.job.deleteMany({ where: { status: "DONE", createdAt: { lt: new Date(Date.now() - 3 * 86_400_000) } } });
    await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    await purgeExpiredRateLimits();
  }
  return { processed };
}

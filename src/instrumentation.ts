/**
 * In-process scheduler for long-running servers (Docker, VPS, Railway, Render…).
 * It polls the Postgres job queue for flow delays and broadcasts. Several app
 * instances can run it at once – jobs are claimed with SKIP LOCKED.
 *
 * On serverless hosts set DISABLE_INTERNAL_SCHEDULER=1 and call /api/cron/tick instead.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DISABLE_INTERNAL_SCHEDULER === "1" || process.env.VERCEL) return;

  const g = globalThis as unknown as { __schedulerStarted?: boolean };
  if (g.__schedulerStarted) return;
  g.__schedulerStarted = true;

  const { tick } = await import("./lib/engine/jobs");
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await tick();
    } catch (err) {
      console.error("[scheduler] tick failed", err);
    } finally {
      running = false;
    }
  }, 2_000);
  timer.unref?.();
}

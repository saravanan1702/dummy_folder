import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { tick } from "@/lib/engine/jobs";

export const maxDuration = 60;

/**
 * Runs due background jobs (flow delays, broadcasts). Only needed on serverless
 * hosts, where the in-process scheduler can't run: point a cron at this URL once
 * a minute with `Authorization: Bearer $CRON_SECRET`.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  const header = req.headers.get("authorization") ?? "";
  if (!safeEqual(header, `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await tick());
}

export const GET = handle;
export const POST = handle;

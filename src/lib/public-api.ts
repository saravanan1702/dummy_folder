import { NextResponse, type NextRequest } from "next/server";
import type { Workspace } from "@/generated/prisma/client";
import { ApiError, errorResponse } from "./api";
import { sha256 } from "./crypto";
import { db } from "./db";
import { rateLimit } from "./rate-limit";

interface PublicArgs<P> {
  req: NextRequest;
  params: P;
  workspace: Workspace;
}

/** Route handler for the public REST API, authenticated with `Authorization: Bearer <api key>`. */
export function withApiKey<P = Record<string, never>>(fn: (args: PublicArgs<P>) => Promise<unknown>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      const header = req.headers.get("authorization") ?? "";
      const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
      if (!key.startsWith("cv_")) throw new ApiError(401, "Missing or malformed API key");

      const row = await db.apiKey.findUnique({ where: { keyHash: sha256(key) }, include: { workspace: true } });
      if (!row) throw new ApiError(401, "Invalid API key");
      if (row.workspace.plan === "FREE") throw new ApiError(402, "The REST API requires a paid plan");

      await rateLimit(`apikey:${row.id}`, 120, 60);
      if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
        await db.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
      }

      const result = await fn({ req, params: await ctx.params, workspace: row.workspace });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function publicContact(c: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  fields: unknown;
  createdAt: Date;
  lastInboundAt: Date | null;
  channel: { type: string };
  tags: { tag: { name: string } }[];
}) {
  return {
    id: c.id,
    first_name: c.firstName,
    last_name: c.lastName,
    username: c.username,
    email: c.email,
    phone: c.phone,
    status: c.status.toLowerCase(),
    channel: c.channel.type.toLowerCase(),
    tags: c.tags.map((t) => t.tag.name),
    fields: c.fields ?? {},
    subscribed_at: c.createdAt,
    last_message_at: c.lastInboundAt,
  };
}

export const publicContactInclude = {
  channel: { select: { type: true } },
  tags: { include: { tag: { select: { name: true } } } },
} as const;

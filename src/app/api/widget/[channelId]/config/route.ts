import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { loadWidgetChannel, widgetConfig } from "@/lib/widget-server";

const CORS = {
  // Public, non-sensitive appearance settings read by the embed script on customer websites.
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=60",
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ channelId: string }> }) {
  try {
    const { channelId } = await ctx.params;
    const channel = await loadWidgetChannel(channelId);
    const { color, position } = widgetConfig(channel);
    return NextResponse.json({ color, position }, { headers: CORS });
  } catch (err) {
    const res = errorResponse(err);
    res.headers.set("access-control-allow-origin", "*");
    return res;
  }
}

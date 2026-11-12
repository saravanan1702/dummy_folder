import { authed } from "@/lib/api";
import { db } from "@/lib/db";

interface DayRow {
  day: Date;
  n: bigint;
}

function fillSeries(days: number, ...sources: DayRow[][]) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const out: { date: string; values: number[] }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({
      date,
      values: sources.map((rows) => Number(rows.find((r) => r.day.toISOString().slice(0, 10) === date)?.n ?? 0)),
    });
  }
  return out;
}

export const GET = authed(async ({ req, workspace }) => {
  const days = Math.min(90, Math.max(7, Number.parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10) || 30));
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const prevSince = new Date(since.getTime() - days * 86_400_000);
  const ws = workspace.id;

  const [
    totalContacts,
    newContacts,
    prevNewContacts,
    messagesOut,
    prevMessagesOut,
    messagesIn,
    openConversations,
    flowRuns,
    prevFlowRuns,
    contactDays,
    inDays,
    outDays,
    byChannel,
    topFlows,
  ] = await Promise.all([
    db.contact.count({ where: { workspaceId: ws, isPreview: false } }),
    db.contact.count({ where: { workspaceId: ws, isPreview: false, createdAt: { gte: since } } }),
    db.contact.count({ where: { workspaceId: ws, isPreview: false, createdAt: { gte: prevSince, lt: since } } }),
    db.message.count({ where: { workspaceId: ws, direction: "OUT", createdAt: { gte: since }, contact: { isPreview: false } } }),
    db.message.count({
      where: { workspaceId: ws, direction: "OUT", createdAt: { gte: prevSince, lt: since }, contact: { isPreview: false } },
    }),
    db.message.count({ where: { workspaceId: ws, direction: "IN", createdAt: { gte: since }, contact: { isPreview: false } } }),
    db.conversation.count({ where: { workspaceId: ws, status: "OPEN", contact: { isPreview: false } } }),
    db.flowRun.count({ where: { workspaceId: ws, preview: false, createdAt: { gte: since } } }),
    db.flowRun.count({ where: { workspaceId: ws, preview: false, createdAt: { gte: prevSince, lt: since } } }),
    db.$queryRaw<DayRow[]>`
      SELECT date_trunc('day', "createdAt") AS day, count(*) AS n FROM "Contact"
      WHERE "workspaceId" = ${ws} AND "isPreview" = false AND "createdAt" >= ${since} GROUP BY 1`,
    db.$queryRaw<DayRow[]>`
      SELECT date_trunc('day', m."createdAt") AS day, count(*) AS n FROM "Message" m
      JOIN "Contact" c ON c."id" = m."contactId"
      WHERE m."workspaceId" = ${ws} AND m."direction" = 'IN' AND c."isPreview" = false AND m."createdAt" >= ${since} GROUP BY 1`,
    db.$queryRaw<DayRow[]>`
      SELECT date_trunc('day', m."createdAt") AS day, count(*) AS n FROM "Message" m
      JOIN "Contact" c ON c."id" = m."contactId"
      WHERE m."workspaceId" = ${ws} AND m."direction" = 'OUT' AND c."isPreview" = false AND m."createdAt" >= ${since} GROUP BY 1`,
    db.$queryRaw<{ type: string; n: bigint }[]>`
      SELECT ch."type"::text AS type, count(c.*) AS n FROM "Channel" ch
      LEFT JOIN "Contact" c ON c."channelId" = ch."id" AND c."isPreview" = false
      WHERE ch."workspaceId" = ${ws} GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ id: string; name: string; n: bigint }[]>`
      SELECT f."id", f."name", count(r.*) AS n FROM "Flow" f
      JOIN "FlowRun" r ON r."flowId" = f."id" AND r."preview" = false AND r."createdAt" >= ${since}
      WHERE f."workspaceId" = ${ws} GROUP BY f."id", f."name" ORDER BY 3 DESC LIMIT 5`,
  ]);

  return {
    days,
    totals: {
      contacts: totalContacts,
      newContacts,
      prevNewContacts,
      messagesOut,
      prevMessagesOut,
      messagesIn,
      openConversations,
      flowRuns,
      prevFlowRuns,
    },
    contactSeries: fillSeries(days, contactDays).map((d) => ({ date: d.date, value: d.values[0] })),
    messageSeries: fillSeries(days, inDays, outDays).map((d) => ({ date: d.date, received: d.values[0], sent: d.values[1] })),
    channels: byChannel.map((c) => ({ type: c.type, contacts: Number(c.n) })),
    topFlows: topFlows.map((f) => ({ id: f.id, name: f.name, runs: Number(f.n) })),
  };
});

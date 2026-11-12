import { sign, verifySignature } from "./crypto";

/** Visitor ids are random and client-generated; the token proves the server issued that id for this channel. */
export function widgetToken(channelId: string, visitorId: string): string {
  return sign(`${channelId}:${visitorId}`, "widget");
}

export function verifyWidgetToken(channelId: string, visitorId: string, token: string): boolean {
  if (!visitorId || !token) return false;
  return verifySignature(`${channelId}:${visitorId}`, "widget", token);
}

export const VISITOR_ID_RE = /^[a-zA-Z0-9_-]{8,80}$/;

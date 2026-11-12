"use client";

import { createContext, useContext } from "react";

export interface TriggerSummary {
  id: string;
  type: "KEYWORD" | "WELCOME" | "DEFAULT_REPLY" | "REF_LINK";
  enabled: boolean;
  config: { keywords?: string[]; match?: string; ref?: string; frequency?: string };
}

export interface BuilderData {
  flowId: string;
  tags: { id: string; name: string }[];
  fields: { id: string; key: string; label: string; type: string }[];
  flows: { id: string; name: string; status: string }[];
  triggers: TriggerSummary[];
  /** Node ids that have a publish-blocking problem. */
  problemNodes: Set<string>;
  refreshTags: () => void;
  refreshTriggers: () => void;
}

export const BuilderContext = createContext<BuilderData | null>(null);

export function useBuilder(): BuilderData {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error("useBuilder must be used inside the flow builder");
  return ctx;
}

export function describeTrigger(t: TriggerSummary): string {
  switch (t.type) {
    case "KEYWORD": {
      const how = t.config.match === "exact" ? "is" : t.config.match === "starts_with" ? "starts with" : "contains";
      return `Message ${how} ${(t.config.keywords ?? []).map((k) => `"${k}"`).join(", ")}`;
    }
    case "WELCOME":
      return "A new contact's first message";
    case "DEFAULT_REPLY":
      return t.config.frequency === "daily" ? "No other flow matches (once a day)" : "No other flow matches";
    case "REF_LINK":
      return `Opens the link "${t.config.ref ?? ""}"`;
  }
}

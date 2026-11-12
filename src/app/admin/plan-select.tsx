"use client";

import { useState } from "react";

export function PlanSelect({ workspaceId, plan }: { workspaceId: string; plan: string }) {
  const [value, setValue] = useState(plan);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  return (
    <span className="flex items-center gap-2">
      <select
        aria-label="Plan"
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[13px]"
        value={value}
        onChange={async (e) => {
          const next = e.target.value;
          setValue(next);
          setState("saving");
          const res = await fetch(`/api/admin/workspaces/${workspaceId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ plan: next }),
          });
          setState(res.ok ? "saved" : "error");
        }}
      >
        <option value="FREE">Free</option>
        <option value="PRO">Pro</option>
        <option value="BUSINESS">Business</option>
      </select>
      {state === "saved" && <span className="text-xs text-mint-700">Saved</span>}
      {state === "error" && <span className="text-xs text-rose-600">Failed</span>}
    </span>
  );
}

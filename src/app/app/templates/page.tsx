"use client";

import { BellOff, CircleHelp, Gift, Hand, LayoutTemplate, Magnet, MessageCircle, Phone, Star, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { Page } from "@/components/app/shell";
import { Badge, Button, PageHeader, PageLoader, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/client";

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  keywords: string[];
  steps: number;
}

const ICONS: Record<string, LucideIcon> = {
  hand: Hand,
  message: MessageCircle,
  magnet: Magnet,
  help: CircleHelp,
  gift: Gift,
  star: Star,
  phone: Phone,
  "bell-off": BellOff,
};

export default function TemplatesPage() {
  const router = useRouter();
  const toast = useToast();
  const { data } = useSWR<{ templates: Template[] }>("/api/templates");
  const [installing, setInstalling] = useState<string | null>(null);
  const [category, setCategory] = useState("All");

  async function install(id: string) {
    setInstalling(id);
    try {
      const res = await api<{ id: string }>(`/api/templates/${id}/install`, { method: "POST" });
      router.push(`/app/automation/flows/${res.id}`);
    } catch (err) {
      toast(errorMessage(err), "error");
      setInstalling(null);
    }
  }

  const categories = ["All", ...new Set((data?.templates ?? []).map((t) => t.category))];
  const visible = (data?.templates ?? []).filter((t) => category === "All" || t.category === category);

  return (
    <Page>
      <PageHeader title="Templates" description="Ready-made flows you can install in one click, then edit to fit your business." />
      {!data ? (
        <PageLoader />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-1.5" role="group" aria-label="Category">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
                className={
                  category === c
                    ? "rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-medium text-white"
                    : "rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-50"
                }
              >
                {c}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((t) => {
              const Icon = ICONS[t.icon] ?? LayoutTemplate;
              return (
                <article key={t.id} className="card flex flex-col p-5 transition-shadow hover:shadow-pop">
                  <div className="flex items-start justify-between">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <Icon className="size-5.5" />
                    </span>
                    <Badge>{t.category}</Badge>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-ink">{t.name}</h3>
                  <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-slate-500">{t.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span className="tabular">{t.steps} steps</span>
                    {t.keywords.length > 0 && (
                      <>
                        <span aria-hidden>·</span>
                        <span>Keywords:</span>
                        {t.keywords.map((k) => (
                          <Badge key={k} tone="brand">
                            {k}
                          </Badge>
                        ))}
                      </>
                    )}
                  </div>
                  <Button variant="subtle" className="mt-4 w-full" loading={installing === t.id} disabled={installing !== null && installing !== t.id} onClick={() => install(t.id)}>
                    Use this template
                  </Button>
                </article>
              );
            })}
          </div>
        </>
      )}
    </Page>
  );
}

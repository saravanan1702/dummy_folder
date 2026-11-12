"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BillingSettings } from "@/components/app/settings/billing";
import { ChannelsSettings } from "@/components/app/settings/channels";
import { ApiSettings, FieldsSettings, GeneralSettings, ProfileSettings, TagsSettings } from "@/components/app/settings/misc";
import { TeamSettings } from "@/components/app/settings/team";
import { Page, useCanManage } from "@/components/app/shell";
import { PageHeader, Tabs } from "@/components/ui";

const TABS = [
  { id: "general", label: "General" },
  { id: "channels", label: "Channels" },
  { id: "team", label: "Team" },
  { id: "tags", label: "Tags" },
  { id: "fields", label: "Custom fields" },
  { id: "billing", label: "Billing" },
  { id: "api", label: "API", managersOnly: true },
  { id: "profile", label: "Your profile" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SettingsPage() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}

function Settings() {
  const router = useRouter();
  const params = useSearchParams();
  const canManage = useCanManage();
  const tabs = TABS.filter((t) => canManage || !("managersOnly" in t && t.managersOnly));
  const requested = params.get("tab");
  const tab: TabId = tabs.some((t) => t.id === requested) ? (requested as TabId) : "general";

  return (
    <Page>
      <PageHeader title="Settings" />
      <Tabs<TabId> value={tab} onChange={(id) => router.replace(`/app/settings?tab=${id}`)} tabs={tabs.map((t) => ({ id: t.id, label: t.label }))} />
      <div className="mt-6">
        {tab === "general" && <GeneralSettings />}
        {tab === "channels" && <ChannelsSettings />}
        {tab === "team" && <TeamSettings />}
        {tab === "tags" && <TagsSettings />}
        {tab === "fields" && <FieldsSettings />}
        {tab === "billing" && <BillingSettings />}
        {tab === "api" && <ApiSettings />}
        {tab === "profile" && <ProfileSettings />}
      </div>
    </Page>
  );
}

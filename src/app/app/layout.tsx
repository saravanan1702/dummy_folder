import type { Metadata } from "next";
import { AppShell } from "@/components/app/shell";
import { requireAuth } from "@/lib/auth";
import { loadMe } from "@/lib/me";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireAuth();
  const me = await loadMe(auth);
  return <AppShell initialMe={me}>{children}</AppShell>;
}

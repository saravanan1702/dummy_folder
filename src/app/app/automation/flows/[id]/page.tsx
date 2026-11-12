import type { Metadata } from "next";
import { FlowBuilder } from "@/components/flow/builder";

export const metadata: Metadata = { title: "Flow builder" };

export default async function FlowBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FlowBuilder flowId={id} />;
}

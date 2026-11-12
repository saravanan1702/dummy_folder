import type { Metadata } from "next";
import { WidgetChat } from "@/components/widget-chat";

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

/**
 * The website chat itself. Loaded inside an iframe by /widget.js on customer
 * sites, or opened directly as a full-page chat (handy for links and testing).
 */
export default async function WidgetPage({
  params,
  searchParams,
}: {
  params: Promise<{ channelId: string }>;
  searchParams: Promise<{ embed?: string; preview?: string; vid?: string; token?: string }>;
}) {
  const { channelId } = await params;
  const sp = await searchParams;
  const preview = sp.preview && sp.vid && sp.token ? { visitorId: sp.vid, token: sp.token } : undefined;
  return (
    <div className="mx-auto h-dvh w-full max-w-[560px] bg-white sm:shadow-pop">
      <WidgetChat channelId={channelId} preview={preview} embedded={sp.embed === "1"} />
    </div>
  );
}

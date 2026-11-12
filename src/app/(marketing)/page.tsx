import {
  ArrowRight,
  Check,
  GitBranch,
  LayoutTemplate,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  Play,
  Rocket,
  Tag,
  Users,
  Webhook,
  Workflow,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { ChannelIcon, Logo, channelLabel } from "@/components/brand";
import { brand } from "@/config/brand";
import { PLAN_ORDER, PLANS } from "@/config/plans";

const CHANNELS = ["WEBCHAT", "TELEGRAM", "WHATSAPP", "MESSENGER", "INSTAGRAM"] as const;

const FEATURES = [
  {
    icon: Workflow,
    title: "Visual flow builder",
    body: "Drag, drop and connect steps to design conversations. Messages, questions, conditions, delays and A/B splits — no code.",
  },
  {
    icon: MessageCircle,
    title: "Shared live chat inbox",
    body: "Every channel in one place. The bot handles the routine; your team steps in with one click and the bot steps back.",
  },
  {
    icon: Megaphone,
    title: "Broadcasts",
    body: "Send announcements or entire flows to everyone — or just the people with the right tags. Now or on a schedule.",
  },
  {
    icon: Users,
    title: "Contacts that build themselves",
    body: "Capture names, emails and phone numbers in chat. Tag and segment automatically as people interact.",
  },
  {
    icon: Rocket,
    title: "Growth tools",
    body: "A chat widget for your website, plus links and QR codes that drop people straight into the right flow.",
  },
  {
    icon: Webhook,
    title: "Webhooks & REST API",
    body: "Push leads to your CRM the moment they arrive, and trigger messages or flows from your own systems.",
  },
];

const STEPS = [
  { title: "Connect a channel", body: "Add the chat widget to your site or link Telegram, WhatsApp, Messenger or Instagram in a couple of minutes." },
  { title: "Build your first flow", body: "Start from a template — welcome message, lead capture, FAQ — and make it yours in the visual builder." },
  { title: "Watch it work", body: "Your bot answers instantly, around the clock. You see every conversation and jump in whenever you like." },
];

const FAQ = [
  {
    q: "Do I need to know how to code?",
    a: "No. Flows are built visually by connecting steps on a canvas, and templates give you a working starting point in one click.",
  },
  {
    q: "Which channels are supported?",
    a: "Website chat works out of the box. You can also connect Telegram bots, WhatsApp (Cloud API), Facebook Messenger and Instagram DMs.",
  },
  {
    q: "Can a real person take over from the bot?",
    a: "Yes. Any conversation can be handed to your team — automatically from a flow, or the moment a teammate replies. The bot pauses so it never talks over you.",
  },
  {
    q: "What counts as a contact?",
    a: "Anyone who has messaged you on a connected channel. The free plan includes 1,000 contacts, and you can upgrade whenever you grow past that.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Paid plans are billed monthly and you can cancel or change plan whenever you want from the billing settings.",
  },
];

function FlowNodeMock({
  icon: Icon,
  title,
  chip,
  accent,
  children,
  className,
}: {
  icon: typeof Play;
  title: string;
  chip: string;
  accent: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`absolute w-[200px] rounded-2xl border border-slate-200 bg-white p-3 shadow-card ${className ?? ""}`} style={{ borderTop: `3px solid ${accent}` }}>
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex size-6 items-center justify-center rounded-md ${chip}`}>
          <Icon className="size-3.5" />
        </span>
        <span className="text-xs font-semibold text-ink">{title}</span>
      </div>
      {children}
    </div>
  );
}

/** Illustrative product mock built from plain HTML/SVG – no screenshots to keep up to date. */
function ProductMock() {
  return (
    <div className="relative mx-auto mt-14 max-w-[1040px]" aria-hidden>
      <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_40px_80px_-30px_rgba(47,32,121,0.35)]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <span className="size-2.5 rounded-full bg-slate-200" />
          <span className="size-2.5 rounded-full bg-slate-200" />
          <span className="size-2.5 rounded-full bg-slate-200" />
          <span className="ml-3 text-xs font-medium text-slate-500">Lead capture</span>
          <span className="rounded-md bg-mint-50 px-1.5 py-0.5 text-[10px] font-semibold text-mint-700">Live</span>
        </div>
        <div className="grid md:grid-cols-[1fr_300px]">
          <div
            className="relative hidden h-[400px] overflow-hidden md:block"
            style={{ backgroundColor: "#f6f6fb", backgroundImage: "radial-gradient(#d6d4e6 1.2px, transparent 1.2px)", backgroundSize: "20px 20px" }}
          >
            <svg className="absolute inset-0 h-full w-full" fill="none" stroke="#a5a1c2" strokeWidth="2">
              <path d="M232 92 C 262 92, 256 74, 286 74" />
              <path d="M486 142 C 520 142, 500 262, 310 262" strokeDasharray="0" />
              <path d="M300 320 C 280 320, 280 320, 262 320" opacity="0" />
              <path d="M486 286 C 520 286, 520 318, 544 318" />
            </svg>
            <FlowNodeMock icon={Play} title="Starting step" chip="bg-mint-100 text-mint-700" accent="#2cb67d" className="left-8 top-10">
              <div className="rounded-lg bg-mint-50 px-2 py-1.5 text-[11px] text-mint-700">Message contains &ldquo;demo&rdquo;</div>
            </FlowNodeMock>
            <FlowNodeMock icon={MessageSquareText} title="Send message" chip="bg-brand-100 text-brand-700" accent="#6246ea" className="left-[286px] top-8">
              <div className="rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] leading-snug text-slate-700">Great — let&apos;s get you set up. What&apos;s your email?</div>
              <div className="mt-1.5 rounded-md border border-brand-200 py-1 text-center text-[11px] font-medium text-brand-700">Sure!</div>
            </FlowNodeMock>
            <FlowNodeMock icon={GitBranch} title="Condition" chip="bg-teal-100 text-teal-700" accent="#14b8a6" className="left-[286px] top-[222px]">
              <div className="rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] text-slate-700">Email has any value</div>
              <div className="mt-1.5 text-right text-[11px] font-semibold text-mint-700">Yes, matches</div>
            </FlowNodeMock>
            <FlowNodeMock icon={Zap} title="Actions" chip="bg-amber-100 text-amber-700" accent="#f59e0b" className="left-[544px] top-[262px]">
              <div className="rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">Add tag &ldquo;Lead&rdquo;</div>
              <div className="mt-1 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">Send to webhook</div>
            </FlowNodeMock>
          </div>
          <div className="flex h-[400px] flex-col border-l border-slate-100">
            <div className="flex items-center gap-2.5 bg-brand-600 px-4 py-3 text-white">
              <span className="flex size-8 items-center justify-center rounded-full bg-white/20">
                <MessageCircle className="size-4" />
              </span>
              <div>
                <div className="text-[13px] font-semibold leading-tight">Chat with Acme</div>
                <div className="text-[11px] leading-tight opacity-80">We usually reply in a few minutes</div>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-hidden px-3.5 py-4 text-[13px]">
              <div className="ml-auto w-fit rounded-2xl rounded-br-md bg-brand-600 px-3 py-2 text-white">I&apos;d like a demo</div>
              <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-slate-100 px-3 py-2 text-ink">Great — let&apos;s get you set up. What&apos;s your email?</div>
              <div className="ml-auto w-fit rounded-2xl rounded-br-md bg-brand-600 px-3 py-2 text-white">sam@example.com</div>
              <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-slate-100 px-3 py-2 text-ink">Perfect, Sam. We&apos;ll be in touch shortly ✅</div>
            </div>
            <div className="mx-3 mb-3 rounded-full bg-slate-100 px-4 py-2.5 text-[13px] text-slate-400">Type a message…</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-white">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1160px] items-center gap-8 px-5">
          <Link href="/" aria-label={`${brand.name} home`}>
            <Logo />
          </Link>
          <nav className="hidden flex-1 items-center gap-7 text-sm font-medium text-slate-600 md:flex" aria-label="Primary">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Sign in
            </Link>
            <Link href="/signup" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-5 pb-20 pt-16 sm:pt-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[620px]"
            style={{ background: "radial-gradient(50% 60% at 50% 0%, rgba(114,89,238,0.16) 0%, transparent 70%)" }}
          />
          <div className="relative mx-auto max-w-[820px] text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[13px] font-medium text-brand-700">
              <Zap className="size-3.5" /> No-code chat automation
            </span>
            <h1 className="mt-6 text-[40px] font-extrabold leading-[1.08] text-ink sm:text-[58px]">
              Turn conversations into customers, <span className="text-brand-600">automatically</span>.
            </h1>
            <p className="mx-auto mt-5 max-w-[620px] text-[17px] leading-relaxed text-slate-600">
              Build chatbots visually, answer instantly on your website and messaging apps, and step in live whenever a human touch matters.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-6 text-[15px] font-semibold text-white shadow-[0_10px_24px_-8px_rgba(98,70,234,0.7)] hover:bg-brand-700">
                Start for free <ArrowRight className="size-4" />
              </Link>
              <a href="#how" className="inline-flex h-12 items-center rounded-xl border border-slate-300 bg-white px-6 text-[15px] font-semibold text-ink hover:bg-slate-50">
                See how it works
              </a>
            </div>
            <p className="mt-4 text-[13px] text-slate-500">Free for your first 1,000 contacts · No credit card required</p>
          </div>
          <ProductMock />
        </section>

        {/* Channels */}
        <section className="border-y border-slate-100 bg-canvas px-5 py-10">
          <div className="mx-auto max-w-[1160px] text-center">
            <p className="text-sm font-medium text-slate-500">One bot and one inbox for every place your customers chat</p>
            <ul className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {CHANNELS.map((c) => (
                <li key={c} className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-2 pl-2.5 pr-4 text-sm font-medium text-ink shadow-card">
                  <ChannelIcon type={c} size={26} className="rounded-full" /> {channelLabel(c)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 px-5 py-20">
          <div className="mx-auto max-w-[1160px]">
            <div className="mx-auto max-w-[640px] text-center">
              <h2 className="text-[32px] font-bold leading-tight text-ink sm:text-[38px]">Everything you need to sell and support in chat</h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600">From the first hello to the follow-up a week later — automated where it helps, human where it counts.</p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <article key={f.title} className="rounded-2xl border border-slate-200 p-6 transition-shadow hover:shadow-pop">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <f.icon className="size-5.5" />
                  </span>
                  <h3 className="mt-4 text-[17px] font-semibold text-ink">{f.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">{f.body}</p>
                </article>
              ))}
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="flex items-start gap-4 rounded-2xl bg-brand-950 p-6 text-white">
                <LayoutTemplate className="mt-0.5 size-6 shrink-0 text-brand-300" />
                <div>
                  <h3 className="text-[17px] font-semibold">Start from a template</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-brand-100">Welcome messages, lead capture, FAQs, coupon giveaways and feedback surveys — installed in one click.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 rounded-2xl bg-mint-50 p-6">
                <Tag className="mt-0.5 size-6 shrink-0 text-mint-700" />
                <div>
                  <h3 className="text-[17px] font-semibold text-ink">Personal at any scale</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-slate-700">Greet people by name, remember their answers and branch on tags so every reply feels written for them.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 bg-canvas px-5 py-20">
          <div className="mx-auto max-w-[1160px]">
            <h2 className="text-center text-[32px] font-bold leading-tight text-ink sm:text-[38px]">Live in three steps</h2>
            <ol className="mt-12 grid gap-5 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <span className="flex size-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
                  <h3 className="mt-4 text-[17px] font-semibold text-ink">{s.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 px-5 py-20">
          <div className="mx-auto max-w-[1040px]">
            <div className="text-center">
              <h2 className="text-[32px] font-bold leading-tight text-ink sm:text-[38px]">Simple pricing that grows with you</h2>
              <p className="mt-3 text-base text-slate-600">Start free. Upgrade when your audience does.</p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {PLAN_ORDER.map((id) => {
                const plan = PLANS[id];
                const featured = id === "PRO";
                return (
                  <article key={id} className={`relative flex flex-col rounded-2xl border p-7 ${featured ? "border-brand-500 shadow-[0_24px_50px_-24px_rgba(98,70,234,0.55)]" : "border-slate-200"}`}>
                    {featured && <span className="absolute -top-3 left-7 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">Most popular</span>}
                    <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>
                    <p className="mt-1 min-h-10 text-sm leading-snug text-slate-500">{plan.blurb}</p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-[42px] font-extrabold leading-none text-ink">${plan.price}</span>
                      <span className="text-sm text-slate-500">/ month</span>
                    </div>
                    <ul className="mt-6 flex-1 space-y-2.5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                          <Check className="mt-0.5 size-4 shrink-0 text-mint-600" strokeWidth={2.5} /> {f}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/signup"
                      className={`mt-7 inline-flex h-11 items-center justify-center rounded-xl text-sm font-semibold ${
                        featured ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-slate-300 text-ink hover:bg-slate-50"
                      }`}
                    >
                      {id === "FREE" ? "Start for free" : `Get started with ${plan.name}`}
                    </Link>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 bg-canvas px-5 py-20">
          <div className="mx-auto max-w-[760px]">
            <h2 className="text-center text-[32px] font-bold leading-tight text-ink sm:text-[38px]">Questions, answered</h2>
            <div className="mt-10 space-y-3">
              {FAQ.map((item) => (
                <details key={item.q} className="group rounded-2xl border border-slate-200 bg-white px-6 py-4">
                  <summary className="flex list-none items-center justify-between gap-4 text-base font-semibold text-ink [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 py-20">
          <div className="relative mx-auto max-w-[1040px] overflow-hidden rounded-[28px] bg-brand-950 px-8 py-14 text-center">
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: "radial-gradient(50% 80% at 85% 0%, rgba(143,122,244,.5) 0%, transparent 70%), radial-gradient(40% 70% at 10% 100%, rgba(44,182,125,.3) 0%, transparent 70%)" }}
            />
            <div className="relative">
              <h2 className="mx-auto max-w-[560px] text-[30px] font-bold leading-tight text-white sm:text-[36px]">Your next customer is already typing.</h2>
              <p className="mx-auto mt-3 max-w-[480px] text-base text-brand-100">Launch a bot that answers in seconds — and hands over to you when it matters.</p>
              <Link href="/signup" className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-brand-700 hover:bg-brand-50">
                Create your free account <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 px-5 py-10">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-4">
          <Logo />
          <nav className="flex flex-wrap gap-6 text-sm text-slate-500" aria-label="Footer">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
            <Link href="/login" className="hover:text-ink">Sign in</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <a href={`mailto:${brand.supportEmail}`} className="hover:text-ink">Contact</a>
          </nav>
          <p className="text-sm text-slate-400">© {new Date().getFullYear()} {brand.name}</p>
        </div>
      </footer>
    </div>
  );
}

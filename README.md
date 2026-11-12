# Convoly — chat marketing & automation SaaS

A full multi-tenant SaaS for building chatbots and automating conversations on **website chat, Telegram, WhatsApp, Messenger and Instagram** — with a visual flow builder, shared live-chat inbox, contacts CRM, broadcasts, growth tools, team seats, Stripe billing and a public REST API.

> The name, logo and colours are placeholders. Rebrand in `src/config/brand.ts` (name/tagline), `src/app/globals.css` (colour tokens) and `src/components/brand.tsx` + `public/icon.svg` (logo).

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js 16** (App Router, React 19, TypeScript) | One codebase for marketing site, dashboard, API and webhooks |
| Database | **PostgreSQL** + **Prisma 7** | Relational data, migrations, type-safe queries |
| Background jobs | Postgres job queue (`SELECT … FOR UPDATE SKIP LOCKED`) | Flow delays & broadcasts with no Redis needed; safe across multiple instances |
| UI | Tailwind CSS 4, React Flow (`@xyflow/react`), Lucide icons, SWR | |
| Billing | Stripe Checkout + Customer Portal + webhooks | |
| Email | Resend (optional) | Invites & password resets; logged to console if unset |

## Features

- **Visual flow builder** — messages (text, images, buttons, quick replies), questions with validation that save to fields, conditions, actions (tags, fields, subscribe, human handoff, webhooks), waits, A/B randomizer, jump to another flow. Autosave, draft vs. published versions, publish-time validation, live preview.
- **Triggers** — keywords (exact / starts with / contains), welcome message, default reply, ref links / QR codes.
- **Live Chat inbox** — every channel in one inbox, assignment, open/closed, unread counts, automatic bot pause when a human replies.
- **Contacts** — search, filters, tags, custom fields, bulk actions, CSV export, profile drawer, send a flow manually.
- **Broadcasts** — text or a whole flow, tag-based audiences, live reach count, scheduling, progress, cancel. Respects the 24-hour window on Meta channels.
- **Growth tools** — embeddable chat widget (`<script>` snippet) with appearance settings, direct chat link, QR codes, Telegram/Messenger deep links.
- **Templates** — 8 ready-made flows installed in one click.
- **Workspaces & team** — multiple workspaces per user, Owner / Admin / Agent roles, email invites.
- **Plans & limits** — Free / Pro / Business limits enforced server-side (`src/config/plans.ts`).
- **REST API** — API keys, `/api/v1/contacts` (list, get, tag, message, start flow).
- **Platform admin** — `/admin` for the owners listed in `SUPERADMIN_EMAILS`: all customers, plans, MRR, usage, manual plan changes.
- **Legal pages** — `/terms` and `/privacy` templates (fill in `src/config/legal.ts`, have them reviewed).
- **Security** — scrypt passwords, hashed session & API tokens, CSRF origin checks, AES-256-GCM encrypted channel credentials, signed webhooks (Telegram secret header, Meta `X-Hub-Signature-256`, Stripe), SSRF-guarded customer webhooks, Postgres-backed rate limiting, tenant scoping on every query.

## Run locally

Requirements: Node 20.9+ and PostgreSQL 14+.

```bash
cp .env.example .env        # then set DATABASE_URL and APP_SECRET
npm install
npx prisma migrate deploy
npm run db:seed             # optional demo data: demo@example.com / demo12345
npm run dev                 # http://localhost:3000
```

Or everything in Docker:

```bash
docker compose up --build   # http://localhost:3000
```

Useful scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

End-to-end tests for Telegram, WhatsApp, Messenger, Instagram and Stripe run against local simulators — see `tests/e2e/README.md`.

## Deploying to production

The app is a single Node service plus Postgres, so any of these work:

- **Render (easiest)** — the repo includes `render.yaml`. In Render choose *New → Blueprint*, pick this repo, and it creates the database and web service for you. The public URL is detected automatically.
- **Railway / Fly.io / a VPS** — deploy the `Dockerfile`. The container applies migrations on start, and the built-in scheduler processes flow delays and broadcasts. Add a managed Postgres and set the env vars below.
- **Vercel** — works too; set `DISABLE_INTERNAL_SCHEDULER=1` and `CRON_SECRET`, and call `GET /api/cron/tick` every minute with `Authorization: Bearer $CRON_SECRET` (Vercel Cron or any external cron).

Required environment variables:

| Variable | |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `APP_SECRET` | ≥ 32 random characters (`openssl rand -base64 48`). Encrypts channel credentials — don't change it after go-live |
| `APP_URL` | Public `https://` URL. Telegram and Meta deliver webhooks here |

Optional: `STRIPE_*` (billing), `RESEND_API_KEY` + `EMAIL_FROM` (email), `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_SUPPORT_EMAIL`. See `.env.example`.

### Stripe setup

1. Create two recurring Prices (Pro, Business) and put their ids in `STRIPE_PRICE_PRO` / `STRIPE_PRICE_BUSINESS`.
2. Add a webhook endpoint `https://YOUR_APP/api/webhooks/stripe` for `checkout.session.completed` and `customer.subscription.created|updated|deleted`; put its signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Enable the Customer Portal in Stripe settings.

### Channels

- **Telegram**: customers paste a BotFather token; the webhook is registered automatically (needs a public `APP_URL`).
- **WhatsApp / Messenger / Instagram**: each workspace connects its own Meta app (token + app secret). After connecting, the dashboard shows the callback URL and verify token to paste into the Meta app's Webhooks settings. For a fully managed "Login with Facebook" onboarding you would add Meta app review and Embedded Signup on top of this.

## Project layout

```
prisma/                schema, migrations, seed
src/app/(marketing)    landing page
src/app/(auth)         login, signup, password reset, invites
src/app/app            dashboard pages
src/app/api            internal API, public v1 API, webhooks, widget, cron
src/app/widget         the website chat (iframe target)
src/components         UI kit, app shell, flow builder, charts
src/lib/engine         automation engine: inbound routing, flow runner, jobs, broadcasts
src/lib/channels       Telegram & Meta adapters
src/config             brand + plans
public/widget.js       embed script for customer websites
```

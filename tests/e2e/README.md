# End-to-end tests against simulated providers

These exercise the real app against local stand-ins for the Telegram Bot API,
Meta Graph API and Stripe API — no real accounts needed.

1. Start the stubs: `node tests/e2e/mock-providers.js & node tests/e2e/mock-stripe.js &`
2. Add to `.env` and start the app with `npm run dev`:
   ```
   TELEGRAM_API_BASE="http://localhost:4010"
   META_GRAPH_BASE="http://localhost:4010"
   STRIPE_API_BASE="http://localhost:4012"
   STRIPE_SECRET_KEY="sk_test_dummy"
   STRIPE_WEBHOOK_SECRET="whsec_testsecret"
   STRIPE_PRICE_PRO="price_pro"
   STRIPE_PRICE_BUSINESS="price_biz"
   ```
3. Run: `psql "$DATABASE_URL" -c "DELETE FROM \"Channel\" WHERE type <> 'WEBCHAT'"` (fresh channels), then
   `python3 tests/e2e/channels.py` and `node tests/e2e/stripe.mjs`.

Never set the `*_API_BASE` variables in production.

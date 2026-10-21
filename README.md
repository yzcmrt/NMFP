# NMFP — Telegram garage game

A Next.js Telegram Mini App for collecting virtual cars, managing garages and earning in-game NMFP points. Purchases use Telegram Stars. NMFP points and game items have no cash value; this release does not mint NFTs or accept TON deposits.

## Development

Use Node.js 22 or 24. Install with `npm ci`, configure `.env.local`, then run `npm run dev`.

Required server variables: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `SESSION_SECRET` (at least 32 random characters), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

Public variables: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WEBAPP_URL`, `NEXT_PUBLIC_TON_MANIFEST_URL`, `NEXT_PUBLIC_WEB3FORMS_KEY`. Never prefix server credentials with `NEXT_PUBLIC_`. The historical bot/Pinata credentials must be rotated because the previous app exposed them to browsers.

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. `tests/database-rollback.sql` exercises signup, starter assets, mining and Stars fulfillment in a transaction that must be rolled back. Use it against a staging database or append it to the recovery migrations inside BEGIN / ROLLBACK; never run its fixture as a committed production transaction.

## Architecture

Telegram initData is checked on the server (HMAC and freshness). An HttpOnly signed session scopes all reads and mutations to its owner. Browsers contain no Supabase credentials. Game mutations lock the account row; mining completion and payment fulfillment are idempotent. Client payment callbacks are not proof of payment.

Stars checkout creates a server-priced invoice. The webhook verifies its secret, currency, amount and owner before fulfillment. A duplicate item purchase is recorded for refund and refunded through Telegram; transient errors return 500 for retry. The Wallet view shows server-confirmed order history. `/terms`, `/support`, `/paysupport` cover purchase information and support. The 199-Star auto-mining plan lasts 365 days, does not renew automatically, and spends only in-game NMFP on maintenance.

## Deployment

Deploy this repository as a Next.js project on Vercel. Set the required environment variables for the intended environment. Apply the recovery migrations dated 20261019, 20261020 and 20261021 to the existing NMFP schema in order, after a backup. They preserve accounts and inventory, restrict anonymous database access, replace conflicting mining triggers and consolidate mining processing under the `nmfp-mining-v2` cron job.

Configure the bot webhook to `<SITE_URL>/api/telegram/webhook` with `secret_token=TELEGRAM_WEBHOOK_SECRET` and allowed updates `message,pre_checkout_query`. Set the bot menu button to `<SITE_URL>/gamefi`. The Main Mini App URL, if configured in BotFather, must use the same URL. Check `getWebhookInfo` after publishing. A standalone polling bot is no longer needed.

The former NFT scaffolding, unauthenticated IPFS routes, direct TON purchase grants and debug mining page have been removed. Their history remains in Git. Optional TonConnect only displays a connected address; it does not sign messages or authorize game purchases.

## Gameplay consistency

`GET /api/game` returns an owner-scoped snapshot in one SQL statement. Completed mining history is excluded from active controls. The shared provider refreshes after mutations and polls only visible pages; home and inventory use the same car controls. Server-side row locks and an active-session unique index protect repeated requests. Maintenance prices use the model-specific proportional cost rounded up; garage bonuses enforce a full 24-hour cooldown.

Run `tests/gameplay-rollback.sql` and `tests/database-rollback.sql` inside BEGIN / ROLLBACK after the migrations, never as committed production fixtures. Apply the two 20261021 migrations before deploying their application code. Historical unknown reward amounts are displayed as unknown and are not paid again.

The channel-join task is inactive until the bot can read membership for the configured channel. Unsupported NFT/manual/test tasks are inactive; existing completion history is retained. See [the gameplay and NFT audit](docs/gameplay-audit-2026-10-21.md) for findings, validation scope and NFT prerequisites.

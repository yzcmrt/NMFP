# NMFP automatic NFT delivery — 22 October 2026

## Two purchase paths

- Existing owned, unsold car → collectible NFT: **50 Stars**.
- New car + collectible NFT: existing catalogue Stars price + **50 Stars**. The normal Stars car multiplier remains 1.2.
- NFT transfer/sale does not transfer the in-game car, balance, or mining progress. This is stated before checkout and in metadata and terms. No token approval, TON transfer, or message signature is requested from players; Telegram confirms their Stars payment.

## What was wrong

The old client sent TON to a game payment wallet without an NFT mint payload, uploaded metadata without attaching it to the mint, and treated the wallet's returned BOC as successful minting. The supplied collection exists, but it is owner-controlled. A normal player or the different payment wallet cannot mint into it. The previous environment also supplied NEXT_PUBLIC_NFT_COLLECTION_ADDRESS while an unused helper read NFT_COLLECTION_ADDRESS.

Collection: `EQAT4ednFN_CBE_Bo2KMZQe15FrMHp9Z0KcAmm1v3opelKWY`.
Verified owner before setup: `UQCKVuuE0CLlLeiA84ymgZiLHaaCEgzchffasQtZ1VqEF0aj`.
Verified collection code hash: `64bb2d4661b5f2dc1a83bf5cbbe09e92ac0b460a1b879a5519386fca4c348bca`.
Read-only snapshot: zero items; common metadata prefix points to Getgems. Supplying a complete custom URL as item content would concatenate the wrong prefix. The setup changes that prefix while retaining collection metadata and royalty.

## Delivery and failure handling

Telegram successful_payment is verified server-side. One SQL transaction records payment, creates the car if applicable, and queues a unique NFT job. A minute scheduler calls a protected worker. One database lease and one in-flight job serialize the collection index and dedicated Wallet V4 sequence.

The worker persists the signed BOC before broadcasting. Network retries reuse that exact transfer; they do not mint another index. It verifies the on-chain NFT index, collection, recipient and request metadata before marking delivery complete. A consumed wallet sequence without a verifiable NFT enters review and disables new NFT sales; an operator must reconcile the chain before retry/refund. Never automatically refund a possibly delivered NFT. Low funds stop new signing and checkout but do not stop confirmation of an already delivered NFT.

The public metadata endpoint exposes only the immutable product snapshot, not Telegram identity, wallet secrets, order details or signed BOC. Metadata and images depend on the application's URL and database remaining available; they are not decentralized IPFS storage. Retain backups and the nmfp.vercel.app project alias.

## One-time activation runbook

1. `node scripts/create-nft-signer.mjs` creates a fresh dedicated, unfunded Wallet V4 and ignored `.env.nft.local` with mode 0600. It refuses overwrite. Back this file up privately. Never reuse the mnemonic previously shared in chat. Never expose these variables with NEXT_PUBLIC.
2. Provision NFT_SIGNER_MNEMONIC, NFT_SIGNER_ADDRESS, NFT_WORKER_SECRET and optional TON_RPC_API_KEY as server-only production variables. Keep NFT_AUTO_MINT_ENABLED=false during setup. A hot signer can control the collection and spend its own TON balance; keep its funds limited and restrict deployment access.
3. Apply `202610220001_nft_queue.sql`, then `202610220002_nft_schedule.sql`. The latter creates an **inactive** minute job. Store the same worker bearer in Supabase Vault named `nmfp_nft_worker_secret`, never in cron command text.
4. Open https://t.me/NMFP_bot?startapp=nftsetup to reach `/gamefi/nft-setup` through the authenticated Mini App. Connect the **current collection-owner wallet**. Personally approve metadata prefix update, then ownership transfer to the new signer. The interface prepares each exact transaction; the server never signs on behalf of the old owner. Each setup message attaches 0.1 TON plus wallet gas. Fund the displayed new V4 address for minting (at least 0.15 TON; each mint attaches 0.1 TON, including 0.05 TON for the NFT deployment; remaining funds may stay in contracts).
5. Run the read-only preflight:
   `node --env-file=.env.local --env-file=.env.nft.local --conditions=react-server --import tsx scripts/nft-preflight.ts`
6. Set NFT_AUTO_MINT_ENABLED=true in Vercel and redeploy. Enable the minute job with `SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='nmfp-nft-worker'),active:=true);`. Verify one successful worker call and fresh heartbeat before exposing checkout.
7. Verify the first real delivery with a controlled purchase only after explicit financial authorization. No mainnet payment, funding or ownership-transfer transaction was performed by the development tests.

Disabling NFT_AUTO_MINT_ENABLED closes NFT invoice/precheckout immediately on the new deployment. It also pauses workers; retain all queued jobs. Normal non-NFT Stars purchases and mining remain available.

## Validation

The actual deployed collection BOC is exercised in TON Sandbox: metadata edit, correct owner mint, NFT content/address verification, rejection of foreign mint, and owner transfer. API tests cover session scope, invalid recipients, disabled checkout, worker authentication and metadata isolation. Worker tests simulate lost broadcast responses, low-balance confirmation, and ambiguous consumed sequence. SQL rollback tests cover both purchase paths, duplicate payments, foreign car, automatic duplicate refund, worker lease and durable preparation; existing game/payment rollback tests also pass.

Reference: https://docs.ton.org/contracts/standard/tokens/nft/nft-reference
Telegram Stars: https://core.telegram.org/bots/payments-stars

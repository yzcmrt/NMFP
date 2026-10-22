// Read-only. Never broadcasts transactions or prints secrets.
import { collectionState, signer, tonClient } from "../src/server/nft/chain";
import { METADATA_PREFIX, COLLECTION } from "../src/lib/nft/contract";
import { toNano } from "@ton/core";
async function main() {
  const client = tonClient(),
    state = await collectionState(client),
    { wallet } = await signer();
  const funded = (await client.getBalance(wallet.address)) >= toNano("0.15");
  const checks = {
    collection: COLLECTION,
    signer: wallet.address.toString({ bounceable: false }),
    ownerMatches: state.owner.equals(wallet.address),
    metadataMatches: state.common === METADATA_PREFIX,
    funded,
    nextIndex: state.nextIndex.toString(),
  };
  console.log(JSON.stringify(checks, null, 2));
  if (!checks.ownerMatches || !checks.metadataMatches || !funded)
    process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "Preflight failed: check server configuration and TON RPC access. No transaction sent.",
  );
  process.exitCode = 1;
});

import { readSession, errorResponse, HttpError } from "@/server/auth";
import { collectionState, signer } from "@/server/nft/chain";
import {
  COLLECTION,
  METADATA_PREFIX,
  metadataSetupBody,
} from "@/lib/nft/contract";
import { Address, beginCell } from "@ton/core";
// Read-only transaction preparation. The current collection owner's wallet must
// independently display and authorize each on-chain change. No secret is returned.
export async function GET(request: Request) {
  try {
    readSession(request);
    const state = await collectionState();
    let target: string | null = null;
    let targetAddress: Address | null = null;
    try {
      targetAddress = (await signer()).wallet.address;
      target = targetAddress.toString({ bounceable: false });
    } catch {}
    const step =
      state.common !== METADATA_PREFIX
        ? "metadata"
        : targetAddress && !state.owner.equals(targetAddress)
          ? "owner"
          : "done";
    if (step === "metadata" && state.nextIndex !== 0n)
      throw new HttpError(
        409,
        "Koleksiyon boş değil; metadata değişikliği otomatik hazırlanamaz.",
      );
    return Response.json(
      {
        collection: COLLECTION,
        owner: state.owner.toRawString(),
        signerAddress: target,
        step,
        transaction:
          target && step !== "done"
            ? {
                validUntil: Math.floor(Date.now() / 1000) + 180,
                network: "-239",
                from: state.owner.toRawString(),
                messages: [
                  {
                    address: COLLECTION,
                    amount: "100000000",
                    payload: (step === "metadata"
                      ? metadataSetupBody(state.data)
                      : beginCell()
                          .storeUint(3, 32)
                          .storeUint(0, 64)
                          .storeAddress(targetAddress)
                          .endCell()
                    )
                      .toBoc()
                      .toString("base64"),
                  },
                ],
              }
            : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}

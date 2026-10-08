// "Key merged" (#17): a Semaphore v4 identity's private key must give the same public key and secret scalar in zk-kit (Semaphore)
// and in circomlibjs (the v4 generator / circomlib EdDSA), and a circomlibjs EdDSA-Poseidon signature with it must verify under zk-kit.
import { Identity } from "@semaphore-protocol/identity";
import { buildEddsa } from "circomlibjs"; import { Scalar } from "ffjavascript"; import createBlakeHash from "blake-hash";
import { verifySignature } from "@zk-kit/eddsa-poseidon"; import crypto from "crypto";
const ed = await buildEddsa(); const F = ed.F;
const L = 2736030358979909402780800718157159386076813972158567259200215660948447373041n;
let ok = 0; const N = 50;
for (let i = 0; i < N; i++) {
  const prv = crypto.createHash("sha256").update("human-" + i).digest();          // 32 raw bytes
  const id = new Identity(prv);
  const A = ed.prv2pub(prv);
  const s = BigInt(Scalar.shr(Scalar.fromRprLE(ed.pruneBuffer(createBlakeHash("blake512").update(Buffer.from(prv)).digest()), 0, 32), 3)) % L;
  const samePk = F.toObject(A[0]) === id.publicKey[0] && F.toObject(A[1]) === id.publicKey[1];
  const sameS = s === id.secretScalar;
  const m = 123456789n + BigInt(i); const sig = ed.signPoseidon(prv, F.e(m));
  const zkSig = { R8: [F.toObject(sig.R8[0]), F.toObject(sig.R8[1])], S: sig.S };
  const verifies = verifySignature(m, zkSig, id.publicKey);
  if (samePk && sameS && verifies) ok++; else console.error({ i, samePk, sameS, verifies });
}
console.log(JSON.stringify({ identities: N, publicKey_secretScalar_signature_all_match: ok })); process.exit(ok === N ? 0 : 1);

// Independent plaintext authorization oracle for ZK-DAC chains (T3).
// Deliberately does NOT use the circuit's Merkle/SMT machinery: registry and revocation are literal sets.
// Hashing uses poseidon-lite (not circomlibjs' poseidon) so a shared hashing bug cannot hide in both.
import { poseidon2, poseidon3, poseidon7 } from "poseidon-lite";
import { buildEddsa } from "circomlibjs";
const SUBORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041n;
const TAG = 1952805748n;
let E; async function eddsa() { return (E ??= await buildEddsa()); }
const B = (x) => BigInt(x);

// world: { registry:Set<bigint>, revoked:Set<bigint>, issued_roots:Set<bigint>, revoked_roots:Set<bigint>, spent:Set<bigint>, trustedNow:number|null }
// claim: the circuit input JSON (public + private fields)
export async function oracle(input, world, D) {
  const { babyJub: bj, F } = await eddsa(); const ed = await eddsa();
  const fail = (why) => ({ accept: false, why });
  if (!world.issued_roots.has(B(input.issued_root))) return fail("issued_root not a current registry root");
  if (!world.revoked_roots.has(B(input.revoked_root))) return fail("revoked_root not a current revocation root");
  const now = B(input.now);
  if (world.trustedNow != null && now !== B(world.trustedNow)) return fail("now != trusted clock");
  const ent = input.ent_Ax.map((x, i) => [B(x), B(input.ent_Ay[i])]);
  if (ent.length !== D + 1) return fail("wrong entity count");
  const cert = [];
  for (let i = 0; i < D; i++) {
    const cap = B(input.cap[i]), exp = B(input.expiry[i]);
    if (cap >= 2n ** 32n) return fail(`cap[${i}] >= 2^32`);
    if (exp >= 2n ** 64n) return fail(`expiry[${i}] >= 2^64`);
    const h = poseidon7([BigInt(i), ent[i][0], ent[i][1], ent[i + 1][0], ent[i + 1][1], cap, exp]); cert.push(h);
    if (!world.registry.has(h)) return fail(`cert ${i} not in registry`);
    if (world.revoked.has(h)) return fail(`cert ${i} revoked`);
    if (now > exp) return fail(`cert ${i} expired`);
    const pk = [F.e(ent[i][0]), F.e(ent[i][1])];
    const sig = { S: B(input.sig_S[i]), R8: [F.e(B(input.sig_R8x[i])), F.e(B(input.sig_R8y[i]))] };
    let ok = false; try { ok = ed.verifyPoseidon(F.e(h), sig, pk); } catch { ok = false; }
    if (!ok) return fail(`bad signature at hop ${i}`);
    if (i > 0) {
      if ((cap & B(input.cap[i - 1])) !== cap) return fail(`cap attenuation violated at hop ${i}`);
      if (exp > B(input.expiry[i - 1])) return fail(`expiry exceeds parent at hop ${i}`);
    }
  }
  const sk = B(input.holder_sk);
  if (sk >= SUBORDER) return fail("holder_sk not canonical");
  const A = bj.mulPointEscalar(bj.Base8, sk);
  if (F.toObject(A[0]) !== ent[D][0] || F.toObject(A[1]) !== ent[D][1]) return fail("holder_sk does not match terminal key");
  const digest = poseidon7([input.act_chain_id, input.act_verifier, input.act_method, input.act_params_hash, input.act_amount, input.act_req_cap, input.act_nonce].map(B));
  if (digest !== B(input.action_digest)) return fail("action_digest != H(action context)");
  const req = B(input.act_req_cap);
  if ((req & B(input.cap[D - 1])) !== req) return fail("required capability not covered by terminal cert");
  if (poseidon3([TAG, sk, digest]) !== B(input.nullifier)) return fail("nullifier != H(tag, holder secret, digest)");
  if (world.spent?.has(B(input.nullifier))) return fail("nullifier already spent (replay)");
  return { accept: true, why: "all checks passed" };
}

export function worldFromMeta(meta, extra = {}) {
  const F = null;
  return {
    registry: new Set([...meta.leaves.values()].map(BigInt)),
    revoked: new Set(meta.revokedIds.map(BigInt)),
    issued_roots: new Set([BigInt(meta.issued_root)]),
    revoked_roots: new Set([BigInt(meta.revoked_root)]),
    spent: new Set(), trustedNow: meta.now, ...extra,
  };
}

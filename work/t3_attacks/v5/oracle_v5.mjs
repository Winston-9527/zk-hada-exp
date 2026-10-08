// Independent plaintext oracle for v5 (= oracle_v3 + registered-root set, #17 option b): cert0 must be a registered root certificate,
// certs i >= 1 must be in the delegation registry, root_root must be a current registered-root root.
// Derived from ../v3/oracle_v3.mjs (v3 header follows).
// Independent plaintext oracle for v3 (layout C). Same rules as ../oracle.mjs except the action part:
//   ctx_hash must equal keccak256(abi.encode(chainid, verifier, method, target, params, amount, nonce)) >> 8 of the action the
//   verifier is executing (world.action); req_cap must equal the verifier's required capability (world.requiredCap) and be covered
//   by the terminal certificate; digest = Poseidon(ctx_hash, req_cap); nullifier = Poseidon(tag, holder_sk, digest).
// Independence: Poseidon via poseidon-lite, keccak via @noble/hashes with a hand-written ABI encoder (the generator and the contract
// use ethers / Solidity abi.encode). EdDSA/BabyJub still via circomlibjs (shared with the generator).
import { poseidon2, poseidon3, poseidon7 } from "poseidon-lite";
import { keccak_256 } from "@noble/hashes/sha3";
import { buildEddsa } from "circomlibjs";
const SUBORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041n;
const TAG = 1952805748n;
let E; async function ed() { return (E ??= await buildEddsa()); }
const B = (x) => BigInt(x);
const word = (x) => B(x).toString(16).padStart(64, "0");
const hexBody = (h) => h.toLowerCase().replace(/^0x/, "");
// abi.encode(uint256 chainid, address verifier, bytes4 method, address target, bytes params, uint256 amount, uint256 nonce)
export function ctxHashIndependent(a) {
  const p = hexBody(a.params), plen = p.length / 2;
  const head = [word(a.chainId), word(B(a.verifier)), hexBody(a.method).padEnd(64, "0"), word(B(a.target)), word(7 * 32), word(a.amount), word(a.nonce)];
  const tail = word(plen) + p.padEnd(Math.ceil(plen / 32) * 64, "0");
  const bytes = Buffer.from(head.join("") + tail, "hex");
  return B("0x" + Buffer.from(keccak_256(bytes)).toString("hex")) >> 8n;
}
export async function oracleV5(input, world, D) {
  const e = await ed(); const { babyJub: bj, F } = e;
  const fail = (why) => ({ accept: false, why });
  if (!world.issued_roots.has(B(input.issued_root))) return fail("issued_root not a current registry root");
  if (!world.revoked_roots.has(B(input.revoked_root))) return fail("revoked_root not a current revocation root");
  if (!world.root_roots.has(B(input.root_root))) return fail("root_root not a current registered-root root");
  const now = B(input.now);
  if (world.trustedNow != null && now !== B(world.trustedNow)) return fail("now != trusted clock");
  const ent = input.ent_Ax.map((x, i) => [B(x), B(input.ent_Ay[i])]);
  if (ent.length !== D + 1) return fail("wrong entity count");
  for (let i = 0; i < D; i++) {
    const cap = B(input.cap[i]), exp = B(input.expiry[i]);
    if (cap >= 2n ** 32n) return fail(`cap[${i}] >= 2^32`);
    if (exp >= 2n ** 64n) return fail(`expiry[${i}] >= 2^64`);
    const h = poseidon7([BigInt(i), ent[i][0], ent[i][1], ent[i + 1][0], ent[i + 1][1], cap, exp]);
    if (i === 0 ? !world.rootRegistry.has(h) : !world.registry.has(h)) return fail(i === 0 ? "cert 0 is not a registered root certificate" : `cert ${i} not in delegation registry`);
    if (world.revoked.has(h)) return fail(`cert ${i} revoked`);
    if (now > exp) return fail(`cert ${i} expired`);
    let ok = false;
    try { ok = e.verifyPoseidon(F.e(h), { S: B(input.sig_S[i]), R8: [F.e(B(input.sig_R8x[i])), F.e(B(input.sig_R8y[i]))] }, [F.e(ent[i][0]), F.e(ent[i][1])]); } catch { ok = false; }
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
  if (ctxHashIndependent(world.action) !== B(input.ctx_hash)) return fail("ctx_hash != keccak(action being executed)");
  const req = B(input.act_req_cap);
  if (req !== B(world.requiredCap)) return fail("req_cap != verifier's required capability");
  if ((req & B(input.cap[D - 1])) !== req) return fail("required capability not covered by terminal cert");
  if (poseidon3([TAG, sk, poseidon2([B(input.ctx_hash), req])]) !== B(input.nullifier)) return fail("nullifier != H(tag, holder secret, H(ctx_hash, req_cap))");
  if (world.spent?.has(B(input.nullifier))) return fail("nullifier already spent (replay)");
  return { accept: true, why: "all checks passed" };
}
export function worldFromMetaV5(meta, extra = {}) {
  return {
    rootRegistry: new Set(meta.rootTree.leaves.map(BigInt)), root_roots: new Set([BigInt(meta.rootTree.root)]),
    registry: new Set([...meta.leaves.values()].map(BigInt)), revoked: new Set(meta.revokedIds.map(BigInt)),
    issued_roots: new Set([BigInt(meta.issued_root)]), revoked_roots: new Set([BigInt(meta.imt.root)]),
    spent: new Set(), trustedNow: meta.now, action: meta.ctx, requiredCap: BigInt(meta.act.req_cap), ...extra,
  };
}

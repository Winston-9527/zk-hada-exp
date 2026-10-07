// T3 differential attack run against zkdac v3 (layout C). Classes from ../ATTACKS_PREREGISTRATION.md, v3 mapping in ATTACKS_PREREGISTRATION_v3.md.
// Ported from ../attacks.mjs (v2): only the action/nullifier parts differ. usage: node v3/attacks_v3.mjs > v3/results/attacks_v3.json
import { buildInstanceV3 as buildInstance, init, R, SUBORDER, ctxHash } from "../../t2_circuit_fix/zkdac_v3/scripts/lib_v3.mjs";
import { satisfiable } from "../../t2_circuit_fix/zkdac_v3/scripts/witness_v3.mjs";
import { oracleV3 as oracle, worldFromMetaV3 as worldFromMeta } from "./oracle_v3.mjs";
import { newMemEmptyTrie } from "circomlibjs";
import crypto from "crypto";
const clone = (o) => JSON.parse(JSON.stringify(o));
const rows = [];
async function judge(id, name, D, input, world, { policy = false, expect, validWitnessExists = null } = {}) {
  const c = await satisfiable(D, input); const o = await oracle(input, world, D);
  const cls = c && !o.accept ? "FALSE_ACCEPT" : !c && o.accept ? (validWitnessExists ? "BAD_WITNESS_ONLY" : "COMPLETENESS_GAP") : c ? "AGREE_ACCEPT" : "AGREE_REJECT";
  rows.push({ id, name, D, circuit: c ? "accept" : "reject", oracle: o.accept ? "accept" : "reject", oracle_why: o.why, class: cls, policy_dependent: policy, expected: expect ?? null, valid_witness_exists: validWitnessExists });
}
const S = (x) => x.toString();
const { eddsa } = await init(); const F = eddsa.F;
const sameRoot = async (meta) => meta;

// re-issue hop i (attacker-controlled fields). Signs with signerEnt's prv unless keepSig. Merkle path left as the old one (cert not registered).
function forgeHop(meta, input, i, { holderEnt, cap, expiry, signerEnt, keepSig = false }) {
  const m = clone(input);
  if (holderEnt) { m.ent_Ax[i + 1] = S(holderEnt.Ax); m.ent_Ay[i + 1] = S(holderEnt.Ay); }
  if (cap !== undefined) m.cap[i] = S(cap);
  if (expiry !== undefined) m.expiry[i] = S(expiry);
  if (signerEnt) { m.ent_Ax[i] = S(signerEnt.Ax); m.ent_Ay[i] = S(signerEnt.Ay); }
  if (!keepSig) {
    const h = meta.P([i, m.ent_Ax[i], m.ent_Ay[i], m.ent_Ax[i + 1], m.ent_Ay[i + 1], m.cap[i], m.expiry[i]]);
    const sg = eddsa.signPoseidon((signerEnt ?? meta.ents[i]).prv, F.e(h));
    m.sig_S[i] = S(sg.S); m.sig_R8x[i] = S(F.toObject(sg.R8[0])); m.sig_R8y[i] = S(F.toObject(sg.R8[1]));
  }
  return m;
}
const attackerKey = () => { const prv = crypto.randomBytes(32); const A = eddsa.prv2pub(prv); return { prv, Ax: F.toObject(A[0]), Ay: F.toObject(A[1]) }; };

const D = 4;
const { input: V, meta: M } = await buildInstance({ D });
const W = worldFromMeta(M);
await judge("A00", "control: valid D=4", D, V, W, { expect: "accept" });

// A02: wrong terminal secret (intermediate key's secret), nullifier made consistent
{ const m = clone(V); const sk = M.ents[D - 1].sk; m.holder_sk = S(sk); m.nullifier = S(M.P([1952805748n, sk, M.P([BigInt(m.ctx_hash), BigInt(m.act_req_cap)])])); await judge("A02", "wrong terminal secret (intermediate sk)", D, m, W, { expect: "reject" }); }
for (const d of [1, 2, 3]) { const { input, meta } = await buildInstance({ D: d }); await judge("A02b", `legit shorter chain D=${d}`, d, input, worldFromMeta(meta), { expect: "accept" }); }

// A03: illegal padding / unregistered extra hop / identity keys
{ const dummy = attackerKey(); const m = forgeHop(M, V, 3, { holderEnt: dummy, cap: 0, expiry: 2000, signerEnt: M.ents[3] }); await judge("A03", "terminal hop replaced by unregistered zero-cap hop to new key (cert not registered)", D, m, W, { expect: "reject" }); }
{ const ident = { prv: crypto.randomBytes(32), Ax: 0n, Ay: 1n }; const m = forgeHop(M, V, 3, { holderEnt: ident, cap: 0, expiry: 2000, signerEnt: M.ents[3] }); m.holder_sk = "0"; m.nullifier = S(M.P([1952805748n, 0n, M.P([BigInt(m.ctx_hash), BigInt(m.act_req_cap)])])); await judge("A03b", "identity-point holder key with sk=0 on unregistered hop", D, m, W, { expect: "reject" }); }

// A04: signature reuse with replaced field (keepSig)
for (const [nm, kw] of [["cap", { cap: 0xFE }], ["expiry", { expiry: 4999 }], ["holder", { holderEnt: attackerKey() }]]) {
  for (const i of [0, D - 1]) { const m = forgeHop(M, V, i, { ...kw, keepSig: true }); await judge("A04", `reuse sig at hop ${i}, replace ${nm}`, D, m, W, { expect: "reject" }); }
}

// A05: splice chain A cert0 into chain B (both registered in B's registry)
{ const { input: IA, meta: MA } = await buildInstance({ D, seed: 11 });
  const { input: IB, meta: MB } = await buildInstance({ D, seed: 22, extraLeaves: MA.cert });
  const WB = worldFromMeta(MB); const m = clone(IB); const p = MB.merklePath(MB.merkleIdx(MA.cert[0]));
  m.sig_S[0] = IA.sig_S[0]; m.sig_R8x[0] = IA.sig_R8x[0]; m.sig_R8y[0] = IA.sig_R8y[0]; m.cap[0] = IA.cap[0]; m.expiry[0] = IA.expiry[0];
  m.ent_Ax[0] = IA.ent_Ax[0]; m.ent_Ay[0] = IA.ent_Ay[0]; m.m_sib[0] = p.sib.map(S); m.m_bit[0] = p.bit.map(S);
  await judge("A05", "splice: A.cert0 (registered) + B.certs1.. (issuer/holder keys of B)", D, m, WB, { expect: "reject" });
  const m2 = clone(m); m2.ent_Ax[1] = IA.ent_Ax[1]; m2.ent_Ay[1] = IA.ent_Ay[1];
  await judge("A05b", "splice with ent[1]=A's holder: B.cert1 no longer matches", D, m2, WB, { expect: "reject" });
  await judge("A05c", "control: B valid", D, IB, WB, { expect: "accept" }); }

// A06: holder key substitution with attacker's own key+secret, sig kept
{ const m = clone(V); const ak = attackerKey(); const sk = BigInt("0x" + crypto.randomBytes(30).toString("hex")) % SUBORDER; const { babyJub: bj } = eddsa; const A = bj.mulPointEscalar(bj.Base8, sk);
  m.ent_Ax[D] = S(F.toObject(A[0])); m.ent_Ay[D] = S(F.toObject(A[1])); m.holder_sk = S(sk); m.nullifier = S(M.P([1952805748n, sk, M.P([BigInt(m.ctx_hash), BigInt(m.act_req_cap)])]));
  await judge("A06", "terminal holder replaced by attacker key+secret (signature kept)", D, m, W, { expect: "reject" }); }

// A07: nullifier variants
{ let m = clone(V); m.nullifier = S(M.P([1952805748n, BigInt(m.ent_Ax[D]), M.P([BigInt(m.ctx_hash), BigInt(m.act_req_cap)])])); await judge("A07", "nullifier from public key only", D, m, W, { expect: "reject" });
  m = clone(V); const sk2 = BigInt(m.holder_sk) + SUBORDER; m.holder_sk = S(sk2); m.nullifier = S(M.P([1952805748n, sk2, M.P([BigInt(m.ctx_hash), BigInt(m.act_req_cap)])])); await judge("A07", "second nullifier via secret alias s+l", D, m, W, { expect: "reject" });
  m = clone(V); m.nullifier = S(M.P([1952805748n, 12345n, M.P([BigInt(m.ctx_hash), BigInt(m.act_req_cap)])])); await judge("A07", "nullifier from unrelated secret", D, m, W, { expect: "reject" });
  m = clone(V); m.nullifier = S(M.P([7n, BigInt(m.holder_sk), M.P([BigInt(m.ctx_hash), BigInt(m.act_req_cap)])])); await judge("A07", "nullifier with different domain tag", D, m, W, { expect: "reject" }); }

// A08: registry mis-binding
{ const m = clone(V); const p = M.merklePath(M.merkleIdx(M.cert[1])); m.m_sib[0] = p.sib.map(S); m.m_bit[0] = p.bit.map(S); await judge("A08", "merkle path of cert1 used for cert0", D, m, W, { expect: "reject", validWitnessExists: true });
  const m2 = clone(V); const p2 = M.merklePath(5); m2.m_sib[2] = p2.sib.map(S); m2.m_bit[2] = p2.bit.map(S); await judge("A08", "path of an arbitrary empty index for cert2", D, m2, W, { expect: "reject", validWitnessExists: true }); }

// A09: non-boolean bits
for (const v of ["2", (R - 1n).toString()]) { const m = clone(V); m.m_bit[1][3] = v; await judge("A09", `path bit = ${v.slice(0, 6)}`, D, m, W, { expect: "reject", validWitnessExists: true }); }

// A10: replay (policy)
{ const w2 = worldFromMeta(M, { spent: new Set([BigInt(V.nullifier)]) }); await judge("A10", "replay of already-spent nullifier (circuit alone)", D, V, w2, { policy: true, expect: "circuit accept, contract must dedupe" }); }

// A11 (v3): proof for action X presented while the verifier executes action Y
for (const [k, v] of [["chainId", 137n], ["verifier", "0x0000000000000000000000000000000000004242"], ["method", "0x095ea7b3"], ["amount", 10000000n], ["params", "0x01"], ["nonce", 999n], ["target", "0x000000000000000000000000000000000000beef"]]) {
  const Wy = { ...W, action: { ...W.action, [k]: v } };
  await judge("A11a", `public inputs unchanged, verifier executes action with different ${k}`, D, V, Wy, { expect: "reject" });
  const m = clone(V); m.ctx_hash = S(ctxHash(Wy.action));
  await judge("A11b", `attacker swaps ctx_hash to keccak(Y) (${k}) without holder secret`, D, m, Wy, { expect: "reject" });
}
// A11-req (v3, new): prover-chosen req_cap = 0 with a consistent nullifier (holder cooperates) — circuit accepts, verifier must fix req_cap
{ const m = clone(V); m.act_req_cap = "0"; m.nullifier = S(M.P([1952805748n, BigInt(m.holder_sk), M.P([BigInt(m.ctx_hash), 0n])]));
  await judge("A11-req", "req_cap=0 chosen by prover, consistent nullifier", D, m, W, { policy: true, expect: "circuit accepts; contract sets req_cap (closed in #18)" }); }

// A12: revocation
for (const i of [0, 1, D - 1]) {
  const { input, meta } = await buildInstance({ D });
  const Wold = worldFromMeta(meta);
  await meta.smt.insert(BigInt(meta.cert[i]), 0n);                       // issuer revokes cert i (new revoked root)
  const newRoot = F.toObject(meta.smt.root);
  const Wnew = { ...Wold, revoked: new Set([...Wold.revoked, BigInt(meta.cert[i])]), revoked_roots: new Set([newRoot]) };
  const stale = clone(input); stale.revoked_root = S(newRoot);
  await judge("A12b", `revoke cert ${i}: old non-membership proof vs new root`, D, stale, Wnew, { expect: "reject" });
  const ex = await meta.exclusion(meta.cert[i]);
  const honest = clone(input); honest.revoked_root = S(newRoot); honest.r_sib[i] = ex.sib.map(S); honest.r_oldKey[i] = S(ex.oldKey); honest.r_oldValue[i] = S(ex.oldValue); honest.r_isOld0[i] = S(ex.isOld0);
  await judge("A12a", `revoke cert ${i}: honest re-proof (cert is found => no exclusion proof exists)`, D, honest, Wnew, { expect: "reject" });
  await judge("A12c", `revoke cert ${i}: proof against stale pre-revocation revoked_root`, D, input, Wnew, { policy: true, expect: "circuit accepts old root; verifier must check root freshness" });
}

// A13: SMT depth overflow
{ const lowbits = (x, n) => BigInt(x) & ((1n << BigInt(n)) - 1n); const RD = 16;
  const { input: i0, meta: m0 } = await buildInstance({ D });
  const target = BigInt(m0.cert[0]);
  // find k sharing the low RD+1 bits with target (target is the *revoked* cert in this attack)
  let k; for (let n = 1n; ; n++) { const c = BigInt("0x" + crypto.createHash("sha256").update("k" + n).digest("hex").slice(0, 60)); if (lowbits(c, RD + 1) === lowbits(target, RD + 1)) { k = c; break; } }
  const { input, meta } = await buildInstance({ D, extraRevoked: [k] });
  await meta.smt.insert(target, 0n);                                       // revoke the real cert; it now sits deeper than RD levels
  const newRoot = F.toObject(meta.smt.root); const Wn = { ...worldFromMeta(meta), revoked: new Set([...meta.revokedIds.map(BigInt), target]), revoked_roots: new Set([newRoot]) };
  const ex = await meta.exclusion(k);                                      // legit proof for k (found); try to reuse it as exclusion of target
  const m = clone(input); m.revoked_root = S(newRoot);
  m.r_sib[0] = ex.sib.slice(0, RD).map(S); m.r_oldKey[0] = S(k); m.r_oldValue[0] = "0"; m.r_isOld0[0] = "0";
  await judge("A13", `forged exclusion of revoked cert0 using sibling key sharing ${RD + 1} low bits as oldKey`, D, m, Wn, { expect: "reject" });
  // liveness probe: honest cert whose revoked-tree path exceeds RD (two *other* revoked keys share RD+1 bits with it)
  const hc = BigInt(m0.cert[1]); const mk = []; for (let n = 1n; mk.length < 2; n++) { const c = BigInt("0x" + crypto.createHash("sha256").update("h" + n).digest("hex").slice(0, 60)); if (lowbits(c, RD + 1) === lowbits(hc, RD + 1) && c !== hc) mk.push(c); }
  const { input: lv, meta: lm } = await buildInstance({ D, extraRevoked: mk });
  const found = await lm.exclusion(lm.cert[1]); const depth = found.sib.filter((x) => x !== 0n).length;
  await judge("A13b", `liveness: honest cert1 with two revoked keys sharing ${RD + 1} low bits (path depth ~${depth})`, D, lv, worldFromMeta(lm), { expect: "accept (liveness)", validWitnessExists: false });
}

// A14: time (policy)
{ const { input, meta } = await buildInstance({ D }); const wTrust = worldFromMeta(meta);
  const m = clone(input); m.now = "0"; await judge("A14", "now=0 (clock lie; certs not expired)", D, m, wTrust, { policy: true, expect: "circuit accepts; contract must bind now to block time" });
  const m2 = clone(input); m2.now = (R - 1n).toString(); await judge("A14", "now=p-1", D, m2, wTrust, { expect: "reject" });
  const m3 = clone(input); m3.now = "2001"; await judge("A14", "now past terminal expiry", D, m3, { ...wTrust, trustedNow: 2001 }, { expect: "reject" }); }

// A15: capability smuggling
{ for (const c of [2n ** 32n + 1n, 2n ** 32n]) { const { input, meta } = await buildInstance({ D, caps: [Number(c), 0x3F, 0x0F, 0x03].map(Number) }).catch(() => ({})); if (input) await judge("A15", `cap[0]=${c}`, D, input, worldFromMeta(meta), { expect: "reject" }); }
  { const { input, meta } = await buildInstance({ D, caps: [0xFF, 0x3F, 0x0F, 0x03 | 0x80] }); await judge("A15", "child cap with extra high bit", D, input, worldFromMeta(meta), { expect: "reject" }); }
  { const { input, meta } = await buildInstance({ D, reqCap: 0x40n }); await judge("A15", "req_cap outside terminal cap", D, input, worldFromMeta(meta), { expect: "reject" }); } }

// A16: expiry inversion / wrap
{ const { input, meta } = await buildInstance({ D, expiries: [5000, 5001, 3000, 2000] }); await judge("A16", "child expiry > parent", D, input, worldFromMeta(meta), { expect: "reject" });
  const { input: i2, meta: m2 } = await buildInstance({ D, expiries: [2 ** 53, 4000, 3000, 2000] }); await judge("A16", "expiry 2^53 (still < 2^64) as parent: legit large expiry", D, i2, worldFromMeta(m2), { expect: "accept" });
  const big = (2n ** 64n).toString(); const { input: i3, meta: m3 } = await buildInstance({ D, expiries: [big, 4000, 3000, 2000] }).catch(() => ({})); if (i3) await judge("A16", "expiry >= 2^64", D, i3, worldFromMeta(m3), { expect: "reject" }); }

const sum = {}; for (const r of rows) sum[r.class] = (sum[r.class] ?? 0) + 1;
console.log(JSON.stringify({ circuit: "zkdac_v3 (layout C) D=4 (+D=1..3 for A02b)", summary: sum, false_accepts: rows.filter((r) => r.class === "FALSE_ACCEPT"), false_rejects: rows.filter((r) => r.class === "FALSE_REJECT"), rows }, null, 1));
process.exit(0);

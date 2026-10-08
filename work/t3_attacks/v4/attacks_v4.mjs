// T3 differential attack run against zkdac v4 (layout C + IMT revocation). Classes: ../ATTACKS_PREREGISTRATION.md; v4 mapping: ATTACKS_PREREGISTRATION_v4.md.
// Ported from ../v3/attacks_v3.mjs: A11a is POLICY (pre-registered this time); A12/A13 use the indexed Merkle tree. usage: node v4/attacks_v4.mjs > v4/results/attacks_v4.json
import { buildInstanceV4 as buildInstance, init, R, SUBORDER, ctxHash, trunc } from "../../t2_circuit_fix/zkdac_v4/scripts/lib_v4.mjs";
import { satisfiable } from "../../t2_circuit_fix/zkdac_v4/scripts/witness_v4.mjs";
import { oracleV3 as oracle, worldFromMetaV3 } from "../v3/oracle_v3.mjs";
// IMT root replaces the SMT root built by the v2 generator
const worldFromMeta = (meta, extra = {}) => worldFromMetaV3(meta, { revoked_roots: new Set([BigInt(meta.imt.root)]), ...extra });
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
  await judge("A11a", `public inputs unchanged, verifier executes action with different ${k}`, D, V, Wy, { policy: true, expect: "circuit accepts; contract computes ctx_hash (VariantC test_A11a_*)" });
  const m = clone(V); m.ctx_hash = S(ctxHash(Wy.action));
  await judge("A11b", `attacker swaps ctx_hash to keccak(Y) (${k}) without holder secret`, D, m, Wy, { expect: "reject" });
}
// A11-req (v3, new): prover-chosen req_cap = 0 with a consistent nullifier (holder cooperates) — circuit accepts, verifier must fix req_cap
{ const m = clone(V); m.act_req_cap = "0"; m.nullifier = S(M.P([1952805748n, BigInt(m.holder_sk), M.P([BigInt(m.ctx_hash), 0n])]));
  await judge("A11-req", "req_cap=0 chosen by prover, consistent nullifier", D, m, W, { policy: true, expect: "circuit accepts; contract sets req_cap (closed in #18)" }); }

// A12: revocation (IMT). Revoke cert i after the witness was built (new root), then try every way around it.
const setLow = (m, i, t, idx) => { const L = t.imt.leaves[idx], p = t.imt.path(idx); m.r_low_value[i] = S(L.value); m.r_low_next_index[i] = S(L.nextIndex); m.r_low_next_value[i] = S(L.nextValue); m.r_sib[i] = p.sib.map(S); m.r_bit[i] = p.bit.map(S); return m; };
for (const i of [0, 1, D - 1]) {
  const { input, meta } = await buildInstance({ D });
  const Wold = worldFromMeta(meta);
  meta.imt.insert(BigInt(meta.cert[i]));                                          // issuer revokes cert i
  const Wnew = { ...Wold, revoked: new Set([...Wold.revoked, BigInt(meta.cert[i])]), revoked_roots: new Set([meta.imt.root]) };
  const stale = clone(input); stale.revoked_root = S(meta.imt.root);
  await judge("A12b", `revoke cert ${i}: old IMT witness vs new root`, D, stale, Wnew, { expect: "reject" });
  let gen = "generator produced a witness (BUG)"; try { meta.imt.nonMemberWitness(meta.cert[i]); } catch { gen = "no witness exists"; }
  rows.push({ id: "A12a", name: `revoke cert ${i}: honest re-proof`, D, circuit: "n/a", oracle: "reject", oracle_why: gen, class: gen === "no witness exists" ? "AGREE_REJECT" : "FALSE_ACCEPT", policy_dependent: false, expected: "no witness" });
  const k = trunc(meta.cert[i]);
  await judge("A12b'", `revoke cert ${i}: predecessor leaf in the new tree`, D, setLow(clone(stale), i, meta, meta.imt.lowIndex(k)), Wnew, { expect: "reject" });
  const f = setLow(clone(stale), i, meta, meta.imt.lowIndex(k)); f.r_low_next_value[i] = S(meta.imt.leaves.find((l) => l.value === k).nextValue);
  await judge("A12b''", `revoke cert ${i}: forged leaf skipping the revoked key (predecessor's path)`, D, f, Wnew, { expect: "reject" });
  await judge("A12c", `revoke cert ${i}: proof against stale pre-revocation revoked_root`, D, input, Wnew, { policy: true, expect: "circuit accepts old root; verifier must check root freshness" });
}

// A13: keys sharing many low bits (the SMT failure mode), both directions
{ const lowmask = (b) => (1n << BigInt(b)) - 1n, rnd = (s) => BigInt("0x" + crypto.createHash("sha256").update(s).digest("hex").slice(0, 60));
  for (const shared of [17, 40, 200]) {
    // A13b liveness: honest cert1 with three revoked keys sharing `shared` low bits — expected ACCEPT now
    const { meta: m0 } = await buildInstance({ D }); const hc = BigInt(m0.cert[1]);
    const near = [0, 1, 2].map((j) => ((rnd(`n${shared}-${j}`) >> BigInt(shared)) << BigInt(shared)) | (hc & lowmask(shared)));
    const { input: lv, meta: lm } = await buildInstance({ D, extraRevoked: near });
    await judge("A13b", `liveness: honest cert1, 3 revoked keys sharing ${shared} low bits`, D, lv, worldFromMeta(lm), { expect: "accept" });
    // A13: the revoked cert itself sits among keys sharing `shared` low bits; try its neighbours' leaves
    // a revoked key above every certificate key, so the revoked cert always has a successor and the end-of-list leaf is a different leaf
    // (run 1 skipped the successor / A13c rows because cert1 happened to be the maximum key)
    const top = (1n << 252n) - 7n;
    const { input, meta } = await buildInstance({ D, extraRevoked: [...near, top] }); meta.imt.insert(BigInt(meta.cert[1]));
    const Wn = { ...worldFromMeta(meta), revoked: new Set([...meta.revokedIds.map(BigInt), BigInt(meta.cert[1])]), revoked_roots: new Set([meta.imt.root]) };
    const base = clone(input); base.revoked_root = S(meta.imt.root); const k = trunc(meta.cert[1]);
    const order = meta.imt.leaves.map((l, idx) => [l.value, idx]).sort((a, b) => (a[0] < b[0] ? -1 : 1)); const pos = order.findIndex(([v]) => v === k);
    for (const [label, off] of [["predecessor", -1], ["successor", 1], ["two below", -2]]) {
      const idx = order[pos + off]?.[1]; if (idx === undefined) throw new Error(`A13 ${label} leaf not exercised`);
      await judge("A13", `revoked cert1 among keys sharing ${shared} low bits: ${label} leaf`, D, setLow(clone(base), 1, meta, idx), Wn, { expect: "reject" });
    }
    // A13c: end-of-list leaf (next_value = 0) used for a revoked key below the maximum
    const last = meta.imt.leaves.findIndex((l) => l.nextValue === 0n);
    if (meta.imt.leaves[last].value === k) throw new Error("A13c not exercised: revoked key is the maximum");
    await judge("A13c", `revoked cert1 (${shared} shared bits): end-of-list leaf`, D, setLow(clone(base), 1, meta, last), Wn, { expect: "reject" });
  }
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
console.log(JSON.stringify({ circuit: "zkdac_v4 (layout C + IMT20) D=4 (+D=1..3 for A02b)", summary: sum, false_accepts: rows.filter((r) => r.class === "FALSE_ACCEPT"), false_rejects: rows.filter((r) => r.class === "FALSE_REJECT"), rows }, null, 1));
process.exit(0);

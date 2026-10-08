// T3 differential attack run against zkdac v7 (v6 + R6 accountability, #30). Classes: ../ATTACKS_PREREGISTRATION.md; v7 mapping: ATTACKS_PREREGISTRATION_v7.md.
// Ported from ../v6/attacks_v6.mjs. v6 rows run on mode-C instances; before judging a v6 row the harness RE-ENCRYPTS the accountability
// ciphertexts to the (possibly modified) ent[] under the public TPK (any attacker can), so those rows test their original property, not R6.
// New A19 rows (keepAcc) run in both modes. usage: node v7/attacks_v7.mjs > v7/results/attacks_v7.json
import { buildInstanceV7, encryptChain, init, R, SUBORDER, ctxHash, trunc, rootProof, RT, keyHash, refreshKeys, refreshAll, KEY_TAG, elgamal, auditorKey } from "../../t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs";
import { refreshRevocation } from "../../t2_circuit_fix/zkdac_v4/scripts/lib_v4.mjs";
import { satisfiable as sat7 } from "../../t2_circuit_fix/zkdac_v7/scripts/witness_v7.mjs";
import { oracleV7, worldFromMetaV7 as worldFromMeta } from "./oracle_v7.mjs";
import crypto from "crypto";
let MODE = "C";
const buildInstance = (opts = {}) => buildInstanceV7({ mode: MODE, ...opts });
const reencrypt = async (m) => encryptChain(m, m.ent_Ax.map((x, i) => [BigInt(x), BigInt(m.ent_Ay[i])]), m.tpk.map(BigInt), MODE, "reenc-" + crypto.createHash("sha256").update(JSON.stringify(m.ent_Ax)).digest("hex"));
const clone = (o) => JSON.parse(JSON.stringify(o));
const rows = [];
async function judge(id, name, D, input, world, { policy = false, expect, validWitnessExists = null, keepAcc = false } = {}) {
  if (!keepAcc && input.ent_Ax.length === D + 1) input = await reencrypt(JSON.parse(JSON.stringify(input)));
  const c = await sat7(D, input, MODE); const o = await oracleV7(input, world, D, MODE);
  const cls = c && !o.accept ? "FALSE_ACCEPT" : !c && o.accept ? (validWitnessExists ? "BAD_WITNESS_ONLY" : "COMPLETENESS_GAP") : c ? "AGREE_ACCEPT" : "AGREE_REJECT";
  rows.push({ id, mode: MODE, name, D, circuit: c ? "accept" : "reject", oracle: o.accept ? "accept" : "reject", oracle_why: o.why, class: cls, policy_dependent: policy, expected: expect ?? null, valid_witness_exists: validWitnessExists });
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
  const { input: IB0, meta: MB } = await buildInstance({ D, seed: 22, extraLeaves: MA.cert });
  MB.rootTree.insert(BigInt(MA.cert[0]));                                   // v5: A's root certificate is registered too, so this tests the splice itself
  const IB = { ...IB0, ...rootProof(MB.rootTree, MB.cert[0]) };              // B's own root path against the updated root tree
  const WB = worldFromMeta(MB); const m = clone(IB);
  m.sig_S[0] = IA.sig_S[0]; m.sig_R8x[0] = IA.sig_R8x[0]; m.sig_R8y[0] = IA.sig_R8y[0]; m.cap[0] = IA.cap[0]; m.expiry[0] = IA.expiry[0];
  m.ent_Ax[0] = IA.ent_Ax[0]; m.ent_Ay[0] = IA.ent_Ay[0]; Object.assign(m, rootProof(MB.rootTree, MA.cert[0]));
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
  const stale = refreshKeys(clone(input), meta);                                   // v6: key slots valid under the new root
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
    const base = refreshKeys(clone(input), meta); const k = trunc(meta.cert[1]);
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

// A17: registered-root tree (#17 option b)
{ const { input, meta } = await buildInstance({ D, registerCert0: false });
  await judge("A17a", "cert0 valid and signed but never registered (delegation tree only)", D, input, worldFromMeta(meta), { expect: "reject" });
  const { input: i2, meta: m2 } = await buildInstance({ D }); const mm = clone(i2); Object.assign(mm, rootProof(m2.rootTree, m2.rootTree.leaves[3]));
  await judge("A17b", "cert0 with another registered root certificate's path", D, mm, worldFromMeta(m2), { expect: "reject", validWitnessExists: true });
  const { input: i3, meta: m3 } = await buildInstance({ D }); const Wold = worldFromMeta(m3);
  const idx = m3.rootTree.indexOf(BigInt(m3.cert[0])); m3.rootTree.update(idx, 987654321n);   // re-registration replaces this master's leaf in place
  const Wnew = worldFromMeta(m3); const stale = clone(i3); stale.root_root = S(m3.rootTree.root);
  await judge("A17c", "replaced master: old path vs new root_root", D, stale, Wnew, { expect: "reject" });
  await judge("A17c'", "replaced master: proof against pre-replacement root_root", D, i3, Wnew, { policy: true, expect: "circuit accepts old root_root; contract root window" });
  const { input: i4, meta: m4 } = await buildInstance({ D }); const z = clone(i4); z.rt_depth = String(RT + 1); z.root_root = "0";
  // run 1 wrongly modelled the registry root as 0; the attacker targets the real registry, whose current root is not 0
  await judge("A17d", "rt_depth > RT with root_root = 0", D, z, worldFromMeta(m4), { expect: "reject" });
  // A17e: the registry holds this human's root certificate for a different master M'; the chain uses master M (cert0 for M is not registered)
  const { input: i5, meta: m5 } = await buildInstance({ D, registerCert0: false });
  const other = m5.P([0, i5.ent_Ax[0], i5.ent_Ay[0], 4242n, 4343n, i5.cap[0], i5.expiry[0]]); m5.rootTree.insert(BigInt(other));
  const e = clone(i5); Object.assign(e, rootProof(m5.rootTree, other));
  await judge("A17e", "human's root certificate registered for master M', chain uses master M", D, e, worldFromMeta(m5), { expect: "reject" });
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

// A18: holder-key revocation (#28)
const setKLow = (m, t, meta, idx) => { const L = meta.imt.leaves[idx], p = meta.imt.path(idx); m.k_low_value[t] = S(L.value); m.k_low_next_index[t] = S(L.nextIndex); m.k_low_next_value[t] = S(L.nextValue); m.k_sib[t] = p.sib.map(S); m.k_bit[t] = p.bit.map(S); return m; };
const revokeKey = (meta, W, ent) => { const h = keyHash(meta, ent); meta.imt.insert(h); return { ...W, revokedKeys: new Set([...W.revokedKeys, h]), revoked_roots: new Set([meta.imt.root]) }; };
for (const d of [2, 3, 4]) {           // A18a / A18a': terminal key revoked
  const { input, meta } = await buildInstance({ D: d }); const Wn = revokeKey(meta, worldFromMeta(meta), meta.ents[d]);
  await judge("A18a", `terminal key ent[${d}] revoked: old key witness vs new root (D=${d})`, d, refreshRevocation(clone(input), meta), Wn, { expect: "reject" });
  let gen = "generator produced a witness (BUG)"; try { refreshAll(clone(input), meta); } catch { gen = "no witness exists"; }
  rows.push({ id: "A18a'", name: `terminal key ent[${d}] revoked: honest re-proof (D=${d})`, D: d, circuit: "n/a", oracle: "reject", oracle_why: gen, class: gen === "no witness exists" ? "AGREE_REJECT" : "FALSE_ACCEPT", policy_dependent: false, expected: "no witness" });
}
{ // A18b: key compromise. ent[2] revoked; its holder signs a fresh cert2' to a fresh attacker key, and cert2' is even registered in the
  // delegation tree (strongest case: the cert-level revocation set cannot know cert2'). D = 3 chain: human -> master -> ent[2] -> attacker.
  const bj = eddsa.babyJub; const sk = BigInt("0x" + crypto.randomBytes(30).toString("hex")) % SUBORDER; const A = bj.mulPointEscalar(bj.Base8, sk);
  const att = { Ax: F.toObject(A[0]), Ay: F.toObject(A[1]) };
  const { meta: probe } = await buildInstance({ D: 3 });                       // same seed => same keys as the instance below
  const cert2p = probe.P([2, probe.ents[2].Ax, probe.ents[2].Ay, att.Ax, att.Ay, 0x03, 2000]);
  const { input, meta } = await buildInstance({ D: 3, extraLeaves: [cert2p], extraLeafBase: 40000 });   // run 1 used the default base 200000 (>= 2^16: not in the tree)
  const ctrl = clone(input); ctrl.ent_Ax[3] = S(att.Ax); ctrl.ent_Ay[3] = S(att.Ay); ctrl.cap[2] = "3"; ctrl.expiry[2] = "2000";
  const sg = eddsa.signPoseidon(meta.ents[2].prv, F.e(cert2p)); ctrl.sig_S[2] = S(sg.S); ctrl.sig_R8x[2] = S(F.toObject(sg.R8[0])); ctrl.sig_R8y[2] = S(F.toObject(sg.R8[1]));
  const p = meta.merklePath(meta.merkleIdx(cert2p)); ctrl.m_sib[2] = p.sib.map(S); ctrl.m_bit[2] = p.bit.map(S);
  ctrl.holder_sk = S(sk); ctrl.nullifier = S(meta.P([1952805748n, sk, meta.P([BigInt(ctrl.ctx_hash), BigInt(ctrl.act_req_cap)])]));
  const metaNew = { ...meta, cert: [meta.cert[0], meta.cert[1], cert2p] };
  refreshAll(ctrl, metaNew);
  const W0 = worldFromMeta(meta);
  await judge("A18b", "control: fresh registered cert from ent[2] to attacker key, ent[2] NOT revoked (legitimate re-delegation)", 3, ctrl, W0, { expect: "accept" });
  const Wn = revokeKey(meta, W0, meta.ents[2]);
  const stale = refreshRevocation(clone(ctrl), metaNew);                      // new root; cert slots fresh; key slot 0 (ent[2]) old
  const w3 = meta.imt.nonMemberWitness(keyHash(meta, att));                    // key slot 1 (attacker key, not revoked) fresh
  stale.k_low_value[1] = w3.low_value; stale.k_low_next_index[1] = w3.low_next_index; stale.k_low_next_value[1] = w3.low_next_value; stale.k_sib[1] = w3.sib; stale.k_bit[1] = w3.bit;
  await judge("A18b", "key compromise: ent[2] revoked, fresh registered cert to attacker key, old key witness", 3, stale, Wn, { expect: "reject" });
  const k = trunc(keyHash(meta, meta.ents[2]));
  await judge("A18b", "key compromise: predecessor leaf for revoked ent[2]", 3, setKLow(clone(stale), 0, meta, meta.imt.lowIndex(k)), Wn, { expect: "reject" });
  let gen = "generator produced a witness (BUG)"; try { refreshAll(clone(ctrl), metaNew); } catch { gen = "no witness exists"; }
  rows.push({ id: "A18b", name: "key compromise: honest re-proof with revoked ent[2]", D: 3, circuit: "n/a", oracle: "reject", oracle_why: gen, class: gen === "no witness exists" ? "AGREE_REJECT" : "FALSE_ACCEPT", policy_dependent: false, expected: "no witness" });
}
for (const j of [2, 3, 4]) {          // A18c: revoked key ent[j], every low-leaf trick (all other slots fresh under the new root)
  const top = (1n << 252n) - 7n;     // a key above every real key, so successor / end-of-list leaves are distinct leaves
  const { input, meta } = await buildInstance({ D, extraRevoked: [top] }); const Wn = revokeKey(meta, worldFromMeta(meta), meta.ents[j]);
  const h = keyHash(meta, meta.ents[j]), k = trunc(h), t = j - 2;
  const base = refreshRevocation(clone(input), meta); base.revoked_root = S(meta.imt.root);
  for (let u = 0; u < D - 1; u++) if (u !== t) { const w = meta.imt.nonMemberWitness(keyHash(meta, meta.ents[u + 2])); base.k_low_value[u] = w.low_value; base.k_low_next_index[u] = w.low_next_index; base.k_low_next_value[u] = w.low_next_value; base.k_sib[u] = w.sib; base.k_bit[u] = w.bit; }
  await judge("A18c", `revoked key ent[${j}]: old key witness vs new root`, D, base, Wn, { expect: "reject" });
  await judge("A18c", `revoked key ent[${j}]: predecessor leaf`, D, setKLow(clone(base), t, meta, meta.imt.lowIndex(k)), Wn, { expect: "reject" });
  const own = meta.imt.leaves.findIndex((l) => l.value === k);
  const f = setKLow(clone(base), t, meta, meta.imt.lowIndex(k)); f.k_low_next_value[t] = S(meta.imt.leaves[own].nextValue);
  await judge("A18c", `revoked key ent[${j}]: forged leaf skipping the key (predecessor's path)`, D, f, Wn, { expect: "reject" });
  const last = meta.imt.leaves.findIndex((l) => l.nextValue === 0n); if (meta.imt.leaves[last].value === k) throw new Error("A18c end leaf not exercised");
  await judge("A18c", `revoked key ent[${j}]: end-of-list leaf`, D, setKLow(clone(base), t, meta, last), Wn, { expect: "reject" });
}
{ const { input, meta } = await buildInstance({ D }); const Wn = revokeKey(meta, worldFromMeta(meta), meta.ents[1]);
  await judge("A18d", "master key ent[1] revoked as a key entry (chain otherwise valid)", D, refreshAll(clone(input), meta), Wn, { policy: true, expect: "circuit accepts by design; master invalidated by re-registration (A17c)" }); }
{ const { input, meta } = await buildInstance({ D }); const Wn = revokeKey(meta, worldFromMeta(meta), meta.ents[3]);
  await judge("A18e", "ent[3] revoked; proof against pre-revocation revoked_root", D, input, Wn, { policy: true, expect: "circuit accepts old root; contract root window" }); }
{ const lowmask = (b) => (1n << BigInt(b)) - 1n, rnd = (s) => BigInt("0x" + crypto.createHash("sha256").update(s).digest("hex").slice(0, 60));
  const { meta: m0 } = await buildInstance({ D }); const hk = trunc(keyHash(m0, m0.ents[3]));
  for (const shared of [17, 40, 200]) {
    const near = [0, 1, 2].map((j) => ((rnd(`k${shared}-${j}`) >> BigInt(shared)) << BigInt(shared)) | (hk & lowmask(shared)));
    const { input, meta } = await buildInstance({ D, extraRevoked: near });
    await judge("A18f", `liveness: 3 revoked entries sharing ${shared} low bits with H(ent[3])`, D, input, worldFromMeta(meta), { expect: "accept" });
  }
  const { input, meta } = await buildInstance({ D, nRevokedKeys: 40 });
  await judge("A18f", "liveness: 40 revoked keys of unrelated agents", D, input, worldFromMeta(meta), { expect: "accept" }); }
{ const { poseidon2: p2 } = await import("poseidon-lite");
  for (const [nm, enc] of [["Poseidon(2)(Ax, Ay)", (meta, e) => p2([e.Ax, e.Ay])], ["tag 0", (meta, e) => meta.P([0n, e.Ax, e.Ay])]]) {
    const { input, meta } = await buildInstance({ D }); meta.imt.insert(enc(meta, meta.ents[3]));
    await judge("A18g", `ent[3] revoked under non-canonical encoding ${nm}`, D, refreshAll(clone(input), meta), worldFromMeta(meta), { expect: "accept (operator must use canonical encoding)" }); } }
{ const { input, meta } = await buildInstance({ D }); const m = clone(input);
  for (const f of ["k_low_value", "k_low_next_index", "k_low_next_value", "k_sib", "k_bit"]) [m[f][0], m[f][1]] = [m[f][1], m[f][0]];
  await judge("A18h", "key witnesses of slots ent[2] and ent[3] swapped (nothing revoked)", D, m, worldFromMeta(meta), { expect: "reject", validWitnessExists: true }); }
{ // A18i: key revoked as some chain's ent[2] appears as ent[4] of this chain
  const { input, meta } = await buildInstance({ D }); const Wn = revokeKey(meta, worldFromMeta(meta), meta.ents[4]);
  let gen = "generator produced a witness (BUG)"; try { refreshAll(clone(input), meta); } catch { gen = "no witness exists"; }
  rows.push({ id: "A18i", name: "key revoked (position-independent entry) appears as ent[4]: honest re-proof", D, circuit: "n/a", oracle: "reject", oracle_why: gen, class: gen === "no witness exists" ? "AGREE_REJECT" : "FALSE_ACCEPT", policy_dependent: false, expected: "no witness" });
  await judge("A18i", "key revoked (position-independent entry) appears as ent[4]: stale witness", D, refreshRevocation(clone(input), meta), Wn, { expect: "reject" }); }

// A19: R6 accountability (#30), both modes, ciphertexts NOT re-encrypted (keepAcc)
const RP = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const ACC = ["acc_r", "acc_kx", "acc_ky", "acc_c1x", "acc_c1y", "acc_c2x", "acc_c2y", "acc_e"];
const words = (m) => MODE === "A" ? ["acc_c1x", "acc_c1y", "acc_c2x", "acc_c2y"].flatMap((f) => m[f].map((_, j) => [f, j])) : [["acc_c1x", 0], ["acc_c1y", 0], ["acc_c2x", 0], ["acc_c2y", 0], ...m.acc_e.flatMap((_, j) => [["acc_e", j, 0], ["acc_e", j, 1]])];
for (const mode of ["A", "C"]) {
  MODE = mode;
  const { input: V7, meta: M7 } = await buildInstance({ D }); const W7 = worldFromMeta(M7);
  const ents = V7.ent_Ax.map((x, i) => [BigInt(x), BigInt(V7.ent_Ay[i])]);
  await judge("A19-ctrl", `[${mode}] control: valid D=4`, D, V7, W7, { expect: "accept", keepAcc: true });
  const other = attackerKey();
  for (const j of [0, 1, D]) { const e2 = ents.map((p, k) => (k === j ? [other.Ax, other.Ay] : p)); const m = await encryptChain(clone(V7), e2, M7.tpk, mode, `a19a-${j}`);
    await judge("A19a", `[${mode}] ciphertext of ent[${j}] encrypts another key (wrong accountability object)`, D, m, W7, { expect: "reject", keepAcc: true }); }
  const fake = await auditorKey("attacker-committee");
  { const m = await encryptChain(clone(V7), ents, fake.tpk, mode, "a19b");      // sets m.tpk = attacker key
    await judge("A19b", `[${mode}] ciphertexts to a prover-chosen key, public tpk = that key`, D, m, W7, { expect: "reject", keepAcc: true });
    const m2 = clone(m); m2.tpk = M7.tpk.map(String);
    await judge("A19b'", `[${mode}] ciphertexts to a prover-chosen key, public tpk = committee key`, D, m2, W7, { expect: "reject", keepAcc: true }); }
  { const { input: O } = await buildInstance({ D, seed: 77 }); const m = clone(V7); for (const f of ACC) m[f] = clone(O[f]);
    await judge("A19c", `[${mode}] ciphertexts copied from another chain's action`, D, m, W7, { expect: "reject", keepAcc: true }); }
  { const { input: N2, meta: MN } = await buildInstance({ D, ctx: { nonce: 999n }, accSeed: "fresh" }); const m = clone(N2); for (const f of ACC) m[f] = clone(V7[f]);
    await judge("A19d", `[${mode}] ciphertexts reused from an earlier action of the same chain`, D, m, worldFromMeta(MN), { expect: "accept (links the prover's own actions)", keepAcc: true }); }
  { const m = clone(V7);
    if (mode === "A") for (const f of ["acc_r", "acc_c1x", "acc_c1y", "acc_c2x", "acc_c2y"]) [m[f][1], m[f][2]] = [m[f][2], m[f][1]]; else [m.acc_e[1], m.acc_e[2]] = [m.acc_e[2], m.acc_e[1]];
    await judge("A19e", `[${mode}] ciphertexts of ent[1] and ent[2] swapped`, D, m, W7, { expect: "reject", keepAcc: true }); }
  { const m = clone(V7); m.acc_r[0] = S(BigInt(m.acc_r[0]) + SUBORDER);
    await judge("A19f", `[${mode}] randomness r + subgroup order (same ciphertext)`, D, m, W7, { expect: "reject (witness)", validWitnessExists: true, keepAcc: true }); }
  if (mode === "C") {
    const { eddsa, poseidon } = await init(); const bjj = eddsa.babyJub, Fq = bjj.F; const P = (xs) => eddsa.F.toObject(poseidon(xs.map(BigInt)));
    const withK = async (K) => { const m = clone(V7); const r = BigInt(m.acc_r[0]);
      const c1 = bjj.mulPointEscalar(bjj.Base8, r); const c2 = bjj.addPoint([Fq.e(K[0]), Fq.e(K[1])], bjj.mulPointEscalar([Fq.e(M7.tpk[0]), Fq.e(M7.tpk[1])], r));
      Object.assign(m, { acc_kx: S(K[0]), acc_ky: S(K[1]), acc_c1x: [S(Fq.toObject(c1[0]))], acc_c1y: [S(Fq.toObject(c1[1]))], acc_c2x: [S(Fq.toObject(c2[0]))], acc_c2y: [S(Fq.toObject(c2[1]))] });
      m.acc_e = ents.map((p, j) => [0, 1].map((b) => S((((p[b] + P([K[0], K[1], BigInt(2 * j + b)])) % RP) + RP) % RP))); return m; };
    await judge("A19g", "[C] ephemeral point K off the curve", D, await withK([BigInt(V7.acc_kx) + 1n, BigInt(V7.acc_ky)]), W7, { expect: "reject", keepAcc: true });
    await judge("A19h", "[C] ephemeral point K = identity (0, 1)", D, await withK([0n, 1n]), W7, { expect: "accept (privacy loss for the prover only)", keepAcc: true });
  }
  { // A19i: gate configured with TPK = identity; committee secret for the identity is 0
    const m = await encryptChain(clone(V7), ents, [0n, 1n], mode, "a19i"); const Wi = { ...W7, tpk: [0n, 1n], tsk: 0n };
    const clear = mode === "A" ? m.acc_c2x.every((x, j) => BigInt(x) === ents[j][0]) : null;
    await judge("A19i", `[${mode}] committee key TPK = identity configured in the gate` + (clear === null ? "" : ` (c2 == plaintext: ${clear})`), D, m, Wi, { policy: true, expect: "circuit accepts; deployment must check TPK", keepAcc: true }); }
  for (const w of words(V7)) { const m = clone(V7); if (w.length === 2) m[w[0]][w[1]] = S((BigInt(m[w[0]][w[1]]) + 1n) % R); else m[w[0]][w[1]][w[2]] = S((BigInt(m[w[0]][w[1]][w[2]]) + 1n) % R);
    await judge("A19j", `[${mode}] ciphertext word ${w.join("/")} + 1`, D, m, W7, { expect: "reject", keepAcc: true }); }
}
MODE = "C";

const sum = {}; for (const r of rows) sum[r.class] = (sum[r.class] ?? 0) + 1;
console.log(JSON.stringify({ circuit: "zkdac_v7 (v6 + R6 accountability) D=4; v6 rows mode C, A19 rows modes A and C", summary: sum, false_accepts: rows.filter((r) => r.class === "FALSE_ACCEPT"), false_rejects: rows.filter((r) => r.class === "FALSE_REJECT"), rows }, null, 1));
process.exit(0);

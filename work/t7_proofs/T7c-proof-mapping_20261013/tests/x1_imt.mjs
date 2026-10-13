// T7c X1 (PLAN.md): ordered-tree (IMT) non-membership. X1a exhaustive differential on IMTNonMember(4); X1b 252-bit truncation; X1c RevokeTransition(20)
// keeps the sorted linked list, forged insertions rejected. usage (this directory): node x1_imt.mjs > ../results/x1_imt.json 2> ../results/x1_imt.stderr
import fs from "fs"; import os from "os"; import path from "path"; import crypto from "crypto"; import { createRequire } from "module";
const W = new URL("../../../", import.meta.url).pathname;
const req = createRequire(W + "t2_circuit_fix/zkdac_v7/package.json");
const snarkjs = req("snarkjs"); const { buildBabyjub } = req("circomlibjs");
const { IMT, trunc } = await import(W + "t2_circuit_fix/zkdac_v4/scripts/imt.mjs");
const R = await import(W + "t4_obligations/E7-obligations_20261009/revoke/revoke_lib.mjs");
const { rnd250 } = await import(W + "t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs");
const WASM4 = new URL("../build/imt/imt_nm4_js/imt_nm4.wasm", import.meta.url).pathname;
const tmp = path.join(os.tmpdir(), `x1-${process.pid}.wtns`);
async function sat(wasm, input) {
  try { await snarkjs.wtns.calculate(input, wasm, tmp); return { sat: true }; }
  catch (e) { const m = String(e.message ?? e).match(/template (\S+) line: (\d+)/); return { sat: false, at: m ? `${m[1].replace(/_\d+$/, "")} L${m[2]}` : String(e).slice(0, 100) }; }
}
const out = { X1a: {}, X1b: [], X1c: {} }; const fail = (...a) => console.error("FAIL", ...a);
const P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const wit = (t, k, i) => { const l = t.leaves[i], { sib, bit } = t.path(i);
  return { key_full: String(k), root: String(t.root), low_value: String(l.value), low_next_index: String(l.nextIndex), low_next_value: String(l.nextValue), sib: sib.map(String), bit: bit.map(String) }; };

// ---------- X1a ----------
{ let cases = 0, agree = 0, completeOk = 0, completeN = 0; const disagreements = [];
  for (let mask = 0; mask < 64; mask++) {
    const S = [1, 2, 3, 4, 5, 6].filter((v, b) => mask & (1 << b)); const t = await IMT.create(4); for (const v of S) t.insert(BigInt(v));
    for (let k = 0; k <= 8; k++) {
      const member = k === 0 || S.includes(k); const pred = member ? -1 : t.lowIndex(BigInt(k)); let anyAcc = false;
      for (let i = 0; i < t.leaves.length; i++) {
        const r = await sat(WASM4, wit(t, k, i)); cases++; const expect = !member && i === pred; if (r.sat) anyAcc = true;
        if (r.sat === expect) agree++; else { disagreements.push({ S, k, leaf: i, expect, got: r }); fail("X1a", S, k, i); }
      }
      if (!member) { completeN++; if (anyAcc) completeOk++; }
    }
  }
  // forged low leaves: random fields, path of leaf 0 (and random paths)
  let forged = 0, forgedRej = 0; const t = await IMT.create(4); for (const v of [2, 4, 6]) t.insert(BigInt(v));
  for (let r = 0; r < 1000; r++) { const w = wit(t, 3, t.lowIndex(3n)); const rb = () => String(BigInt("0x" + crypto.randomBytes(31).toString("hex")) % (1n << 250n));
    const which = r % 3; if (which === 0) w.low_value = String(BigInt(r % 3)); if (which === 1) w.low_next_value = rb(); if (which === 2) { w.low_next_index = String(r); w.sib = w.sib.map(() => rb()); }
    w.low_value = which === 0 ? "1" : w.low_value;                       // value 1 < 3 < next 4 would pass the range check; only the path can reject
    const s = await sat(WASM4, w); forged++; if (!s.sat) forgedRej++; else fail("X1a forged", r, w); }
  out.X1a = { trees: 64, queries: "k = 0..8", cases, agree, disagreements, completeness: `${completeOk}/${completeN} non-members have an accepting witness`, forged_low_leaves: `${forgedRej}/${forged} rejected` };
  console.error("X1a", JSON.stringify(out.X1a).slice(0, 200)); }

// ---------- X1b ----------
{ const t = await IMT.create(4); for (const v of [5n, 9n]) t.insert(v);
  for (const k of [3n, 7n, 11n, 9n]) { const hi = k + (1n << 252n); if (hi >= P) continue;
    const a = await sat(WASM4, { ...wit(t, k, Math.max(0, t.lowIndex(trunc(k)))), key_full: String(k) }), b = await sat(WASM4, { ...wit(t, hi, Math.max(0, t.lowIndex(trunc(hi)))), key_full: String(hi) });
    out.X1b.push({ k: String(k), k_plus_2_252: String(hi), member: t.has(k), nonmember_k: a.sat, nonmember_hi: b.sat, same: a.sat === b.sat }); if (a.sat !== b.sat) fail("X1b", k); }
  { const t2 = await IMT.create(4); t2.insert(7n + (1n << 252n)); const a = await sat(WASM4, wit(t2, 7n, t2.lowIndex(7n)));      // revoking the high alias revokes 7
    out.X1b.push({ case: "insert 7 + 2^252, query 7", nonmember_7: a.sat, expected: false }); if (a.sat) fail("X1b alias"); } }

// ---------- X1c ----------
const bj = await buildBabyjub(); const F = bj.F; const L = bj.subOrder; const KEY_TAG = 2053861995n;
const H3 = (await IMT.create(1)).H;
const keyAuth = () => { const sk = BigInt("0x" + crypto.randomBytes(32).toString("hex")) % L; const A = bj.mulPointEscalar(bj.Base8, sk);
  const ia = [F.toObject(A[0]), F.toObject(A[1])]; return { a: { kind: 0, who: 0, ia, sk }, entry: H3([KEY_TAG, ia[0], ia[1]]) }; };
const decodeSorted = (t) => { const seen = new Set(); let i = 0, prev = -1n, n = 0;
  while (true) { if (seen.has(i)) return false; seen.add(i); const l = t.leaves[i]; if (l.value <= prev && i !== 0) return false; prev = l.value; n++;
    if (l.nextValue === 0n) return n === t.leaves.length; const j = Number(l.nextIndex); if (t.leaves[j]?.value !== l.nextValue) return false; i = j; } };
// variant transition: same as revoke_lib.transition with overrides
function transitionX(imt, entry, a, o = {}) {
  const k = trunc(entry); const lo = o.lo ?? imt.lowIndex(k); const low = imt.leaves[lo]; const lp = (o.pathTree ?? imt).path(lo);
  const ni = o.ni ?? imt.leaves.length; const t = R.cloneImt(imt);
  t._set(lo, { value: low.value, nextIndex: BigInt(ni), nextValue: k }); const np = t.path(ni);
  const newLeaf = o.newLeaf ?? { value: k, nextIndex: low.nextIndex, nextValue: low.nextValue }; t._set(ni, newLeaf);
  return { old_root: String(o.oldRoot ?? imt.root), new_root: String(t.root), entry: String(entry), next_index: String(ni),
    kind: String(a.kind), who: String(a.who), hop: "0", ia: a.ia.map(String), ha: ["0", "0"], cap: "0", expiry: "0", sk: String(a.sk),
    low_value: String(low.value), low_next_index: String(low.nextIndex), low_next_value: String(low.nextValue), low_sib: lp.sib.map(String), low_bit: lp.bit.map(String), new_sib: np.sib.map(String) };
}
{ const imt = await IMT.create(20); for (let k = 0; k < 20; k++) imt.insert(rnd250("v8-decoy-" + k));          // generators' genesis (E7c, v9 fixtures)
  let honestOk = 0, invOk = 0, rootOk = 0; const forg = {}; const inserted = []; const N = Number(process.env.N ?? 200);
  const rec = (name, r, contract) => { (forg[name] ??= { n: 0, unsat: 0, at: {}, sat_rows: [] }); const f = forg[name]; f.n++; if (!r.sat) { f.unsat++; f.at[r.at] = (f.at[r.at] ?? 0) + 1; } else f.sat_rows.push(contract ?? "SAT"); };
  for (let s = 0; s < N; s++) {
    const { a, entry } = keyAuth(); const prevRoot = imt.root; const prev = R.cloneImt(imt);
    if (s % 7 === 0) {                                          // forgeries on every 7th step (≥ 28 steps)
      const k = trunc(entry); const lo = imt.lowIndex(k);
      const other = imt.leaves.map((l, i) => i).filter((i) => i !== lo); const wrong = other[(s * 13) % other.length];
      rec("(i) low leaf not the predecessor", await sat(R.WASM, transitionX(imt, entry, a, { lo: wrong })));
      if (inserted.length) { const d = inserted[s % inserted.length]; rec("(ii) duplicate key", await sat(R.WASM, transitionX(imt, d.entry, d.a))); }
      rec("(iv) next_index = a used slot", await sat(R.WASM, transitionX(imt, entry, a, { ni: (s % imt.leaves.length) })));
      rec("(iii') next_index = an empty slot != count (circuit only checks emptiness)", await sat(R.WASM, transitionX(imt, entry, a, { ni: imt.leaves.length + 1 })), "SAT; rejected on chain: Rev passes count as next_index (RV-C1)");
      if (inserted.length > 1) { rec("(v) low-leaf path from a stale tree, current old_root", await sat(R.WASM, transitionX(imt, entry, a, { pathTree: inserted[0].tree })));
        rec("(v') stale old_root with its own consistent witness", await sat(R.WASM, transitionX(inserted[inserted.length - 1].tree, entry, a)), "SAT; rejected on chain: Rev passes its CURRENT root as old_root (RV-C1)"); }
      const low = imt.leaves[lo]; rec("(vi) new leaf with wrong next pointer", await sat(R.WASM, transitionX(imt, entry, a, { newLeaf: { value: k, nextIndex: low.nextIndex + 1n, nextValue: low.nextValue } })));
      rec("(vi') new leaf with wrong value", await sat(R.WASM, transitionX(imt, entry, a, { newLeaf: { value: k + 1n, nextIndex: low.nextIndex, nextValue: low.nextValue } })));
    }
    const tr = R.transition(imt, entry, a); const r = await sat(R.WASM, tr.input); if (r.sat) honestOk++; else fail("X1c honest", s, r);
    imt.insert(entry); if (String(imt.root) === String(tr.newRoot)) rootOk++; if (decodeSorted(imt)) invOk++; else fail("X1c invariant", s);
    inserted.push({ a, entry, tree: prev }); if (inserted.length > 50) inserted.splice(1, 1);
    if (s % 20 === 0) process.stderr.write(`\rX1c ${s}/${N}`);
  }
  out.X1c = { genesis: "IMT depth 20 with 20 decoys (generators' genesis)", honest_insertions: N, honest_satisfiable: honestOk, new_root_equals_js: rootOk, sorted_list_after_each: invOk, final_leaves: imt.leaves.length, forgeries: forg };
}
try { fs.unlinkSync(tmp); } catch {}
console.log(JSON.stringify(out, (k, v) => (typeof v === "bigint" ? String(v) : v), 1)); console.error("\ndone"); process.exit(0);

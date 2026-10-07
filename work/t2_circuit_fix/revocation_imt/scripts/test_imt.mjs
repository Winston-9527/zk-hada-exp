// Correctness of the IMT non-membership circuit (issue #24), witness level, depth 20.
// usage: node scripts/test_imt.mjs > results/imt_correctness.json
import { IMT, trunc } from "./imt.mjs";
import * as snarkjs from "snarkjs"; import crypto from "crypto"; import fs from "fs"; import os from "os"; import path from "path";
const DEPTH = 20, WASM = new URL(`../build/main_imt_${DEPTH}_js/main_imt_${DEPTH}.wasm`, import.meta.url).pathname;
const R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const tmp = path.join(os.tmpdir(), "imt-" + process.pid + ".wtns");
const ok = async (w) => { const { _lowIndex, ...input } = w; try { await snarkjs.wtns.calculate(input, WASM, tmp); return true; } catch { return false; } };
const rnd = (seed) => BigInt("0x" + crypto.createHash("sha256").update(String(seed)).digest("hex")) % R;   // field elements like Poseidon outputs
const t = await IMT.create(DEPTH);
const N = 300, members = []; for (let i = 0; i < N; i++) { const k = rnd("rev" + i); members.push(k); t.insert(k); }
const out = { depth: DEPTH, inserted: N, honest: { tried: 0, accepted: 0 }, negatives: [] };
// 1) honest non-members, including keys adjacent to members and the extremes
const queries = []; for (let i = 0; i < 200; i++) queries.push(rnd("q" + i));
const sorted = members.map(trunc).sort((a, b) => (a < b ? -1 : 1));
queries.push(sorted[0] - 1n, sorted[0] + 1n, sorted[N - 1] + 1n, (1n << 252n) - 1n, 1n);
for (const q of queries) { if (t.has(trunc(q)) || trunc(q) === 0n) continue; out.honest.tried++; if (await ok(t.nonMemberWitness(q))) out.honest.accepted++; }
// 2) negatives — every one must be rejected
const neg = async (name, w) => out.negatives.push({ name, accepted: await ok(w) });
const m = members[7], km = trunc(m);
{ // revoked key: use its predecessor leaf (low.value < k holds, but low.next_value == k so k < next fails)
  const lo = t.lowIndex(km), low = t.leaves[lo], { sib, bit } = t.path(lo);
  await neg("member_with_predecessor_leaf", { key_full: m.toString(), root: t.root.toString(), low_value: low.value.toString(), low_next_index: low.nextIndex.toString(), low_next_value: low.nextValue.toString(), sib: sib.map(String), bit: bit.map(String) });
  const mi = t.leaves.findIndex((l) => l.value === km), ml = t.leaves[mi], p2 = t.path(mi);   // member's own leaf: low.value < k fails (equal)
  await neg("member_with_own_leaf", { key_full: m.toString(), root: t.root.toString(), low_value: ml.value.toString(), low_next_index: ml.nextIndex.toString(), low_next_value: ml.nextValue.toString(), sib: p2.sib.map(String), bit: p2.bit.map(String) });
}
{ // member key: forge a low leaf that "skips" it (value < k < next) — not in the tree
  const lo = t.lowIndex(km), low = t.leaves[lo], { sib, bit } = t.path(lo);
  const after = t.leaves.find((l) => l.value === km).nextValue;
  await neg("member_forged_skip_leaf_old_path", { key_full: m.toString(), root: t.root.toString(), low_value: low.value.toString(), low_next_index: low.nextIndex.toString(), low_next_value: after.toString(), sib: sib.map(String), bit: bit.map(String) });
}
{ // member key claimed via the last element's "end" sentinel semantics
  const last = t.leaves.findIndex((l) => l.nextValue === 0n), L = t.leaves[last], p = t.path(last);
  await neg("member_via_end_leaf", { key_full: m.toString(), root: t.root.toString(), low_value: L.value.toString(), low_next_index: L.nextIndex.toString(), low_next_value: "0", sib: p.sib.map(String), bit: p.bit.map(String) });
}
{ // member key, aliased field representative (k + p wraps; and k + 2^252 shares the low 252 bits only if < p)
  const w = t.nonMemberWitness(rnd("q0")); w.key_full = ((m + R) % R).toString();   // identical field element -> still a member
  await neg("member_key_mod_p_representative", { ...w, key_full: m.toString() });
}
{ const w = t.nonMemberWitness(rnd("q1")); w.bit[0] = "2"; await neg("non_boolean_path_bit", w); }
{ const w = t.nonMemberWitness(rnd("q2")); w.low_next_value = (BigInt(w.low_next_value) + 1n).toString(); await neg("next_value_tampered", w); }
{ const w = t.nonMemberWitness(rnd("q3")); w.low_value = ((1n << 252n) + BigInt(w.low_value)).toString(); await neg("low_value_ge_2^252", w); }
{ const w = t.nonMemberWitness(rnd("q4")); w.root = (BigInt(w.root) + 1n).toString(); await neg("wrong_root", w); }
{ const w = t.nonMemberWitness(rnd("q5")); const other = t.nonMemberWitness(rnd("q6")); if (other._lowIndex !== w._lowIndex) { w.key_full = other.key_full; await neg("low_leaf_of_a_different_gap", w); } }
{ const w = t.nonMemberWitness(rnd("q7")); w.key_full = "0"; await neg("key_zero_sentinel", w); }
out.summary = { honest_accepted: `${out.honest.accepted}/${out.honest.tried}`, negatives_accepted: out.negatives.filter((x) => x.accepted).map((x) => x.name), negatives: out.negatives.length };
console.log(JSON.stringify(out, null, 1)); process.exit(0);

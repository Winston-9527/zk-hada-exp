// E3.2 (update cost vs descendants) and E3.3 (witness maintenance for other holders), PREREGISTRATION.md.
// usage: node e32_e33.mjs > results/e32_e33.json. Entries are random 250-bit values standing in for Poseidon outputs (certificate / key hashes).
// IMT = the off-circuit indexed Merkle tree used by every v4–v7 generator (../../t2_circuit_fix/zkdac_v4/scripts/imt.mjs; lowIndex is a linear scan).
import crypto from "crypto";
import * as W from "./world.mjs";
const rnd = () => BigInt("0x" + crypto.randomBytes(32).toString("hex")) % (1n << 250n);
const now = () => performance.now();
async function imtWith(n) { const t = await W.IMT.create(20); for (let i = 0; i < n; i++) t.insert(rnd()); return t; }
function counted(t) { const H = t.H; t.calls = 0; t.H = (xs) => { t.calls++; return H(xs); }; return t; }
const stats = (xs) => { const n = xs.length, mu = xs.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1)) : 0, s = [...xs].sort((a, b) => a - b);
  return { n, mean: +mu.toFixed(3), sd: +sd.toFixed(3), median: s[(n - 1) >> 1], p95: s[Math.min(n - 1, Math.ceil(0.95 * n) - 1)], max: s[n - 1] }; };
const out = { date: new Date().toISOString(), E32: [], E33: [], E33_issued: [] };

// ---------------- E3.2 ----------------
// one human; B = 8 top branches under the master, each with k descendants; revoke branch 0.
for (const k of [1, 10, 100, 1000, 10000]) {
  const B = 8, chainsOfHuman = 1 + B * (1 + k);                       // master + branch heads + descendants
  const res = { k, chains_of_human: chainsOfHuman };
  for (const strat of ["per-hop", "enumerate", "root-only"]) {
    const t = counted(await imtWith(1000)); const nIns = strat === "enumerate" ? k + 1 : 1; const vals = Array.from({ length: nIns }, rnd);
    t.calls = 0; const t0 = now(); for (const v of vals) t.insert(v); const ms = now() - t0;
    res[strat] = { inserts: nIns, poseidon_calls: t.calls, ms: +ms.toFixed(1), entries_published: nIns, collateral_chains: strat === "root-only" ? chainsOfHuman - (1 + k) : 0,
      operator_must_know_descendants: strat === "enumerate" };
  }
  out.E32.push(res); console.error("E3.2 k=" + k, res["per-hop"].ms, res.enumerate.ms);
}

// ---------------- E3.3 helpers ----------------
const H2 = (t, a, b) => t.H([a, b]);
function rootFrom(t, leafHash, idx, sib) { let h = leafHash, i = BigInt(idx); for (let l = 0; l < t.depth; l++) { h = (i & 1n) ? H2(t, BigInt(sib[l]), h) : H2(t, h, BigInt(sib[l])); i >>= 1n; } return h; }
function witnessRoot(t, w) { return rootFrom(t, t.H([BigInt(w.low_value), BigInt(w.low_next_index), BigInt(w.low_next_value)]), w._lowIndex, w.sib); }
// operator broadcast after a batch: every changed leaf (index, record) with its FINAL path
function broadcast(t, changed) { return [...changed].map((i) => ({ i, rec: { ...t.leaves[i] }, path: t.path(i).sib })); }
// holder-side update from the broadcast only (no query revealing the holder's entries)
function localUpdate(t, w, key, bc) {
  const k = W.trunc(key);
  // 1. low leaf: best of (old low leaf, possibly updated) and any broadcast leaf with value < k
  let lowIdx = w._lowIndex, rec = { value: BigInt(w.low_value), nextIndex: BigInt(w.low_next_index), nextValue: BigInt(w.low_next_value) };
  const byIdx = new Map(bc.map((x) => [x.i, x]));
  if (byIdx.has(lowIdx)) rec = byIdx.get(lowIdx).rec;
  for (const x of bc) if (x.rec.value < k && x.rec.value > rec.value) { lowIdx = x.i; rec = x.rec; }
  // 2. path: start from the old path (or the broadcast path if the low leaf itself was broadcast), then patch the sibling at the divergence level of every changed leaf
  let sib = byIdx.has(lowIdx) ? [...byIdx.get(lowIdx).path].map(BigInt) : w.sib.map(BigInt);
  if (!byIdx.has(lowIdx)) for (const x of bc) {
    const d = BigInt(lowIdx) ^ BigInt(x.i); if (d === 0n) continue; const l = d.toString(2).length - 1;   // x lies in the sibling subtree at level l
    let h = t.H([x.rec.value, x.rec.nextIndex, x.rec.nextValue]), i = BigInt(x.i);
    for (let m = 0; m < l; m++) { h = (i & 1n) ? H2(t, BigInt(x.path[m]), h) : H2(t, h, BigInt(x.path[m])); i >>= 1n; }
    sib[l] = h;
  }
  return { low_value: String(rec.value), low_next_index: String(rec.nextIndex), low_next_value: String(rec.nextValue), sib: sib.map(String), _lowIndex: lowIdx };
}

// ---------------- E3.3: revocation IMT ----------------
for (const R of [1000, 10000]) {
  const base = await imtWith(R);
  for (const N of [32, 128, 1024]) for (const b of [1, 10, 100]) {
    const t = await W.IMT.create(20); t.leaves = structuredClone(base.leaves); t.levels = base.levels.map((m) => new Map(m));   // copy of the pre-filled tree
    const holders = Array.from({ length: N }, () => Array.from({ length: 7 }, rnd));
    const wit = holders.map((es) => es.map((e) => t.nonMemberWitness(e)));
    const n0 = t.leaves.length; const changed = new Set();
    for (let j = 0; j < b; j++) { const v = rnd(); const lo = t.lowIndex(W.trunc(v)); t.insert(v); changed.add(lo); changed.add(t.leaves.length - 1); }
    const bc = broadcast(t, changed); const newRoot = t.root;
    let stale = 0, lowChanged = 0, okLocal = 0, total = 0; const sibChanged = [], refreshMs = [], localMs = [];
    for (let h = 0; h < N; h++) {
      let t0 = now(); const fresh = holders[h].map((e) => t.nonMemberWitness(e)); refreshMs.push(now() - t0);
      t0 = now(); const loc = holders[h].map((e, j) => localUpdate(t, wit[h][j], e, bc)); localMs.push(now() - t0);
      for (let j = 0; j < 7; j++) { total++; const o = wit[h][j], f = fresh[j];
        if (witnessRoot(t, o) !== newRoot) stale++;
        if (o._lowIndex !== f._lowIndex || o.low_next_value !== f.low_next_value || o.low_next_index !== f.low_next_index) lowChanged++;
        if (o._lowIndex === f._lowIndex) sibChanged.push(o.sib.filter((s, l) => s !== f.sib[l]).length);
        const L = loc[j]; if (L._lowIndex === f._lowIndex && L.low_value === f.low_value && L.low_next_index === f.low_next_index && L.low_next_value === f.low_next_value && L.sib.every((s, l) => s === f.sib[l]) && witnessRoot(t, L) === newRoot) okLocal++; }
    }
    const bcBytes = bc.length * (4 + 3 * 32 + 20 * 32);
    out.E33.push({ R, N, inserts: b, witnesses: total, stale_under_new_root: `${stale}/${total}`, low_leaf_changed: `${lowChanged}/${total}`, changed_siblings_per_witness: stats(sibChanged),
      broadcast_update_equals_recompute: `${okLocal}/${total}`, broadcast_leaves: bc.length, broadcast_bytes: bcBytes, full_tree_download_bytes: (n0 + b) * 3 * 32,
      holder_refresh_ms_full_recompute: stats(refreshMs), holder_refresh_ms_broadcast: stats(localMs) });
    console.error(`E3.3 R=${R} N=${N} b=${b}: stale ${stale}/${total}, local ${okLocal}/${total}`);
  }
}

// ---------------- E3.3: issued tree (depth 16, append-only index tree) ----------------
for (const N of [32, 128, 1024]) for (const b of [1, 10, 100]) {
  const T = new W.SparseTree(W.MD); for (let i = 0; i < 1000; i++) T.append(rnd());
  const certs = Array.from({ length: N * 3 }, () => T.append(rnd()));                // 3 certificates (hops 1..3) per holder
  const old = certs.map((i) => T.path(i).sib); for (let j = 0; j < b; j++) T.append(rnd());
  const nw = certs.map((i) => T.path(i).sib); const ch = old.map((s, x) => s.filter((v, l) => v !== nw[x][l]).length);
  out.E33_issued.push({ N, issuances: b, paths: certs.length, stale_under_new_root: `${ch.filter((c) => c > 0).length}/${certs.length}`, changed_siblings_per_path: stats(ch) });
}
console.log(JSON.stringify(out, null, 1)); process.exit(0);

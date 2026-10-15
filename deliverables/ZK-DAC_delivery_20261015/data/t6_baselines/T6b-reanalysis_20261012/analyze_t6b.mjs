// T6b (PREREGISTRATION.md): ratio grid over gas-accounting choices + paired component test. usage: node analyze_t6b.mjs > results/analysis_t6b.json
import fs from "fs"; import crypto from "crypto";
const T6 = new URL("../T6-baselines_20261010/results/", import.meta.url).pathname, T5 = new URL("../../t5_e2e/T5-e2e-scale_20261010/results/", import.meta.url).pathname;
const js = (f) => JSON.parse(fs.readFileSync(f, "utf8")); const jl = (f) => fs.readFileSync(f, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const mean = (x) => x.reduce((a, b) => a + b, 0) / x.length;
const q = (x, p) => { const s = [...x].sort((a, b) => a - b); const h = (s.length - 1) * p, lo = Math.floor(h); return s[lo] + (h - lo) * (s[Math.min(lo + 1, s.length - 1)] - s[lo]); };
function rng(seed) { let c = 0; return () => crypto.createHash("sha256").update(`${seed}-${c++}`).digest().readUInt32BE(0) / 2 ** 32; }
const holm = (ps) => { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]); const adj = Array(ps.length); let mx = 0; o.forEach(([p, i], k) => { mx = Math.max(mx, Math.min(1, (ps.length - k) * p)); adj[i] = mx; }); return adj; };
function signFlip(d, seed, B = 10000) { const r = rng(seed), obs = Math.abs(mean(d)); let ge = 0; for (let b = 0; b < B; b++) { let s = 0; for (const x of d) s += r() < 0.5 ? -x : x; if (Math.abs(s / d.length) >= obs - 1e-12) ge++; } return (ge + 1) / (B + 1); }
const INTR = 21000; const law = (D) => 529576 + 7763 * D;   // T5 gas_vs_note_index.txt at popcount 0
const measured = { 2: 577509, 4: 564147 };                    // ../../t2_circuit_fix/zkdac_v9/RESULTS.md (anvil receipts)
const b0 = js(T6 + "b0_anvil.json"), t5 = js(T5 + "analysis.json"), t6 = js(T6 + "analysis.json");
const out = { note: "gas = receipt gasUsed unless 'minus_intrinsic'; ratio = v9 / B0", b0_medians: {}, ratio_grid: {}, ranges: {} };
const all = { fresh: [], world: [] };
for (const D of [1, 2, 3, 4]) { const x = b0.rows.filter((r) => r.D === D); const b = { first: q(x.map((r) => r.first.gasUsed), 0.5), second: q(x.map((r) => r.second.gasUsed), 0.5) };
  out.b0_medians[D] = { ...b, t6_analysis_json_first_median: t6.B0_plaintext.by_D[D].first_execute_gas.median };
  const v = { law_popcount0: law(D), ...(measured[D] ? { measured_receipt: measured[D] } : {}), t5_world_mean: t5.e4b_epoch1.gas_by_D[D].mean };
  out.ratio_grid[D] = {};
  for (const [vk, vg] of Object.entries(v)) for (const [bk, bg] of Object.entries(b)) for (const intr of [false, true]) {
    const r = intr ? (vg - INTR) / (bg - INTR) : vg / bg; const key = `${vk} / B0_${bk}${intr ? " minus_intrinsic" : ""}`; out.ratio_grid[D][key] = +r.toFixed(2);
    (vk === "t5_world_mean" ? all.world : all.fresh).push(r); }
  out.ratio_grid[D].t6_reported = { fresh: t6.B0_plaintext.by_D[D].privacy_cost_vs_v9.ratio.fresh, T5_world: t6.B0_plaintext.by_D[D].privacy_cost_vs_v9.ratio.T5_world }; }
out.ranges = { fresh_tree: [Math.min(...all.fresh), Math.max(...all.fresh)].map((x) => +x.toFixed(2)), t5_world: [Math.min(...all.world), Math.max(...all.world)].map((x) => +x.toFixed(2)) };
// paired component test
const c = jl(T6 + "comp_bench.jsonl"); const ps = [], keys = [];
for (const D of [1, 2, 3, 4]) for (const [a, bv] of [["v6", "v7"], ["v7", "v8"], ["v8", "v9"]]) {
  const by = (v) => Object.fromEntries(c.filter((r) => r.D === D && r.version === v).map((r) => [`${r.block}-${r.seed}`, r.prove_ms]));
  const A = by(a), Bm = by(bv); const k = Object.keys(A).filter((s) => s in Bm); const d = k.map((s) => Bm[s] - A[s]);
  ps.push(signFlip(d, `t6b-${D}-${a}${bv}`)); keys.push({ D, pair: `${a}->${bv}`, n_pairs: d.length, mean_diff_ms: +mean(d).toFixed(1) }); }
const adj = holm(ps); const t6t = t6.components.tests;
out.components_paired = keys.map((k, i) => { const u = t6t.find((t) => t.D === k.D && t.pair === k.pair); const sigP = adj[i] < 0.05, sigU = u.p_holm < 0.05;
  return { ...k, p_signflip: +ps[i].toFixed(4), p_holm: +adj[i].toFixed(4), t6_unpaired_p_holm: u.p_holm, same_decision_at_005: sigP === sigU }; });
console.log(JSON.stringify(out, null, 1));

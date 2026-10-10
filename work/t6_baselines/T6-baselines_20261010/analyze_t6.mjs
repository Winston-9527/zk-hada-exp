// T6 statistics as pre-registered. usage: node analyze_t6.mjs > results/analysis.json
import fs from "fs"; import crypto from "crypto";
const R = new URL("results/", import.meta.url).pathname; const T5 = new URL("../../t5_e2e/T5-e2e-scale_20261010/results/", import.meta.url).pathname;
const js = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null);
const jl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const mean = (x) => x.reduce((a, b) => a + b, 0) / x.length; const sd = (x) => Math.sqrt(x.reduce((a, b) => a + (b - mean(x)) ** 2, 0) / (x.length - 1));
const q = (x, p) => { const s = [...x].sort((a, b) => a - b); const h = (s.length - 1) * p, lo = Math.floor(h); return s[lo] + (h - lo) * (s[Math.min(lo + 1, s.length - 1)] - s[lo]); };
const r3 = (x) => (x == null ? x : +x.toPrecision(4));
const summ = (x) => (x.length ? { n: x.length, mean: r3(mean(x)), sd: x.length > 1 ? r3(sd(x)) : null, median: r3(q(x, 0.5)), p95: r3(q(x, 0.95)), min: r3(Math.min(...x)), max: r3(Math.max(...x)) } : { n: 0 });
function rng(seed) { let c = 0; return () => crypto.createHash("sha256").update(`${seed}-${c++}`).digest().readUInt32BE(0) / 2 ** 32; }
function perm(x, y, seed, B = 10000) { const r = rng(seed), obs = Math.abs(mean(x) - mean(y)), all = [...x, ...y]; let ge = 0;
  for (let b = 0; b < B; b++) { const a = [...all]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } if (Math.abs(mean(a.slice(0, x.length)) - mean(a.slice(x.length))) >= obs - 1e-12) ge++; } return (ge + 1) / (B + 1); }
const holm = (ps) => { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]); const adj = Array(ps.length); let mx = 0; o.forEach(([p, i], k) => { mx = Math.max(mx, Math.min(1, (ps.length - k) * p)); adj[i] = mx; }); return adj; };
const out = { note: "times in ms unless stated; gas = receipt gasUsed (includes intrinsic and calldata)" };
// B1 go-ucan
const u = js(R + "ucan_bench.json");
if (u) out.B1_go_ucan = { impl: u.impl, N: u.N, by_D: Object.fromEntries([1, 2, 3, 4].map((D) => { const x = u.rows.filter((r) => r.D === D);
  return [D, { issue_ms_per_edge: summ(x.map((r) => r.issue_ms_per_edge)), invoke_ms: summ(x.map((r) => r.invoke_ms)), verify_ms: summ(x.map((r) => r.verify_ms)), bytes_total: summ(x.map((r) => r.bytes_total)),
    accepted: `${x.filter((r) => r.accepted).length}/${x.length}`, overspend_rejected: `${x.filter((r) => r.overspend_rejected).length}/${x.length}` }]; })) };
// B2 DAC-EQS
const d = js(R + "dac_bench.json");
if (d) { const d1 = d.rows.filter((r) => r.D === 1), d2 = d.rows.filter((r) => r.D === 2);
  out.B2_dac_eqs = { impl: d.impl, N: d.N, na: d.na, D1: { issue_ms: summ(d1.map((r) => r.issue_ms)), show_ms: summ(d1.map((r) => r.show_ms)), verify_ms: summ(d1.map((r) => r.verify_ms)), proof_bytes: summ(d1.map((r) => r.proof_bytes)), accepted: `${d1.filter((r) => r.accepted).length}/${d1.length}`, wrong_subset_rejected: `${d1.filter((r) => r.wrong_subset_rejected).length}/${d1.length}` },
    D2: { issue_ms: summ(d2.map((r) => r.issue_ms)), delegate_ms: summ(d2.map((r) => r.delegate_ms)), verify_cred_ms: summ(d2.map((r) => r.verify_cred_ms)), cred_bytes: summ(d2.map((r) => r.cred_bytes)), accepted: `${d2.filter((r) => r.accepted).length}/${d2.length}` } }; }
// B3 zk-creds (criterion: technical replicates of one witness)
const zdir = R + "zkcreds_criterion/";
if (fs.existsSync(zdir)) { out.B3_zkcreds = { note: "criterion estimates over repeated runs of ONE witness (technical replicates); mean point estimate and 95% CI, ms", benches: {} };
  for (const f of fs.readdirSync(zdir)) { const e = js(zdir + f); out.B3_zkcreds.benches[f.replace(".json", "")] = { mean_ms: r3(e.mean.point_estimate / 1e6), ci95_ms: [r3(e.mean.confidence_interval.lower_bound / 1e6), r3(e.mean.confidence_interval.upper_bound / 1e6)], median_ms: r3(e.median.point_estimate / 1e6) }; }
  if (fs.existsSync(R + "zkcreds_proof_sizes.csv")) out.B3_zkcreds.proof_sizes = fs.readFileSync(R + "zkcreds_proof_sizes.csv", "utf8").trim().split("\n"); }
// B0 plaintext
const b0 = js(R + "b0_anvil.json");
const v9law = (pc, D) => 529576 + 27089 * pc + 7763 * D;   // T5 results/gas_vs_note_index.txt
if (b0) { out.B0_plaintext = { by_D: {}, sanity: b0.sanity.map((s) => ({ D: s.D, case: s.case, status: s.status, reason: s.reason })) };
  const t5 = js(T5 + "analysis.json");
  for (const D of [1, 2, 3, 4]) { const x = b0.rows.filter((r) => r.D === D); const first = x.map((r) => r.first.gasUsed), second = x.map((r) => r.second.gasUsed);
    const v9world = t5?.e4b_epoch1?.gas_by_D?.[D]?.mean;
    out.B0_plaintext.by_D[D] = { first_execute_gas: summ(first), second_execute_gas: summ(second), calldata_bytes: summ(x.map((r) => r.first.calldata_bytes)), all_status_1: x.every((r) => r.first.status === 1 && r.second.status === 1),
      privacy_cost_vs_v9: { v9_fresh_tree_popcount0: v9law(0, D), v9_T5_world_mean: v9world, minus_B0_median_first: { fresh: v9law(0, D) - q(first, 0.5), T5_world: v9world ? Math.round(v9world - q(first, 0.5)) : null },
        ratio: { fresh: +(v9law(0, D) / q(first, 0.5)).toFixed(2), T5_world: v9world ? +(v9world / q(first, 0.5)).toFixed(2) : null } } }; } }
// component costs v6..v9
const c = jl(R + "comp_bench.jsonl");
if (c.length) { out.components = { by_D: {}, tests: [] }; const ps = [], keys = [];
  for (const D of [1, 2, 3, 4]) { out.components.by_D[D] = {};
    for (const v of ["v6", "v7", "v8", "v9"]) { const x = c.filter((r) => r.D === D && r.version === v); out.components.by_D[D][v] = { prove_ms: summ(x.map((r) => r.prove_ms)), witness_ms: summ(x.map((r) => r.witness_ms)), public_inputs: x[0]?.public_inputs }; }
    for (const [a, b] of [["v6", "v7"], ["v7", "v8"], ["v8", "v9"]]) { const xa = c.filter((r) => r.D === D && r.version === a).map((r) => r.prove_ms), xb = c.filter((r) => r.D === D && r.version === b).map((r) => r.prove_ms);
      if (xa.length && xb.length) { ps.push(perm(xa, xb, `t6c-${D}-${a}${b}`)); keys.push({ D, pair: `${a}->${b}`, diff_ms: r3(mean(xb) - mean(xa)), ratio: +(mean(xb) / mean(xa)).toFixed(3) }); } } }
  const adj = holm(ps); out.components.tests = keys.map((k, i) => ({ ...k, p_perm: +ps[i].toFixed(4), p_holm: +adj[i].toFixed(4) }));
  out.components.constraints = { v6: [38266, 81944, 125622, 169300], v7: [47058, 91948, 136838, 181728], v8: [60708, 105598, 150488, 195378], v9: [60622, 105424, 150226, 195028], source: "snarkjs r1cs info on build/*/main*.r1cs of each version" };
  out.components.per_block_mean_prove = Object.fromEntries([1, 2, 3].map((b) => [b, Object.fromEntries(["v6", "v7", "v8", "v9"].map((v) => [v, r3(mean(c.filter((r) => r.block === b && r.version === v && r.D === 4).map((r) => r.prove_ms)))]))])); }
// RSS
const L = R + "logs/"; out.peak_rss_bytes = Object.fromEntries(fs.readdirSync(L).filter((f) => f.endsWith(".stderr")).map((f) => { const m = fs.readFileSync(L + f, "utf8").match(/(\d+)\s+maximum resident set size/); return [f, m ? +m[1] : null]; }));
console.log(JSON.stringify(out, null, 1));

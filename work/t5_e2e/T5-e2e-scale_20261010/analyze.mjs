// T5 statistics exactly as pre-registered (PREREGISTRATION.md "Statistics"). usage: node analyze.mjs > results/analysis.json
import fs from "fs"; import crypto from "crypto";
const RES = new URL("results/", import.meta.url).pathname;
const jl = (f) => fs.existsSync(RES + f) ? fs.readFileSync(RES + f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
const js = (f) => fs.existsSync(RES + f) ? JSON.parse(fs.readFileSync(RES + f, "utf8")) : null;
function rng(seed) { let c = 0; return () => crypto.createHash("sha256").update(`${seed}-${c++}`).digest().readUInt32BE(0) / 2 ** 32; }
const mean = (x) => x.reduce((a, b) => a + b, 0) / x.length;
const sd = (x) => { const m = mean(x); return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1)); };
const q = (x, p) => { const s = [...x].sort((a, b) => a - b); const h = (s.length - 1) * p, lo = Math.floor(h); return s[lo] + (h - lo) * ((s[Math.min(lo + 1, s.length - 1)]) - s[lo]); };   // linear interpolation (type 7)
const B = 10000;
function bootMean(x, seed) { const r = rng(seed), ms = []; for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < x.length; i++) s += x[Math.floor(r() * x.length)]; ms.push(s / x.length); } return [q(ms, 0.025), q(ms, 0.975)]; }
function bootDiff(x, y, seed) { const r = rng(seed), ds = []; for (let b = 0; b < B; b++) { let sx = 0, sy = 0; for (let i = 0; i < x.length; i++) sx += x[Math.floor(r() * x.length)]; for (let i = 0; i < y.length; i++) sy += y[Math.floor(r() * y.length)]; ds.push(sx / x.length - sy / y.length); } return [q(ds, 0.025), q(ds, 0.975)]; }
function perm(x, y, seed) { const r = rng(seed), obs = Math.abs(mean(x) - mean(y)), all = [...x, ...y]; let ge = 0;
  for (let b = 0; b < B; b++) { const a = [...all]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } if (Math.abs(mean(a.slice(0, x.length)) - mean(a.slice(x.length))) >= obs - 1e-12) ge++; } return (ge + 1) / (B + 1); }
const holm = (ps) => { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]); const adj = Array(ps.length); let mx = 0; o.forEach(([p, i], k) => { mx = Math.max(mx, Math.min(1, (ps.length - k) * p)); adj[i] = mx; }); return adj; };
const ols = (xs, ys) => { const mx = mean(xs), my = mean(ys); let n = 0, d = 0; xs.forEach((x, i) => { n += (x - mx) * (ys[i] - my); d += (x - mx) ** 2; }); return n / d; };
function slopeCI(byD, seed) { const r = rng(seed), sl = []; for (let b = 0; b < B; b++) { const xs = [], ys = []; for (const [D, v] of Object.entries(byD)) for (let i = 0; i < v.length; i++) { xs.push(+D); ys.push(v[Math.floor(r() * v.length)]); } sl.push(ols(xs, ys)); } return [q(sl, 0.025), q(sl, 0.975)]; }
const r1 = (x) => (x == null ? x : +x.toFixed(1));
const summ = (x, seed) => x.length ? { n: x.length, mean: r1(mean(x)), sd: x.length > 1 ? r1(sd(x)) : null, median: r1(q(x, 0.5)), p95: r1(q(x, 0.95)), max: r1(Math.max(...x)), min: r1(Math.min(...x)), mean_ci95: x.length > 1 ? bootMean(x, seed).map(r1) : null } : { n: 0 };
const STAGES = ["S1_fetch", "S2_assembly", "S3_witness", "S4_prove", "S5_verify", "S6_submit", "S7_inclusion"];
const pick = (rows, k) => rows.map((r) => (k in r ? r[k] : r.T?.[k])).filter((v) => typeof v === "number");
const out = { note: "ms unless stated; p95 by linear interpolation; p99 not estimable with N = 30 (max reported); bootstrap 10^4, permutation 10^4, seeds fixed" };
// ---------- E4a ----------
const steadyAll = jl("e4a_steady.jsonl"), coldAll = jl("e4a_cold.jsonl");
const steady = steadyAll.filter((r) => r.kind === "measured"), warm = steadyAll.filter((r) => r.kind === "warmup");
out.e4a_failures = { steady: steadyAll.filter((r) => r.error || r.status !== 1).map((r) => ({ agent: r.agent, D: r.D, kind: r.kind, error: r.error, status: r.status, reason: r.reason })), cold: coldAll.filter((r) => r.error || r.status !== 1).map((r) => ({ agent: r.agent, D: r.D, error: r.error, status: r.status, reason: r.reason })) };
const okS = steady.filter((r) => r.status === 1), okC = coldAll.filter((r) => r.status === 1);
out.e4a = {};
for (const D of [1, 2, 3, 4]) { const s = okS.filter((r) => r.D === D), c = okC.filter((r) => r.D === D), w = warm.filter((r) => r.D === D && r.status === 1);
  const e = { steady: {}, cold: {}, warmup_local_ms: w.map((r) => r.local_ms) };
  for (const k of [...STAGES, "local_ms", "e2e_ms", "gasUsed", "calldataBytes"]) { e.steady[k] = summ(pick(s, k), `s-${D}-${k}`); e.cold[k] = summ(pick(c, k), `c-${D}-${k}`); }
  for (const k of ["node_boot_ms", "import_ms", "wallet_load_ms"]) e.cold[k] = summ(pick(c, k), `c-${D}-${k}`);
  e.cold_minus_steady = {}; for (const k of ["local_ms", "S4_prove", "S3_witness", "S1_fetch", "S2_assembly"]) { const a = pick(c, k), b = pick(s, k); if (a.length > 1 && b.length > 1) e.cold_minus_steady[k] = { diff: r1(mean(a) - mean(b)), ci95: bootDiff(a, b, `cs-${D}-${k}`).map(r1), p_perm: +perm(a, b, `pcs-${D}-${k}`).toFixed(4) }; }
  e.per_block_local_mean = [1, 2, 3].map((b) => { const x = pick(s.filter((r) => r.block === b), "local_ms"); return x.length ? r1(mean(x)) : null; });
  const bm = e.per_block_local_mean.filter((x) => x != null); e.block_flag_gt10pct = bm.some((x) => bm.some((y) => Math.abs(x - y) / Math.min(x, y) > 0.1));
  e.peak_rss_stage_bytes = Math.max(0, ...[...s, ...c].flatMap((r) => Object.values(r.rss ?? {})));
  out.e4a[D] = e; }
// D effect
const byD = (k, rows) => Object.fromEntries([1, 2, 3, 4].map((D) => [D, pick(rows.filter((r) => r.D === D), k)]));
out.d_effect = {};
for (const k of ["S4_prove", "local_ms"]) { const g = byD(k, okS); const xs = [], ys = []; for (const [D, v] of Object.entries(g)) v.forEach((y) => { xs.push(+D); ys.push(y); });
  const pairs = [[1, 2], [2, 3], [3, 4]]; const ps = pairs.map(([a, b]) => perm(g[a], g[b], `pd-${k}-${a}${b}`)); const adj = holm(ps);
  out.d_effect[k] = { slope_ms_per_hop: r1(ols(xs, ys)), slope_ci95: slopeCI(g, `sl-${k}`).map(r1),
    adjacent: pairs.map(([a, b], i) => ({ pair: `${a}-${b}`, diff: r1(mean(g[b]) - mean(g[a])), ratio: +(mean(g[b]) / mean(g[a])).toFixed(3), p_perm: +ps[i].toFixed(4), p_holm: +adj[i].toFixed(4) })) }; }
// RSS from /usr/bin/time -l
const logs = fs.existsSync(RES + "logs") ? fs.readdirSync(RES + "logs").filter((f) => f.endsWith(".stderr")) : [];
out.process_peak_rss_bytes = Object.fromEntries(logs.map((f) => { const m = fs.readFileSync(RES + "logs/" + f, "utf8").match(/(\d+)\s+maximum resident set size/); return [f.replace(".stderr", ""), m ? +m[1] : null]; }));
const rssVals = Object.values(out.process_peak_rss_bytes).filter((x) => x != null);
out.verifier_gas = jl("e4a_verifier_gas.jsonl");
// targets (fixed before the run; research design line 300)
const d4s = pick(okS.filter((r) => r.D === 4), "local_ms"), d4c = pick(okC.filter((r) => r.D === 4), "local_ms"); const vg4 = out.verifier_gas.find((v) => v.D === 4);
out.targets = { "T-lat steady D=4 p95(local) <= 10000 ms": d4s.length ? { p95: r1(q(d4s, 0.95)), pass: q(d4s, 0.95) <= 10000 } : null,
  "T-lat cold D=4 p95(local) <= 10000 ms": d4c.length ? { p95: r1(q(d4c, 0.95)), pass: q(d4c, 0.95) <= 10000 } : null,
  "T-mem peak RSS <= 8 GiB (all processes)": rssVals.length ? { max_bytes: Math.max(...rssVals), max_GiB: +(Math.max(...rssVals) / 2 ** 30).toFixed(2), pass: Math.max(...rssVals) <= 8 * 2 ** 30 } : null,
  "T-gas verifier-only D=4 <= 500k": vg4 ? { verifier_exec_gas: vg4.verifier_exec_gas, pass: vg4.verifier_exec_gas <= 500000 } : null };
// ---------- issuance + world ----------
const ib = js("issuance_bench.json"); if (ib) out.issuance = { cert_formula_matches_world: ib.cert_formula_matches_world, keygen_ms: summ(ib.rows.map((r) => r.keygen_ms), "ik"), hash_and_sign_ms: summ(ib.rows.map((r) => r.hash_and_sign_ms), "is") };
const wb = js("world_build.json"); if (wb) { out.world = { agents: wb.agents, agents_by_D: wb.agents_by_D, transfers: wb.transfers, gas: Object.fromEntries(Object.entries(wb.gas).map(([k, v]) => [k, summ(v, "wg" + k)])), ms: Object.fromEntries(Object.entries(wb.ms).map(([k, v]) => [k, summ(v, "wm" + k)])) }; }
// ---------- E4b ----------
const e1 = js("e4b_epoch1.json"); const e1rows = jl("e4b_epoch1_rows.jsonl");
if (e1) { const ok = e1rows.filter((r) => r.status === 1);
  out.e4b_epoch1 = { accepted: e1.accepted, of: e1.agents, failed_by_reason: e1.failed_by_reason, build_errors: e1.build_errors.length, blocks_used: e1.blocks_used, txs_per_block: summ(e1.blocks.map((b) => b.txs), "tpb"), gas_per_block: summ(e1.blocks.map((b) => b.gasUsed), "gpb"),
    chain_time_drain_s: e1.chain_time_drain_s, last_inclusion_minus_R0_retirement_s: e1.last_inclusion_minus_R0_retirement_s, note_window_s: e1.note_window_s,
    proof_generation_wall_s: r1(e1.proof_generation_wall_ms / 1000), proofs_per_min: r1(e1.proofs_built / (e1.proof_generation_wall_ms / 60000)),
    gas_by_D: Object.fromEntries([1, 2, 3, 4].map((D) => [D, summ(ok.filter((r) => r.D === D).map((r) => r.gasUsed), "e1g" + D)])), gas_all: summ(ok.map((r) => r.gasUsed), "e1ga"),
    local_ms_by_D: Object.fromEntries([1, 2, 3, 4].map((D) => [D, summ(ok.filter((r) => r.D === D).map((r) => r.local_ms), "e1l" + D)])),
    accountability_log_bytes: summ(ok.map((r) => r.accountabilityLogDataBytes).filter((x) => x != null), "alb"), note_leaves_after: e1.note_leaves_after };
  const g = mean(ok.map((r) => r.gasUsed)), g4 = mean(ok.filter((r) => r.D === 4).map((r) => r.gasUsed));
  out.e4b_epoch1.computed_actions_per_block = Object.fromEntries([30e6, 45e6, 60e6].map((L) => [`${L / 1e6}M`, { mix: Math.floor(L / g), D4: Math.floor(L / g4) }])); }
for (const r of [1, 10]) { const x = js(`e4b_revoke_${r}.json`); if (x) out[`e4b_revoke_${r}`] = { ...x, revocation: { ...x.revocation, prove_ms: summ(x.revocation.prove_ms, "rp" + r), gas: summ(x.revocation.gas, "rg" + r) } }; }
console.log(JSON.stringify(out, null, 1));

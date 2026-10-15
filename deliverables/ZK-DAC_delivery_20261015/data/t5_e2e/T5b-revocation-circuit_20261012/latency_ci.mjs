// T5b part B (PREREGISTRATION.md): percentile-bootstrap 95 % CI of p95 for every T5 latency cell (same filters and quantile as T5 analyze.mjs).
// usage: node latency_ci.mjs > results/latency_p95_ci.json
import fs from "fs"; import crypto from "crypto";
const RES = new URL("../T5-e2e-scale_20261010/results/", import.meta.url).pathname;
const jl = (f) => fs.readFileSync(RES + f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
function rng(seed) { let c = 0; return () => crypto.createHash("sha256").update(`${seed}-${c++}`).digest().readUInt32BE(0) / 2 ** 32; }
const q = (x, p) => { const s = [...x].sort((a, b) => a - b); const h = (s.length - 1) * p, lo = Math.floor(h); return s[lo] + (h - lo) * ((s[Math.min(lo + 1, s.length - 1)]) - s[lo]); };
const r1 = (x) => +x.toFixed(1);
function bootQ(x, p, seed, B = 10000) { const r = rng(seed), v = []; for (let b = 0; b < B; b++) { const y = []; for (let i = 0; i < x.length; i++) y.push(x[Math.floor(r() * x.length)]); v.push(q(y, p)); } return [q(v, 0.025), q(v, 0.975)]; }
const okS = jl("e4a_steady.jsonl").filter((r) => r.kind === "measured" && r.status === 1), okC = jl("e4a_cold.jsonl").filter((r) => r.status === 1);
const out = { note: "p95 type-7 quantile; percentile bootstrap 10^4, seed fixed; N = 30 per cell, so the upper CI bound is close to the sample maximum", cells: {} };
for (const [mode, rows] of [["steady", okS], ["cold", okC]]) for (const D of [1, 2, 3, 4]) for (const k of ["local_ms", "e2e_ms"]) {
  const x = rows.filter((r) => r.D === D).map((r) => r[k]); out.cells[`${mode} D=${D} ${k}`] = { n: x.length, p95: r1(q(x, 0.95)), p95_ci95: bootQ(x, 0.95, `p95-${mode}-${D}-${k}`).map(r1), max: r1(Math.max(...x)) }; }
console.log(JSON.stringify(out, null, 1));

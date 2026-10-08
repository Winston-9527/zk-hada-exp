// Grinding cost (issue #24): an issuer varies the expiry of a certificate it signs and recomputes the 7-input Poseidon certificate hash
// until the low bits match a victim's. Measure single-core JS hash rates, then extrapolate the expected 2^RD trials
// (two keys sharing RD-1 low bits) for RD = 16 / 20 / 24 / 32. Also run the RD=16 attack for real once.
import { buildPoseidon } from "circomlibjs"; import { poseidon7 } from "poseidon-lite"; import os from "os";
const p = await buildPoseidon(); const F = p.F;
const base = [1n, 111n, 222n, 333n, 444n, 0xFFn];
function rate(fn, n) { const t0 = performance.now(); for (let i = 0; i < n; i++) fn(BigInt(i)); return n / ((performance.now() - t0) / 1000); }
const rWasm = rate((e) => F.toObject(p([...base, e])), 20000);
const rLite = rate((e) => poseidon7([...base, e]), 20000);
const r = Math.max(rWasm, rLite);
// real RD=16 run: find two expiries whose cert hash shares the low 15 bits with a victim hash
const victim = poseidon7([0n, 9n, 9n, 9n, 9n, 0xFFn, 5000n]), mask = (1n << 15n) - 1n;
const t0 = performance.now(); let tries = 0n; const found = [];
for (let e = 0n; found.length < 2; e++) { tries++; const h = p.F.toObject(p([...base, e])); if ((h & mask) === (victim & mask)) found.push(e.toString()); }
const secs = (performance.now() - t0) / 1000;
const est = Object.fromEntries([16, 20, 24, 32].map((RD) => [RD, { expected_trials: 2 ** RD, single_core_hours: 2 ** RD / r / 3600 }]));
console.log(JSON.stringify({ cpu: os.cpus()[0].model, cores: os.cpus().length, rate_circomlibjs_wasm_per_s: Math.round(rWasm), rate_poseidon_lite_per_s: Math.round(rLite),
  rd16_real_attack: { tries: tries.toString(), seconds: +secs.toFixed(2), expiries_found: found }, extrapolation_single_core: est }, null, 1));
process.exit(0);

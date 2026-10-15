// T6 Table 2 item 2 (PREREGISTRATION.md): paired proving benchmark of v6 -> v7 (mode C) -> v8 -> v9 at D = 1..4. N = 30 fresh instances per (version, D),
// in 3 process blocks of 10; within a block, for each D, the version order is shuffled (seed t6-comp-<block>-<D>) and the 4 versions alternate
// instance by instance. usage: node comp_bench.mjs <block 1..3> >> results/comp_bench.jsonl
import crypto from "crypto"; import fs from "fs"; import os from "os"; import path from "path";
const W = new URL("../../t2_circuit_fix/", import.meta.url).pathname;
const L = { v6: await import(W + "zkdac_v6/scripts/lib_v6.mjs"), v7: await import(W + "zkdac_v7/scripts/lib_v7.mjs"), v8: await import(W + "zkdac_v8/scripts/lib_v8.mjs"), v9: await import(W + "zkdac_v9/scripts/lib_v9.mjs") };
const { createRequire } = await import("module"); const snarkjs = createRequire(W + "zkdac_v7/package.json")("snarkjs");
const build = { v6: (o) => L.v6.buildInstanceV6(o), v7: (o) => L.v7.buildInstanceV7({ mode: "C", ...o }), v8: (o) => L.v8.buildInstanceV8(o), v9: (o) => L.v9.buildInstanceV9(o) };
const art = (v, D) => v === "v6" ? [`${W}zkdac_v6/build/d${D}/main_d${D}_js/main_d${D}.wasm`, `${W}zkdac_v6/build/zk/d${D}.zkey`] : [`${W}zkdac_${v}/build/c${D}/main_c_d${D}_js/main_c_d${D}.wasm`, `${W}zkdac_${v}/build/zk/c${D}.zkey`];
function shuffle(xs, seed) { const a = [...xs]; let c = 0; const r = () => crypto.createHash("sha256").update(`${seed}-${c++}`).digest().readUInt32BE(0) / 2 ** 32; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const b = Number(process.argv[2]); const tmp = path.join(os.tmpdir(), `t6comp-${process.pid}.wtns`);
for (const v of ["v6", "v7", "v8", "v9"]) { const { input } = await build[v]({ D: 1, seed: 999 }); const [w, z] = art(v, 1); await snarkjs.wtns.calculate(input, w, tmp); await snarkjs.groth16.prove(z, tmp); }   // warm-up (excluded)
for (const D of [1, 2, 3, 4]) { const order = shuffle(["v6", "v7", "v8", "v9"], `t6-comp-${b}-${D}`);
  for (let k = 0; k < 10; k++) for (const v of order) { const seed = 10000 * b + 100 * D + k;   // fresh instance: new seed -> new keys, certificates, trees
    const { input } = await build[v]({ D, seed }); const [w, z] = art(v, D);
    let t = performance.now(); await snarkjs.wtns.calculate(input, w, tmp); const wm = performance.now() - t;
    t = performance.now(); const { publicSignals } = await snarkjs.groth16.prove(z, tmp); const pm = performance.now() - t;
    console.log(JSON.stringify({ block: b, D, version: v, k, seed, witness_ms: +wm.toFixed(2), prove_ms: +pm.toFixed(2), public_inputs: publicSignals.length })); } }
try { fs.unlinkSync(tmp); } catch {}
process.exit(0);

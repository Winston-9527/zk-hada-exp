// T5c I3: v9.2-noacc proving benchmark (= v9.2 prove_bench.mjs; instances = v9.2 instances with the accountability fields removed). Original header: v9 proving benchmark (#41): per depth D, N runs, each with a FRESH instance (new seed). usage: node scripts/prove_bench.mjs 10 > results/prove_bench.json
// The sample proof is written to the scratch dir given by SAMPLE_DIR (never into results/; see HANDOFF pitfalls).
import { buildInstanceV9 } from "../../zkdac_v9_2/scripts/lib_v9.mjs";
export const ACC_FIELDS = ["tpk", "acc_r", "acc_kx", "acc_ky", "acc_c1x", "acc_c1y", "acc_c2x", "acc_c2y", "acc_e", "acc_esign"];
import * as snarkjs from "snarkjs"; import fs from "fs"; import os from "os"; import path from "path";
const N = Number(process.argv[2] ?? 10), here = new URL("..", import.meta.url).pathname, tmp = path.join(os.tmpdir(), "v9bench-" + process.pid + ".wtns");
const stats = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)); const s = [...xs].sort((a, b) => a - b); return { mean: +m.toFixed(1), sd: +sd.toFixed(1), median: +((s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2).toFixed(1) }; };
const out = { machine: `${os.cpus()[0].model} x${os.cpus().length}`, node: process.version, snarkjs: "0.7.6", runs: N, note: "ms; fresh instance per run (seed = 1000 + run)", depths: {} };
for (const D of [1, 2, 3, 4]) {
  const wasm = `${here}build/c${D}/main_c_d${D}_js/main_c_d${D}.wasm`, zkey = `${here}build/zk/c${D}.zkey`, vk = JSON.parse(fs.readFileSync(`${here}zk/vk_c${D}.json`));
  const tw = [], tp = [], tv = []; let ok = 0, npub = 0;
  for (let r = 0; r < N; r++) { const { input } = await buildInstanceV9({ D, seed: 1000 + r }); for (const k of ACC_FIELDS) delete input[k];      // T5c I3: the same v9.2 instance without accountability
    let t = performance.now(); await snarkjs.wtns.calculate(input, wasm, tmp); tw.push(performance.now() - t);
    t = performance.now(); const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, tmp); tp.push(performance.now() - t); npub = publicSignals.length;
    t = performance.now(); if (await snarkjs.groth16.verify(vk, publicSignals, proof)) ok++; tv.push(performance.now() - t); }
  out.depths[D] = { verified: `${ok}/${N}`, public_inputs: npub, witness_ms: stats(tw), prove_ms: stats(tp), verify_ms: stats(tv) };
  console.error(`D=${D} prove ${out.depths[D].prove_ms.mean}±${out.depths[D].prove_ms.sd}`);
}
try { fs.unlinkSync(tmp); } catch {}
console.log(JSON.stringify(out, null, 1)); process.exit(0);

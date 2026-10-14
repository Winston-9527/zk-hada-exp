// T8c C5: generate N v9.2 proofs per D (fresh instances, seeds BASE..BASE+N-1) and save {D, seed, proof, publicSignals} for cross-verification.
// usage: node c/c5_gen.mjs <BASE> <N> > results/c5_proofs_<machine>.json   (run from the T8c directory)
import os from "os"; import { createRequire } from "module";
const W = new URL("../../../", import.meta.url).pathname; const V = W + "t2_circuit_fix/zkdac_v9_2/";
const snarkjs = createRequire(V + "package.json")("snarkjs"); const { buildInstanceV9 } = await import(V + "scripts/lib_v9.mjs");
const BASE = Number(process.argv[2]), N = Number(process.argv[3]); const out = { machine: `${os.cpus()[0].model} x${os.cpus().length}`, host: os.hostname(), base: BASE, proofs: [] };
for (const D of [1, 2, 3, 4]) for (let r = 0; r < N; r++) { const { input } = await buildInstanceV9({ D, seed: BASE + r });
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, `${V}build/c${D}/main_c_d${D}_js/main_c_d${D}.wasm`, `${V}build/zk/c${D}.zkey`); out.proofs.push({ D, seed: BASE + r, proof, publicSignals }); }
console.log(JSON.stringify(out)); process.exit(0);

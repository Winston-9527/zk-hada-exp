// T8b C6: N fresh v9.1 instances at depth D (seed 9000 + 100 D + r), proved with the frozen wasm and the released zkey. usage: node gen.mjs <D> <N> <label> > out.json
import os from "os"; import { createRequire } from "module";
const V91 = new URL("../../../t2_circuit_fix/zkdac_v9_1/", import.meta.url).pathname;
const snarkjs = createRequire(V91 + "package.json")("snarkjs");
const { buildInstanceV9 } = await import(V91 + "scripts/lib_v9.mjs");
const [D, N, label] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]]; const proofs = [];
for (let r = 0; r < N; r++) { const { input } = await buildInstanceV9({ D, seed: 9000 + 100 * D + r });
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, `${V91}build/c${D}/main_c_d${D}_js/main_c_d${D}.wasm`, `${V91}build/zk/c${D}.zkey`); proofs.push({ seed: 9000 + 100 * D + r, publicSignals, proof }); }
console.log(JSON.stringify({ label, host: os.hostname(), platform: `${os.platform()} ${os.arch()}`, node: process.version, D, proofs })); process.exit(0);

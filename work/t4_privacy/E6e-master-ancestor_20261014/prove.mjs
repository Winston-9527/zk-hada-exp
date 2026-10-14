// E6e phase 2: prove shard s of S (actions k with k % S == s) with the v9.2 c3 circuit; one JSON line per action {k, proof (8 calldata words), pub}.
// usage: node prove.mjs <s> <S> > build/proofs_<s>.jsonl 2> results/gen_prove_<s>.stderr
import fs from "fs"; import { createRequire } from "module";
const W = new URL("../../", import.meta.url).pathname; const snarkjs = createRequire(W + "t2_circuit_fix/zkdac_v7/package.json")("snarkjs");
const V92 = W + "t2_circuit_fix/zkdac_v9_2"; const wasm = `${V92}/build/c3/main_c_d3_js/main_c_d3.wasm`, zkey = `${V92}/build/zk/c3.zkey`;
const s = Number(process.argv[2]), S = Number(process.argv[3]); const n = fs.readdirSync("build/inputs").length;
for (let k = s; k < n; k += S) {
  const x = JSON.parse(fs.readFileSync(`build/inputs/${k}.json`));
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(x, wasm, zkey);
  const cd = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, publicSignals)) + "]");
  console.log(JSON.stringify({ k, proof: [...cd[0], ...cd[1].flat(), ...cd[2]], pub: publicSignals }));
  if (k % (S * 64) === s) console.error(new Date().toISOString().slice(11, 19), "shard", s, "k", k);
}
process.exit(0);

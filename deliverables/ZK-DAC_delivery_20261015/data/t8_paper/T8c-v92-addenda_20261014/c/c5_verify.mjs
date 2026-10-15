// T8c C5: verify a proofs file with the COMMITTED v9.2 VKs. usage: node c/c5_verify.mjs <proofs.json>
import fs from "fs"; import os from "os"; import { createRequire } from "module";
const W = new URL("../../../", import.meta.url).pathname; const V = W + "t2_circuit_fix/zkdac_v9_2/"; const snarkjs = createRequire(V + "package.json")("snarkjs");
const f = JSON.parse(fs.readFileSync(process.argv[2])); const res = {};
for (const p of f.proofs) { const vk = JSON.parse(fs.readFileSync(`${V}zk/vk_c${p.D}.json`)); const ok = await snarkjs.groth16.verify(vk, p.publicSignals, p.proof); res[p.D] ??= { n: 0, valid: 0 }; res[p.D].n++; if (ok) res[p.D].valid++; }
console.log(JSON.stringify({ proofs_from: f.host, proofs_machine: f.machine, verified_on: os.hostname(), verifier_machine: `${os.cpus()[0].model}`, by_D: res })); process.exit(0);

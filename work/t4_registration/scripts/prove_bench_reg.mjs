// Registration proof benchmark (#17): N runs, each a different Semaphore identity in a fresh group of 1000 members (depth 10).
import { makeHuman, registerWitness, Group } from "./lib_register.mjs";
import * as snarkjs from "snarkjs"; import fs from "fs"; import os from "os"; import path from "path";
const N = Number(process.argv[2] ?? 10), here = new URL("..", import.meta.url).pathname, MAX = 20;
const wasm = `${here}build/r${MAX}/main_reg_${MAX}_js/main_reg_${MAX}.wasm`, zkey = `${here}build/zk/reg${MAX}.zkey`, vk = JSON.parse(fs.readFileSync(`${here}zk/vk_reg${MAX}.json`));
const tmp = path.join(os.tmpdir(), "regbench-" + process.pid + ".wtns");
const humans = Array.from({ length: 1000 }, (_, i) => makeHuman(i)); const group = new Group(humans.map((h) => h.id.commitment));
const st = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return { mean: +m.toFixed(1), sd: +Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)).toFixed(1) }; };
const tw = [], tp = [], tv = []; let ok = 0;
for (let r = 0; r < N; r++) {
  const w = registerWitness({ human: humans[(r * 97) % 1000], group, domain: 0xd0a1n, master: [1n, 2n], cap0: 0xFF, expiry0: 6000, MAX_DEPTH: MAX });
  let t = performance.now(); await snarkjs.wtns.calculate(w, wasm, tmp); tw.push(performance.now() - t);
  t = performance.now(); const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, tmp); tp.push(performance.now() - t);
  t = performance.now(); if (await snarkjs.groth16.verify(vk, publicSignals, proof)) ok++; tv.push(performance.now() - t);
  if (r === 0) fs.writeFileSync(`${here}results/sample_register_proof.json`, JSON.stringify({ proof, publicSignals }, null, 1));
}
console.log(JSON.stringify({ machine: `${os.cpus()[0].model} x${os.cpus().length}`, group_size: group.size, group_depth: group.depth, MAX_DEPTH: MAX, runs: N, verified: `${ok}/${N}`,
  witness_ms: st(tw), prove_ms: st(tp), verify_ms: st(tv), note: "master key placeholder (1,2) is fine at witness level: only the action proof checks the master's signature" }, null, 1));
process.exit(0);

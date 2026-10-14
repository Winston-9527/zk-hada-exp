// E6e: verify every transcript's Groth16 proof with the committed v9.2 VK of its depth. usage: node verify.mjs results/world_w*.jsonl > results/verify.json
import fs from "fs"; import { createRequire } from "module";
const W = new URL("../../", import.meta.url).pathname; const snarkjs = createRequire(W + "t2_circuit_fix/zkdac_v7/package.json")("snarkjs");
const out = {};
for (const f of process.argv.slice(2)) { const rows = fs.readFileSync(f, "utf8").trim().split("\n").map(JSON.parse); let ok = 0;
  const vk = JSON.parse(fs.readFileSync(`${W}t2_circuit_fix/zkdac_v9_2/zk/vk_c${rows[0].D}.json`));
  for (const t of rows) { const p = t.proof; const proof = { pi_a: [p[0], p[1], "1"], pi_b: [[p[3], p[2]], [p[5], p[4]], ["1", "0"]], pi_c: [p[6], p[7], "1"], protocol: "groth16", curve: "bn128" };
    if (await snarkjs.groth16.verify(vk, t.pub, proof)) ok++; }
  out[f.split("/").pop()] = { D: rows[0].D, transcripts: rows.length, valid: ok, agents: new Set(rows.map((t) => t.agent)).size, parents: new Set(rows.map((t) => t.parent)).size, masters: new Set(rows.map((t) => t.master)).size }; }
console.log(JSON.stringify(out, null, 1)); process.exit(0);

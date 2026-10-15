// E6b: (1) verify every transcript's Groth16 proof against the v9 D=4 vk; (2) build the P2 control corpus = fresh transcripts + a public lineage tag
// Poseidon(cert[2]) (the parent edge; PREREGISTRATION.md P2). usage: node verify_and_tag.mjs > results/verify.json
import fs from "fs";
const C = await import(new URL("../../t5_e2e/T5-e2e-scale_20261010/common.mjs", import.meta.url).pathname);
const vk = JSON.parse(fs.readFileSync(`${C.P.V9}/zk/vk_c4.json`));
const out = {};
for (const v of ["fresh", "p1"]) { const rows = fs.readFileSync(`results/transcripts_${v}.jsonl`, "utf8").trim().split("\n").map(JSON.parse); let ok = 0;
  for (const t of rows) { const p = t.proof; const proof = { pi_a: [p[0], p[1], "1"], pi_b: [[p[3], p[2]], [p[5], p[4]], ["1", "0"]], pi_c: [p[6], p[7], "1"], protocol: "groth16", curve: "bn128" };
    if (await C.snarkjs.groth16.verify(vk, t.pub, proof)) ok++; }
  out[v] = `${ok}/${rows.length}`; }
const fresh = fs.readFileSync("results/transcripts_fresh.jsonl", "utf8").trim().split("\n").map(JSON.parse);
fs.writeFileSync("results/transcripts_p2.jsonl", fresh.map((t) => JSON.stringify({ ...t, variant: "p2", tag: String(C.PH([BigInt(t.cert2)])) })).join("\n") + "\n");
console.log(JSON.stringify({ proofs_valid: out, p2_rows: fresh.length })); process.exit(0);

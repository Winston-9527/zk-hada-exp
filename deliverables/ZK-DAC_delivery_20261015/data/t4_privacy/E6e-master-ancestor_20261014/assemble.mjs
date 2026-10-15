// E6e phase 3: join build/actions.jsonl with build/proofs_*.jsonl into results/world_M.jsonl (order k), in the E6d transcript format plus the context fields.
import fs from "fs";
const rd = (f) => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const pr = new Map(); for (const f of fs.readdirSync("build").filter((f) => /^proofs_\d+\.jsonl$/.test(f))) for (const r of rd("build/" + f)) pr.set(r.k, r);
const out = fs.openSync("results/world_M.jsonl", "w"); let n = 0;
for (const a of rd("build/actions.jsonl")) { const p = pr.get(a.k); if (!p) throw new Error("missing proof " + a.k);
  fs.writeSync(out, JSON.stringify({ world: "M", D: 3, ...a, proof: p.proof, pub: p.pub }) + "\n"); n++; }
console.error("assembled", n); process.exit(0);

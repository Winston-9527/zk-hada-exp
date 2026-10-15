// T8b C6: verify proof files (from gen.mjs) with the COMMITTED v9.1 VKs. usage: node verify.mjs file...   prints one line per file: ok / FAIL
import fs from "fs"; import os from "os"; import { createRequire } from "module";
const V91 = new URL("../../../t2_circuit_fix/zkdac_v9_1/", import.meta.url).pathname;
const snarkjs = createRequire(V91 + "package.json")("snarkjs");
for (const f of process.argv.slice(2)) { const x = JSON.parse(fs.readFileSync(f, "utf8")); const vk = JSON.parse(fs.readFileSync(`${V91}zk/vk_c${x.D}.json`, "utf8")); let ok = 0;
  for (const p of x.proofs) if (await snarkjs.groth16.verify(vk, p.publicSignals, p.proof)) ok++;
  console.log(`C6 ${ok === x.proofs.length && ok > 0 ? "ok" : "FAIL"} ${f.split("/").slice(-1)[0]}: proofs made on ${x.host} (${x.platform}) verified on ${os.hostname()} (${os.platform()} ${os.arch()}): ${ok}/${x.proofs.length}`); }
process.exit(0);

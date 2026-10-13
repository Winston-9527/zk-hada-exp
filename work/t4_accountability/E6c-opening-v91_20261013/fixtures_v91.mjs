// E6c fixtures: real v9.1 proofs (released zkeys), fresh instance + CSPRNG ciphertext randomness per action, encrypted to one committee's TPK.
// usage: node fixtures_v91.mjs <t> <n> <epoch> "<D list>" <N>   e.g. node fixtures_v91.mjs 3 5 1 "1 2 3 4" 30  -> results/fixtures_t3n5_e1.json
import fs from "fs"; import os from "os"; import path from "path"; import crypto from "crypto";
import { T, snarkjs, vk, parseCt, COMMITTEES, dealC, fxFile } from "./lib_v91_open.mjs";
const V91 = new URL("../../t2_circuit_fix/zkdac_v9_1/", import.meta.url).pathname;
const { buildInstanceV8 } = await import(new URL("../../t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs", import.meta.url).pathname);
const { toV9 } = await import(V91 + "scripts/lib_v9.mjs");
const [t, n, epoch] = process.argv.slice(2, 5).map(Number), Ds = process.argv[5].split(" ").map(Number), N = Number(process.argv[6]);
const c = COMMITTEES.find((x) => x.t === t && x.n === n); if (!c) throw new Error("unknown committee");
const { pub } = dealC(c, epoch); const tmp = path.join(os.tmpdir(), `e6cfx-${process.pid}.wtns`); const out = [];
for (const D of Ds) {
  for (let r = 0; r < N; r++) {
    const seed = 100000 * t + 10000 * epoch + 1000 * D + r;                               // instance seed (keys, certificates, trees)
    const { input } = await buildInstanceV8({ D, seed });
    input.tpk = pub.tpk.map(String); const accSeed = crypto.randomBytes(32).toString("hex"); toV9(input, accSeed);   // CSPRNG per action
    const t0 = Date.now(); await snarkjs.wtns.calculate(input, `${V91}build/c${D}/main_c_d${D}_js/main_c_d${D}.wasm`, tmp);
    const { proof, publicSignals } = await snarkjs.groth16.prove(`${V91}build/zk/c${D}.zkey`, tmp); const proveMs = Date.now() - t0;
    const ok = await snarkjs.groth16.verify(vk(D), publicSignals, proof); const ct = parseCt(publicSignals, D);
    const layoutOk = T.eq(ct.tpk, pub.tpk) && String(ct.c1s[0][0]) === input.acc_c1x && String(ct.c1s[0][1]) === input.acc_c1y && String(ct.c2[0]) === input.acc_c2x
      && ct.e.every((e, j) => String(e) === input.acc_e[j]) && String(ct.esign) === input.acc_esign;
    if (!ok || !layoutOk) { console.error("FIXTURE FAIL", { D, r, ok, layoutOk }); process.exit(1); }
    out.push({ D, epoch, seed, publicSignals, proof, proveMs, ents: input.ent_Ax.map((x, j) => [x, input.ent_Ay[j]]) });
    process.stderr.write(`\r(${t},${n}) e${epoch} D=${D} ${r + 1}/${N}`);
  }
  process.stderr.write("\n");
}
try { fs.unlinkSync(tmp); } catch {}
fs.mkdirSync(path.dirname(fxFile(c, epoch)), { recursive: true });
fs.writeFileSync(fxFile(c, epoch), JSON.stringify({ committee: c, epoch, tpk: pub.tpk.map(String), host: os.hostname(), fixtures: out }));
console.error("wrote", fxFile(c, epoch), out.length); process.exit(0);

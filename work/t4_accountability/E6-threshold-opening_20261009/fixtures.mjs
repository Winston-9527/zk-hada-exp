// E6 fixtures: real v7 proofs (fresh instance + CSPRNG accountability randomness per action) encrypted to a dealer-generated committee key.
// usage: node fixtures.mjs <mode> <D list> <N> <epoch> <out.json>   e.g. node fixtures.mjs C "1 2 3 4" 30 1 results/fixtures_C_e1.json
// Committee for each epoch: deal({t:3, n:5, epoch, seed: DEALER_SEED}); only its public TPK is used here.
import { createRequire } from "module"; import fs from "fs"; import os from "os"; import path from "path"; import crypto from "crypto";
import { deal, parseCt, eq } from "./threshold.mjs";
const v7 = new URL("../../t2_circuit_fix/zkdac_v7/", import.meta.url).pathname;
const snarkjs = createRequire(v7 + "package.json")("snarkjs");
const { buildInstanceV7, encryptChain } = await import(v7 + "scripts/lib_v7.mjs");
export const DEALER_SEED = "e6-20261009";
const [mode, Ds, N, epoch, outFile] = [process.argv[2], process.argv[3].split(" ").map(Number), Number(process.argv[4]), Number(process.argv[5]), process.argv[6]];
const { pub } = deal({ t: 3, n: 5, epoch, seed: DEALER_SEED });
const tmp = path.join(os.tmpdir(), `e6fx-${process.pid}.wtns`), t = mode.toLowerCase(), out = [];
for (const D of Ds) {
  const vk = JSON.parse(fs.readFileSync(`${v7}zk/vk_${t}${D}.json`));
  for (let r = 0; r < N; r++) {
    const seed = 5000 + 100 * epoch + r;                                   // instance seed (keys, certificates, trees)
    const { input, meta } = await buildInstanceV7({ D, seed, mode });
    const accSeed = crypto.randomBytes(32).toString("hex");                // CSPRNG per action (the default accSeed is deterministic)
    await encryptChain(input, meta.accEnts, pub.tpk, mode, accSeed);
    await snarkjs.wtns.calculate(input, `${v7}build/${t}${D}/main_${t}_d${D}_js/main_${t}_d${D}.wasm`, tmp);
    const { proof, publicSignals } = await snarkjs.groth16.prove(`${v7}build/zk/${t}${D}.zkey`, tmp);
    const ok = await snarkjs.groth16.verify(vk, publicSignals, proof);
    const ct = parseCt(publicSignals, mode, D);                            // layout cross-check against the witness input
    const layoutOk = eq(ct.tpk, pub.tpk) && ct.c1s.every((c, j) => String(c[0]) === input.acc_c1x[j] && String(c[1]) === input.acc_c1y[j])
      && (mode === "A" || ct.e.every((e, j) => String(e[0]) === input.acc_e[j][0] && String(e[1]) === input.acc_e[j][1]));
    if (!ok || !layoutOk) { console.error("FIXTURE FAIL", { D, r, ok, layoutOk }); process.exit(1); }
    out.push({ mode, D, epoch, seed, accSeed, publicSignals, proof, ents: meta.accEnts.map((p) => p.map(String)) });
    process.stderr.write(`\r${mode} D=${D} ${r + 1}/${N}`);
  }
  process.stderr.write("\n");
}
try { fs.unlinkSync(tmp); } catch {}
fs.writeFileSync(outFile, JSON.stringify({ dealerSeed: DEALER_SEED, epoch, t: 3, n: 5, tpk: pub.tpk.map(String), fixtures: out }, null, 0));
console.error("wrote", outFile, out.length); process.exit(0);

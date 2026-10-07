// Real Groth16 proofs (v2 circuit, D=2, MD=RD=16) for the Foundry tests of issue #18.
// usage: node gen_fixtures.mjs  -> foundry/test/fixtures.json
import { buildInstance, R } from "../t2_circuit_fix/zkdac_v2/scripts/lib.mjs";
import * as snarkjs from "snarkjs"; import consts from "./node_modules/circomlibjs/src/poseidon_constants_opt.js"; import { ethers } from "ethers"; import fs from "fs";
const D = 2, WASM = "../t2_circuit_fix/zkdac_v2/build/d2/main_d2_js/main_d2.wasm", ZKEY = "zk/d2.zkey";
export const GATE = process.env.GATE ?? "0x000000000000000000000000000000000000dAC1", TARGET = process.env.TARGET ?? "0x000000000000000000000000000000000000Ba5e";
const CHAIN = 31337n, METHOD = 0xa9059cbbn, REQ = 1n, NOW = Number(process.env.NOW ?? 1000);   // anvil also uses chainid 31337   // forge default chainid; method 'transfer' needs cap bit 0
const PARAMS = "0x1234abcd";
const paramsHash = BigInt(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["address", "bytes"], [TARGET, PARAMS]))) % R;
const act = (nonce, req = REQ, amount = 100n) => ({ chain_id: CHAIN, verifier: BigInt(GATE), method: METHOD, params_hash: paramsHash, amount, req_cap: req, nonce });
async function prove(name, opts) {
  const { input, meta } = await buildInstance({ D, now: NOW, expiries: [NOW + 5000, NOW + 4000], ...opts });
  const t0 = performance.now(); const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY); const ms = performance.now() - t0;
  const cd = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, publicSignals)) + "]");
  console.error(name, "prove ms", ms.toFixed(0));
  return { name, a: cd[0], b: cd[1], c: cd[2], pub: cd[3], nonce: String(opts.action.nonce), amount: String(opts.action.amount ?? 100n), proveMs: Math.round(ms), meta };
}
const unrelated = 123456789n;
const f1 = await prove("valid_n1", { action: act(1n) });
const f2 = await prove("valid_n2", { action: act(2n) });
const f3 = await prove("attacker_reqcap0", { action: act(3n, 0n) });
const f4 = await prove("valid_after_unrelated_revocation_n4", { action: act(4n), extraRevoked: [unrelated] });
// roots: R0 (f1..f3), R1 = R0 + unrelated id (f4), R2 = R1 + cert[1] of this chain (revokes the chain)
const R0 = f1.pub[1], R1 = f4.pub[1];
await f4.meta.smt.insert(BigInt(f4.meta.cert[1]), 0n);
const { eddsa } = await import("../t2_circuit_fix/zkdac_v2/scripts/lib.mjs").then((m) => m.init());
const R2 = "0x" + eddsa.F.toObject(f4.meta.smt.root).toString(16).padStart(64, "0");
function poseidonData() {   // t=8 constants as words: C, S, M (row-major M[j][i]), P; split into two data contracts
  const i = 6, h = (x) => BigInt(x).toString(16).padStart(64, "0");
  const w = [...consts.C[i], ...consts.S[i], ...consts.M[i].flat(), ...consts.P[i].flat()].map(h);
  if (w.length !== 1216) throw new Error("unexpected constant count " + w.length);
  return { d1: "0x00" + w.slice(0, 700).join(""), d2: "0x00" + w.slice(700).join(""), len1: 700 * 32, len2: 516 * 32 };
}
const strip = ({ meta, ...x }) => x;
const out = { gate: GATE, target: TARGET, method: "0xa9059cbb", reqCap: 1, params: PARAMS, now: NOW, issuedRoot: f1.pub[0], R0, R1, R2,
  poseidonData: poseidonData(), proofs: [f1, f2, f3, f4].map(strip) };
fs.writeFileSync(process.env.OUT ?? "foundry/test/fixtures.json", JSON.stringify(out, null, 1));
console.error("issued", out.issuedRoot, "R0", R0, "R1", R1, "R2", R2); process.exit(0);

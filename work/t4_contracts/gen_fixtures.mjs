// Real Groth16 proofs for the Foundry / anvil / geth tests of issue #18.
// usage: VARIANT=v2|A|B [GATE=.. TARGET=.. NOW=.. OUT=..] node gen_fixtures.mjs
//   v2: 5 public inputs (issued, revoked, digest7, nullifier, now)   circuit t2_circuit_fix/zkdac_v2 main_d2
//   A : 4 public inputs (issued, revoked, digest8(ctx, now), nullifier) circuit variants/main_A_d2
//   B : 11 public inputs (issued, revoked, nullifier, now, 7 ctx fields) circuit variants/main_B_d2
import { buildInstance, R, init } from "../t2_circuit_fix/zkdac_v2/scripts/lib.mjs";
import * as snarkjs from "snarkjs"; import consts from "./node_modules/circomlibjs/src/poseidon_constants_opt.js"; import { ethers } from "ethers"; import fs from "fs";
const V = process.env.VARIANT ?? "v2", D = 2;
const CFG = {
  v2: { wasm: "../t2_circuit_fix/zkdac_v2/build/d2/main_d2_js/main_d2.wasm", zkey: "zk/d2.zkey", poseidonT: 8 },
  A: { wasm: "variants/build/main_A_d2_js/main_A_d2.wasm", zkey: "variants/build/A.zkey", poseidonT: 9 },
  B: { wasm: "variants/build/main_B_d2_js/main_B_d2.wasm", zkey: "variants/build/B.zkey", poseidonT: null },
}[V];
export const GATE = process.env.GATE ?? "0x000000000000000000000000000000000000dAC1", TARGET = process.env.TARGET ?? "0x000000000000000000000000000000000000Ba5e";
const CHAIN = BigInt(process.env.CHAIN_ID ?? 31337), METHOD = 0xa9059cbbn, REQ = 1n, NOW = Number(process.env.NOW ?? 1000);
const PARAMS = "0x1234abcd";
const paramsHash = BigInt(ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["address", "bytes"], [TARGET, PARAMS]))) % R;
const act = (nonce, req = REQ, amount = 100n) => ({ chain_id: CHAIN, verifier: BigInt(GATE), method: METHOD, params_hash: paramsHash, amount, req_cap: req, nonce });
function adapt(input, meta) {               // v2 instance -> variant input
  if (V === "A") {
    const a = meta.act, d8 = meta.P([a.chain_id, a.verifier, a.method, a.params_hash, a.amount, a.req_cap, a.nonce, BigInt(input.now)]);
    input.action_digest = d8.toString(); input.nullifier = meta.P([1952805748n, BigInt(input.holder_sk), d8]).toString();
  }
  if (V === "B") delete input.action_digest;
  return input;
}
async function prove(name, opts) {
  const { input, meta } = await buildInstance({ D, now: NOW, expiries: [NOW + 5000, NOW + 4000], ...opts });
  adapt(input, meta);
  const t0 = performance.now(); const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, CFG.wasm, CFG.zkey); const ms = performance.now() - t0;
  const cd = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, publicSignals)) + "]");
  console.error(V, name, "prove ms", ms.toFixed(0));
  return { name, a: cd[0], b: cd[1], c: cd[2], pub: cd[3], nullifier: input.nullifier, now: String(input.now), digest: input.action_digest ?? null,
           nonce: String(opts.action.nonce), amount: String(opts.action.amount ?? 100n), proveMs: Math.round(ms), meta };
}
function poseidonData(t) {   // constants as words: C, S, M (row-major M[j][i]), P; split into two data contracts (< 24 KB each)
  if (!t) return null;
  const i = t - 2, h = (x) => BigInt(x).toString(16).padStart(64, "0");
  const w = [...consts.C[i], ...consts.S[i], ...consts.M[i].flat(), ...consts.P[i].flat()].map(h);
  const nrp = [56, 57, 56, 60, 60, 63, 64, 63][i];
  if (w.length !== 8 * t + nrp + nrp * (2 * t - 1) + 2 * t * t) throw new Error("constant count");
  const cut = 700;
  return { t, nrp, d1: "0x00" + w.slice(0, cut).join(""), d2: "0x00" + w.slice(cut).join(""), len1: cut * 32, len2: (w.length - cut) * 32 };
}
const unrelated = 123456789n;
const f1 = await prove("valid_n1", { action: act(1n) });
const f2 = await prove("valid_n2", { action: act(2n) });
const f3 = await prove("attacker_reqcap0", { action: act(3n, 0n) });
const f4 = await prove("valid_after_unrelated_revocation_n4", { action: act(4n), extraRevoked: [unrelated] });
const hex = (x) => "0x" + BigInt(x).toString(16).padStart(64, "0");
const R0 = hex(f1.meta.revoked_root), R1 = hex(f4.meta.revoked_root);
await f4.meta.smt.insert(BigInt(f4.meta.cert[1]), 0n);
const { eddsa } = await init(); const R2 = hex(eddsa.F.toObject(f4.meta.smt.root));
const strip = ({ meta, ...x }) => x;
const out = { variant: V, chainId: Number(CHAIN), gate: GATE, target: TARGET, method: "0xa9059cbb", reqCap: 1, params: PARAMS, now: NOW,
  issuedRoot: hex(f1.meta.issued_root), R0, R1, R2, poseidonData: poseidonData(CFG.poseidonT), proofs: [f1, f2, f3, f4].map(strip) };
fs.writeFileSync(process.env.OUT ?? `foundry/test/fixtures_${V}.json`, JSON.stringify(out, null, 1));
process.exit(0);

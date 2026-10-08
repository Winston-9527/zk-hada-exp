// Real Groth16 proofs of the v4 main circuit for the Foundry tests (issue #18 / #4). Same JSON schema as gen_fixtures.mjs.
// usage: D=2|4 [GATE=.. TARGET=.. NOW=.. CHAIN_ID=.. OUT=..] node gen_fixtures_v4.mjs
import { buildInstanceV4 } from "../t2_circuit_fix/zkdac_v4/scripts/lib_v4.mjs";
import * as snarkjs from "snarkjs"; import fs from "fs";
const D = Number(process.env.D ?? 2), V4 = "../t2_circuit_fix/zkdac_v4";
const WASM = `${V4}/build/d${D}/main_d${D}_js/main_d${D}.wasm`, ZKEY = `${V4}/build/zk/d${D}.zkey`;
const GATE = process.env.GATE ?? "0x000000000000000000000000000000000000dAC1", TARGET = process.env.TARGET ?? "0x000000000000000000000000000000000000Ba5e";
const CHAIN = BigInt(process.env.CHAIN_ID ?? 31337), NOW = Number(process.env.NOW ?? 1000), METHOD = "0xa9059cbb", PARAMS = "0x1234abcd";
const hex = (x) => "0x" + BigInt(x).toString(16).padStart(64, "0");
const expiries = [NOW + 5000, NOW + 4000, NOW + 3000, NOW + 2000].slice(0, D);
async function prove(name, nonce, { reqCap, extraRevoked } = {}) {
  // one chain (seed 0) for every proof so all share the issued root; only the action nonce / req_cap / revocation set differ
  const { input, meta } = await buildInstanceV4({ D, seed: 0, now: NOW, expiries, reqCap, extraRevoked,
    ctx: { chainId: CHAIN, verifier: GATE, method: METHOD, target: TARGET, params: PARAMS, amount: 100n, nonce } });
  const t0 = performance.now(); const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY); const ms = performance.now() - t0;
  const cd = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, publicSignals)) + "]");
  console.error(`v4 D=${D}`, name, "fullProve ms", ms.toFixed(0));
  return { name, a: cd[0], b: cd[1], c: cd[2], pub: cd[3], nullifier: input.nullifier, now: String(input.now), digest: null, ctxHash: input.ctx_hash,
           nonce: String(nonce), amount: "100", proveMs: Math.round(ms), meta };
}
const f1 = await prove("valid_n1", 1n), f2 = await prove("valid_n2", 2n), f3 = await prove("attacker_reqcap0", 3n, { reqCap: 0n });
const f4 = await prove("valid_after_unrelated_revocation_n4", 4n, { extraRevoked: [123456789n] });
f4.meta.imt.insert(BigInt(f4.meta.cert[1]));
const strip = ({ meta, ...x }) => x;
const out = { variant: `V4D${D}`, chainId: Number(CHAIN), gate: GATE, target: TARGET, method: METHOD, reqCap: 1, params: PARAMS, now: NOW,
  issuedRoot: hex(f1.meta.issued_root), R0: hex(f1.meta.imt.root), R1: hex(f4.pub[1]), R2: hex(f4.meta.imt.root), poseidonData: null, proofs: [f1, f2, f3, f4].map(strip) };
fs.writeFileSync(process.env.OUT ?? `foundry/test/fixtures_V4D${D}.json`, JSON.stringify(out, null, 1));
process.exit(0);

// Fixtures for the v7 gate tests (#30, R6 accountability): two humans register their masters (real registration proofs, Semaphore v4 group), then
// real v7 action proofs for mode A and mode C at D = 2 and D = 4. The ciphertext words are the public signals after the 9 fixed ones
// (circuit declaration order). The generator also checks that the auditor recovers ent[0..D] from those public words alone.
// usage: node gen_fixtures_v7.mjs  -> foundry/test/fixtures_V7.json
import { buildInstanceV7, decryptChain, newRootTree, rootProof } from "../t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs";
import { makeHuman, humanPrv, registerWitness, Group } from "../t4_registration/scripts/lib_register.mjs";
import * as snarkjs from "snarkjs"; import fs from "fs";
const V7 = "../t2_circuit_fix/zkdac_v7", REG = "../t4_registration";
const GATE = "0x000000000000000000000000000000000000dAC7", TARGET = "0x000000000000000000000000000000000000Ba5e";
const CHAIN = 31337n, NOW = 1000, METHOD = "0xa9059cbb", PARAMS = "0x1234abcd", DOMAIN = 0xd0a1n;
const hex = (x) => "0x" + BigInt(x).toString(16).padStart(64, "0");
const humans = Array.from({ length: 10 }, (_, i) => makeHuman(i)); const group = new Group(humans.map((h) => h.id.commitment));
const exps = (D) => [5000, 4000, 3000, 2000].slice(0, D).map((e) => NOW + e);
// hop 0 depends on D (the instance PRNG is seeded with D), so each depth gets its own human: D=2 -> human 1, D=4 -> human 2.
// Both root certificates are registered first; all action proofs are made against the final registered-root tree.
const HUMAN = { 2: 1, 4: 2 };
const base = (D) => ({ seed: 11, now: NOW, entPrv: [humanPrv(HUMAN[D])], rootOthers: 0, expiries: exps(D) });
const T = newRootTree(); const hop0 = {};
for (const D of [2, 4]) { const { meta, input } = await buildInstanceV7({ ...base(D), D, mode: "C" }); hop0[D] = { cert0: meta.cert[0], master: [input.ent_Ax[1], input.ent_Ay[1]], cap0: input.cap[0], expiry0: input.expiry[0] }; T.insert(BigInt(meta.cert[0])); }
const actions = []; let nonce = 1n;
for (const mode of ["A", "C"]) for (const D of [2, 4]) {
  const { input, meta } = await buildInstanceV7({ ...base(D), D, mode, ctx: { chainId: CHAIN, verifier: GATE, method: METHOD, target: TARGET, params: PARAMS, amount: 100n, nonce } });
  if (meta.cert[0] !== hop0[D].cert0) throw new Error("cert0 changed between probe and action");
  Object.assign(input, rootProof(T, meta.cert[0]));
  const t = mode.toLowerCase();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, `${V7}/build/${t}${D}/main_${t}_d${D}_js/main_${t}_d${D}.wasm`, `${V7}/build/zk/${t}${D}.zkey`);
  const ct = publicSignals.slice(9);
  // auditor view: rebuild the ciphertext fields from the public words only, then decrypt
  const N = D + 1, pub = {};
  if (mode === "A") { pub.acc_c1x = ct.slice(0, N); pub.acc_c1y = ct.slice(N, 2 * N); pub.acc_c2x = ct.slice(2 * N, 3 * N); pub.acc_c2y = ct.slice(3 * N, 4 * N); }
  else { [pub.acc_c1x, pub.acc_c1y, pub.acc_c2x, pub.acc_c2y] = [[ct[0]], [ct[1]], [ct[2]], [ct[3]]]; pub.acc_e = Array.from({ length: N }, (_, j) => [ct[4 + 2 * j], ct[5 + 2 * j]]); }
  const dec = await decryptChain(pub, meta.tsk, mode);
  const recovered = dec.every((p, j) => p[0] === meta.accEnts[j][0] && p[1] === meta.accEnts[j][1]);
  if (!recovered) throw new Error(`auditor failed to recover the chain (${mode} D=${D})`);
  const cd = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, publicSignals)) + "]");
  console.error(`action ${mode} D=${D}: ${publicSignals.length} public inputs, ${ct.length} ciphertext words, auditor recovers ent[0..${D}]`);
  actions.push({ name: `${mode}_D${D}`, mode, D, a: cd[0], b: cd[1], c: cd[2], pub: cd[3], ct: ct.map(String), nullifier: input.nullifier, nonce: String(nonce), cert0: meta.cert[0].toString(),
    master: [input.ent_Ax[1], input.ent_Ay[1]], cap0: input.cap[0], expiry0: input.expiry[0], tpk: meta.tpk.map(String) });
  nonce++;
}
const regs = [];
for (const D of [2, 4]) {
  const h = hop0[D]; const w = registerWitness({ human: humans[HUMAN[D]], group, domain: DOMAIN, master: h.master, cap0: h.cap0, expiry0: h.expiry0 });
  if (w.leaf0 !== h.cert0) throw new Error("leaf0 != action cert0");
  const rp = await snarkjs.groth16.fullProve(w, `${REG}/build/r20/main_reg_20_js/main_reg_20.wasm`, `${REG}/build/zk/reg20.zkey`);
  const rcd = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(rp.proof, rp.publicSignals)) + "]");
  regs.push({ D, a: rcd[0], b: rcd[1], c: rcd[2], pub: rcd[3], siblings: [] });
}
const out = { gate: GATE, target: TARGET, method: METHOD, reqCap: 1, params: PARAMS, now: NOW, domain: hex(DOMAIN), groupRoot: hex(group.root), rootRoot: hex(T.root),
  regs, actions };
fs.writeFileSync("foundry/test/fixtures_V7.json", JSON.stringify(out, null, 1)); process.exit(0);

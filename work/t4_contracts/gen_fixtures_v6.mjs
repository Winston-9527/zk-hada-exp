// Fixtures for the v6 gate tests (#28): the v5 history (gen_fixtures_v5.mjs) with v6 action proofs (D=2: the terminal key ent[2] is checked
// against the revocation set), plus a key-revocation step: the operator revokes B's terminal key K_B, i.e. moves the revoked root from B's
// revocation tree rv0 to rv1 = a tree holding H(KEY_TAG, K_B); A then proves against rv1.
// usage: node gen_fixtures_v6.mjs  -> foundry/test/fixtures_V6.json
import { buildInstanceV6 as buildInstanceV5, newRootTree, rootProof } from "../t2_circuit_fix/zkdac_v6/scripts/lib_v6.mjs";
import { makeHuman, humanPrv, registerWitness, Group } from "../t4_registration/scripts/lib_register.mjs";
import * as snarkjs from "snarkjs"; import fs from "fs";
const D = 2, V5 = "../t2_circuit_fix/zkdac_v6", REG = "../t4_registration";
const GATE = "0x000000000000000000000000000000000000dAC5", TARGET = "0x000000000000000000000000000000000000Ba5e";
const CHAIN = 31337n, NOW = 1000, METHOD = "0xa9059cbb", PARAMS = "0x1234abcd", DOMAIN = 0xd0a1n;
const hex = (x) => "0x" + BigInt(x).toString(16).padStart(64, "0");
const humans = Array.from({ length: 10 }, (_, i) => makeHuman(i)); const group = new Group(humans.map((h) => h.id.commitment));
const A = 1, B = 2;
async function action(name, prvIdx, seed, nonce, tree, extra = {}) {
  const { input, meta } = await buildInstanceV5({ ...extra, D, seed, now: NOW, expiries: [NOW + 5000, NOW + 4000], entPrv: [humanPrv(prvIdx)], rootOthers: 0,
    ctx: { chainId: CHAIN, verifier: GATE, method: METHOD, target: TARGET, params: PARAMS, amount: 100n, nonce } });
  Object.assign(input, rootProof(tree, meta.cert[0]));                       // membership against the on-chain history's tree
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, `${V5}/build/d${D}/main_d${D}_js/main_d${D}.wasm`, `${V5}/build/zk/d${D}.zkey`);
  const cd = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, publicSignals)) + "]");
  console.error("action", name, "root", hex(input.root_root).slice(0, 12));
  return { name, a: cd[0], b: cd[1], c: cd[2], pub: cd[3], nullifier: input.nullifier, now: String(input.now), nonce: String(nonce), amount: "100", cert0: meta.cert[0].toString(),
           master: [input.ent_Ax[1], input.ent_Ay[1]], holder: [input.ent_Ax[D], input.ent_Ay[D]], cap0: input.cap[0], expiry0: input.expiry[0], revokedRoot: input.revoked_root };
}
async function registration(name, h, x, siblings = []) {
  const w = registerWitness({ human: humans[h], group, domain: DOMAIN, master: x.master, cap0: x.cap0, expiry0: x.expiry0 });
  if (w.leaf0 !== x.cert0) throw new Error("leaf0 != action cert0");
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(w, `${REG}/build/r20/main_reg_20_js/main_reg_20.wasm`, `${REG}/build/zk/reg20.zkey`);
  const cd = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, publicSignals)) + "]");
  console.error("register", name, "nf", hex(w.nf_domain).slice(0, 12));
  return { name, a: cd[0], b: cd[1], c: cd[2], pub: cd[3], nf: w.nf_domain, leaf0: w.leaf0, siblings: siblings.map(String) };
}
// probe instances (no tree needed) to learn each chain's cert0 before building the history
const probe = async (prvIdx, seed) => (await buildInstanceV5({ D, seed, now: NOW, expiries: [NOW + 5000, NOW + 4000], entPrv: [humanPrv(prvIdx)], rootOthers: 0 })).meta.cert[0];
const cA1 = await probe(A, 11), cB = await probe(B, 22), cA2 = await probe(A, 33);
const T = newRootTree();
T.insert(BigInt(cA1)); const R1 = T.root;
const actA1_n1 = await action("A_M1_vs_R1", A, 11, 1n, T);
const regA1 = await registration("A_M1", A, actA1_n1);
T.insert(BigInt(cB)); const R2 = T.root;
const actB = await action("B_vs_R2", B, 22, 7n, T);
const regB = await registration("B", B, actB);
const actA1_n2 = await action("A_M1_vs_R2", A, 11, 2n, T);
const sib = T.generateProof(T.indexOf(BigInt(cA1))).siblings; T.update(T.indexOf(BigInt(cA1)), BigInt(cA2)); const R3 = T.root;
const actA2 = await action("A_M2_vs_R3", A, 33, 3n, T);
const regA2 = await registration("A_M2_replaces_M1", A, actA2, sib);
if (regA1.nf !== regA2.nf) throw new Error("same human/domain must give the same nf");
// key revocation (#28): A (master M2) proves against a revocation tree that holds B's terminal key
const KB = { Ax: BigInt(actB.holder[0]), Ay: BigInt(actB.holder[1]) };
const actA2_rev = await action("A_M2_vs_R3_revokedKB", A, 33, 4n, T, { revokedKeys: [KB] });
let probeB = "generator produced a witness for B (BUG)";
try { await buildInstanceV5({ D, seed: 22, now: NOW, expiries: [NOW + 5000, NOW + 4000], entPrv: [humanPrv(B)], rootOthers: 0, revokedKeys: [KB] }); } catch { probeB = "no witness for B once K_B is revoked"; }
console.error(probeB); if (!probeB.startsWith("no witness")) throw new Error(probeB);
const out = { gate: GATE, target: TARGET, method: METHOD, reqCap: 1, params: PARAMS, now: NOW, domain: hex(DOMAIN), groupRoot: hex(group.root),
  roots: { R1: hex(R1), R2: hex(R2), R3: hex(R3) }, regs: [regA1, regB, regA2], actions: [actA1_n1, actB, actA1_n2, actA2, actA2_rev], keyRevocation: { KB: [actB.holder[0], actB.holder[1]], rv0: actB.revokedRoot, rv1: actA2_rev.revokedRoot, probeB } };
fs.writeFileSync("foundry/test/fixtures_V6.json", JSON.stringify(out, null, 1)); process.exit(0);

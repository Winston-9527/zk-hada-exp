// #18 Part 3 fixtures for real chains (same logic as t4_contracts/gen_fixtures_v7.mjs, but at real time and for the predicted gate/target addresses):
// two registrations (humans 1, 2), two v7 mode C D=4 action proofs (human 2, nonces 1 and 2, both against the genesis revoked root) and one
// revoke_transition proof (issuer ent[2] revokes cert hop 2 of that chain). env: NOW CHAIN GATE TARGET OUT
import fs from "fs";
const H = (p) => new URL(p, import.meta.url).pathname;
const L7 = await import(H("../../../t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs"));
const { makeHuman, humanPrv, registerWitness, Group } = await import(H("../../../t4_registration/scripts/lib_register.mjs"));
const R = await import(H("../revoke/revoke_lib.mjs")); const snarkjs = R.snarkjs;
const NOW = Number(process.env.NOW), CHAIN = BigInt(process.env.CHAIN), GATE = process.env.GATE, TARGET = process.env.TARGET;
const METHOD = "0xa9059cbb", PARAMS = "0x1234abcd", DOMAIN = 0xd0a1n, hex = (x) => "0x" + BigInt(x).toString(16).padStart(64, "0");
const V7 = H("../../../t2_circuit_fix/zkdac_v7"), REG = H("../../../t4_registration");
const humans = Array.from({ length: 10 }, (_, i) => makeHuman(i)); const group = new Group(humans.map((h) => h.id.commitment));
const exps = (D) => [5000, 4000, 3000, 2000].slice(0, D).map((e) => NOW + e); const HUMAN = { 2: 1, 4: 2 };
const base = (D) => ({ seed: 11, now: NOW, entPrv: [humanPrv(HUMAN[D])], rootOthers: 0, expiries: exps(D) });
const T = L7.newRootTree(); const hop0 = {};
for (const D of [2, 4]) { const { meta, input } = await L7.buildInstanceV7({ ...base(D), D, mode: "C" }); hop0[D] = { cert0: meta.cert[0], master: [input.ent_Ax[1], input.ent_Ay[1]], cap0: input.cap[0], expiry0: input.expiry[0] }; T.insert(BigInt(meta.cert[0])); }
const regs = [];
for (const D of [2, 4]) { const h = hop0[D]; const w = registerWitness({ human: humans[HUMAN[D]], group, domain: DOMAIN, master: h.master, cap0: h.cap0, expiry0: h.expiry0 });
  const rp = await snarkjs.groth16.fullProve(w, `${REG}/build/r20/main_reg_20_js/main_reg_20.wasm`, `${REG}/build/zk/reg20.zkey`);
  const c = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(rp.proof, rp.publicSignals)) + "]"); regs.push({ D, a: c[0], b: c[1], c: c[2], pub: c[3] }); }
const actions = []; let inst;
for (const nonce of [1n, 2n]) {
  const x = await L7.buildInstanceV7({ ...base(4), D: 4, mode: "C", ctx: { chainId: CHAIN, verifier: GATE, method: METHOD, target: TARGET, params: PARAMS, amount: 100n, nonce } });
  Object.assign(x.input, L7.rootProof(T, x.meta.cert[0])); inst ??= x;
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(x.input, `${V7}/build/c4/main_c_d4_js/main_c_d4.wasm`, `${V7}/build/zk/c4.zkey`);
  if (!(await snarkjs.groth16.verify(JSON.parse(fs.readFileSync(`${V7}/zk/vk_c4.json`)), publicSignals, proof))) throw new Error("action proof");
  const c = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, publicSignals)) + "]");
  actions.push({ nonce: String(nonce), a: c[0], b: c[1], c: c[2], pub: c[3], ct: publicSignals.slice(9) });
}
const genesis = inst.meta.imt; const t1 = R.transition(genesis, BigInt(inst.meta.cert[2]), R.certAuthority(inst, 2, 0));
const rp = await snarkjs.groth16.fullProve(t1.input, R.WASM, H("../revoke/build/zk/rt.zkey"));
const rc = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(rp.proof, rp.publicSignals)) + "]");
const out = { now: NOW, chain: String(CHAIN), gate: GATE, target: TARGET, method: METHOD, params: PARAMS, reqCap: 1, domain: String(DOMAIN), groupRoot: String(group.root), rootRoot: String(T.root),
  issuedRoot: actions[0].pub[0], genesisRoot: String(genesis.root), genesisCount: genesis.leaves.length, tpk: inst.meta.tpk.map(String), regs, actions,
  revoke: { a: rc[0], b: rc[1], c: rc[2], newRoot: String(t1.newRoot), entry: t1.input.entry } };
if (BigInt(actions[0].pub[1]) !== genesis.root) throw new Error("genesis != action revoked_root");
fs.writeFileSync(process.env.OUT, JSON.stringify(out, null, 1)); console.error("fixtures ok"); process.exit(0);

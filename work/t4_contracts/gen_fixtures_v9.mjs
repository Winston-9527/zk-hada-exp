// Fixtures for the v9 gate tests (#41; same history as gen_fixtures_v8.mjs, action proofs from the v9 circuit — no action nullifier, state root,
// compressed accountability). Original v8 header: Fixtures for the v8 gate tests (#39, budget notes): one human (human 2, Semaphore) registers master M; chains H>M, H>M>S1, H>M>S2, H>M>S1>S11,
// H>M>S1>S11>S111 share the issued tree, the revocation IMT (genesis of ZkDacRevocations) and the registered-root tree. Real proofs for an ordered
// sequence of budget steps; the JS note tree mirrors the on-chain LeanIMT insertion order. usage: node gen_fixtures_v9.mjs -> foundry/test/fixtures_V9.json
import fs from "fs"; import crypto from "crypto";
import { buildInstanceV7, refreshAll, IMT, newRootTree, rootProof } from "../t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs";
import { setBudget, noteCm, newNoteTree, linOf, rnd250 } from "../t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs";
import { toV9 } from "../t2_circuit_fix/zkdac_v9/scripts/lib_v9.mjs";
import { makeHuman, humanPrv, registerWitness, Group } from "../t4_registration/scripts/lib_register.mjs";
import * as snarkjs from "snarkjs";
const BW = await import("../t2_circuit_fix/zkdac_v8/scripts/budget_world.mjs");          // only for the transfer-witness builder logic (reused below)
const R = await import("../t4_obligations/E7-obligations_20261009/revoke/revoke_lib.mjs");
const W = BW.W;
const V8 = "../t2_circuit_fix/zkdac_v8", V9 = "../t2_circuit_fix/zkdac_v9", REG = "../t4_registration";
const GATE = "0x000000000000000000000000000000000000dAC9", TARGET = "0x000000000000000000000000000000000000Ba5e";
const CHAIN = 31337n, NOW = 1000, METHOD = "0xa9059cbb", PARAMS = "0x1234abcd", DOMAIN = 0xd0a1n;
const exps = (D) => [5000, 4000, 3000, 2000].slice(0, D).map((e) => NOW + e);
const key = (n) => (n === "H" ? humanPrv(2) : crypto.createHash("sha256").update("v8-node-" + n).digest());
// ---- shared state ----
const imt = await IMT.create(20); for (let k = 0; k < 20; k++) imt.insert(rnd250("v8-decoy-" + k));
const issued = new W.SparseTree(16); const roots = newRootTree(); const notes = newNoteTree();
let nonce = 0n;
async function holder(chain, withAction = true) {
  const D = chain.length - 1; const n = ++nonce;
  const { input, meta } = await buildInstanceV7({ D, seed: 11, mode: "C", now: NOW, entPrv: chain.map(key), rootOthers: 0, expiries: exps(D), accSeed: `v8fx-${chain.join(">")}-${n}`,
    ctx: { chainId: CHAIN, verifier: GATE, method: METHOD, target: TARGET, params: PARAMS, amount: 0n, nonce: n } });
  for (let i = 1; i < D; i++) issued.append(meta.cert[i]);
  if (roots.indexOf(BigInt(meta.cert[0])) < 0) roots.insert(BigInt(meta.cert[0]));
  return { chain, D, input, meta, nonce: n };
}
// action instance for holder chain spending `amount` (the ctx amount must equal q_spent)
async function actionInst(chain, amount) {
  const D = chain.length - 1; const n = ++nonce;
  const { input, meta } = await buildInstanceV7({ D, seed: 11, mode: "C", now: NOW, entPrv: chain.map(key), rootOthers: 0, expiries: exps(D), accSeed: `v8fx-${chain.join(">")}-${n}`,
    ctx: { chainId: CHAIN, verifier: GATE, method: METHOD, target: TARGET, params: PARAMS, amount: BigInt(amount), nonce: n } });
  return { chain, D, input, meta, nonce: n };
}
function treeWitness(h) {   // shared issued / revocation / registered-root witnesses
  const input = structuredClone(h.input); input.issued_root = String(issued.root);
  for (let i = 1; i < h.D; i++) { const p = issued.path(issued.index.get(String(h.meta.cert[i]))); input.m_sib[i] = p.sib; input.m_bit[i] = p.bit; }
  Object.assign(input, rootProof(roots, h.meta.cert[0])); refreshAll(input, { ...h.meta, imt }); return input;
}
const owner = (h) => [BigInt(h.input.ent_Ax[h.D]), BigInt(h.input.ent_Ay[h.D])];
const mkNote = (h, q, label) => ({ own: owner(h), q: BigInt(q), lin: linOf(h.meta), rho: rnd250("v8fx-note-" + label) });
const cd = async (proof, ps) => JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, ps)) + "]");
async function prove(input, circ, zkeyName) { const dir = circ.startsWith("c") ? V9 : V8; const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, `${dir}/build/${circ}/${circ.startsWith("c") ? "main_c_d" + circ.slice(1) : circ}_js/${circ.startsWith("c") ? "main_c_d" + circ.slice(1) : circ}.wasm`, `${dir}/build/zk/${zkeyName}.zkey`); return { proof, publicSignals }; }
// holders (registration of human 2's cert0 first)
const M = await holder(["H", "M"]), S1 = await holder(["H", "M", "S1"]), S2 = await holder(["H", "M", "S2"]), S11 = await holder(["H", "M", "S1", "S11"]), S111 = await holder(["H", "M", "S1", "S11", "S111"]);
const humans = Array.from({ length: 10 }, (_, i) => makeHuman(i)); const group = new Group(humans.map((h) => h.id.commitment));
const rw = registerWitness({ human: humans[2], group, domain: DOMAIN, master: [M.input.ent_Ax[1], M.input.ent_Ay[1]], cap0: M.input.cap[0], expiry0: M.input.expiry[0] });
if (rw.leaf0 !== M.meta.cert[0]) throw new Error("leaf0 != cert0");
const rp = await snarkjs.groth16.fullProve(rw, `${REG}/build/r20/main_reg_20_js/main_reg_20.wasm`, `${REG}/build/zk/reg20.zkey`); const rc = await cd(rp.proof, rp.publicSignals);
const revGenesis = { root: String(imt.root), count: imt.leaves.length };
// transfer witness (BudgetWorld logic, on these shared trees)
const bwShim = Object.assign(Object.create(BW.BudgetWorld.prototype), { w: { imt }, notes });
const steps = [];
async function stepMint(n, label) { const x = bwShim.mintWitness(n); const { proof, publicSignals } = await prove(x, "budget_mint", "budget_mint"); notes.insert(noteCm(n)); steps.push({ kind: "mint", label, ...(await pk(proof, publicSignals)), cm: x.cm, q: x.q }); }
async function stepTransfer(from, n, opts, label, expect = "ok", insert = true) { const t = bwShim.transferWitness(from, n, { ...opts, label }); const { proof, publicSignals } = await prove(t.input, "budget_transfer", "budget_transfer");
  if (insert) { notes.insert(noteCm(t.out1)); notes.insert(noteCm(t.out2)); } steps.push({ kind: "transfer", label, expect, ...(await pk(proof, publicSignals)) }); return t; }
async function stepAction(chain, n, amount, label, expect = "ok", insert = true) { const h = await actionInst(chain, amount); const inp = treeWitness(h); const { input, change } = setBudget(inp, n, notes, BigInt(amount), rnd250("v8fx-chg-" + label)); toV9(input, "v9fx-" + label);
  const { proof, publicSignals } = await prove(input, "c" + h.D, "c" + h.D); if (insert) notes.insert(noteCm(change));
  steps.push({ kind: "execute", label, expect, D: h.D, nonce: String(h.nonce), amount: String(amount), ...(await pk(proof, publicSignals)), ct: publicSignals.slice(6, publicSignals.length - 4), roots: [input.issued_root, input.revoked_root, input.root_root] }); return change; }
async function pk(proof, ps) { const c = await cd(proof, ps); return { a: c[0], b: c[1], c: c[2], pub: c[3] }; }
// ---- the ordered sequence ----
const n0 = mkNote(M, 100, "mint"); await stepMint(n0, "S0 mint 100 to M");
const t1 = await stepTransfer(M, n0, { to: S1, q1: 40, q2: 60 }, "S1 M delegates 40 to S1, change 60");
const rootBeforeA1 = notes.root;
const ch1 = await stepAction(S1.chain, t1.out1, 10, "S2 S1 spends 10 (D=2)");
{ // S3: second action from the SAME note version (built on the pre-A1 root) -> BudgetSpent
  const saved = notes; const t = newNoteTree(); for (let i = 0; i < saved.size - 1; i++) t.insert(saved.leaves[i]);   // tree before A1's change insert
  const h = await actionInst(S1.chain, 10); const inp = treeWitness(h); const { input } = setBudget(inp, t1.out1, t, 10n, rnd250("v8fx-chg-dup")); toV9(input, "v9fx-dup");
  if (String(t.root) !== String(rootBeforeA1)) throw new Error("pre-A1 root mismatch");
  const { proof, publicSignals } = await prove(input, "c2", "c2");
  steps.push({ kind: "execute", label: "S3 S1 spends again from the same note version (new action nonce)", expect: "BudgetSpent", D: 2, nonce: String(h.nonce), amount: "10", ...(await pk(proof, publicSignals)), ct: publicSignals.slice(6, publicSignals.length - 4), roots: [input.issued_root, input.revoked_root, input.root_root] }); }
const t2 = await stepTransfer(M, t1.out2, { to: S2, q1: 20, q2: 40 }, "S4 M delegates 20 to S2, change 40");
// S5: S1 spends 10 from its change note; the proof is built on the root BEFORE S4 (one retired root, inside noteWindow)
let ch3;
{ const t = newNoteTree(); for (let i = 0; i < notes.size - 2; i++) t.insert(notes.leaves[i]);
  const h = await actionInst(S1.chain, 10); const inp = treeWitness(h); const { input, change } = setBudget(inp, ch1, t, 10n, rnd250("v8fx-chg-S5")); toV9(input, "v9fx-S5");
  const { proof, publicSignals } = await prove(input, "c2", "c2"); notes.insert(noteCm(change)); ch3 = change;
  steps.push({ kind: "execute", label: "S5 S1 spends 10 from its change, proof on the retired pre-S4 note root", expect: "ok", D: 2, nonce: String(h.nonce), amount: "10", ...(await pk(proof, publicSignals)), ct: publicSignals.slice(6, publicSignals.length - 4), roots: [input.issued_root, input.revoked_root, input.root_root] }); }
await stepAction(S2.chain, t2.out1, 20, "S6 S2 spends its 20 (D=2)");
const t3 = await stepTransfer(S1, ch3, { to: S11, q1: 10, q2: 10 }, "S7 S1 delegates 10 to S11, change 10");
const t4 = await stepTransfer(S11, t3.out1, { to: S111, q1: 10, q2: 0 }, "S8 S11 delegates 10 to S111");
await stepAction(S111.chain, t4.out1, 10, "S9 S111 spends 10 (D=4)");
// revocation material (not inserted; used from the state after S9): S1's remaining note (10) — an action and a transfer, both on the old revoked root
const revA = await stepAction(S1.chain, t3.out2, 5, "R-A S1 spends 5 (pre-revocation proof)", "revocation-test", false);
await stepTransfer(S1, t3.out2, { q1: 5, q2: 5 }, "R-T S1 splits 5/5 (pre-revocation proof)", "revocation-test", false);
const tr = R.transition(imt, BigInt(S1.meta.cert[1]), R.certAuthority(S1, 1, 0)); const rvp = await snarkjs.groth16.fullProve(tr.input, R.WASM, "../t4_obligations/E7-obligations_20261009/revoke/build/zk/rt.zkey");
const rvc = await cd(rvp.proof, rvp.publicSignals);
const out = { gate: GATE, target: TARGET, method: METHOD, reqCap: 1, params: PARAMS, now: NOW, domain: String(DOMAIN), groupRoot: String(group.root), rootRoot: String(roots.root),
  issuedRoot: String(issued.root), tpk: M.meta.tpk.map(String), revGenesisRoot: revGenesis.root, revGenesisCount: revGenesis.count,
  reg: { a: rc[0], b: rc[1], c: rc[2], pub: rc[3] }, steps, revoke: { a: rvc[0], b: rvc[1], c: rvc[2], newRoot: String(tr.newRoot), entry: tr.input.entry },
  totals: { minted: 100, spent_ok_steps: 50, unspent_after_S9: { M: 40, S1: 10, S11: 0, S111: 0, S2: 0 } } };
fs.writeFileSync("foundry/test/fixtures_V9.json", JSON.stringify(out, null, 1)); console.error("steps", steps.length, "final note root", String(notes.root)); process.exit(0);

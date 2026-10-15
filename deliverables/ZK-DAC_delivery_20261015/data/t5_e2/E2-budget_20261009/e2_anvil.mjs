// E2 (#39 PREREGISTRATION "E2"): concurrent budget spending with REAL transactions on anvil, automine off so every candidate of a race lands in ONE block.
// a1: M splits 100 into 10 notes of 10 for S1..S10; 32 delegates S1..S32 attempt 10 each (S11..S32 hold no note: no proof can be built).
// a2: a second budget of 100; M gives T1..T4 25 each; each Ti submits 3 actions of 10 built on the SAME note version, in one block.
//     then revocation freeze: M (issuer) revokes T1's certificate; after the window T1's pre-built proof fails, T2 still spends.
// a3: counterexample on the real v7 gate (ZkDacGateV7R, no budget): S1..S32 each submit 2 actions of 10 in one block.
// usage: node e2_anvil.mjs > results/e2_anvil.json   (starts anvil on :8553; anvil test key #0 is public; local only)
import { createRequire } from "module"; import { spawn } from "child_process"; import fs from "fs"; import crypto from "crypto";
const H = (p) => new URL(p, import.meta.url).pathname;
const TC = H("../../t4_contracts/"); const reqTC = createRequire(TC + "package.json"); const { ethers } = reqTC("ethers");
const L7 = await import(H("../../t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs"));
const L8 = await import(H("../../t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs"));
const BW = await import(H("../../t2_circuit_fix/zkdac_v8/scripts/budget_world.mjs"));
const RG = await import(H("../../t4_registration/scripts/lib_register.mjs"));
const RV = await import(H("../../t4_obligations/E7-obligations_20261009/revoke/revoke_lib.mjs"));
const snarkjs = createRequire(H("../../t2_circuit_fix/zkdac_v7/package.json"))("snarkjs");
const V7 = H("../../t2_circuit_fix/zkdac_v7"), V8 = H("../../t2_circuit_fix/zkdac_v8"), REG = H("../../t4_registration"), RVK = H("../../t4_obligations/E7-obligations_20261009/revoke/build/zk/rt.zkey");
const PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; const PORT = 8553, FORK = process.env.FORK ?? "prague";
const METHOD = "0xa9059cbb", PARAMS = "0x1234abcd", DOMAIN = 0xd0a1n, RWIN = 30, NWIN = 600, SKEW = 3600;
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);
// ---------- chain ----------
const anvil = spawn("anvil", ["--port", String(PORT), "--chain-id", "31337", "--hardfork", FORK, "--gas-limit", "300000000", "--silent"], { stdio: "ignore" });
process.on("exit", () => anvil.kill());
const provider = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:${PORT}`); let up = false;
for (let i = 0; i < 50 && !up; i++) { try { await provider.getBlockNumber(); up = true; } catch { await new Promise((r) => setTimeout(r, 200)); } }
const wallet = new ethers.Wallet(PK, provider); let nonce = await wallet.getTransactionCount();
const art = (file, name) => JSON.parse(fs.readFileSync(`${TC}foundry/out/${file}/${name}.json`));
async function deploy(file, name, args = [], lib) { const a = art(file, name); let code = a.bytecode.object; if (lib) code = code.replace(/__\$[0-9a-f]{34}\$__/g, lib.slice(2).toLowerCase());
  const f = new ethers.ContractFactory(a.abi, code, wallet); const c = await f.deploy(...args, { nonce: nonce++ }); await c.deployed(); return c; }
const NOW = (await provider.getBlock("latest")).timestamp;
// ---------- off-chain mirror of the shared state ----------
const key = (n) => (n === "H" ? RG.humanPrv(2) : crypto.createHash("sha256").update("e2-node-" + n).digest());
const imt = await L7.IMT.create(20); for (let k = 0; k < 20; k++) imt.insert(L8.rnd250("e2-decoy-" + k));
const issued = new BW.W.SparseTree(16); const roots = L7.newRootTree(); const notes = L8.newNoteTree();
const exps = (D) => [5000, 4000, 3000, 2000].slice(0, D).map((e) => NOW + e);
let ctxNonce = 0n; const holders = {};
async function inst(chain, gate, amount) { const D = chain.length - 1; const n = ++ctxNonce;
  const x = await L7.buildInstanceV7({ D, seed: 11, mode: "C", now: NOW, entPrv: chain.map(key), rootOthers: 0, expiries: exps(D), accSeed: `e2-${chain.join(">")}-${n}`,
    ctx: { chainId: 31337n, verifier: gate ?? "0x0000000000000000000000000000000000000001", method: METHOD, target: target?.address ?? "0x0000000000000000000000000000000000000002", params: PARAMS, amount: BigInt(amount ?? 0), nonce: n } });
  return { chain, D, input: x.input, meta: x.meta, nonce: n }; }
async function addHolder(name, chain) { const h = await inst(chain); for (let i = 1; i < h.D; i++) issued.append(h.meta.cert[i]); if (roots.indexOf(BigInt(h.meta.cert[0])) < 0) roots.insert(BigInt(h.meta.cert[0])); holders[name] = h; return h; }
function treeWitness(h) { const input = structuredClone(h.input); input.issued_root = String(issued.root);
  for (let i = 1; i < h.D; i++) { const p = issued.path(issued.index.get(String(h.meta.cert[i]))); input.m_sib[i] = p.sib; input.m_bit[i] = p.bit; }
  Object.assign(input, L7.rootProof(roots, h.meta.cert[0])); L7.refreshAll(input, { ...h.meta, imt }); return input; }
const owner = (h) => [BigInt(h.input.ent_Ax[h.D]), BigInt(h.input.ent_Ay[h.D])];
const mkNote = (h, q, label) => ({ own: owner(h), q: BigInt(q), lin: L8.linOf(h.meta), rho: L8.rnd250("e2-note-" + label) });
const cd = async (proof, ps) => JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, ps)) + "]");
const P3 = (c) => ({ a: c[0], b: c[1], c: c[2] });
// ---------- holders (all created before the gates are deployed: issued root is fixed at deployment) ----------
const M = await addHolder("M", ["H", "M"]);
for (let i = 1; i <= 32; i++) await addHolder("S" + i, ["H", "M", "S" + i]);
for (let i = 1; i <= 4; i++) await addHolder("T" + i, ["H", "M", "T" + i]);
log("holders", Object.keys(holders).length);
// ---------- deployment ----------
const poseidon = await deploy("PoseidonT3.sol", "PoseidonT3");
const reg = await deploy("ZkDacRegistry.sol", "ZkDacRegistry", [(await deploy("Groth16VerifierRegister.sol", "Groth16VerifierRegister")).address, wallet.address, DOMAIN.toString(), 300], poseidon.address);
const revs = await deploy("ZkDacRevocations.sol", "ZkDacRevocations", [(await deploy("Groth16VerifierRevoke.sol", "Groth16VerifierRevoke")).address, String(imt.root), imt.leaves.length, RWIN]);
var target = await deploy("Targets.sol", "MockTarget");
const tpk = M.meta.tpk.map(String);
const gate8 = await deploy("ZkDacGateV8.sol", "ZkDacGateV8", [[(await deploy("Groth16VerifierV8CD2.sol", "Groth16VerifierV8CD2")).address], [10], reg.address, revs.address, wallet.address, String(issued.root), 300, SKEW, tpk,
  [(await deploy("Groth16VerifierBudgetTransfer.sol", "Groth16VerifierBudgetTransfer")).address, (await deploy("Groth16VerifierBudgetMint.sol", "Groth16VerifierBudgetMint")).address, NWIN]], poseidon.address);   // LeanIMT links PoseidonT3
const gate7 = await deploy("ZkDacGateV7R.sol", "ZkDacGateV7R", [(await deploy("Groth16VerifierV7CD2.sol", "Groth16VerifierV7CD2")).address, reg.address, revs.address, wallet.address, String(issued.root), 300, SKEW, tpk, 10]);
const send = async (c, fn, args, gasLimit) => { const tx = await c[fn](...args, { nonce: nonce++, ...(gasLimit ? { gasLimit } : {}) }); return tx; };
for (const g of [gate8, gate7]) await (await send(g, "setMethod", [METHOD, 1, true])).wait();
const humans = Array.from({ length: 10 }, (_, i) => RG.makeHuman(i)); const group = new RG.Group(humans.map((h) => h.id.commitment));
await (await send(reg, "setGroupRoot", [group.root.toString(), true])).wait();
{ const w = RG.registerWitness({ human: humans[2], group, domain: DOMAIN, master: [M.input.ent_Ax[1], M.input.ent_Ay[1]], cap0: M.input.cap[0], expiry0: M.input.expiry[0] });
  const rp = await snarkjs.groth16.fullProve(w, `${REG}/build/r20/main_reg_20_js/main_reg_20.wasm`, `${REG}/build/zk/reg20.zkey`); const c = await cd(rp.proof, rp.publicSignals);
  await (await send(reg, "register", [P3(c), c[3][0], c[3][2], c[3][3], []])).wait(); }
if ((await reg.currentRoot()).toString() !== String(roots.root)) throw new Error("registry root mismatch");
log("deployed; gate8", gate8.address, "gate7", gate7.address);
// ---------- budget operations (mirror kept in sync; checked against gate8.noteRoot()) ----------
const bw = Object.assign(Object.create(BW.BudgetWorld.prototype), { w: { imt }, notes });
async function syncCheck() { const r = (await gate8.noteRoot()).toString(); if (r !== String(notes.root)) throw new Error(`note root mismatch ${r} vs ${notes.root}`); }
async function mint(h, q, label) { const n = mkNote(h, q, label); const x = bw.mintWitness(n); const { proof, publicSignals } = await snarkjs.groth16.fullProve(x, `${V8}/build/budget_mint/budget_mint_js/budget_mint.wasm`, `${V8}/build/zk/budget_mint.zkey`);
  await (await send(gate8, "mint", [P3(await cd(proof, publicSignals)), x.cm, x.q])).wait(); notes.insert(L8.noteCm(n)); await syncCheck(); return n; }
async function transfer(from, n, to, q1, q2, label) { const t = bw.transferWitness(from, n, { to, q1, q2, label: "e2-" + label });
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(t.input, `${V8}/build/budget_transfer/budget_transfer_js/budget_transfer.wasm`, `${V8}/build/zk/budget_transfer.zkey`);
  const s = publicSignals; await (await send(gate8, "transferBudget", [P3(await cd(proof, s)), s[0], s[1], s[2], s[3], s[4]])).wait(); notes.insert(L8.noteCm(t.out1)); notes.insert(L8.noteCm(t.out2)); await syncCheck(); return t; }
async function actionTx(gate, h, amount, note, label) {   // returns { args, change } built on the CURRENT mirror state
  const a = await inst(h.chain, gate.address, amount); const inp = treeWitness(a);
  let input = inp, change = null;
  if (note) { const r = L8.setBudget(inp, note, notes, BigInt(amount), L8.rnd250("e2-chg-" + label)); input = r.input; change = r.change; }
  const D = h.D, dir = note ? V8 : V7; const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, `${dir}/build/c${D}/main_c_d${D}_js/main_c_d${D}.wasm`, `${dir}/build/zk/c${D}.zkey`);
  const s = publicSignals; const c = await cd(proof, s); const act = [target.address, METHOD, amount, a.nonce.toString(), PARAMS];
  const nCt = 4 + 2 * (D + 1); const ct = s.slice(9, 9 + nCt);
  const args = note ? [P3(c), [s[0], s[1], s[2]], s[3], s[4], act, ct, s.slice(9 + nCt)] : [P3(c), [s[0], s[1], s[2]], s[3], s[4], act, ct];
  return { args, change, label, holder: h.chain.at(-1) };
}
const ERR = {}; for (const [n, g] of [["v8", gate8], ["v7r", gate7]]) for (const f of g.interface.fragments.filter((f) => f.type === "error")) ERR[g.interface.getSighash(f)] = f.name;
async function race(name, gate, txs) {   // all txs in ONE block
  await provider.send("evm_setAutomine", [false]); const sent = [];
  for (const t of txs) sent.push({ t, tx: await send(gate, "execute", t.args, 3000000) });
  await provider.send("evm_mine", []); await provider.send("evm_setAutomine", [true]);
  const rows = []; const blocks = new Set();
  for (const { t, tx } of sent) { const rc = await provider.getTransactionReceipt(tx.hash); blocks.add(rc.blockNumber); let reason = null;
    if (rc.status === 0) { const tr = await provider.send("debug_traceTransaction", [tx.hash, { tracer: "callTracer" }]); const sel = (tr.output ?? "").slice(0, 10); reason = ERR[sel] ?? sel; }
    else if (t.change) notes.insert(L8.noteCm(t.change));                       // the change note is inserted in transaction order
    rows.push({ label: t.label, holder: t.holder, status: rc.status, gasUsed: rc.gasUsed.toNumber(), txIndex: rc.transactionIndex, reason }); }
  rows.sort((a, b) => a.txIndex - b.txIndex);
  const ok = rows.filter((r) => r.status === 1); const reasons = {}; for (const r of rows.filter((r) => r.status === 0)) reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
  log(name, "submitted", rows.length, "ok", ok.length, "blocks", [...blocks]);
  return { name, blocks: [...blocks], submitted: rows.length, succeeded: ok.length, failed_by_reason: reasons, rows };
}
const amountOf = (r, txs) => r.rows.filter((x) => x.status === 1).length * 10;
const out = { date: new Date().toISOString(), client: await provider.send("web3_clientVersion", []), hardfork: FORK, now: NOW, windows: { revoked_s: RWIN, note_s: NWIN, clock_skew_s: SKEW } };
// ---------- a1 ----------
let mN = await mint(M, 100, "a1"); const a1Notes = {};
for (let i = 1; i <= 10; i++) { const t = await transfer(M, mN, holders["S" + i], 10, mN.q - 10n, `a1-${i}`); a1Notes["S" + i] = t.out1; mN = t.out2; }
log("a1 setup: 10 delegations done");
{ const txs = []; let noProof = 0;
  for (let i = 1; i <= 32; i++) { const h = holders["S" + i]; if (a1Notes["S" + i]) txs.push(await actionTx(gate8, h, 10, a1Notes["S" + i], `a1-S${i}`)); else noProof++; }
  const r = await race("a1", gate8, txs); await syncCheck();
  out.a1 = { ...r, attempts: 32, no_note_so_no_proof: noProof, accepted_total: amountOf(r) }; }
// ---------- a2 ----------
mN = await mint(M, 100, "a2"); const a2Notes = {};
for (let i = 1; i <= 4; i++) { const t = await transfer(M, mN, holders["T" + i], 25, mN.q - 25n, `a2-${i}`); a2Notes["T" + i] = t.out1; mN = t.out2; }
{ const txs = []; for (let i = 1; i <= 4; i++) for (let k = 1; k <= 3; k++) txs.push(await actionTx(gate8, holders["T" + i], 10, a2Notes["T" + i], `a2-T${i}-${k}`));
  const r = await race("a2", gate8, txs); await syncCheck(); out.a2 = { ...r, accepted_total: amountOf(r) };
  // the change note of each Ti's successful action (15 left)
  const succ = r.rows.filter((x) => x.status === 1).map((x) => x.label); out.a2.successful_labels = succ;
  const changeOf = {}; for (const t of txs) if (succ.includes(t.label)) changeOf[t.holder] = t.change;
  // revocation freeze: T1's proof is built on the pre-revocation revoked root, then M revokes T1's certificate
  const pre = { T1: await actionTx(gate8, holders.T1, 10, changeOf.T1, "rev-T1") };
  const tr = RV.transition(imt, BigInt(holders.T1.meta.cert[1]), RV.certAuthority(holders.T1, 1, 0));
  const rp = await snarkjs.groth16.fullProve(tr.input, RV.WASM, RVK); await (await send(revs, "revoke", [P3(await cd(rp.proof, rp.publicSignals)), String(tr.newRoot), tr.input.entry])).wait();
  imt.insert(BigInt(holders.T1.meta.cert[1]));
  await provider.send("evm_increaseTime", [RWIN + 1]); await provider.send("evm_mine", []);
  const post = { T2: await actionTx(gate8, holders.T2, 10, changeOf.T2, "rev-T2") };
  let t1Fresh = "built"; try { await actionTx(gate8, holders.T1, 10, changeOf.T1, "rev-T1-fresh"); } catch (e) { t1Fresh = "no witness (" + String(e.message).slice(0, 50) + ")"; }
  const r2 = await race("a2-revocation", gate8, [pre.T1, post.T2]); await syncCheck();
  out.a2_revocation = { ...r2, T1_fresh_proof_after_revocation: t1Fresh }; }
// ---------- a3: v7 gate, no budget ----------
{ const txs = []; for (let i = 1; i <= 32; i++) for (let k = 1; k <= 2; k++) txs.push(await actionTx(gate7, holders["S" + i], 10, null, `a3-S${i}-${k}`));
  const r = await race("a3", gate7, txs); out.a3 = { ...r, accepted_total: amountOf(r) }; }
// ---------- conservation check from chain events ----------
const minted = (await gate8.totalMinted()).toNumber(); const used = (await gate8.queryFilter(gate8.filters.BudgetUsed())).reduce((s, e) => s + e.args.qSpent.toNumber(), 0);
out.conservation = { minted, spent_on_chain: used, note: "unspent = minted - spent by construction of each proof; checked per proof in-circuit; here: spent <= minted", spent_le_minted: used <= minted, final_note_root_matches_mirror: (await gate8.noteRoot()).toString() === String(notes.root) };
console.log(JSON.stringify(out, null, 1)); anvil.kill(); process.exit(0);

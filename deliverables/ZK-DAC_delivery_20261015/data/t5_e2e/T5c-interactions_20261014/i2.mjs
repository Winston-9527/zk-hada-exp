// T5c I2 (PREREGISTRATION_I2.md): fan-out x concurrency. H > M > P > C1..Cf (children act at D = 3). Real proofs and verifiers on anvil; 30M block gas
// limit, 12 s blocks (timestamps set explicitly, automine off). Tree build cost by tx type; R = ceil(10 / k) rounds of k concurrent actions on one snapshot.
// usage: F=8 K=8 SEED=0 PORT=8701 node i2.mjs > results/i2/runs/f8-k8/0.json
import fs from "fs"; import path from "path"; import os from "os"; import crypto from "crypto"; import { spawn } from "child_process"; import { createRequire } from "module";
const HERE = new URL(".", import.meta.url).pathname, W = path.resolve(HERE, "../..") + "/";
const { ethers } = createRequire(W + "t4_contracts/package.json")("ethers");
const req7 = createRequire(W + "t2_circuit_fix/zkdac_v7/package.json"); const snarkjs = req7("snarkjs"); const { poseidon3 } = req7("poseidon-lite");
const L7 = await import(W + "t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs"); const L8 = await import(W + "t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs");
const L9 = await import(W + "t2_circuit_fix/zkdac_v9_2/scripts/lib_v9.mjs"); const BW = await import(W + "t2_circuit_fix/zkdac_v8/scripts/budget_world.mjs");
const RG = await import(W + "t4_registration/scripts/lib_register.mjs");
const F = Number(process.env.F), K = Number(process.env.K), SEED = String(process.env.SEED), PORT = Number(process.env.PORT ?? 8701);
if (![1, 8, 32].includes(F) || ![1, 8, 32, 128].includes(K)) throw new Error("bad cell");
const R = Math.ceil(10 / K), PER = Math.ceil(K / F), NC = PER * R, BLK = 12, GASLIM = 30_000_000;
const METHOD = "0xa9059cbb", PARAMS = "0x1234abcd", DOMAIN = 0xd0a1n, CHAIN = 31337n, TAG_BNF = 2053857902n, S = String;
const OUT = W + "t4_contracts/foundry/out", V92 = W + "t2_circuit_fix/zkdac_v9_2", V8 = W + "t2_circuit_fix/zkdac_v8";
const art = (f, n) => JSON.parse(fs.readFileSync(`${OUT}/${f}/${n}.json`)); const TAG = `f${F}-k${K}-s${SEED}`;
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), TAG, ...a); const wall0 = Date.now();
const rngOf = (tag) => { let c = 0; return () => crypto.createHash("sha256").update(`i2-${tag}-${c++}`).digest().readUInt32BE(0) / 2 ** 32; };
const shuffle = (xs, r) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rOrd = rngOf(`ord-${F}-${K}-${SEED}`); let lbl = 0; const label = () => `i2-${SEED}-${F}-${K}-${lbl++}-${crypto.randomBytes(6).toString("hex")}`;
// ---------------- chain ----------------
const anvil = spawn("anvil", ["--port", String(PORT), "--silent", "--gas-limit", String(GASLIM), "--code-size-limit", "100000", "--no-mining"], { stdio: "ignore" }); process.on("exit", () => anvil.kill());
const provider = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:${PORT}`); provider.pollingInterval = 5;
for (let i = 0; i < 200; i++) { try { await provider.getBlockNumber(); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
const MN = "test test test test test test test test test test test junk";            // anvil's public default mnemonic (local only)
const op = ethers.Wallet.fromMnemonic(MN, "m/44'/60'/0'/0/0").connect(provider), relayer = ethers.Wallet.fromMnemonic(MN, "m/44'/60'/0'/0/1").connect(provider);
const nonces = new Map(); const nextNonce = async (w) => { if (!nonces.has(w.address)) nonces.set(w.address, await w.getTransactionCount()); const n = nonces.get(w.address); nonces.set(w.address, n + 1); return n; };
let clock = (await provider.getBlock("latest")).timestamp + 5;
const mine = async () => { clock += BLK; await provider.send("evm_setNextBlockTimestamp", [clock]); await provider.send("evm_mine", []); return clock; };
const rc = (h) => provider.getTransactionReceipt(h);
async function blockOf(sends) {                       // send, mine until all included; returns receipts in order
  const hs = []; for (const s of sends) hs.push((await s()).hash); let n = 0;
  do { await mine(); n++; if (n > 500) throw new Error("not included"); } while ((await Promise.all(hs.map(rc))).some((r) => !r));
  return Promise.all(hs.map(rc)); }
const LIBS = {};
async function deploy(f, n, args = []) { const a = art(f, n); let code = a.bytecode.object.slice(2);
  for (const refs of Object.values(a.bytecode.linkReferences ?? {})) for (const [lib, locs] of Object.entries(refs)) for (const { start, length } of locs) code = code.slice(0, 2 * start) + LIBS[lib].slice(2).toLowerCase() + code.slice(2 * (start + length));
  const f_ = new ethers.ContractFactory(a.abi, "0x" + code, op); const [r] = await blockOf([async () => f_.deploy(...args, { nonce: await nextNonce(op), gasLimit: 29_000_000 }).then((c) => c.deployTransaction)]);
  return new ethers.Contract(r.contractAddress, a.abi, op); }
const cdP = async (proof, ps) => { const c = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, ps)) + "]"); return { pr: { a: c[0], b: c[1], c: c[2] }, pub: c[3] }; };
// ---------------- world ----------------
const keyOf = (n) => (n === "H" ? RG.humanPrv(0) : crypto.createHash("sha256").update(`i2-node-${SEED}-` + n).digest());
const EXP = [4e9, 3.9e9, 3.8e9];
const mk = async (chain) => { const D = chain.length - 1; const { input, meta } = await L7.buildInstanceV7({ D, seed: 11, mode: "C", now: 1000, entPrv: chain.map(keyOf), rootOthers: 0, expiries: EXP.slice(0, D), accSeed: `i2-${chain.join(">")}` }); return { chain, D, input, meta }; };
const M = await mk(["H", "M"]), Pn = await mk(["H", "M", "P"]); const C = []; for (let i = 0; i < F; i++) C.push(await mk(["H", "M", "P", `C${i}`]));
const imt = await L7.IMT.create(20); for (let k = 0; k < 20; k++) imt.insert(L8.rnd250("i2-decoy-" + k));
const issued = new BW.W.SparseTree(16); const issued0 = S(issued.root); issued.append(Pn.meta.cert[1]); for (const c of C) issued.append(c.meta.cert[2]);
const roots = L7.newRootTree(); roots.insert(BigInt(M.meta.cert[0]));
for (const h of [M, Pn, ...C]) { const x = h.input; x.issued_root = S(issued.root); for (let i = 1; i < h.D; i++) { const p = issued.path(issued.index.get(S(h.meta.cert[i]))); x.m_sib[i] = p.sib; x.m_bit[i] = p.bit; }
  Object.assign(x, L7.rootProof(roots, h.meta.cert[0])); L7.refreshAll(x, { ...h.meta, imt }); }
// ---------------- contracts (real verifiers) ----------------
LIBS.PoseidonT3 = (await deploy("PoseidonT3.sol", "PoseidonT3")).address; LIBS.PoseidonT4 = (await deploy("PoseidonT4.sol", "PoseidonT4")).address;
const reg = await deploy("ZkDacRegistry.sol", "ZkDacRegistry", [(await deploy("Groth16VerifierRegister.sol", "Groth16VerifierRegister")).address, op.address, DOMAIN.toString(), 1_000_000_000]);
const revs = await deploy("ZkDacRevocations.sol", "ZkDacRevocations", [(await deploy("Groth16VerifierRevoke.sol", "Groth16VerifierRevoke")).address, S(imt.root), imt.leaves.length, 30]);
const target = await deploy("T7cRefineHelpers.sol", "T7cSumTarget"); const vs = []; for (const d of [1, 2, 3, 4]) vs.push((await deploy(`Groth16VerifierV92CD${d}.sol`, `Groth16VerifierV92CD${d}`)).address);
const gate = await deploy("ZkDacGateV9.sol", "ZkDacGateV9", [vs, [7, 8, 9, 10], reg.address, revs.address, op.address, issued0, 1_000_000_000, 3600, M.meta.tpk.map(S),
  [(await deploy("Groth16VerifierBudgetTransfer.sol", "Groth16VerifierBudgetTransfer")).address, (await deploy("Groth16VerifierBudgetMint.sol", "Groth16VerifierBudgetMint")).address, 600]]);
const ERR = {}; for (const f of gate.interface.fragments.filter((f) => f.type === "error")) ERR[gate.interface.getSighash(f)] = f.name;
const cost = {}; const add = (k, r) => { (cost[k] ??= []).push(r.gasUsed.toNumber()); if (r.status !== 1) throw new Error(`setup ${k} reverted`); };
const opSend = (c, fn, args) => async () => c[fn](...args, { nonce: await nextNonce(op), gasLimit: 29_000_000 });
add("setMethod", (await blockOf([opSend(gate, "setMethod", [METHOD, Number(C[0].input.act_req_cap), true])]))[0]);
{ const humans = Array.from({ length: 4 }, (_, i) => RG.makeHuman(i)); const group = new RG.Group(humans.map((h) => h.id.commitment)); await blockOf([opSend(reg, "setGroupRoot", [S(group.root), true])]);
  const rw = RG.registerWitness({ human: humans[0], group, domain: DOMAIN, master: [M.input.ent_Ax[1], M.input.ent_Ay[1]], cap0: M.input.cap[0], expiry0: M.input.expiry[0] });
  const p = await snarkjs.groth16.fullProve(rw, `${W}t4_registration/build/r20/main_reg_20_js/main_reg_20.wasm`, `${W}t4_registration/build/zk/reg20.zkey`); const c = await cdP(p.proof, p.publicSignals);
  add("register", (await blockOf([opSend(reg, "register", [c.pr, c.pub[0], c.pub[2], c.pub[3], []])]))[0]); if (S(await reg.currentRoot()) !== S(roots.root)) throw new Error("registry root"); }
add("updateIssuedRoot", (await blockOf([opSend(gate, "updateIssuedRoot", [S(issued.root)])]))[0]);
const ROOTS = { issued: S(issued.root), revoked: S(imt.root), root: S(roots.root) };
add("registerState", (await blockOf([opSend(gate, "registerState", [ROOTS.issued, ROOTS.revoked, ROOTS.root])]))[0]);
// ---------------- budget: mint to M, M > P, P > Ci, splits ----------------
const notes = L8.newNoteTree(); const bw = () => Object.assign(Object.create(BW.BudgetWorld.prototype), { w: { imt }, notes });
const nfOf = (h, n) => S(poseidon3([TAG_BNF, BigInt(h.meta.ents[h.D].sk), L8.noteCm(n)]));
const syncNotes = (receipts) => { for (const r of [...receipts].sort((a, b) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex)) for (const lg of r.logs) { try { const e = gate.interface.parseLog(lg); if (e.name === "NoteInserted") notes.insert(BigInt(S(e.args.cm))); } catch {} } };
const own = (h) => [BigInt(h.input.ent_Ax[h.D]), BigInt(h.input.ent_Ay[h.D])];
const total = BigInt(F * NC * 10); const nM = { own: own(M), q: total, lin: L8.linOf(M.meta), rho: L8.rnd250(label()) };
{ const p = await snarkjs.groth16.fullProve(bw().mintWitness(nM), `${V8}/build/budget_mint/budget_mint_js/budget_mint.wasm`, `${V8}/build/zk/budget_mint.zkey`);
  const r = await blockOf([opSend(gate, "mint", [(await cdP(p.proof, p.publicSignals)).pr, S(L8.noteCm(nM)), S(total)])]); add("mint", r[0]); syncNotes(r); }
async function transfer(from, n, opts) {           // returns { send, out1, out2 } built on the current mirror
  const t = bw().transferWitness(from, n, { ...opts, label: label() });
  const p = await snarkjs.groth16.fullProve(t.input, `${V8}/build/budget_transfer/budget_transfer_js/budget_transfer.wasm`, `${V8}/build/zk/budget_transfer.zkey`); const s = p.publicSignals;
  return { send: async () => gate.connect(op).transferBudget((await cdP(p.proof, s)).pr, s[0], s[1], s[2], s[3], s[4], { nonce: await nextNonce(op), gasLimit: 29_000_000 }), out1: t.out1, out2: t.out2 }; }
let nP; { const t = await transfer(M, nM, { to: Pn, q1: total, q2: 0n }); const r = await blockOf([t.send]); add("delegate_M_P", r[0]); syncNotes(r); nP = t.out1; }
const childNotes = C.map(() => []); const childBig = [];
for (let i = 0; i < F; i++) { const q = BigInt(NC * 10); const t = await transfer(Pn, nP, { to: C[i], q1: q, q2: nP.q - q }); const r = await blockOf([t.send]); add("delegate_P_C", r[0]); syncNotes(r); childBig.push(t.out1); nP = t.out2; }
for (let step = 0; step < NC - 1; step++) {          // every child splits off one note of 10 per block (children in parallel)
  const ts = []; for (let i = 0; i < F; i++) { const n = childBig[i]; ts.push(await transfer(C[i], n, { q1: 10n, q2: n.q - 10n })); }
  const r = await blockOf(ts.map((t) => t.send)); for (const x of r) add("split", x); syncNotes(r);
  for (let i = 0; i < F; i++) { childNotes[i].push(ts[i].out1); childBig[i] = ts[i].out2; } }
for (let i = 0; i < F; i++) childNotes[i].push(childBig[i]);            // the last remainder is the NC-th note of 10
if (!childNotes.every((ns) => ns.length === NC && ns.every((n) => n.q === 10n))) throw new Error("child notes");
if (S(await gate.noteRoot()) !== S(notes.root)) throw new Error("note root after setup");
log("setup done: notes", notes.size, "wall", Math.round((Date.now() - wall0) / 1000), "s");
// ---------------- action rounds ----------------
const rounds = []; const used = C.map(() => 0);
for (let rd = 0; rd < R; rd++) {
  const t0 = clock; const txs = [];
  for (let a = 0; a < K; a++) { const i = a % F; const h = C[i]; const n = childNotes[i][used[i]++];
    const { input } = L8.setBudget(structuredClone(h.input), n, notes, 10n, L8.rnd250(label())); L9.toV9(input, crypto.randomBytes(16).toString("hex")); input.now = S(t0);
    const nonceA = BigInt(rd * 1000 + a); input.ctx_hash = S(L7.ctxHash({ chainId: CHAIN, verifier: gate.address, method: METHOD, target: target.address, params: PARAMS, amount: 10n, nonce: nonceA }));
    const { proof, publicSignals: ps } = await snarkjs.groth16.fullProve(input, `${V92}/build/c3/main_c_d3_js/main_c_d3.wasm`, `${V92}/build/zk/c3.zkey`); const c = await cdP(proof, ps);
    txs.push({ child: i, args: [c.pr, ROOTS, t0, { target: target.address, method: METHOD, amount: 10, nonce: S(nonceA), params: PARAMS }, ps.slice(6, ps.length - 4),
      { noteRoot: ps.at(-4), budgetNf: ps.at(-3), cmChange: ps.at(-2), qSpent: ps.at(-1) }] }); }
  const order = shuffle(txs, rOrd); const hs = []; for (const t of order) hs.push((await gate.connect(relayer).execute(...t.args, { nonce: await nextNonce(relayer), gasLimit: 1_000_000 })).hash);
  const startBlock = await provider.getBlockNumber(); let mined = 0;
  while ((await Promise.all(hs.map(rc))).some((r) => !r)) { await mine(); mined++; if (mined > 200) throw new Error("round not included"); }
  const recs = await Promise.all(hs.map(rc)); const rows = [];
  for (const [j, r] of recs.entries()) { let reason = null, idx = null;
    if (r.status !== 1) { const tr = await provider.send("debug_traceTransaction", [hs[j], { tracer: "callTracer" }]); reason = ERR[(tr.output ?? "").slice(0, 10)] ?? (tr.output ?? "").slice(0, 10); }
    for (const lg of r.logs) { try { const e = gate.interface.parseLog(lg); if (e.name === "NoteInserted") idx = e.args.index.toNumber(); } catch {} }
    rows.push({ child: order[j].child, status: r.status, reason, gas: r.gasUsed.toNumber(), block_offset: r.blockNumber - startBlock, txIndex: r.transactionIndex, note_index: idx }); }
  syncNotes([...recs].sort((a, b) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex));
  if (S(await gate.noteRoot()) !== S(notes.root)) throw new Error("note root after round");
  const blocks = new Set(recs.map((r) => r.blockNumber)); rounds.push({ round: rd, blocks_to_include_all: mined, distinct_blocks: blocks.size, rows,
    gas_per_block: [...blocks].sort().map((b) => recs.filter((r) => r.blockNumber === b).reduce((s, r) => s + r.gasUsed.toNumber(), 0)) });
  log("round", rd, "k", K, "blocks", mined, "ok", rows.filter((x) => x.status === 1).length);
}
// ---------------- metrics ----------------
const sum = (k) => (cost[k] ?? []).reduce((a, b) => a + b, 0);
const fixed = sum("register") + sum("mint") + sum("delegate_M_P") + sum("updateIssuedRoot") + sum("registerState") + sum("setMethod");
const perChild = sum("delegate_P_C") + sum("split"); const acts = rounds.flatMap((r) => r.rows);
const out = { cell: `f${F}-k${K}`, f: F, k: K, seed: SEED, rounds_R: R, notes_per_child: NC, block_s: BLK, gas_limit: GASLIM,
  tree: { by_type: Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, { n: v.length, total: v.reduce((a, b) => a + b, 0), mean: v.reduce((a, b) => a + b, 0) / v.length }])),
          whole_tree_gas: fixed + perChild, fixed_gas: fixed, per_child_gas_total: perChild, per_chain_tree_gas: fixed / F + perChild / F },
  actions: { n: acts.length, accepted: acts.filter((x) => x.status === 1).length, rejected_by_reason: acts.filter((x) => x.status !== 1).reduce((o, x) => ((o[x.reason] = (o[x.reason] ?? 0) + 1), o), {}),
             gas_mean: acts.reduce((s, x) => s + x.gas, 0) / acts.length, latency_blocks_mean: acts.reduce((s, x) => s + x.block_offset, 0) / acts.length,
             blocks_to_include_all: rounds.map((r) => r.blocks_to_include_all) },
  rounds, notes_final: notes.size, wall_s: Math.round((Date.now() - wall0) / 1000), host: os.hostname() };
console.log(JSON.stringify(out)); log("done", "accepted", out.actions.accepted, "/", acts.length, "gas", Math.round(out.actions.gas_mean), "wall", out.wall_s, "s");
anvil.kill(); process.exit(0);

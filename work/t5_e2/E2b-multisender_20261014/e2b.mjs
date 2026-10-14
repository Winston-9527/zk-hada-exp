// E2b (PREREGISTRATION.md): k uncoordinated senders of ONE agent compete for its budget on a real ZkDacGateV9 (v9.2 verifiers) on anvil.
// Logical clock: blocks every B seconds (timestamps set explicitly), proving takes T_P = 1.377 s (Mac median, v9.1 D = 2), every attempt carries a real proof.
// usage: COND=A|B K=32 BLK=1 SEED=0 PORT=8601 node e2b.mjs > results/runs/<COND>-k<K>-b<BLK>/<SEED>.json
import fs from "fs"; import path from "path"; import crypto from "crypto"; import os from "os"; import { spawn } from "child_process"; import { createRequire } from "module";
const HERE = new URL(".", import.meta.url).pathname, W = path.resolve(HERE, "../..") + "/";
const reqC = createRequire(W + "t4_contracts/package.json"); const { ethers } = reqC("ethers");
const req7 = createRequire(W + "t2_circuit_fix/zkdac_v7/package.json"); const snarkjs = req7("snarkjs"); const { poseidon3 } = req7("poseidon-lite");
const L7 = await import(W + "t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs");
const L8 = await import(W + "t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs");
const L9 = await import(W + "t2_circuit_fix/zkdac_v9_2/scripts/lib_v9.mjs");
const BW = await import(W + "t2_circuit_fix/zkdac_v8/scripts/budget_world.mjs");
const RG = await import(W + "t4_registration/scripts/lib_register.mjs");
const COND = process.env.COND, K = Number(process.env.K), BLK = Number(process.env.BLK), SEED = String(process.env.SEED), PORT = Number(process.env.PORT ?? 8601);
if (!["A", "B"].includes(COND) || ![1, 8, 32, 128].includes(K) || ![1, 2].includes(BLK)) throw new Error("bad cell");
const T_P = 1.377, AMOUNT = 10n, MAX_ATTEMPTS = 4, NOTE_WIN = 600, SKEW = 3600, LONG = 1_000_000_000;
const BUDGET = K === 128 ? 1280n : 100n; const NOTES = COND === "A" ? [BUDGET] : Array(Number(BUDGET / 10n)).fill(10n);
const METHOD = "0xa9059cbb", PARAMS = "0x1234abcd", DOMAIN = 0xd0a1n, CHAIN = 31337n, TAG_BNF = 2053857902n, D = 2;
const OUT = W + "t4_contracts/foundry/out"; const V92 = W + "t2_circuit_fix/zkdac_v9_2", V8 = W + "t2_circuit_fix/zkdac_v8";
const art = (f, n) => JSON.parse(fs.readFileSync(`${OUT}/${f}/${n}.json`));
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), `${COND}-k${K}-b${BLK}-s${SEED}`, ...a);
// seeded streams; start times and block orders do NOT depend on COND (paired design), note choices do
const rngOf = (tag) => { let c = 0; return () => crypto.createHash("sha256").update(`e2b-${tag}-${c++}`).digest().readUInt32BE(0) / 2 ** 32; };
const rStart = rngOf(`start-${K}-${BLK}-${SEED}`), rOrder = rngOf(`order-${K}-${BLK}-${SEED}`), rPick = rngOf(`pick-${COND}-${K}-${BLK}-${SEED}`);
const shuffle = (xs, r) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const wall0 = Date.now();

// ---------------- anvil ----------------
const anvil = spawn("anvil", ["--port", String(PORT), "--silent", "--accounts", "130", "--gas-limit", "300000000", "--code-size-limit", "100000", "--no-mining"], { stdio: "ignore" });
process.on("exit", () => anvil.kill());
const provider = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:${PORT}`); provider.pollingInterval = 5;
for (let i = 0; i < 200; i++) { try { await provider.getBlockNumber(); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
const MN = "test test test test test test test test test test test junk";                    // anvil's public default mnemonic (local only)
const acct = (i) => ethers.Wallet.fromMnemonic(MN, `m/44'/60'/0'/0/${i}`).connect(provider);
const op = acct(0); const nonces = new Map();
const nextNonce = async (w) => { if (!nonces.has(w.address)) nonces.set(w.address, await w.getTransactionCount()); const n = nonces.get(w.address); nonces.set(w.address, n + 1); return n; };
const receipt = async (hash) => { for (;;) { const r = await provider.getTransactionReceipt(hash); if (r) return r; await new Promise((z) => setTimeout(z, 3)); } };
let clock = (await provider.getBlock("latest")).timestamp + 5;
const mineAt = async (t) => { await provider.send("evm_setNextBlockTimestamp", [t]); await provider.send("evm_mine", []); };
async function setupTx(contract, fn, args) { const tx = await contract[fn](...args, { nonce: await nextNonce(op), gasLimit: 30_000_000 }); await mineAt(clock++); const rc = await receipt(tx.hash); if (rc.status !== 1) throw new Error(`setup ${fn} reverted`); return rc; }
const LIBS = {};
async function deploy(f, n, args = []) { const a = art(f, n); let code = a.bytecode.object.slice(2);
  for (const refs of Object.values(a.bytecode.linkReferences ?? {})) for (const [lib, locs] of Object.entries(refs)) for (const { start, length } of locs) code = code.slice(0, 2 * start) + LIBS[lib].slice(2).toLowerCase() + code.slice(2 * (start + length));
  const c = await new ethers.ContractFactory(a.abi, "0x" + code, op).deploy(...args, { nonce: await nextNonce(op), gasLimit: 30_000_000 }); await mineAt(clock++); await receipt(c.deployTransaction.hash); return c; }
const cdP = async (proof, ps) => { const c = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, ps)) + "]"); return { pr: { a: c[0], b: c[1], c: c[2] }, pub: c[3] }; };

// ---------------- world: one agent H > M > A ----------------
const keyOf = (n) => (n === "H" ? RG.humanPrv(0) : crypto.createHash("sha256").update("e2b-node-" + n).digest());
const imt = await L7.IMT.create(20); for (let k = 0; k < 20; k++) imt.insert(L8.rnd250("e2b-decoy-" + k));
const issued = new BW.W.SparseTree(16), roots = L7.newRootTree();
const { input: A0, meta: AM } = await L7.buildInstanceV7({ D, seed: 11, mode: "C", now: 1000, entPrv: ["H", "M", "A"].map(keyOf), rootOthers: 0, expiries: [4_000_000_000, 3_999_000_000], accSeed: "e2b-A" });
issued.append(AM.cert[1]); roots.insert(BigInt(AM.cert[0]));
const baseInput = (() => { const x = structuredClone(A0); x.issued_root = String(issued.root); const p = issued.path(issued.index.get(String(AM.cert[1]))); x.m_sib[1] = p.sib; x.m_bit[1] = p.bit;
  Object.assign(x, L7.rootProof(roots, AM.cert[0])); L7.refreshAll(x, { ...AM, imt }); return x; })();
const SK = BigInt(AM.ents[D].sk); const OWN = [BigInt(A0.ent_Ax[D]), BigInt(A0.ent_Ay[D])];
const nfOf = (n) => String(poseidon3([TAG_BNF, SK, L8.noteCm(n)]));

// ---------------- deployment ----------------
LIBS.PoseidonT3 = (await deploy("PoseidonT3.sol", "PoseidonT3")).address; LIBS.PoseidonT4 = (await deploy("PoseidonT4.sol", "PoseidonT4")).address;
const reg = await deploy("ZkDacRegistry.sol", "ZkDacRegistry", [(await deploy("Groth16VerifierRegister.sol", "Groth16VerifierRegister")).address, op.address, DOMAIN.toString(), LONG]);
const revs = await deploy("ZkDacRevocations.sol", "ZkDacRevocations", [(await deploy("Groth16VerifierRevoke.sol", "Groth16VerifierRevoke")).address, String(imt.root), imt.leaves.length, LONG]);
const target = await deploy("T7cRefineHelpers.sol", "T7cSumTarget");
const vs = []; for (const d of [1, 2, 3, 4]) vs.push((await deploy(`Groth16VerifierV92CD${d}.sol`, `Groth16VerifierV92CD${d}`)).address);
const gate = await deploy("ZkDacGateV9.sol", "ZkDacGateV9", [vs, [7, 8, 9, 10], reg.address, revs.address, op.address, String(issued.root), LONG, SKEW, AM.tpk.map(String),
  [(await deploy("Groth16VerifierBudgetTransfer.sol", "Groth16VerifierBudgetTransfer")).address, (await deploy("Groth16VerifierBudgetMint.sol", "Groth16VerifierBudgetMint")).address, NOTE_WIN]]);
const REQCAP = Number(baseInput.act_req_cap); await setupTx(gate, "setMethod", [METHOD, REQCAP, true]);
{ const humans = Array.from({ length: 4 }, (_, i) => RG.makeHuman(i)); const group = new RG.Group(humans.map((h) => h.id.commitment));
  const rw = RG.registerWitness({ human: humans[0], group, domain: DOMAIN, master: [A0.ent_Ax[1], A0.ent_Ay[1]], cap0: A0.cap[0], expiry0: A0.expiry[0] });
  await setupTx(reg, "setGroupRoot", [String(group.root), true]);
  const p = await snarkjs.groth16.fullProve(rw, `${W}t4_registration/build/r20/main_reg_20_js/main_reg_20.wasm`, `${W}t4_registration/build/zk/reg20.zkey`); const c = await cdP(p.proof, p.publicSignals);
  await setupTx(reg, "register", [c.pr, c.pub[0], c.pub[2], c.pub[3], []]);
  if (String(await reg.currentRoot()) !== String(roots.root)) throw new Error("registry root mismatch"); }
const ROOTS = { issued: String(issued.root), revoked: String(imt.root), root: String(roots.root) };
await setupTx(gate, "registerState", [ROOTS.issued, ROOTS.revoked, ROOTS.root]);
// ---------------- budget: minted notes owned by A (fresh CSPRNG rho) ----------------
const leaves = []; const wallet = [];                       // wallet: {n, cm, nf, spent, leaf}
const bw = Object.assign(Object.create(BW.BudgetWorld.prototype), { w: { imt }, notes: L8.newNoteTree() });
for (const q of NOTES) { const n = { own: OWN, q, lin: L8.linOf(AM), rho: BigInt("0x" + crypto.randomBytes(31).toString("hex")) % (1n << 250n) };
  const p = await snarkjs.groth16.fullProve(bw.mintWitness(n), `${V8}/build/budget_mint/budget_mint_js/budget_mint.wasm`, `${V8}/build/zk/budget_mint.zkey`);
  await setupTx(gate, "mint", [(await cdP(p.proof, p.publicSignals)).pr, String(L8.noteCm(n)), String(q)]); bw.notes.insert(L8.noteCm(n));
  wallet.push({ n, cm: String(L8.noteCm(n)), nf: nfOf(n), spent: false, leaf: leaves.length, born: 0 }); leaves.push(L8.noteCm(n)); }
if (String(await gate.noteRoot()) !== String(bw.notes.root)) throw new Error("note root mismatch after mint");
log("setup done; notes", wallet.length, "wall", Math.round((Date.now() - wall0) / 1000), "s");

// ---------------- simulation (logical clock) ----------------
const T0 = clock + 10;                                      // block n at T0 + BLK * n; block 0 = state after setup
const blockTime = (n) => T0 + BLK * n;
const states = [{ leaves: leaves.length, spent: new Set() }];             // per block: number of note leaves, spent nullifiers
const treeCache = new Map(); const treeAt = (n) => { const c = states[n].leaves; if (!treeCache.has(c)) { const t = L8.newNoteTree(); for (const l of leaves.slice(0, c)) t.insert(l); treeCache.set(c, t); } return treeCache.get(c); };
const senders = Array.from({ length: K }, (_, i) => ({ i, w: acct(i + 1), start: T0 + rStart() * 2, tau: null, attempts: [], done: null }));
for (const s of senders) s.tau = s.start;
const pending = []; let ctr = 0; const blocks = []; const proveMs = [];
const ERR = {}; for (const f of gate.interface.fragments.filter((f) => f.type === "error")) ERR[gate.interface.getSighash(f)] = f.name;
const stateIdx = (tau) => Math.min(states.length - 1, Math.max(0, Math.floor((tau - T0) / BLK)));   // latest mined block with timestamp <= tau
async function attempt(s) {
  const n = stateIdx(s.tau); const st = states[n];
  const live = wallet.filter((x) => x.leaf < st.leaves && !st.spent.has(x.nf) && x.n.q >= AMOUNT);
  if (!live.length) { s.done = "exhausted"; s.tau = null; return; }
  const x = COND === "A" ? live[live.length - 1] : live[Math.floor(rPick() * live.length)];
  const nowTs = Math.floor(s.tau); const nonceA = BigInt(++ctr);
  const r = L8.setBudget(structuredClone(baseInput), x.n, treeAt(n), AMOUNT, BigInt("0x" + crypto.randomBytes(31).toString("hex")) % (1n << 250n)); const inp = r.input;
  L9.toV9(inp, crypto.randomBytes(32).toString("hex")); inp.now = String(nowTs);
  inp.ctx_hash = String(L7.ctxHash({ chainId: CHAIN, verifier: gate.address, method: METHOD, target: target.address, params: PARAMS, amount: AMOUNT, nonce: nonceA }));
  const t1 = Date.now(); const p = await snarkjs.groth16.fullProve(inp, `${V92}/build/c${D}/main_c_d${D}_js/main_c_d${D}.wasm`, `${V92}/build/zk/c${D}.zkey`); proveMs.push(Date.now() - t1);
  const c = await cdP(p.proof, p.publicSignals); const ps = p.publicSignals;
  pending.push({ s, arrival: s.tau + T_P, note: x, change: r.change, observed: n, nowTs,
    args: [c.pr, ROOTS, nowTs, { target: target.address, method: METHOD, amount: AMOUNT, nonce: String(nonceA), params: PARAMS }, ps.slice(6, ps.length - 4),
      { noteRoot: ps[ps.length - 4], budgetNf: ps[ps.length - 3], cmChange: ps[ps.length - 2], qSpent: ps[ps.length - 1] }] });
  s.tau = null;
}
for (let bn = 1; ; bn++) {
  const tb = blockTime(bn);
  for (const s of senders) if (s.tau !== null && s.tau < tb) await attempt(s);                 // observes a block that is already mined
  const now = pending.filter((t) => t.arrival <= tb); for (const t of now) pending.splice(pending.indexOf(t), 1);
  const order = shuffle(now, rOrder); const sent = [];
  for (const t of order) { const tx = await gate.connect(t.s.w).execute(...t.args, { nonce: await nextNonce(t.s.w), gasLimit: 3_000_000, gasPrice: 50_000_000_000 }); sent.push({ t, hash: tx.hash }); }
  await mineAt(tb); const st = { leaves: states[bn - 1].leaves, spent: new Set(states[bn - 1].spent) };
  const rows = [];
  for (const { t, hash } of sent) { const rc = await receipt(hash); let reason = null;
    if (rc.status === 1) { leaves.push(BigInt(t.args[5].cmChange)); st.spent.add(t.note.nf);
      wallet.push({ n: t.change, cm: t.args[5].cmChange, nf: nfOf(t.change), spent: false, leaf: leaves.length - 1, born: bn }); }
    else { const tr = await provider.send("debug_traceTransaction", [hash, { tracer: "callTracer" }]); reason = ERR[(tr.output ?? "").slice(0, 10)] ?? (tr.output ?? "").slice(0, 10); }
    rows.push({ t, rc, reason }); }
  rows.sort((a, b) => a.rc.transactionIndex - b.rc.transactionIndex);
  const orderKept = rows.every((r, k) => r.t === order[k]);
  // insertion order on chain = transaction index order; the leaves above were pushed in send order -> rebuild this block's leaves by tx index
  const okRows = rows.filter((r) => r.rc.status === 1); leaves.splice(leaves.length - okRows.length, okRows.length, ...okRows.map((r) => BigInt(r.t.args[5].cmChange)));
  for (const w of wallet.filter((w) => w.born === bn)) w.leaf = leaves.indexOf(BigInt(w.cm));
  st.leaves = leaves.length; states.push(st);
  for (const { t, rc, reason } of rows) { const s = t.s;
    s.attempts.push({ observed_block: t.observed, now: t.nowTs - T0, arrival: +(t.arrival - T0).toFixed(3), block: bn, txIndex: rc.transactionIndex, status: rc.status, reason, gas: rc.gasUsed.toNumber(), note_q: Number(t.note.n.q) });
    if (rc.status === 1) { s.done = "accepted"; s.acceptedAt = tb - T0; }
    else if (s.attempts.length >= MAX_ATTEMPTS) s.done = "retry cap";
    else s.tau = tb; }
  blocks.push({ n: bn, t: tb - T0, txs: rows.length, accepted: okRows.length, orderKept });
  if (String(await gate.noteRoot()) !== String(treeAt(bn).root)) throw new Error(`note root mismatch at block ${bn}`);
  if (senders.every((s) => s.done !== null) && pending.length === 0) break;
  if (bn > 10_000) throw new Error("no termination");
}
// ---------------- metrics ----------------
const used = await gate.queryFilter(gate.filters.BudgetUsed()); const nfCount = {}; for (const e of used) nfCount[String(e.args.budgetNf)] = (nfCount[String(e.args.budgetNf)] ?? 0) + 1;
const acceptedUnits = used.reduce((a, e) => a + e.args.qSpent.toNumber(), 0); const all = senders.flatMap((s) => s.attempts);
const acc = senders.filter((s) => s.done === "accepted"); const reasons = {}; for (const a of all.filter((a) => a.status === 0)) reasons[a.reason] = (reasons[a.reason] ?? 0) + 1;
const firstStart = Math.min(...senders.map((s) => s.start)) - T0, lastAcc = acc.length ? Math.max(...acc.map((s) => s.acceptedAt)) : null;
const out = { cell: `${COND}-k${K}-b${BLK}`, cond: COND, k: K, block_s: BLK, seed: SEED, t_p_s: T_P, budget: Number(BUDGET), notes: NOTES.map(Number),
  hard: { accepted_units: acceptedUnits, accepted_le_budget: acceptedUnits <= Number(BUDGET), max_spends_per_nf: Math.max(0, ...Object.values(nfCount)), nf_once: Object.values(nfCount).every((c) => c === 1),
          accepted_events: used.length, accepted_txs: all.filter((a) => a.status === 1).length },
  accepted_actions: acc.length, stops: { exhausted: senders.filter((s) => s.done === "exhausted").length, retry_cap: senders.filter((s) => s.done === "retry cap").length },
  attempts: all.length, rejections_by_reason: reasons, wasted_gas: all.filter((a) => a.status === 0).reduce((g, a) => g + a.gas, 0),
  gas_accepted: all.filter((a) => a.status === 1).map((a) => a.gas),
  latency_s: acc.map((s) => +(s.acceptedAt - (s.start - T0)).toFixed(3)), latency_blocks: acc.map((s) => s.attempts.at(-1).block - Math.floor((s.start - T0) / BLK)),
  effective_parallelism: lastAcc !== null && lastAcc > firstStart ? acc.length / (lastAcc - firstStart) : null, first_start_s: +firstStart.toFixed(3), last_acceptance_s: lastAcc,
  max_accepted_per_block: Math.max(0, ...blocks.map((b) => b.accepted)), blocks: blocks.length, block_order_kept: blocks.every((b) => b.orderKept),
  state: { note_leaves: leaves.length, budget_spent_slots: used.length, retired_note_roots: leaves.length - 1, registered_states: 1 },
  senders: senders.map((s) => ({ i: s.i, start: +(s.start - T0).toFixed(3), done: s.done, attempts: s.attempts })),
  wall_s: Math.round((Date.now() - wall0) / 1000), prove_ms_median: proveMs.sort((a, b) => a - b)[Math.floor(proveMs.length / 2)] ?? null, host: os.hostname() };
console.log(JSON.stringify(out)); log("done accepted", acc.length, "units", acceptedUnits, "attempts", all.length, "wall", out.wall_s, "s");
anvil.kill(); process.exit(0);

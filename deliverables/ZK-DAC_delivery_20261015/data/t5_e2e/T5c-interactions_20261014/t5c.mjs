// T5c I1 (PREREGISTRATION.md + A1): revocation rate x window on the 1,230-agent T5 tree. Real gate / revocation / registry code on anvil with accept-all
// proof verifiers; logical clock (2 s blocks, 30 s epochs, Mac t_p per D); honest agents act once per epoch (<= 4 attempts), revoked descendants replay
// the last pre-revocation root. Checks: JS non-membership for every attempt, real witnesses / proofs for seeded samples, real revoke witnesses.
// usage: RATE=10 DEP=1 SEED=0 PORT=8801 node t5c.mjs > results/runs/r10-d1/0.json
import fs from "fs"; import path from "path"; import os from "os"; import crypto from "crypto"; import { spawn } from "child_process"; import { createRequire } from "module";
const HERE = new URL(".", import.meta.url).pathname, W = path.resolve(HERE, "../..") + "/";
const reqC = createRequire(W + "t4_contracts/package.json"); const { ethers } = reqC("ethers");
const req7 = createRequire(W + "t2_circuit_fix/zkdac_v7/package.json"); const snarkjs = req7("snarkjs"); const { poseidon3 } = req7("poseidon-lite");
const L7 = await import(W + "t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs");
const L8 = await import(W + "t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs");
const L9 = await import(W + "t2_circuit_fix/zkdac_v9_2/scripts/lib_v9.mjs");
const BW = await import(W + "t2_circuit_fix/zkdac_v8/scripts/budget_world.mjs");
const RG = await import(W + "t4_registration/scripts/lib_register.mjs");
const RV = await import(W + "t4_obligations/E7-obligations_20261009/revoke/revoke_lib.mjs");
const RATE = Number(process.env.RATE), DEP = Number(process.env.DEP), SEED = String(process.env.SEED), PORT = Number(process.env.PORT ?? 8801);
if (![0, 1, 10].includes(RATE) || ![0, 1, 5, 20].includes(DEP)) throw new Error("bad cell");
const BLK = 2, EPOCH = 30, EPOCHS = Number(process.env.SMOKE_EPOCHS ?? 30), DELTA = DEP * EPOCH, T_P = [null, 0.787, 1.377, 2.240, 2.585], MAX_ATT = 4;
const METHOD = "0xa9059cbb", PARAMS = "0x1234abcd", DOMAIN = 0xd0a1n, CHAIN = 31337n, TAG_BNF = 2053857902n, P = L9.P;
const OUT = W + "t4_contracts/foundry/out"; const V92 = W + "t2_circuit_fix/zkdac_v9_2";
const art = (f, n) => JSON.parse(fs.readFileSync(`${OUT}/${f}/${n}.json`));
const TAG = `r${RATE}-d${DEP}-s${SEED}`; const log = (...a) => console.error(new Date().toISOString().slice(11, 19), TAG, ...a);
const rngOf = (tag) => { let c = 0; return () => crypto.createHash("sha256").update(`t5c-${tag}-${c++}`).digest().readUInt32BE(0) / 2 ** 32; };
const shuffle = (xs, r) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rnd250 = () => BigInt("0x" + crypto.randomBytes(32).toString("hex")) % (1n << 250n);
const wall0 = Date.now();

// ---------------- the T5 tree (cached credentials; deterministic keys) ----------------
const CREDS = HERE + "build/creds.json"; let creds;
if (fs.existsSync(CREDS)) creds = JSON.parse(fs.readFileSync(CREDS));
else {
  const key = (n) => (n.startsWith("H") ? RG.humanPrv(Number(n.slice(1))) : crypto.createHash("sha256").update("t5c-node-" + n).digest());
  const list = []; for (let k = 0; k < 32; k++) list.push({ name: `M${k}`, chain: [`H${k}`, `M${k}`], parent: null });
  const kids = (p, n) => { for (let a = 0; a < n; a++) list.push({ name: `${p.name}.${a}`, chain: [...p.chain, `${p.name}.${a}`], parent: p.name }); };
  for (let k = 0; k < 32; k++) kids(list[k], k < 2 ? 8 : 1);
  for (const D of [2, 3]) for (const p of list.filter((x) => x.chain.length - 1 === D && /^M[01]\./.test(x.name))) kids(p, 8);
  creds = [];
  for (const a of list) { const D = a.chain.length - 1;
    const { input, meta } = await L7.buildInstanceV7({ D, seed: 11, mode: "C", now: 1000, entPrv: a.chain.map(key), rootOthers: 0, expiries: [4e9, 3.9e9, 3.8e9, 3.7e9].slice(0, D), accSeed: `t5c-${a.name}` });
    creds.push({ id: creds.length, name: a.name, chain: a.chain, D, parent: a.parent, cert: meta.cert.map(String), sks: meta.ents.map((e) => String(e.sk)), tpk: meta.tpk.map(String), input }); }
  fs.mkdirSync(HERE + "build", { recursive: true }); fs.writeFileSync(CREDS, JSON.stringify(creds));
}
if (creds.length !== 1230) throw new Error("expected 1,230 agents");
const metaOf = (c) => ({ D: c.D, cert: c.cert.map(BigInt), P: (xs) => L7 && poseidonN(xs), ents: c.sks.map((sk) => ({ sk: BigInt(sk) })) });
const req92 = createRequire(V92 + "/package.json"); const PL = req92("poseidon-lite"); const poseidonN = (xs) => PL[`poseidon${xs.length}`](xs.map(BigInt));
const edges = creds.filter((c) => c.D >= 2).map((c) => c.id);                         // edge into agent c = cert[c.D - 1]
const lineage = (c) => c.cert.slice(1);                                               // revocable certificates of c's chain
// ---------------- off-chain mirror ----------------
const imt = await L7.IMT.create(20); for (let k = 0; k < 20; k++) imt.insert(L8.rnd250("t5c-decoy-" + k));
const issued = new BW.W.SparseTree(16); for (const c of creds) for (let i = 1; i < c.D; i++) if (issued.index.get(c.cert[i]) === undefined) issued.append(BigInt(c.cert[i]));
const roots = L7.newRootTree();
// ---------------- anvil + contracts (accept-all verifiers) ----------------
const anvil = spawn("anvil", ["--port", String(PORT), "--silent", "--accounts", "101", "--gas-limit", "300000000", "--code-size-limit", "100000", "--no-mining"], { stdio: "ignore" });
process.on("exit", () => anvil.kill());
const provider = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:${PORT}`); provider.pollingInterval = 5;
for (let i = 0; i < 200; i++) { try { await provider.getBlockNumber(); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
const MN = "test test test test test test test test test test test junk";                // anvil's public default mnemonic (local only)
const acct = (i) => ethers.Wallet.fromMnemonic(MN, `m/44'/60'/0'/0/${i}`).connect(provider);
const op = acct(0); const relayers = Array.from({ length: 100 }, (_, i) => acct(i + 1)); const nonces = new Map();
const nextNonce = async (w) => { if (!nonces.has(w.address)) nonces.set(w.address, await w.getTransactionCount()); const n = nonces.get(w.address); nonces.set(w.address, n + 1); return n; };
const receipt = async (hash) => { for (;;) { const r = await provider.getTransactionReceipt(hash); if (r) return r; await new Promise((z) => setTimeout(z, 2)); } };
let clock = (await provider.getBlock("latest")).timestamp + 5;
const mineAt = async (t) => { await provider.send("evm_setNextBlockTimestamp", [t]); await provider.send("evm_mine", []); };
const LIBS = {};
async function deploy(f, n, args = []) { const a = art(f, n); let code = a.bytecode.object.slice(2);
  for (const refs of Object.values(a.bytecode.linkReferences ?? {})) for (const [lib, locs] of Object.entries(refs)) for (const { start, length } of locs) code = code.slice(0, 2 * start) + LIBS[lib].slice(2).toLowerCase() + code.slice(2 * (start + length));
  const c = await new ethers.ContractFactory(a.abi, "0x" + code, op).deploy(...args, { nonce: await nextNonce(op), gasLimit: 30_000_000 }); await mineAt(clock++); await receipt(c.deployTransaction.hash); return c; }
async function batch(calls) {       // operator setup txs, many per block
  const hs = []; for (const [c, fn, args] of calls) hs.push((await c[fn](...args, { nonce: await nextNonce(op), gasLimit: 5_000_000 })).hash);
  await mineAt(clock++);
  for (let k = 0; k < 50 && (await Promise.all(hs.map((h) => provider.getTransactionReceipt(h)))).some((r) => !r); k++) await mineAt(clock++);   // spill-over blocks
  for (const h of hs) { const r = await receipt(h); if (r.status !== 1) throw new Error("setup tx reverted"); } }
LIBS.PoseidonT3 = (await deploy("PoseidonT3.sol", "PoseidonT3")).address; LIBS.PoseidonT4 = (await deploy("PoseidonT4.sol", "PoseidonT4")).address;
const ACC = (await deploy("T7cRefineHelpers.sol", "T7cAcceptAll")).address;
const reg = await deploy("ZkDacRegistry.sol", "ZkDacRegistry", [ACC, op.address, DOMAIN.toString(), 1_000_000_000]);
const revs = await deploy("ZkDacRevocations.sol", "ZkDacRevocations", [ACC, String(imt.root), imt.leaves.length, DELTA]);
const target = await deploy("T7cRefineHelpers.sol", "T7cSumTarget");
const gate = await deploy("ZkDacGateV9.sol", "ZkDacGateV9", [[ACC, ACC, ACC, ACC], [7, 8, 9, 10], reg.address, revs.address, op.address, String(issued.root), 300, 3600, creds[0].tpk, [ACC, ACC, 600]]);
const REQCAP = Number(creds[0].input.act_req_cap); if (!creds.every((c) => Number(c.input.act_req_cap) === REQCAP)) throw new Error("req cap differs");
const ZERO = { a: [0, 0], b: [[0, 0], [0, 0]], c: [0, 0] };
{ const humans = Array.from({ length: 32 }, (_, i) => RG.makeHuman(i)); const group = new RG.Group(humans.map((h) => h.id.commitment)); const calls = [[gate, "setMethod", [METHOD, REQCAP, true]], [reg, "setGroupRoot", [String(group.root), true]]];
  for (let k = 0; k < 32; k++) { const m = creds[k]; const rw = RG.registerWitness({ human: humans[k], group, domain: DOMAIN, master: [m.input.ent_Ax[1], m.input.ent_Ay[1]], cap0: m.input.cap[0], expiry0: m.input.expiry[0] });
    if (rw.leaf0 !== m.cert[0]) throw new Error("leaf0"); roots.insert(BigInt(m.cert[0]));
    calls.push([reg, "register", [ZERO, String(group.root), String(poseidon3([2053858418n, BigInt(rw.human_sk), DOMAIN])), rw.leaf0, []]]); }
  await batch(calls); if (String(await reg.currentRoot()) !== String(roots.root)) throw new Error("registry root"); }
const ISS = String(issued.root), ROOT = String(roots.root);
await batch([[gate, "registerState", [ISS, String(imt.root), ROOT]]]);
// notes: one note of 1,000 per agent (accept-all mint)
const notes = L8.newNoteTree(); const wallet = new Map();
const own = (c) => [BigInt(c.input.ent_Ax[c.D]), BigInt(c.input.ent_Ay[c.D])];
const nfOf = (c, n) => String(poseidon3([TAG_BNF, BigInt(c.sks[c.D]), L8.noteCm(n)]));
for (let s = 0; s < creds.length; s += 200) { const calls = [];
  for (const c of creds.slice(s, s + 200)) { const n = { own: own(c), q: 1000n, lin: L8.linOf({ D: c.D, cert: c.cert.map(BigInt) }), rho: rnd250() }; wallet.set(c.id, n); notes.insert(L8.noteCm(n)); calls.push([gate, "mint", [ZERO, String(L8.noteCm(n)), "1000"]]); }
  await batch(calls); }
if (String(await gate.noteRoot()) !== String(notes.root)) throw new Error("note root after mint");
log("setup done", Math.round((Date.now() - wall0) / 1000), "s");

// ---------------- schedule ----------------
const T0 = clock + 10, NBLK = EPOCHS * EPOCH / BLK; const tOf = (b) => T0 + BLK * b;
const rRev = rngOf(`rev-${RATE}-${DEP}-${SEED}`), rAct = rngOf(`act-${RATE}-${DEP}-${SEED}`), rOrd = rngOf(`ord-${RATE}-${DEP}-${SEED}`), rSmp = rngOf(`smp-${RATE}-${DEP}-${SEED}`);
const nRev = Math.round(RATE / 100 * edges.length); const revEdges = shuffle(edges, rRev).slice(0, nRev);
const revAt = revEdges.map((id) => ({ id, t: T0 + 5 * EPOCH + rRev() * 5 * EPOCH })).sort((a, b) => a.t - b.t);
const ag = creds.map((c) => ({ c, epoch: 0, next: T0 + rAct() * EPOCH, att: 0, pending: false, adv: false, preRoot: null, rows: [] }));
const revoked = new Set(); const imtHist = [{ root: String(imt.root), imt: RV.cloneImt(imt) }]; const revLog = [];
const isRevokedNow = (c) => lineage(c).some((x) => revoked.has(x));
// per-block observed state: revoked-root index into imtHist (the note tree is always the live one: attempts observe the latest mined block)
let curRevIdx = 0;
const stats = { attempts: 0, honest_sampled: [], adv_sampled: [], adv_fresh_constructible: 0, adv_attempts: 0, rej: { free: {}, affected_honest: {}, adversary: {} }, rev_witness_sat: 0, rev_witness_unsat: 0, mirror_mismatch: 0 };
const rows = [];                    // one per finished action (honest) or adversarial attempt
const SAMPLE_P = 30 / (creds.length * EPOCHS) * 4, ADV_P = 0.05;
async function fullInput(c, revIdx, n, rhoChange, nowTs, nonceA) {     // the real witness input for this tx (live note tree, chosen revoked snapshot)
  const x = structuredClone(c.input); x.issued_root = ISS;
  for (let i = 1; i < c.D; i++) { const p = issued.path(issued.index.get(c.cert[i])); x.m_sib[i] = p.sib; x.m_bit[i] = p.bit; }
  Object.assign(x, L7.rootProof(roots, c.cert[0])); L7.refreshAll(x, { D: c.D, cert: c.cert.map(BigInt), P: poseidonN, ents: c.sks.map((sk) => ({ sk: BigInt(sk) })), imt: imtHist[revIdx].imt });
  const { input } = L8.setBudget(x, n, notes, 1n, rhoChange); L9.toV9(input, crypto.randomBytes(16).toString("hex")); input.now = String(nowTs);
  input.ctx_hash = String(L7.ctxHash({ chainId: CHAIN, verifier: gate.address, method: METHOD, target: target.address, params: PARAMS, amount: 1n, nonce: nonceA })); return input;
}
let nonceCtr = 0n; const pending = [];
async function build(a, now) {      // the agent observes the latest mined block (time now) and builds its tx
  const c = a.c; const n = wallet.get(c.id); const nowTs = tOf(Math.floor((now - T0) / BLK)); let revIdx = curRevIdx;
  if (!a.adv && isRevokedNow(c)) { a.adv = true; }
  if (a.adv) { stats.adv_attempts++; if (lineage(c).every((x) => !imtHist[curRevIdx].imt.has(L7.trunc(BigInt(x))))) stats.adv_fresh_constructible++; revIdx = a.preRoot; }
  const rho = rnd250(); const change = { own: n.own, q: n.q - 1n, lin: n.lin, rho }; const nonceA = ++nonceCtr;
  // JS-level witness construction (non-membership in the chosen snapshot) for every attempt
  const sat = lineage(c).every((x) => !imtHist[revIdx].imt.has(L7.trunc(BigInt(x))));
  if (!sat) throw new Error(`no witness for ${a.adv ? "adversarial" : "honest"} attempt of ${c.name}`);
  const smp = a.adv ? rSmp() < ADV_P && stats.adv_sampled.length < 30 : rSmp() < SAMPLE_P && stats.honest_sampled.length < 60;
  let ct = Array(c.D + 6).fill("1"), ctx = null, input = null;
  if (smp) { input = await fullInput(c, revIdx, n, rho, nowTs, nonceA); ct = [input.acc_c1x, input.acc_c1y, input.acc_c2x, input.acc_c2y, ...input.acc_e, input.acc_esign]; }
  const tx = { a, adv: a.adv, revIdx, arrival: now + T_P[c.D], nowTs, input,
    args: [ZERO, { issued: ISS, revoked: imtHist[revIdx].root, root: ROOT }, nowTs, { target: target.address, method: METHOD, amount: 1, nonce: String(nonceA), params: PARAMS }, ct,
      { noteRoot: String(notes.root), budgetNf: nfOf(c, n), cmChange: String(L8.noteCm(change)), qSpent: "1" }], change };
  a.pending = true; a.att++; stats.attempts++; pending.push(tx);
}
const ERR = {}; for (const f of gate.interface.fragments.filter((f) => f.type === "error")) ERR[gate.interface.getSighash(f)] = f.name;
let relay = 0;
for (let b = 1; b <= NBLK + 200; b++) {
  const tb = tOf(b);
  // agents whose action time has come observe block b - 1 (already mined)
  for (const a of ag) if (!a.pending && a.epoch < EPOCHS && a.next < tb) await build(a, a.next);
  const inBlock = pending.filter((t) => t.arrival <= tb); for (const t of inBlock) pending.splice(pending.indexOf(t), 1);
  const hs = [];
  // revocations due in this block: first in the block (operator), each with registerState of the new root
  const due = revAt.filter((r) => r.t <= tb && !r.done);
  for (const r of due) { r.done = true; const c = creds[r.id]; const hop = c.D - 1; const entry = BigInt(c.cert[hop]);
    const tr = RV.transition(imt, entry, RV.certAuthority({ input: c.input, meta: metaOf(c) }, hop, 0));
    if (await RV.satisfiable(tr.input)) stats.rev_witness_sat++; else stats.rev_witness_unsat++;
    hs.push({ rev: r, hash: (await revs.revoke(ZERO, String(tr.newRoot), String(entry), { nonce: await nextNonce(op), gasLimit: 2_000_000 })).hash });
    imt.insert(entry); if (String(imt.root) !== String(tr.newRoot)) throw new Error("imt root");
    hs.push({ hash: (await gate.registerState(ISS, String(imt.root), ROOT, { nonce: await nextNonce(op), gasLimit: 2_000_000 })).hash });
    // descendants that see this revocation remember the root just before their first revoking revocation
    for (const a of ag) if (a.preRoot === null && lineage(a.c).includes(c.cert[hop])) a.preRoot = imtHist.length - 1;
    revoked.add(c.cert[hop]); imtHist.push({ root: String(imt.root), imt: RV.cloneImt(imt) }); revLog.push({ id: r.id, name: c.name, hop, block: b, t: tb - T0 }); }
  for (const t of shuffle(inBlock, rOrd)) { const w = relayers[relay++ % relayers.length];
    hs.push({ t, hash: (await gate.connect(w).execute(...t.args, { nonce: await nextNonce(w), gasLimit: 3_000_000 })).hash }); }
  await mineAt(tb); if (due.length) curRevIdx = imtHist.length - 1;
  for (const h of hs) { const rc = await provider.getTransactionReceipt(h.hash); if (!rc) throw new Error(`tx not included in block ${b} (capacity)`);
    if (!h.t) { if (rc.status !== 1) throw new Error("operator tx reverted"); continue; }
    const t = h.t, a = t.a; let reason = null;
    if (rc.status === 1) { notes.insert(BigInt(t.args[5].cmChange)); wallet.set(a.c.id, t.change); }
    else { const tr = await provider.send("debug_traceTransaction", [h.hash, { tracer: "callTracer" }]); reason = ERR[(tr.output ?? "").slice(0, 10)] ?? (tr.output ?? "").slice(0, 10);
      const grp = t.adv ? "adversary" : "pending_class"; (stats.rejRaw ??= []).push({ id: a.c.id, adv: t.adv, reason }); }
    if (t.input) (a.adv ? stats.adv_sampled : stats.honest_sampled).push({ input: t.input, D: a.c.D, accepted: rc.status === 1, pub_args: t.args });
    a.pending = false;
    const row = { id: a.c.id, D: a.c.D, epoch: a.epoch, att: a.att, adv: t.adv, revIdx: t.revIdx, block: b, t: tb - T0, ok: rc.status === 1, reason };
    if (t.adv) { rows.push(row); a.epoch++; a.att = 0; a.next = Math.max(T0 + a.epoch * EPOCH + rAct() * EPOCH, tb); }        // adversary: one attempt per epoch
    else if (rc.status === 1 || a.att >= MAX_ATT) { rows.push(row); a.epoch++; a.att = 0; a.next = Math.max(T0 + a.epoch * EPOCH + rAct() * EPOCH, tb); }
    else a.next = tb;                                                            // retry: re-observe at the inclusion time
  }
  if (String(await gate.noteRoot()) !== String(notes.root)) stats.mirror_mismatch++;
  if (String(await revs.root()) !== String(imt.root)) throw new Error("revocation root mismatch");
  if (ag.every((a) => a.epoch >= EPOCHS && !a.pending) && pending.length === 0 && b >= NBLK) break;
  if (b % 75 === 0) log("block", b, "attempts", stats.attempts, "revoked", revoked.size);
}
log("simulation done", Math.round((Date.now() - wall0) / 1000), "s; checks");
// ---------------- real witness and proof checks on the samples ----------------
const tmp = path.join(os.tmpdir(), `t5c-${process.pid}.wtns`); const wsat = async (x, D) => { try { await snarkjs.wtns.calculate(x, `${V92}/build/c${D}/main_c_d${D}_js/main_c_d${D}.wasm`, tmp); return true; } catch { return false; } };
const checks = { b_adv_witness: { n: 0, sat: 0 }, c_honest_witness: { n: 0, sat: 0 }, d_honest_proof: { n: 0, valid: 0, pub_match: 0 } };
for (const s of stats.adv_sampled.slice(0, 30)) { checks.b_adv_witness.n++; if (await wsat(s.input, s.D)) checks.b_adv_witness.sat++; }
for (const s of stats.honest_sampled.slice(0, 30)) { checks.c_honest_witness.n++; if (await wsat(s.input, s.D)) checks.c_honest_witness.sat++; }
for (const s of stats.honest_sampled.filter((s) => s.accepted).slice(0, 10)) { checks.d_honest_proof.n++;
  const { proof, publicSignals: ps } = await snarkjs.groth16.fullProve(s.input, `${V92}/build/c${s.D}/main_c_d${s.D}_js/main_c_d${s.D}.wasm`, `${V92}/build/zk/c${s.D}.zkey`);
  if (await snarkjs.groth16.verify(JSON.parse(fs.readFileSync(`${V92}/zk/vk_c${s.D}.json`)), ps, proof)) checks.d_honest_proof.valid++;
  const b = s.pub_args[5]; if (ps.at(-4) === b.noteRoot && ps.at(-3) === b.budgetNf && ps.at(-2) === b.cmChange && ps.at(-1) === b.qSpent && ps[1] === String(s.pub_args[2])) checks.d_honest_proof.pub_match++; }
try { fs.unlinkSync(tmp); } catch {}
// ---------------- metrics ----------------
const descOf = (edgeCert) => new Set(creds.filter((c) => lineage(c).includes(edgeCert)).map((c) => c.id));
const affected = new Set(); const exposure = [];
for (const r of revLog) { const cert = creds[r.id].cert[r.hop]; const ds = descOf(cert); for (const d of ds) affected.add(d);
  const acc = rows.filter((x) => x.ok && ds.has(x.id) && x.t > r.t);
  exposure.push({ edge: r.name, hop: r.hop, t: r.t, descendants: ds.size, accepted_after: acc.length, last_after_s: acc.length ? Math.max(...acc.map((x) => x.t)) - r.t : null,
                  h1_after_window: acc.filter((x) => x.t > r.t + DELTA).length }); }
const free = rows.filter((x) => !affected.has(x.id)); const reasons = {}; for (const x of rows.filter((x) => !x.ok)) reasons[x.reason] = (reasons[x.reason] ?? 0) + 1;
for (const r of stats.rejRaw ?? []) { const g = r.adv ? "adversary" : affected.has(r.id) ? "affected_honest" : "free"; stats.rej[g][r.reason] = (stats.rej[g][r.reason] ?? 0) + 1; }
const freeAgents = creds.filter((c) => !affected.has(c.id));
let strict = 0; const streaks = [];
for (const c of freeAgents) { const xs = free.filter((x) => x.id === c.id).sort((a, b) => a.epoch - b.epoch); let s = 0; for (let i = xs.length - 1; i >= 0 && !xs[i].ok; i--) s++; if (s > 0) { strict++; streaks.push(s); } }
const freeAcc = free.filter((x) => x.ok);
const out = { cell: `r${RATE}-d${DEP}`, rate: RATE, delta_epochs: DEP, delta_s: DELTA, seed: SEED, block_s: BLK, epoch_s: EPOCH, epochs: EPOCHS, t_p: T_P.slice(1),
  revocations: revLog.length, affected_agents: affected.size, free_agents: freeAgents.length,
  H1_accepted_after_window: exposure.reduce((s, e) => s + e.h1_after_window, 0),
  H2_strictly_denied_free_agents: strict, H2_denial_streaks: streaks,
  free: { demanded: freeAgents.length * EPOCHS, accepted: freeAcc.length, transient_denials: free.filter((x) => !x.ok).length,
          attempts_per_accepted: freeAcc.length ? freeAcc.reduce((s, x) => s + x.att, 0) / freeAcc.length : null,
          attempts_hist: [1, 2, 3, 4].map((k) => freeAcc.filter((x) => x.att === k).length) },
  rejections_final_by_reason: reasons, rejections_all_attempts: stats.rej, exposure,
  adversary: { attempts: stats.adv_attempts, accepted: rows.filter((x) => x.adv && x.ok).length, fresh_witness_constructible: stats.adv_fresh_constructible },
  checks: { ...checks, e_revoke_witness: { sat: stats.rev_witness_sat, unsat: stats.rev_witness_unsat }, note_root_mirror_mismatches: stats.mirror_mismatch },
  attempts_total: stats.attempts, blocks: rows.length ? Math.max(...rows.map((x) => x.block)) : 0, wall_s: Math.round((Date.now() - wall0) / 1000), host: os.hostname(),
  adversary_rows: rows.filter((x) => x.adv) };
console.log(JSON.stringify(out)); log("done H1", out.H1_accepted_after_window, "H2", strict, "free acc", freeAcc.length, "/", out.free.demanded, "wall", out.wall_s, "s");
anvil.kill(); process.exit(0);

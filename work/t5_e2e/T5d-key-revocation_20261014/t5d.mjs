// T5d (PREREGISTRATION.md): key revocation at scale on the T5 tree with shared delegate keys. One world per (S, R, SEED); methods K, E-oracle, E-local
// run from the same chain snapshot. Real revoke proofs + verifier (gas); accept-all execute verifier; circuit-level substitute witnesses (T5b style).
// usage: S=30 R=10 SEED=0 PORT=8901 node t5d.mjs > results/worlds/s30-r10-0.json      (SMOKE_AGENTS=n limits the circuit checks; not evidence)
import fs from "fs"; import path from "path"; import os from "os"; import crypto from "crypto"; import { spawn } from "child_process"; import { createRequire } from "module";
const HERE = new URL(".", import.meta.url).pathname, W = path.resolve(HERE, "../..") + "/";
const reqC = createRequire(W + "t4_contracts/package.json"); const { ethers } = reqC("ethers");
const req7 = createRequire(W + "t2_circuit_fix/zkdac_v7/package.json"); const snarkjs = req7("snarkjs"); const PL = req7("poseidon-lite");
const L7 = await import(W + "t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs");
const L8 = await import(W + "t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs");
const L9 = await import(W + "t2_circuit_fix/zkdac_v9_2/scripts/lib_v9.mjs");
const BW = await import(W + "t2_circuit_fix/zkdac_v8/scripts/budget_world.mjs");
const RG = await import(W + "t4_registration/scripts/lib_register.mjs");
const RV = await import(W + "t4_obligations/E7-obligations_20261009/revoke/revoke_lib.mjs");
const S_ = Number(process.env.S), R_ = Number(process.env.R), SEED = String(process.env.SEED), PORT = Number(process.env.PORT ?? 8901), SMOKE = Number(process.env.SMOKE_AGENTS ?? 0);
if (![10, 30].includes(S_) || ![1, 10].includes(R_)) throw new Error("bad cell");
const RWIN = 30, METHOD = "0xa9059cbb", PARAMS = "0x1234abcd", DOMAIN = 0xd0a1n, CHAIN = 31337n, TAG_BNF = 2053857902n, KEY_TAG = 2053861995n, P = L9.P;
const OUT = W + "t4_contracts/foundry/out", V92 = W + "t2_circuit_fix/zkdac_v9_2"; const art = (f, n) => JSON.parse(fs.readFileSync(`${OUT}/${f}/${n}.json`));
const TAG = `s${S_}-r${R_}-${SEED}`; const log = (...a) => console.error(new Date().toISOString().slice(11, 19), TAG, ...a);
const rngOf = (tag) => { let c = 0; return () => crypto.createHash("sha256").update(`t5d-${tag}-${c++}`).digest().readUInt32BE(0) / 2 ** 32; };
const shuffle = (xs, r) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const poseidonN = (xs) => PL[`poseidon${xs.length}`](xs.map(BigInt)); const S = String; const wall0 = Date.now();

// ---------------- tree and key sharing ----------------
const list = []; for (let k = 0; k < 32; k++) list.push({ name: `M${k}`, chain: [`H${k}`, `M${k}`], parent: null });
const kids = (p, n) => { for (let a = 0; a < n; a++) list.push({ name: `${p.name}.${a}`, chain: [...p.chain, `${p.name}.${a}`], parent: p.name }); };
for (let k = 0; k < 32; k++) kids(list[k], k < 2 ? 8 : 1);
for (const D of [2, 3]) for (const p of list.filter((x) => x.chain.length - 1 === D && /^M[01]\./.test(x.name))) kids(p, 8);
const rShare = rngOf(`share-${S_}-${SEED}`); const deep = list.filter((x) => x.chain.length - 1 >= 2);
const nReuse = Math.round(S_ / 100 * deep.length); const reusers = shuffle(deep, rShare).slice(0, nReuse); const reuserSet = new Set(reusers.map((x) => x.name));
const keyName = {};                                                                   // node name -> name whose key it uses
for (const r of reusers) { const cands = deep.filter((x) => !reuserSet.has(x.name) && x.parent !== r.parent && !x.chain.includes(r.name) && !r.chain.includes(x.name));
  keyName[r.name] = cands[Math.floor(rShare() * cands.length)].name; }
const keyOf = (n) => (n.startsWith("H") ? RG.humanPrv(Number(n.slice(1))) : crypto.createHash("sha256").update("t5d-node-" + (keyName[n] ?? n)).digest());
const creds = [];
for (const a of list) { const D = a.chain.length - 1;
  const { input, meta } = await L7.buildInstanceV7({ D, seed: 11, mode: "C", now: 1000, entPrv: a.chain.map(keyOf), rootOthers: 0, expiries: [4e9, 3.9e9, 3.8e9, 3.7e9].slice(0, D), accSeed: `t5d-${a.name}` });
  creds.push({ id: creds.length, name: a.name, chain: a.chain, D, cert: meta.cert.map(S), sks: meta.ents.map((e) => S(e.sk)), tpk: meta.tpk.map(S), input }); }
if (creds.length !== 1230) throw new Error("1,230 agents");
const metaOf = (c) => ({ D: c.D, cert: c.cert.map(BigInt), P: poseidonN, ents: c.sks.map((sk) => ({ sk: BigInt(sk) })) });
const keyHashOf = (c, j) => S(poseidonN([KEY_TAG, BigInt(c.input.ent_Ax[j]), BigInt(c.input.ent_Ay[j])]));
const delegKeys = (c) => Array.from({ length: Math.max(0, c.D - 1) }, (_, i) => keyHashOf(c, i + 2));       // key slots: ent[2..D]
// distinct delegate keys = holder keys of agents at D >= 2 (a reuser's key equals its source's)
const holderOf = new Map(); for (const c of creds.filter((c) => c.D >= 2)) { const k = keyHashOf(c, c.D); if (!holderOf.has(k)) holderOf.set(k, []); holderOf.get(k).push(c.id); }
const distinct = [...holderOf.keys()]; const rRev = rngOf(`rev-${S_}-${R_}-${SEED}`);
const revKeys = shuffle(distinct, rRev).slice(0, Math.round(R_ / 100 * distinct.length));
const revKeySet = new Set(revKeys); const targets = new Set(creds.filter((c) => delegKeys(c).some((k) => revKeySet.has(k))).map((c) => c.id));
log("reusers", nReuse, "distinct keys", distinct.length, "revoked keys", revKeys.length, "targets", targets.size, "creds", Math.round((Date.now() - wall0) / 1000), "s");
// edges per method: E-oracle = every certificate whose holder is a revoked key; E-local = the lowest-id holder's certificate only
const edgesOracle = revKeys.flatMap((k) => holderOf.get(k)); const edgesLocal = revKeys.map((k) => Math.min(...holderOf.get(k)));

// ---------------- chain (shared deployment; methods restored from a snapshot) ----------------
const imt0 = await L7.IMT.create(20); for (let k = 0; k < 20; k++) imt0.insert(L8.rnd250("t5d-decoy-" + k));
const issued = new BW.W.SparseTree(16); for (const c of creds) for (let i = 1; i < c.D; i++) if (issued.index.get(c.cert[i]) === undefined) issued.append(BigInt(c.cert[i]));
const roots = L7.newRootTree();
const anvil = spawn("anvil", ["--port", String(PORT), "--silent", "--accounts", "3", "--gas-limit", "300000000", "--code-size-limit", "100000", "--no-mining"], { stdio: "ignore" });
process.on("exit", () => anvil.kill());
const provider = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:${PORT}`); provider.pollingInterval = 5;
for (let i = 0; i < 200; i++) { try { await provider.getBlockNumber(); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
const op = ethers.Wallet.fromMnemonic("test test test test test test test test test test test junk").connect(provider);   // anvil's public default account (local only)
let nonce = await op.getTransactionCount(); let clock = (await provider.getBlock("latest")).timestamp + 5;
const mineAt = async (t) => { await provider.send("evm_setNextBlockTimestamp", [t]); await provider.send("evm_mine", []); };
const receipt = async (h) => { for (;;) { const r = await provider.getTransactionReceipt(h); if (r) return r; await new Promise((z) => setTimeout(z, 2)); } };
async function block(calls) { const hs = []; for (const [c, fn, args] of calls) hs.push((await c[fn](...args, { nonce: nonce++, gasLimit: 5_000_000 })).hash);
  await mineAt(clock++); for (let k = 0; k < 50 && (await Promise.all(hs.map((h) => provider.getTransactionReceipt(h)))).some((r) => !r); k++) await mineAt(clock++);
  return Promise.all(hs.map(receipt)); }
const LIBS = {};
async function deploy(f, n, args = []) { const a = art(f, n); let code = a.bytecode.object.slice(2);
  for (const refs of Object.values(a.bytecode.linkReferences ?? {})) for (const [lib, locs] of Object.entries(refs)) for (const { start, length } of locs) code = code.slice(0, 2 * start) + LIBS[lib].slice(2).toLowerCase() + code.slice(2 * (start + length));
  const c = await new ethers.ContractFactory(a.abi, "0x" + code, op).deploy(...args, { nonce: nonce++, gasLimit: 30_000_000 }); await mineAt(clock++); await receipt(c.deployTransaction.hash); return c; }
LIBS.PoseidonT3 = (await deploy("PoseidonT3.sol", "PoseidonT3")).address; LIBS.PoseidonT4 = (await deploy("PoseidonT4.sol", "PoseidonT4")).address;
const ACC = (await deploy("T7cRefineHelpers.sol", "T7cAcceptAll")).address;
const reg = await deploy("ZkDacRegistry.sol", "ZkDacRegistry", [ACC, op.address, DOMAIN.toString(), 1_000_000_000]);
const revs = await deploy("ZkDacRevocations.sol", "ZkDacRevocations", [(await deploy("Groth16VerifierRevoke.sol", "Groth16VerifierRevoke")).address, S(imt0.root), imt0.leaves.length, RWIN]);
const target = await deploy("T7cRefineHelpers.sol", "T7cSumTarget");
const gate = await deploy("ZkDacGateV9.sol", "ZkDacGateV9", [[ACC, ACC, ACC, ACC], [7, 8, 9, 10], reg.address, revs.address, op.address, S(issued.root), 300, 3600, creds[0].tpk, [ACC, ACC, 600]]);
const REQCAP = Number(creds[0].input.act_req_cap); const ZERO = { a: [0, 0], b: [[0, 0], [0, 0]], c: [0, 0] };
{ const humans = Array.from({ length: 32 }, (_, i) => RG.makeHuman(i)); const group = new RG.Group(humans.map((h) => h.id.commitment)); const calls = [[gate, "setMethod", [METHOD, REQCAP, true]], [reg, "setGroupRoot", [S(group.root), true]]];
  for (let k = 0; k < 32; k++) { const m = creds[k]; const rw = RG.registerWitness({ human: humans[k], group, domain: DOMAIN, master: [m.input.ent_Ax[1], m.input.ent_Ay[1]], cap0: m.input.cap[0], expiry0: m.input.expiry[0] });
    roots.insert(BigInt(m.cert[0])); calls.push([reg, "register", [ZERO, S(group.root), S(PL.poseidon3([2053858418n, BigInt(rw.human_sk), DOMAIN])), rw.leaf0, []]]); }
  await block(calls); if (S(await reg.currentRoot()) !== S(roots.root)) throw new Error("registry root"); }
const ISS = S(issued.root), ROOT = S(roots.root);
await block([[gate, "registerState", [ISS, S(imt0.root), ROOT]]]);
const notes = L8.newNoteTree(); const note0 = new Map(); const own = (c) => [BigInt(c.input.ent_Ax[c.D]), BigInt(c.input.ent_Ay[c.D])];
for (let s = 0; s < creds.length; s += 200) { const calls = []; for (const c of creds.slice(s, s + 200)) { const n = { own: own(c), q: 1000n, lin: L8.linOf({ D: c.D, cert: c.cert.map(BigInt) }), rho: L8.rnd250(`t5d-n-${SEED}-${c.id}`) };
  note0.set(c.id, n); notes.insert(L8.noteCm(n)); calls.push([gate, "mint", [ZERO, S(L8.noteCm(n)), "1000"]]); } await block(calls); }
let snap0 = await provider.send("evm_snapshot", []); const nonce0 = nonce, clock0 = clock;
log("setup done", Math.round((Date.now() - wall0) / 1000), "s");

// ---------------- helpers ----------------
const lineageOk = (c, imt) => c.cert.slice(1).every((x) => !imt.has(L7.trunc(BigInt(x)))) && delegKeys(c).every((k) => !imt.has(L7.trunc(BigInt(k))));
function honestInput(c, imt, noteTree, n) { const x = structuredClone(c.input); x.issued_root = ISS;
  for (let i = 1; i < c.D; i++) { const p = issued.path(issued.index.get(c.cert[i])); x.m_sib[i] = p.sib; x.m_bit[i] = p.bit; }
  Object.assign(x, L7.rootProof(roots, c.cert[0])); L7.refreshAll(x, { ...metaOf(c), imt });
  const { input } = L8.setBudget(x, n, noteTree, 1n, L8.rnd250(`t5d-chg-${SEED}-${c.id}-${crypto.randomBytes(4).toString("hex")}`)); return input; }
function substitute(c, imt, noteTree, n, variant) {     // honest construction for unrevoked slots; for revoked slots, the predecessor or the own leaf (T5b)
  const x = structuredClone(c.input); x.issued_root = ISS;
  for (let i = 1; i < c.D; i++) { const p = issued.path(issued.index.get(c.cert[i])); x.m_sib[i] = p.sib; x.m_bit[i] = p.bit; }
  Object.assign(x, L7.rootProof(roots, c.cert[0])); x.revoked_root = S(imt.root);
  const leafAt = (k) => (variant === "pred" ? imt.lowIndex(k) : imt.leaves.findIndex((l) => l.value === k));
  const put = (pre, i, k) => { let idx; if (imt.has(k)) idx = leafAt(k); else idx = imt.lowIndex(k); const L = imt.leaves[idx], p = imt.path(idx);
    x[`${pre}_low_value`][i] = S(L.value); x[`${pre}_low_next_index`][i] = S(L.nextIndex); x[`${pre}_low_next_value`][i] = S(L.nextValue); x[`${pre}_sib`][i] = p.sib.map(S); x[`${pre}_bit`][i] = p.bit.map(S); };
  for (let i = 0; i < c.D; i++) put("r", i, L7.trunc(BigInt(c.cert[i])));
  const dk = delegKeys(c); if (c.D >= 2) for (let i = 0; i < dk.length; i++) put("k", i, L7.trunc(BigInt(dk[i])));
  const { input } = L8.setBudget(x, n, noteTree, 1n, L8.rnd250(`t5d-sub-${SEED}-${c.id}`)); return input; }
const tmp = path.join(os.tmpdir(), `t5d-${process.pid}.wtns`);
async function sat(x, D) { L9.toV9(x, crypto.randomBytes(16).toString("hex")); x.now = "2000"; x.ctx_hash = S(L7.ctxHash({ chainId: CHAIN, verifier: gate.address, method: METHOD, target: target.address, params: PARAMS, amount: 1n, nonce: 1n }));
  try { await snarkjs.wtns.calculate(x, `${V92}/build/c${D}/main_c_d${D}_js/main_c_d${D}.wasm`, tmp); return "accept"; } catch (e) { const m = String(e.message ?? e).match(/template (\S+) line: (\d+)/); return m ? `${m[1].replace(/_\d+$/, "")} L${m[2]}` : "reject"; } }
const execArgs = (c, revRoot, nowTs, n, k) => { const change = { own: n.own, q: n.q - 1n, lin: n.lin, rho: L8.rnd250(`t5d-x-${SEED}-${c.id}-${k}`) };
  return [ZERO, { issued: ISS, revoked: revRoot, root: ROOT }, nowTs, { target: target.address, method: METHOD, amount: 1, nonce: S(BigInt(c.id) * 10n + BigInt(k)), params: PARAMS }, Array(c.D + 6).fill("1"),
    { noteRoot: S(notes.root), budgetNf: S(PL.poseidon3([TAG_BNF, BigInt(c.sks[c.D]), L8.noteCm(n)])), cmChange: S(L8.noteCm(change)), qSpent: "1" }]; };
const ERR = {}; for (const f of gate.interface.fragments.filter((f) => f.type === "error")) ERR[gate.interface.getSighash(f)] = f.name;
const rControl = rngOf(`ctl-${S_}-${R_}-${SEED}`); const nonTargets = creds.filter((c) => !targets.has(c.id));
const controls = shuffle(nonTargets.map((c) => c.id), rControl).slice(0, 64);

async function runMethod(name) {
  if (!(await provider.send("evm_revert", [snap0]))) throw new Error("revert failed"); snap0 = await provider.send("evm_snapshot", []); nonce = nonce0; clock = clock0 + 100;
  const imt = RV.cloneImt(imt0); const t0 = clock; let gas = 0, txs = 0, states = 0, revWitnessSat = 0, revProveMs = 0;
  // pre-revocation transactions (built now, submitted after the window)
  const pre = creds.map((c) => ({ c, args: execArgs(c, S(imt.root), t0, note0.get(c.id), 0) }));
  const entries = name === "K" ? revKeys.map((k) => ({ entry: BigInt(k), auth: (() => { const c = creds[holderOf.get(k)[0]]; return RV.keyAuthority({ input: c.input, meta: metaOf(c) }, c.D); })() }))
    : (name === "E-oracle" ? edgesOracle : edgesLocal).map((id) => { const c = creds[id]; const hop = c.D - 1; return { entry: BigInt(c.cert[hop]), auth: RV.certAuthority({ input: c.input, meta: metaOf(c) }, hop, 0) }; });
  for (const e of entries) {
    const tr = RV.transition(imt, e.entry, e.auth); if (await RV.satisfiable(tr.input)) revWitnessSat++;
    let t = performance.now(); const p = await snarkjs.groth16.fullProve(tr.input, RV.WASM, W + "t4_obligations/E7-obligations_20261009/revoke/build/zk/rt.zkey"); revProveMs += performance.now() - t;
    const cd = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(p.proof, p.publicSignals)) + "]");
    const [r1] = await block([[revs, "revoke", [{ a: cd[0], b: cd[1], c: cd[2] }, S(tr.newRoot), tr.input.entry]]]); if (r1.status !== 1) throw new Error("revoke reverted");
    gas += r1.gasUsed.toNumber(); txs++; imt.insert(e.entry);
    const [r2] = await block([[gate, "registerState", [ISS, S(imt.root), ROOT]]]); states++; if (S(await revs.root()) !== S(imt.root)) throw new Error("revocation root mismatch"); }
  clock += RWIN + 2; await mineAt(clock++);
  // gate level: pre-revocation txs of every agent, then a fresh tx by every agent that can construct a witness
  const nowTs = clock; const res = { pre: {}, fresh: { targets_accepted: 0, nontargets_rejected: 0, nontargets_no_witness: 0, targets_with_witness: 0 } };
  const send = async (rows) => { const hs = []; for (const r of rows) hs.push((await gate.execute(...r, { nonce: nonce++, gasLimit: 3_000_000 })).hash); await mineAt(clock++);
    const out = []; for (const h of hs) { const rc = await provider.getTransactionReceipt(h); if (!rc) throw new Error("not included");
      let reason = null; if (rc.status !== 1) { const tr = await provider.send("debug_traceTransaction", [h, { tracer: "callTracer" }]); reason = ERR[(tr.output ?? "").slice(0, 10)] ?? (tr.output ?? "").slice(0, 10); } out.push(reason); } return out; };
  for (let s = 0; s < pre.length; s += 300) for (const r of await send(pre.slice(s, s + 300).map((x) => x.args))) res.pre[r ?? "accepted"] = (res.pre[r ?? "accepted"] ?? 0) + 1;
  const fresh = creds.filter((c) => lineageOk(c, imt)); for (const c of creds) if (!lineageOk(c, imt)) { if (!targets.has(c.id)) res.fresh.nontargets_no_witness++; } else if (targets.has(c.id)) res.fresh.targets_with_witness++;
  for (let s = 0; s < fresh.length; s += 300) { const batch = fresh.slice(s, s + 300); const rs = await send(batch.map((c) => execArgs(c, S(imt.root), nowTs, note0.get(c.id), 1)));
    rs.forEach((r, i) => { const c = batch[i]; if (targets.has(c.id) && r === null) res.fresh.targets_accepted++; if (!targets.has(c.id) && r !== null) res.fresh.nontargets_rejected++; }); }
  // circuit level: substitute witnesses for every target (both variants), honest controls
  const circ = { targets: {}, controls: {} }; const tlist = [...targets].sort((a, b) => a - b); const check = SMOKE ? tlist.slice(0, SMOKE) : tlist;
  for (const id of check) { const c = creds[id]; for (const v of ["pred", "own"]) { const r = await sat(substitute(c, imt, notes, note0.get(id), v), c.D); circ.targets[`${v} ${r}`] = (circ.targets[`${v} ${r}`] ?? 0) + 1; } }
  for (const id of controls.slice(0, SMOKE || 64)) { const c = creds[id]; const r = await sat(honestInput(c, imt, notes, note0.get(id)), c.D); circ.controls[r] = (circ.controls[r] ?? 0) + 1; }
  const covered = tlist.filter((id) => !lineageOk(creds[id], imt)).length;
  const satTargets = Object.entries(circ.targets).filter(([k]) => k.endsWith(" accept")).reduce((s, [, v]) => s + v, 0);
  log(name, "txs", txs, "gas", gas, "covered", covered, "/", targets.size);
  return { method: name, revoke_txs: txs, revoke_gas_total: gas, revoke_gas_mean: txs ? gas / txs : null, register_state_txs: states, imt_entries_added: txs, revoke_witness_sat: revWitnessSat,
    revoke_prove_ms_mean: txs ? revProveMs / txs : null, coverage: { covered, targets: targets.size, uncovered: tlist.filter((id) => lineageOk(creds[id], imt)).map((id) => creds[id].name) },
    gate: res, circuit: { ...circ, checked_targets: check.length, substitute_accepts: satTargets },
    false_accept: name === "E-local" ? null : res.fresh.targets_accepted + satTargets + res.fresh.targets_with_witness,
    collateral_denial: res.fresh.nontargets_no_witness + res.fresh.nontargets_rejected + (circ.controls.accept === (SMOKE || 64) ? 0 : (SMOKE || 64) - (circ.controls.accept ?? 0)),
    reproving_nontargets: nonTargets.length };
}
const methods = []; for (const m of ["K", "E-oracle", "E-local"]) methods.push(await runMethod(m));
try { fs.unlinkSync(tmp); } catch {}
const multi = [...holderOf.values()].filter((v) => v.length > 1).length;
console.log(JSON.stringify({ world: TAG, share: S_, rate: R_, seed: SEED, reusers: nReuse, distinct_keys: distinct.length, shared_keys: multi, revoked_keys: revKeys.length,
  revoked_shared_keys: revKeys.filter((k) => holderOf.get(k).length > 1).length, targets: targets.size, edges_oracle: edgesOracle.length, edges_local: edgesLocal.length,
  methods, smoke: SMOKE || null, wall_s: Math.round((Date.now() - wall0) / 1000), host: os.hostname() }));
anvil.kill(); process.exit(0);

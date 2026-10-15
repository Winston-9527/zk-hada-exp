// T5 world (PREREGISTRATION.md "World"): 32 registered masters; M0, M1 fan out 8 x 8 x 8 to D = 4; M2..M31 have one child each -> 1,230 agents.
// Real txs on anvil (must already run on T5_PORT, see run_t5.sh): deployment, 32 registrations, updateIssuedRoot, registerState, 32 mints, 1,198 transfers.
// usage: node build_world.mjs > results/world_build.json   (writes state/creds.json, state/state.json)
import fs from "fs"; import crypto from "crypto";
import { ethers, L7, L8, BW, RG, snarkjs, P, DOMAIN, RWIN, NWIN, IWIN, SKEW, METHOD, STATE, log, connect, art, cd, saveState, Mirror, noteJson, agentObj } from "./common.mjs";
fs.mkdirSync(STATE, { recursive: true });
const ch = await connect(); const w = ch.wallets[0]; const tx = async (p) => { const t = await p; return t.wait(); };
const nx = () => ({ nonce: ch.nonces[0]++ });
const NOW = (await ch.provider.getBlock("latest")).timestamp; const EXP = [4e7, 3e7, 2e7, 1e7].map((e) => NOW + e);
// ---------- agents ----------
const key = (n) => (n.startsWith("H") ? RG.humanPrv(Number(n.slice(1))) : crypto.createHash("sha256").update("t5-node-" + n).digest());
const NM = Number(process.env.T5_NM ?? 8), FAN = Number(process.env.T5_FAN ?? 4);   // T8d: scaled-down T5 (8 masters, fan-out 4: 182 agents, 128 at D = 4)
const list = [];
for (let k = 0; k < NM; k++) list.push({ name: `M${k}`, chain: [`H${k}`, `M${k}`], parent: null });
const kids = (p, n) => { for (let a = 0; a < n; a++) list.push({ name: `${p.name}.${a}`, chain: [...p.chain, `${p.name}.${a}`], parent: p.name }); };
for (let k = 0; k < NM; k++) kids(list[k], k < 2 ? FAN : 1);
for (const D of [2, 3]) for (const p of list.filter((x) => x.chain.length - 1 === D && /^M[01]\./.test(x.name))) kids(p, FAN);
const t0 = performance.now(); const creds = []; const byName = {};
for (const a of list) { const D = a.chain.length - 1;
  const { input, meta } = await L7.buildInstanceV7({ D, seed: 11, mode: "C", now: NOW, entPrv: a.chain.map(key), rootOthers: 0, expiries: EXP.slice(0, D), accSeed: `t5-cred-${a.name}` });
  const c = { id: creds.length, name: a.name, chain: a.chain, D, parent: a.parent, cert: meta.cert.map(String), sks: meta.ents.map((e) => String(e.sk)), input };
  if (a.parent) { const p = byName[a.parent]; for (let i = 0; i < p.D; i++) if (p.cert[i] !== c.cert[i]) throw new Error(`prefix cert mismatch ${a.name} hop ${i}`); }
  creds.push(c); byName[a.name] = c; if (creds.length % 100 === 0) log("creds", creds.length); }
const credMs = performance.now() - t0; const byD = [1, 2, 3, 4].map((D) => creds.filter((c) => c.D === D).length);
log("agents", creds.length, "by D", byD.join("/"));
fs.writeFileSync(STATE + "creds.json", JSON.stringify(creds));
// ---------- mirror ----------
const st = { NOW, EXP, issuedLeaves: [], imtEntries: [], rootLeaves: [], noteLeaves: [], agents: {} };
for (let k = 0; k < 20; k++) st.imtEntries.push(String(L8.rnd250("t5-decoy-" + k)));
for (const c of creds) for (let i = 1; i < c.D; i++) if (!st.issuedLeaves.includes(c.cert[i])) st.issuedLeaves.push(c.cert[i]);
const m = await Mirror.from({ ...st, issuedLeaves: [] });          // issued tree empty at deployment
const issuedGenesis = String(m.issued.root);
// ---------- deployment ----------
const LIBS = {};
async function deploy(file, name, args = []) { const a = art(file, name); let code = a.bytecode.object.slice(2);
  for (const refs of Object.values(a.bytecode.linkReferences ?? {})) for (const [lib, locs] of Object.entries(refs)) for (const { start, length } of locs) code = code.slice(0, 2 * start) + LIBS[lib].slice(2).toLowerCase() + code.slice(2 * (start + length));
  const c = await new ethers.ContractFactory(a.abi, "0x" + code, w).deploy(...args, nx()); await c.deployed(); return c; }
LIBS.PoseidonT3 = (await deploy("PoseidonT3.sol", "PoseidonT3")).address; LIBS.PoseidonT4 = (await deploy("PoseidonT4.sol", "PoseidonT4")).address;
const reg = await deploy("ZkDacRegistry.sol", "ZkDacRegistry", [(await deploy("Groth16VerifierRegister.sol", "Groth16VerifierRegister")).address, w.address, DOMAIN.toString(), 300]);
const revs = await deploy("ZkDacRevocations.sol", "ZkDacRevocations", [(await deploy("Groth16VerifierRevoke.sol", "Groth16VerifierRevoke")).address, String(m.imt.root), m.imt.leaves.length, RWIN]);
const target = await deploy("Targets.sol", "MockTarget");
const vs = []; for (const D of [1, 2, 3, 4]) vs.push((await deploy(`Groth16VerifierV92CD${D}.sol`, `Groth16VerifierV92CD${D}`)).address);
const btv = (await deploy("Groth16VerifierBudgetTransfer.sol", "Groth16VerifierBudgetTransfer")).address, bmv = (await deploy("Groth16VerifierBudgetMint.sol", "Groth16VerifierBudgetMint")).address;
const tpk = creds[0].input.tpk.map(String);
const gate = await deploy("ZkDacGateV9.sol", "ZkDacGateV9", [vs, [7, 8, 9, 10], reg.address, revs.address, w.address, issuedGenesis, IWIN, SKEW, tpk, [btv, bmv, NWIN]]);
await tx(gate.setMethod(METHOD, 1, true, nx()));
st.addrs = { gate: gate.address, reg: reg.address, revs: revs.address, target: target.address, verifiers: vs, btv, bmv };
log("deployed gate", gate.address);
const out = { date: new Date().toISOString(), client: await ch.provider.send("web3_clientVersion", []), agents_by_D: byD, agents: creds.length, cred_build_ms_total: Math.round(credMs), gas: {}, ms: {} };
const push = (k, v) => ((out.gas[k] ??= []).push(v));
const pushMs = (k, v) => ((out.ms[k] ??= []).push(+v.toFixed(1)));
// ---------- issuance on chain ----------
for (const l of st.issuedLeaves) m.issued.append(l);
{ const r = await tx(gate.updateIssuedRoot(String(m.issued.root), nx())); push("updateIssuedRoot", r.gasUsed.toNumber()); }
// ---------- registration of the 32 masters ----------
const humans = Array.from({ length: NM }, (_, k) => RG.makeHuman(k)); const group = new RG.Group(humans.map((h) => h.id.commitment));
await tx(reg.setGroupRoot(group.root.toString(), true, nx()));
for (let k = 0; k < NM; k++) { const M = creds[k];
  const rw = RG.registerWitness({ human: humans[k], group, domain: DOMAIN, master: [M.input.ent_Ax[1], M.input.ent_Ay[1]], cap0: M.input.cap[0], expiry0: M.input.expiry[0] });
  if (rw.leaf0 !== M.cert[0]) throw new Error("leaf0 != cert0 for " + M.name);
  let t = performance.now(); const rp = await snarkjs.groth16.fullProve(rw, `${P.REG}/build/r20/main_reg_20_js/main_reg_20.wasm`, `${P.REG}/build/zk/reg20.zkey`); pushMs("register_prove", performance.now() - t);
  const c = await cd(rp.proof, rp.publicSignals); const r = await tx(reg.register({ a: c[0], b: c[1], c: c[2] }, c[3][0], c[3][2], c[3][3], [], nx())); push("register", r.gasUsed.toNumber());
  st.rootLeaves.push(M.cert[0]); m.roots.insert(BigInt(M.cert[0])); }
if (String(await reg.currentRoot()) !== String(m.roots.root)) throw new Error("registry root mismatch");
{ const r = await tx(gate.registerState(String(m.issued.root), String(m.imt.root), String(m.roots.root), nx())); push("registerState_new", r.gasUsed.toNumber()); }
log("registered masters", NM);
// ---------- budget: mint + transfers down the tree ----------
const bw = Object.assign(Object.create(BW.BudgetWorld.prototype), { w: { imt: m.imt }, notes: m.notes });
const A = creds.map(agentObj); const P3 = (c) => ({ a: c[0], b: c[1], c: c[2] });
async function syncCheck() { if (String(await gate.noteRoot()) !== String(m.notes.root)) throw new Error("note root mismatch"); }
const insertNote = (n) => { const cm = L8.noteCm(n); m.notes.insert(cm); st.noteLeaves.push(String(cm)); };
for (let k = 0; k < NM; k++) { const a = A[k]; const n = { own: [BigInt(a.input.ent_Ax[1]), BigInt(a.input.ent_Ay[1])], q: k < 2 ? 1000000n : 1000n, lin: L8.linOf(a.meta), rho: L8.rnd250("t5-mint-" + a.name) };
  const x = bw.mintWitness(n); let t = performance.now(); const p = await snarkjs.groth16.fullProve(x, `${P.V8}/build/budget_mint/budget_mint_js/budget_mint.wasm`, `${P.V8}/build/zk/budget_mint.zkey`); pushMs("mint_prove", performance.now() - t);
  const r = await tx(gate.mint(P3(await cd(p.proof, p.publicSignals)), x.cm, x.q, nx())); push("mint", r.gasUsed.toNumber()); insertNote(n); st.agents[a.id] = { note: noteJson(n) }; }
await syncCheck(); log("minted");
const childrenOf = (name) => A.filter((x) => creds[x.id].parent === name);
let nT = 0;
for (const D of [1, 2, 3]) for (const p of A.filter((x) => x.D === D)) { const kids = childrenOf(p.name); if (!kids.length) continue;
  const share = BigInt(st.agents[p.id].note.q) / BigInt(kids.length + 1);
  for (const c of kids) { const n = { ...st.agents[p.id].note }; const nIn = { own: n.own.map(BigInt), q: BigInt(n.q), lin: n.lin.map(BigInt), rho: BigInt(n.rho) };
    let t = performance.now(); const tw = bw.transferWitness(p, nIn, { to: c, q1: share, q2: nIn.q - share, label: "t5-" + c.name }); pushMs("transfer_witness_build", performance.now() - t);
    t = performance.now(); const pf = await snarkjs.groth16.fullProve(tw.input, `${P.V8}/build/budget_transfer/budget_transfer_js/budget_transfer.wasm`, `${P.V8}/build/zk/budget_transfer.zkey`); pushMs("transfer_prove", performance.now() - t);
    const s = pf.publicSignals; const r = await tx(gate.transferBudget(P3(await cd(pf.proof, s)), s[0], s[1], s[2], s[3], s[4], nx())); push("transferBudget", r.gasUsed.toNumber());
    insertNote(tw.out1); insertNote(tw.out2); st.agents[c.id] = { note: noteJson(tw.out1) }; st.agents[p.id].note = noteJson(tw.out2);
    if (++nT % 50 === 0) { await syncCheck(); log("transfers", nT); saveState(st); } } }
await syncCheck(); log("transfers done", nT);
if (Object.keys(st.agents).length !== creds.length) throw new Error("not every agent has a note");
saveState(st);
out.transfers = nT; out.note_leaves = st.noteLeaves.length; out.issued_leaves = st.issuedLeaves.length; out.final_block = await ch.provider.getBlockNumber();
out.state_sha256 = crypto.createHash("sha256").update(fs.readFileSync(STATE + "state.json")).digest("hex"); out.creds_sha256 = crypto.createHash("sha256").update(fs.readFileSync(STATE + "creds.json")).digest("hex");
console.log(JSON.stringify(out)); process.exit(0);

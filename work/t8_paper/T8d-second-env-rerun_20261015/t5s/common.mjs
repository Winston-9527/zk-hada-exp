// T8d (WP13): scaled-down copy of ../../../t5_e2e/T5-e2e-scale_20261010 on v9.2 (paths and verifier names -> v9.2; world size from T5_NM / T5_FAN). Original header follows.
// T5 (PREREGISTRATION.md): shared code. Credentials (state/creds.json, written once by build_world.mjs) + dynamic mirror of the on-chain state
// (state/state.json: tree leaves in insertion order, each agent's current note, contract addresses). One action = prepare (S1..S5) + submit (S6..S8).
import { createRequire } from "module"; import fs from "fs"; import os from "os"; import path from "path"; import crypto from "crypto";
export const HERE = new URL(".", import.meta.url).pathname; const WORK = path.resolve(HERE, "../..") + "/";
const reqTC = createRequire(WORK + "t4_contracts/package.json"); export const { ethers } = reqTC("ethers");
export const L7 = await import(WORK + "t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs");
export const L8 = await import(WORK + "t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs");
export const L9 = await import(WORK + "t2_circuit_fix/zkdac_v9_2/scripts/lib_v9.mjs");
export const BW = await import(WORK + "t2_circuit_fix/zkdac_v8/scripts/budget_world.mjs");
export const RG = await import(WORK + "t4_registration/scripts/lib_register.mjs");
export const RV = await import(WORK + "t4_obligations/E7-obligations_20261009/revoke/revoke_lib.mjs");
export const snarkjs = createRequire(WORK + "t2_circuit_fix/zkdac_v7/package.json")("snarkjs");
const { poseidon3 } = createRequire(WORK + "t2_circuit_fix/zkdac_v8/package.json")("poseidon-lite");
export const P = { V8: WORK + "t2_circuit_fix/zkdac_v8", V9: WORK + "t2_circuit_fix/zkdac_v9_2", REG: WORK + "t4_registration", RVK: WORK + "t4_obligations/E7-obligations_20261009/revoke/build/zk/rt.zkey", OUT: WORK + "t4_contracts/foundry/out" };
export const PORT = Number(process.env.T5_PORT ?? 8560), METHOD = "0xa9059cbb", PARAMS = "0x1234abcd", DOMAIN = 0xd0a1n, RWIN = 30, NWIN = 600, IWIN = 300, SKEW = 3600, CHAIN = 31337n;
export const STATE = process.env.T5_STATE ?? HERE + "state/"; export const RES = process.env.T5_RES ?? HERE + "results/";   // smoke tests use a scratch dir
export const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);
export const MNEMONIC = "test test test test test test test test test test test junk";   // anvil's public default accounts (local only)
const { eddsa, poseidon: POS } = await L7.init(); export const PH = (xs) => eddsa.F.toObject(POS(xs.map(BigInt)));
// ---------- deterministic randomness ----------
export function rng(seed) { let ctr = 0; return () => { const h = crypto.createHash("sha256").update(`${seed}-${ctr++}`).digest(); return h.readUInt32BE(0) / 2 ** 32; }; }
export function shuffle(xs, seed) { const r = rng(seed), a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// ---------- chain ----------
export async function connect() {
  const provider = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:${PORT}`); provider.pollingInterval = 20;
  const wallets = Array.from({ length: 10 }, (_, i) => ethers.Wallet.fromMnemonic(MNEMONIC, `m/44'/60'/0'/0/${i}`).connect(provider));
  const nonces = await Promise.all(wallets.map((w) => w.getTransactionCount("pending")));
  return { provider, wallets, nonces, wallet: wallets[0] };
}
export const art = (file, name) => JSON.parse(fs.readFileSync(`${P.OUT}/${file}/${name}.json`));
export function at(ch, file, name, addr, w = 0) { return new ethers.Contract(addr, art(file, name).abi, ch.wallets[w]); }
export async function contracts(ch, A) {
  return { gate: at(ch, "ZkDacGateV9.sol", "ZkDacGateV9", A.gate), reg: at(ch, "ZkDacRegistry.sol", "ZkDacRegistry", A.reg), revs: at(ch, "ZkDacRevocations.sol", "ZkDacRevocations", A.revs),
    target: A.target, verifiers: A.verifiers };
}
export const errMap = () => { const m = {}; for (const [f, n] of [["ZkDacGateV9.sol", "ZkDacGateV9"], ["ZkDacRevocations.sol", "ZkDacRevocations"], ["ZkDacRegistry.sol", "ZkDacRegistry"]]) { const i = new ethers.utils.Interface(art(f, n).abi); for (const e of Object.values(i.errors)) m[i.getSighash(e)] = e.name; } return m; };
export async function revertReason(ch, hash, ERR) { const tr = await ch.provider.send("debug_traceTransaction", [hash, { tracer: "callTracer" }]); const sel = (tr.output ?? "").slice(0, 10); return ERR[sel] ?? (sel || tr.error || "unknown"); }
// ---------- credentials + mirror ----------
export function loadCreds() { return JSON.parse(fs.readFileSync(STATE + "creds.json")); }
export function saveState(st) { const tmp = STATE + "state.json.tmp"; fs.writeFileSync(tmp, JSON.stringify(st)); fs.renameSync(tmp, STATE + "state.json"); }
export function loadState() { return JSON.parse(fs.readFileSync(STATE + "state.json")); }
export class Mirror {
  static async from(st) { const m = new Mirror(); m.issued = new BW.W.SparseTree(16); for (const l of st.issuedLeaves) m.issued.append(l);
    m.imt = await L7.IMT.create(20); for (const e of st.imtEntries) m.imt.insert(BigInt(e));
    m.roots = L7.newRootTree(); for (const l of st.rootLeaves) m.roots.insert(BigInt(l));
    m.notes = L8.newNoteTree(); if (st.noteLeaves.length) m.notes.insertMany(st.noteLeaves.map(BigInt)); return m; }
}
export const noteOf = (o) => ({ own: o.own.map(BigInt), q: BigInt(o.q), lin: o.lin.map(BigInt), rho: BigInt(o.rho) });
export const noteJson = (n) => ({ own: n.own.map(String), q: String(n.q), lin: n.lin.map(String), rho: String(n.rho) });
// an agent object usable by lib_v7 / budget_world helpers
export function agentObj(c) { const meta = { D: c.D, cert: c.cert.map(BigInt), P: (xs) => PH(xs), ents: c.sks.map((sk) => ({ sk: BigInt(sk) })) }; return { id: c.id, name: c.name, chain: c.chain, D: c.D, input: c.input, meta }; }
// ---------- timing helpers ----------
const now = () => performance.now();
export const rss = () => process.memoryUsage().rss;
const tmpW = path.join(os.tmpdir(), `t5-${process.pid}.wtns`);
const vkCache = {}; const vk = (D) => (vkCache[D] ??= JSON.parse(fs.readFileSync(`${P.V9}/zk/vk_c${D}.json`)));
export async function cd(proof, ps) { return JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, ps)) + "]"); }
// S1..S5. ag = agentObj, st = state (agent notes), m = Mirror, K = contracts. opts.amount (default 1)
export async function prepare(ch, K, m, st, ag, opts = {}) {
  const T = {}, R = {}; const amount = BigInt(opts.amount ?? 1); let t = now();
  // S1 fetch: current roots + block time over RPC, then every path from the mirror
  const [iR, rR, gR, nR, blk] = await Promise.all([K.gate.issuedRoot(), K.revs.root(), K.reg.currentRoot(), K.gate.noteRoot(), ch.provider.getBlock("latest")]);
  if (String(iR) !== String(m.issued.root) || String(rR) !== String(m.imt.root) || String(gR) !== String(m.roots.root) || String(nR) !== String(m.notes.root)) throw new Error("mirror out of sync with chain");
  const input = structuredClone(ag.input); input.issued_root = String(m.issued.root);
  for (let i = 1; i < ag.D; i++) { const p = m.issued.path(m.issued.index.get(String(ag.meta.cert[i]))); input.m_sib[i] = p.sib; input.m_bit[i] = p.bit; }
  Object.assign(input, L7.rootProof(m.roots, ag.meta.cert[0]));
  try { L7.refreshAll(input, { ...ag.meta, imt: m.imt }); } catch (e) { if (/is a member/.test(String(e))) { const err = new Error("NO_WITNESS: revoked entry on the chain"); err.code = "NO_WITNESS"; throw err; } throw e; }
  const note = noteOf(st.agents[ag.id].note); const cmIn = L8.noteCm(note); const np = L8.notePath(m.notes, cmIn);
  T.S1_fetch = now() - t; R.S1 = rss(); t = now();
  // S2 assembly
  const ctxNonce = BigInt("0x" + crypto.randomBytes(8).toString("hex"));
  input.now = String(blk.timestamp); input.ctx_hash = String(L7.ctxHash({ chainId: CHAIN, verifier: K.gate.address, method: METHOD, target: K.target, params: PARAMS, amount, nonce: ctxNonce }));
  input.act_req_cap = "1";
  const change = { own: note.own, q: note.q - amount, lin: note.lin, rho: L8.rnd250("t5-chg-" + crypto.randomBytes(16).toString("hex")) };
  Object.assign(input, { note_root: String(m.notes.root), budget_nf: String(poseidon3([L8.TAG_BNF, BigInt(input.holder_sk), cmIn])), cm_change: String(L8.noteCm(change)), q_spent: String(amount),
    q_in: String(note.q), rho_in: String(note.rho), q_change: String(change.q), rho_change: String(change.rho), ...np });
  L9.toV9(input, crypto.randomBytes(32).toString("hex"));                  // fresh accountability randomness
  const roots = [input.issued_root, input.revoked_root, input.root_root];
  const key = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["uint256", "uint256", "uint256"], roots));
  const known = (await K.gate.stateOf(key)).toString(); T.S2_assembly = now() - t; R.S2 = rss();
  let registerState = null;
  if (known === "0") { t = now(); const tx = await K.gate.connect(ch.wallets[0]).registerState(...roots, { nonce: ch.nonces[0]++ }); const rc = await tx.wait(); registerState = { ms: now() - t, gas: rc.gasUsed.toNumber() }; }
  else if (known !== input.state_root) throw new Error("stateOf != local state_root");
  // S3 witness, S4 prove, S5 verify
  const D = ag.D; const wasm = `${P.V9}/build/c${D}/main_c_d${D}_js/main_c_d${D}.wasm`, zkey = `${P.V9}/build/zk/c${D}.zkey`;
  t = now();
  if (opts.witnessOnly) { let sat = true; try { await snarkjs.wtns.calculate(input, wasm, tmpW); } catch { sat = false; } return { ag, D, sat, registerState, ms: now() - t }; }
  await snarkjs.wtns.calculate(input, wasm, tmpW); T.S3_witness = now() - t; R.S3 = rss();
  t = now(); const { proof, publicSignals: s } = await snarkjs.groth16.prove(zkey, tmpW); T.S4_prove = now() - t; R.S4 = rss();
  t = now(); const ok = await snarkjs.groth16.verify(vk(D), s, proof); T.S5_verify = now() - t; R.S5 = rss();
  if (!ok) throw new Error("off-chain verify failed");
  const actT = [K.target, METHOD, amount.toString(), ctxNonce.toString(), PARAMS]; const nCt = D + 6;
  return { ag, D, T, R, registerState, proof, s, input, roots, actT, nCt, change, cmIn: String(cmIn), noteRoot: input.note_root, revokedRoot: input.revoked_root, ts: blk.timestamp };
}
export async function execArgs(pr) { const c = await cd(pr.proof, pr.s); return [{ a: c[0], b: c[1], c: c[2] }, pr.roots, pr.s[1], pr.actT, pr.s.slice(6, 6 + pr.nCt), pr.s.slice(6 + pr.nCt)]; }
// S6 submit (calldata export + estimateGas + sign + eth_sendRawTransaction) ; S7 inclusion (receipt) ; S8 execute (gas)
export async function submit(ch, K, pr, { w = 0, wait = true, gasLimit } = {}) {
  let t = now(); const args = await execArgs(pr); const g = K.gate.connect(ch.wallets[w]);
  let gl = gasLimit; if (!gl) { try { gl = (await g.estimateGas.execute(...args)).mul(110).div(100); } catch { gl = ethers.BigNumber.from(3000000); } }
  const tx = await g.execute(...args, { nonce: ch.nonces[w]++, gasLimit: gl }); pr.T.S6_submit = now() - t; pr.tx = tx;
  if (!wait) return pr;
  t = now(); const rc = await ch.provider.waitForTransaction(tx.hash); pr.T.S7_inclusion = now() - t; pr.rc = rc; pr.gasUsed = rc.gasUsed.toNumber(); pr.status = rc.status; pr.calldataBytes = (tx.data.length - 2) / 2;
  return pr;
}
export function afterSuccess(m, st, pr) { m.notes.insert(BigInt(pr.input.cm_change)); st.noteLeaves.push(pr.input.cm_change); st.agents[pr.ag.id].note = noteJson(pr.change); st.agents[pr.ag.id].actions = (st.agents[pr.ag.id].actions ?? 0) + 1; }
export const row = (pr) => ({ agent: pr.ag.id, name: pr.ag.name, D: pr.D, T: Object.fromEntries(Object.entries(pr.T).map(([k, v]) => [k, +v.toFixed(2)])), rss: pr.R, registerState: pr.registerState, status: pr.status, gasUsed: pr.gasUsed, calldataBytes: pr.calldataBytes,
  local_ms: +(pr.T.S1_fetch + pr.T.S2_assembly + pr.T.S3_witness + pr.T.S4_prove).toFixed(2) });

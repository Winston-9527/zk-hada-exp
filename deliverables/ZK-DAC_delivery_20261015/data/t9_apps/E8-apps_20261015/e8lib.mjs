// E8 shared harness: one anvil world with the REAL authorization layer (v9.2 action verifiers, budget transfer / mint, revoke, registration).
// Logical clock (2 s blocks, timestamps set explicitly). act() runs the nine E4 stages and returns the blocking layer for refused attempts:
//   'construction' (no witness can be built, e.g. no non-membership witness), 'circuit' (witness unsatisfiable), 'gate' (revert in ZkDacGateV9, with reason),
//   'target' (revert in the application contract), or null (accepted).
import fs from "fs"; import path from "path"; import os from "os"; import crypto from "crypto"; import { spawn } from "child_process"; import { createRequire } from "module";
const HERE = new URL(".", import.meta.url).pathname; export const W = path.resolve(HERE, "../..") + "/";
export const { ethers } = createRequire(W + "t4_contracts/package.json")("ethers");
const req7 = createRequire(W + "t2_circuit_fix/zkdac_v7/package.json"); export const snarkjs = req7("snarkjs"); const { poseidon3 } = req7("poseidon-lite");
export const L7 = await import(W + "t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs"); export const L8 = await import(W + "t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs");
export const L9 = await import(W + "t2_circuit_fix/zkdac_v9_2/scripts/lib_v9.mjs"); const BW = await import(W + "t2_circuit_fix/zkdac_v8/scripts/budget_world.mjs");
const RG = await import(W + "t4_registration/scripts/lib_register.mjs"); const RV = await import(W + "t4_obligations/E7-obligations_20261009/revoke/revoke_lib.mjs");
const OUT = W + "t4_contracts/foundry/out", V92 = W + "t2_circuit_fix/zkdac_v9_2", V8 = W + "t2_circuit_fix/zkdac_v8";
const DOMAIN = 0xd0a1n, CHAIN = 31337n, TAG_BNF = 2053857902n, S = String; const now_ = () => performance.now();
export const art = (f, n) => JSON.parse(fs.readFileSync(`${OUT}/${f}/${n}.json`));
export const sel = (name) => ethers.utils.id(name).slice(0, 10);                       // method selector of a tool / category
export const rngOf = (tag) => { let c = 0; return () => crypto.createHash("sha256").update(`${tag}-${c++}`).digest().readUInt32BE(0) / 2 ** 32; };
const vkCache = {}; const vk = (D) => (vkCache[D] ??= JSON.parse(fs.readFileSync(`${V92}/zk/vk_c${D}.json`)));
const cdP = async (proof, ps) => { const c = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, ps)) + "]"); return { pr: { a: c[0], b: c[1], c: c[2] }, pub: c[3] }; };

export class World {
  static async create({ port, tag, revWindow = 30, blockTime = 2, log = () => {} }) {
    const w = new World(); Object.assign(w, { port, tag, revWindow, blockTime, log, nonces: new Map(), creds: [], LIBS: {} });
    w.anvil = spawn("anvil", ["--port", String(port), "--silent", "--accounts", "10", "--gas-limit", "30000000", "--code-size-limit", "100000", "--no-mining"], { stdio: "ignore" });
    process.on("exit", () => w.anvil.kill());
    w.provider = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:${port}`); w.provider.pollingInterval = 5;
    for (let i = 0; i < 300; i++) { try { await w.provider.getBlockNumber(); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
    const MN = "test test test test test test test test test test test junk";            // anvil's public default mnemonic (local only)
    w.op = ethers.Wallet.fromMnemonic(MN, "m/44'/60'/0'/0/0").connect(w.provider); w.relayer = ethers.Wallet.fromMnemonic(MN, "m/44'/60'/0'/0/1").connect(w.provider);
    w.gatewayWallet = ethers.Wallet.fromMnemonic(MN, "m/44'/60'/0'/0/2").connect(w.provider);
    w.clock = (await w.provider.getBlock("latest")).timestamp + 5;
    w.imt = await L7.IMT.create(20); for (let k = 0; k < 20; k++) w.imt.insert(L8.rnd250(`e8-${tag}-decoy-${k}`));
    w.issued = new BW.W.SparseTree(16); w.issued0 = S(w.issued.root); w.roots = L7.newRootTree(); w.notes = L8.newNoteTree();
    w.humans = Array.from({ length: 4 }, (_, i) => RG.makeHuman(i)); w.group = new RG.Group(w.humans.map((h) => h.id.commitment)); w.nextHuman = 0;
    const d = (f, n, a) => w.deploy(f, n, a);
    w.LIBS.PoseidonT3 = (await d("PoseidonT3.sol", "PoseidonT3")).address; w.LIBS.PoseidonT4 = (await d("PoseidonT4.sol", "PoseidonT4")).address;
    w.reg = await d("ZkDacRegistry.sol", "ZkDacRegistry", [(await d("Groth16VerifierRegister.sol", "Groth16VerifierRegister")).address, w.op.address, DOMAIN.toString(), 1_000_000_000]);
    w.revs = await d("ZkDacRevocations.sol", "ZkDacRevocations", [(await d("Groth16VerifierRevoke.sol", "Groth16VerifierRevoke")).address, S(w.imt.root), w.imt.leaves.length, revWindow]);
    const vs = []; for (const D of [1, 2, 3, 4]) vs.push((await d(`Groth16VerifierV92CD${D}.sol`, `Groth16VerifierV92CD${D}`)).address);
    w.tpk = null; w.gateArgs = { vs };
    await w.opTx(w.reg, "setGroupRoot", [S(w.group.root), true]);
    w.ERR = {}; return w;
  }
  key(name) { return name.startsWith("H") ? RG.humanPrv(Number(name.slice(1))) : crypto.createHash("sha256").update(`e8-${this.tag}-node-${name}`).digest(); }
  async nextNonce(wl) { if (!this.nonces.has(wl.address)) this.nonces.set(wl.address, await wl.getTransactionCount()); const n = this.nonces.get(wl.address); this.nonces.set(wl.address, n + 1); return n; }
  async mine() { this.clock += this.blockTime; await this.provider.send("evm_setNextBlockTimestamp", [this.clock]); await this.provider.send("evm_mine", []); return this.clock; }
  async advanceTo(t) { while (this.clock + this.blockTime <= t) await this.mine(); }
  async waitFor(hashes) { let n = 0; while ((await Promise.all(hashes.map((h) => this.provider.getTransactionReceipt(h)))).some((r) => !r)) { await this.mine(); if (++n > 200) throw new Error("not included"); } return Promise.all(hashes.map((h) => this.provider.getTransactionReceipt(h))); }
  async deploy(f, n, args = []) { const a = art(f, n); let code = a.bytecode.object.slice(2);
    for (const refs of Object.values(a.bytecode.linkReferences ?? {})) for (const [lib, locs] of Object.entries(refs)) for (const { start, length } of locs) code = code.slice(0, 2 * start) + this.LIBS[lib].slice(2).toLowerCase() + code.slice(2 * (start + length));
    const tx = await new ethers.ContractFactory(a.abi, "0x" + code, this.op).getDeployTransaction(...args); tx.nonce = await this.nextNonce(this.op); tx.gasLimit = 29_000_000;
    const [r] = await this.waitFor([(await this.op.sendTransaction(tx)).hash]); if (r.status !== 1) throw new Error(`deploy ${n} failed`); const c = new ethers.Contract(r.contractAddress, a.abi, this.op);
    for (const fr of c.interface.fragments.filter((x) => x.type === "error")) (this.ERR ??= {})[c.interface.getSighash(fr)] = `${n}.${fr.name}`; return c; }
  async opTx(c, fn, args, wl = this.op) { const [r] = await this.waitFor([(await c.connect(wl)[fn](...args, { nonce: await this.nextNonce(wl), gasLimit: 29_000_000 })).hash]); if (r.status !== 1) throw new Error(`${fn} reverted`); return r; }
  async reason(hash) {                        // deepest erroring call in the call tree: its contract decides the layer (gate vs application target)
    const tr = await this.provider.send("debug_traceTransaction", [hash, { tracer: "callTracer" }]);
    const deepest = (c) => { const ch = (c.calls ?? []).find((x) => x.error); return ch ? deepest(ch) : c; }; const d = deepest(tr); const out = d.output ?? "";
    let r = this.ERR[out.slice(0, 10)];
    if (!r && out.startsWith("0x08c379a0")) { try { r = "Error(" + ethers.utils.defaultAbiCoder.decode(["string"], "0x" + out.slice(10))[0] + ")"; } catch {} }
    const layer = (d.to ?? "").toLowerCase() === this.gate.address.toLowerCase() ? "gate" : "target";
    return { reason: r ?? (d.error ?? out.slice(0, 10)), layer, contract: d.to }; }
  // ---------- gate (deployed after the operator's root key is known, for TPK) ----------
  async deployGate(tpk) { this.gate = await this.deploy("ZkDacGateV9.sol", "ZkDacGateV9", [this.gateArgs.vs, [7, 8, 9, 10], this.reg.address, this.revs.address, this.op.address, this.issued0, 300, 3600, tpk,
      [(await this.deploy("Groth16VerifierBudgetTransfer.sol", "Groth16VerifierBudgetTransfer")).address, (await this.deploy("Groth16VerifierBudgetMint.sol", "Groth16VerifierBudgetMint")).address, 600]]); }
  // ---------- credentials ----------
  async issue(chain, caps, expiries) {
    const t0 = now_(); const D = chain.length - 1;
    const { input, meta } = await L7.buildInstanceV7({ D, seed: 11, mode: "C", now: 1000, entPrv: chain.map((n) => this.key(n)), rootOthers: 0, caps, expiries, accSeed: `e8-${this.tag}-${chain.join(">")}-${caps.join(".")}` });
    const issuanceMs = now_() - t0; for (let i = 1; i < D; i++) if (this.issued.index.get(S(meta.cert[i])) === undefined) this.issued.append(meta.cert[i]);
    const c = { name: chain.at(-1), chain, D, caps, expiries, input, meta, issuanceMs, revoked: false }; this.creds.push(c); return c; }
  async registerRoot(c) {                     // hop 0 of a fresh root chain: real registration proof
    const h = this.humans[this.nextHuman++]; const rw = RG.registerWitness({ human: h, group: this.group, domain: DOMAIN, master: [c.input.ent_Ax[1], c.input.ent_Ay[1]], cap0: c.input.cap[0], expiry0: c.input.expiry[0] });
    const p = await snarkjs.groth16.fullProve(rw, `${W}t4_registration/build/r20/main_reg_20_js/main_reg_20.wasm`, `${W}t4_registration/build/zk/reg20.zkey`); const cd = await cdP(p.proof, p.publicSignals);
    await this.opTx(this.reg, "register", [cd.pr, cd.pub[0], cd.pub[2], cd.pub[3], []]); this.roots.insert(BigInt(c.meta.cert[0])); if (S(await this.reg.currentRoot()) !== S(this.roots.root)) throw new Error("registry root"); }
  async publish() { await this.opTx(this.gate, "updateIssuedRoot", [S(this.issued.root)]); await this.registerCurrentState(); }
  async registerCurrentState() { await this.opTx(this.gate, "registerState", [S(this.issued.root), S(this.imt.root), S(this.roots.root)]); }
  async setMethod(m, cap) { await this.opTx(this.gate, "setMethod", [m, cap, true]); }
  // ---------- budget ----------
  syncNotes(receipts) { for (const r of [...receipts].sort((a, b) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex)) for (const lg of r.logs) {
    if (lg.address.toLowerCase() !== this.gate.address.toLowerCase()) continue; try { const e = this.gate.interface.parseLog(lg); if (e.name === "NoteInserted") this.notes.insert(BigInt(S(e.args.cm))); } catch {} } }
  bw(imt = this.imt) { return Object.assign(Object.create(BW.BudgetWorld.prototype), { w: { imt }, notes: this.notes }); }
  own(c) { return [BigInt(c.input.ent_Ax[c.D]), BigInt(c.input.ent_Ay[c.D])]; }
  async mint(c, q) { const n = { own: this.own(c), q: BigInt(q), lin: L8.linOf(c.meta), rho: L8.rnd250(`e8-${this.tag}-mint-${crypto.randomBytes(6).toString("hex")}`) };
    const p = await snarkjs.groth16.fullProve(this.bw().mintWitness(n), `${V8}/build/budget_mint/budget_mint_js/budget_mint.wasm`, `${V8}/build/zk/budget_mint.zkey`);
    const r = await this.opTx(this.gate, "mint", [(await cdP(p.proof, p.publicSignals)).pr, S(L8.noteCm(n)), S(n.q)]); this.syncNotes([r]); return n; }
  async transfer(from, n, { to, q1, q2 }) {
    const t = this.bw().transferWitness(from, n, { to, q1: BigInt(q1), q2: BigInt(q2), label: `e8-${this.tag}-t-${crypto.randomBytes(6).toString("hex")}` });
    const p = await snarkjs.groth16.fullProve(t.input, `${V8}/build/budget_transfer/budget_transfer_js/budget_transfer.wasm`, `${V8}/build/zk/budget_transfer.zkey`); const s = p.publicSignals;
    const r = await this.opTx(this.gate, "transferBudget", [(await cdP(p.proof, s)).pr, s[0], s[1], s[2], s[3], s[4]], this.relayer); this.syncNotes([r]); return { out1: t.out1, out2: t.out2 }; }
  nf(c, n) { return S(poseidon3([TAG_BNF, BigInt(c.meta.ents[c.D].sk), L8.noteCm(n)])); }
  // ---------- revocation ----------
  async revokeEdge(c) {                       // the issuer of c's last certificate revokes it
    const hop = c.D - 1; const entry = BigInt(c.meta.cert[hop]); const pre = RV.cloneImt(this.imt); const tr = RV.transition(this.imt, entry, RV.certAuthority({ input: c.input, meta: c.meta }, hop, 0));
    const p = await snarkjs.groth16.fullProve(tr.input, RV.WASM, W + "t4_obligations/E7-obligations_20261009/revoke/build/zk/rt.zkey"); const cd = await cdP(p.proof, p.publicSignals);
    const r = await this.opTx(this.revs, "revoke", [cd.pr, S(tr.newRoot), tr.input.entry]); this.imt.insert(entry); c.revoked = true; c.preRevocationImt = pre; c.revokedAt = this.clock;
    await this.registerCurrentState(); return { gas: r.gasUsed.toNumber(), t: this.clock }; }
  // ---------- one action through the gate: the nine E4 stages ----------
  // opts: { method, reqCap, amount, params, target, imt (snapshot override: an attacker's stale revocation view), noteOwner (cred whose note is spent), send (false = build only) }
  async prepare(c, n, opts) {
    const T = {}; let t = now_(); const imt = opts.imt ?? this.imt;
    const x = structuredClone(c.input); x.issued_root = S(this.issued.root);
    try { for (let i = 1; i < c.D; i++) { const p = this.issued.path(this.issued.index.get(S(c.meta.cert[i]))); x.m_sib[i] = p.sib; x.m_bit[i] = p.bit; }
      Object.assign(x, L7.rootProof(this.roots, c.meta.cert[0])); L7.refreshAll(x, { ...c.meta, imt }); }
    catch (e) { return { layer: "construction", reason: String(e.message ?? e).slice(0, 80) }; }
    T.S2_revocation_path_fetch = now_() - t; t = now_();
    const rho = L8.rnd250(`e8-${this.tag}-chg-${crypto.randomBytes(6).toString("hex")}`); let input;
    try { ({ input } = L8.setBudget(x, n, this.notes, BigInt(opts.amount), rho)); } catch (e) { return { layer: "construction", reason: "note: " + String(e.message ?? e).slice(0, 60) }; }
    L9.toV9(input, crypto.randomBytes(16).toString("hex")); input.now = S(this.clock); input.act_req_cap = S(opts.reqCap);
    const nonce = BigInt("0x" + crypto.randomBytes(6).toString("hex"));
    input.ctx_hash = S(L7.ctxHash({ chainId: CHAIN, verifier: this.gate.address, method: opts.method, target: opts.target.address, params: opts.params, amount: BigInt(opts.amount), nonce }));
    T.S3_witness_assembly = now_() - t; t = now_();
    const wtns = path.join(os.tmpdir(), `e8-${process.pid}.wtns`);
    try { await snarkjs.wtns.calculate(input, `${V92}/build/c${c.D}/main_c_d${c.D}_js/main_c_d${c.D}.wasm`, wtns); }
    catch (e) { const m = String(e.message ?? e).match(/template (\S+) line: (\d+)/); return { layer: "circuit", reason: m ? `${m[1].replace(/_\d+$/, "")} L${m[2]}` : "unsat" }; }
    T.S4_witness_calc = now_() - t; t = now_();
    const { proof, publicSignals: ps } = await snarkjs.groth16.prove(`${V92}/build/zk/c${c.D}.zkey`, wtns); T.S5_prove = now_() - t; t = now_();
    const ok = await snarkjs.groth16.verify(vk(c.D), ps, proof); T.S6_offchain_verify = now_() - t;
    const cd = await cdP(proof, ps); const change = { own: n.own, q: n.q - BigInt(opts.amount), lin: n.lin, rho };
    return { layer: null, offchainValid: ok, T, change, nfSpent: S(ps.at(-3)),
      args: [cd.pr, { issued: S(this.issued.root), revoked: S(imt.root), root: S(this.roots.root) }, Number(input.now), { target: opts.target.address, method: opts.method, amount: S(opts.amount), nonce: S(nonce), params: opts.params }, ps.slice(6, ps.length - 4),
             { noteRoot: ps.at(-4), budgetNf: ps.at(-3), cmChange: ps.at(-2), qSpent: ps.at(-1) }] };
  }
  async submit(prs) {                          // several prepared actions in one block (submission order = array order); returns per-action outcome
    const t = now_(); const hs = []; for (const p of prs) hs.push((await this.gate.connect(this.relayer).execute(...p.args, { nonce: await this.nextNonce(this.relayer), gasLimit: 1_500_000 })).hash);
    const tSub = now_() - t; const t2 = now_(); const rs = await this.waitFor(hs); const tFin = now_() - t2; this.syncNotes(rs.filter((r) => r.status === 1));
    const out = []; for (const [i, r] of rs.entries()) { const why = r.status === 1 ? null : await this.reason(hs[i]);
      out.push({ status: r.status, gas: r.gasUsed.toNumber(), block: r.blockNumber, layer: why?.layer ?? null, reason: why?.reason ?? null, hash: hs[i], T: { S7_submission: tSub / prs.length, S8_finality: tFin } }); }
    return out; }
  close() { this.anvil.kill(); }
}

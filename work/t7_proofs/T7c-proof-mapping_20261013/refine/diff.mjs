// T7c R1b (PLAN.md): differential refinement test. Implementation = ZkDacGateV9 + ZkDacRevocations + ZkDacRegistry on anvil, driven by a client that
// builds witnesses for the real circuits' statements; model = `exec` of Refine.lean (sound w.r.t. T7b's Step, machine-checked).
// MODE=mock: verifiers replaced by T7cAcceptAll; the client decides circuit satisfiability with a predicate that mirrors the circuit statement.
// MODE=real: real v9.1 / transfer / mint / revoke / registration verifiers and real proofs; the predicate is checked against the real witness generator.
// usage: MODE=mock N=1000 SEED=1 node diff.mjs > ../results/r1_mock.json ;  MODE=real N=50 SEED=2 node diff.mjs > ../results/r1_real.json
import fs from "fs"; import os from "os"; import path from "path"; import crypto from "crypto"; import { spawn, execFileSync } from "child_process"; import { createRequire } from "module";
const HERE = new URL(".", import.meta.url).pathname, W = path.resolve(HERE, "../../..") + "/";
const reqC = createRequire(W + "t4_contracts/package.json"); const { ethers } = reqC("ethers");
const req7 = createRequire(W + "t2_circuit_fix/zkdac_v7/package.json"); const snarkjs = req7("snarkjs"); const { poseidon3 } = req7("poseidon-lite");
const L7 = await import(W + "t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs");
const L8 = await import(W + "t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs");
const L9 = await import(W + "t2_circuit_fix/zkdac_v9_1/scripts/lib_v9.mjs");
const BW = await import(W + "t2_circuit_fix/zkdac_v8/scripts/budget_world.mjs");
const RV = await import(W + "t4_obligations/E7-obligations_20261009/revoke/revoke_lib.mjs");
const RG = await import(W + "t4_registration/scripts/lib_register.mjs");
const MODE = process.env.MODE ?? "mock", NSEQ = Number(process.env.N ?? 20), SEED = process.env.SEED ?? "1", MAXLEN = 20, DELTA = 2, PORT = Number(process.env.PORT ?? 8571);
const TICK = 1000, WIN = TICK * DELTA + 500;                  // model tick = 1000 s, txs inside a tick at +0..+499 s: rootAccepted(t + WIN) <=> now <= t + DELTA
const METHOD = "0xa9059cbb", PARAMS = "0x1234abcd", DOMAIN = 0xd0a1n, CHAIN = 31337n, TAG_BNF = 2053857902n;
const OUT = W + "t4_contracts/foundry/out";
const art = (f, n) => JSON.parse(fs.readFileSync(`${OUT}/${f}/${n}.json`));
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);
const rngOf = (seed) => { let c = 0; return () => crypto.createHash("sha256").update(`${seed}-${c++}`).digest().readUInt32BE(0) / 2 ** 32; };

// ---------------- anvil ----------------
const anvil = spawn("anvil", ["--port", String(PORT), "--silent", "--gas-limit", "300000000", "--code-size-limit", "100000"], { stdio: "ignore" });
process.on("exit", () => anvil.kill());
const provider = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:${PORT}`); provider.pollingInterval = 5;
for (let i = 0; i < 100; i++) { try { await provider.getBlockNumber(); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
const op = ethers.Wallet.fromMnemonic("test test test test test test test test test test test junk").connect(provider);   // anvil's public default account (local only)
let nonce = await op.getTransactionCount();
// receipts are polled directly: ethers v5 waitForTransaction can miss a block that anvil mined before the listener started (hung the first full run)
const receipt = async (hash) => { for (;;) { const r = await provider.getTransactionReceipt(hash); if (r) return r; await new Promise((z) => setTimeout(z, 3)); } };
const send = async (contract, fn, args) => { const tx = await contract[fn](...args, { nonce: nonce++, gasLimit: 30_000_000 }); return receipt(tx.hash); };
const LIBS = {};
async function deploy(f, n, args = []) { const a = art(f, n); let code = a.bytecode.object.slice(2);
  for (const refs of Object.values(a.bytecode.linkReferences ?? {})) for (const [lib, locs] of Object.entries(refs)) for (const { start, length } of locs) code = code.slice(0, 2 * start) + LIBS[lib].slice(2).toLowerCase() + code.slice(2 * (start + length));
  const c = await new ethers.ContractFactory(a.abi, "0x" + code, op).deploy(...args, { nonce: nonce++, gasLimit: 30_000_000 }); await receipt(c.deployTransaction.hash); return c; }

// ---------------- world: fixed chains, long expiries ----------------
const keyOf = (n) => (n === "H" ? RG.humanPrv(0) : crypto.createHash("sha256").update("t7c-node-" + n).digest());
const EXP = [4_000_000_000, 3_999_000_000, 3_998_000_000, 3_997_000_000];
const CHAINS = [["H", "M"], ["H", "M", "A"], ["H", "M", "A", "B"], ["H", "M", "A", "B", "C"], ["H", "M", "X"], ["H", "M", "X", "Y"]];
const world = { imt: await L7.IMT.create(20), issued: new BW.W.SparseTree(16), roots: L7.newRootTree(), holders: [] };
for (let k = 0; k < 20; k++) world.imt.insert(L8.rnd250("t7c-decoy-" + k));
for (const chain of CHAINS) { const D = chain.length - 1;
  const { input, meta } = await L7.buildInstanceV7({ D, seed: 11, mode: "C", now: 1000, entPrv: chain.map(keyOf), rootOthers: 0, expiries: EXP.slice(0, D), accSeed: `t7c-${chain.join(">")}` });
  for (let i = 1; i < D; i++) world.issued.append(meta.cert[i]); if (world.roots.indexOf(BigInt(meta.cert[0])) < 0) world.roots.insert(BigInt(meta.cert[0]));
  world.holders.push({ chain, D, input, meta }); }
const certIds = new Map(); for (const h of world.holders) for (const c of h.meta.cert) if (!certIds.has(String(c))) certIds.set(String(c), certIds.size);
const holderLin = (h) => h.meta.cert.map((c) => certIds.get(String(c)));
const childOf = (h) => world.holders.filter((g) => g.D === h.D + 1 && g.chain.slice(0, -1).join() === h.chain.join());
const certHolder = (id) => { for (const h of world.holders) { const j = h.meta.cert.findIndex((c) => certIds.get(String(c)) === id); if (j >= 0) return { h, hop: j }; } };
const genesisImt = RV.cloneImt(world.imt);
// witness helpers (shared trees): revocation witnesses against a chosen IMT snapshot
function actionInput(h, imtSnap, notes, note, qs) {
  const input = structuredClone(h.input); input.issued_root = String(world.issued.root);
  for (let i = 1; i < h.D; i++) { const p = world.issued.path(world.issued.index.get(String(h.meta.cert[i]))); input.m_sib[i] = p.sib; input.m_bit[i] = p.bit; }
  Object.assign(input, L7.rootProof(world.roots, h.meta.cert[0]));
  try { L7.refreshAll(input, { ...h.meta, imt: imtSnap }); } catch (e) { return null; }      // a lineage entry is a member of this snapshot
  return L8.setBudget(input, note, notes, BigInt(qs), L8.rnd250("t7c-chg-" + crypto.randomBytes(8).toString("hex")));
}
const bwFor = (imtSnap, notes) => Object.assign(Object.create(BW.BudgetWorld.prototype), { w: { imt: imtSnap }, notes });

// ---------------- deployment ----------------
LIBS.PoseidonT3 = (await deploy("PoseidonT3.sol", "PoseidonT3")).address; LIBS.PoseidonT4 = (await deploy("PoseidonT4.sol", "PoseidonT4")).address;
const real = MODE === "real"; const mock = real ? null : (await deploy("T7cRefineHelpers.sol", "T7cAcceptAll")).address;
const V = async (f, n) => (real ? (await deploy(f, n)).address : mock);
const reg = await deploy("ZkDacRegistry.sol", "ZkDacRegistry", [await V("Groth16VerifierRegister.sol", "Groth16VerifierRegister"), op.address, DOMAIN.toString(), 300]);
const revs = await deploy("ZkDacRevocations.sol", "ZkDacRevocations", [await V("Groth16VerifierRevoke.sol", "Groth16VerifierRevoke"), String(world.imt.root), world.imt.leaves.length, WIN]);
const target = await deploy("T7cRefineHelpers.sol", "T7cSumTarget");
const vs = []; for (const D of [1, 2, 3, 4]) vs.push(await V(`Groth16VerifierV91CD${D}.sol`, `Groth16VerifierV91CD${D}`));
const tpk = world.holders[0].meta.tpk.map(String);
const gate = await deploy("ZkDacGateV9.sol", "ZkDacGateV9", [vs, [7, 8, 9, 10], reg.address, revs.address, op.address, String(world.issued.root), 300, 3600, tpk,
  [await V("Groth16VerifierBudgetTransfer.sol", "Groth16VerifierBudgetTransfer"), await V("Groth16VerifierBudgetMint.sol", "Groth16VerifierBudgetMint"), 1_000_000_000]]);
const REQCAP = Number(world.holders[0].input.act_req_cap); if (!world.holders.every((h) => Number(h.input.act_req_cap) === REQCAP)) throw new Error("req cap differs");
await send(gate, "setMethod", [METHOD, REQCAP, true]);          // requiredCap = the instances' act_req_cap (real-run fix: 0 made every real proof fail)
// registration of the single root certificate H > M
const ZERO = { a: [0, 0], b: [[0, 0], [0, 0]], c: [0, 0] };
const cdP = async (proof, ps) => { const c = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, ps)) + "]"); return { pr: { a: c[0], b: c[1], c: c[2] }, pub: c[3] }; };
{ const humans = Array.from({ length: 4 }, (_, i) => RG.makeHuman(i)); const group = new RG.Group(humans.map((h) => h.id.commitment)); const m = world.holders[0];
  const rw = RG.registerWitness({ human: humans[0], group, domain: DOMAIN, master: [m.input.ent_Ax[1], m.input.ent_Ay[1]], cap0: m.input.cap[0], expiry0: m.input.expiry[0] });
  if (rw.leaf0 !== m.meta.cert[0]) throw new Error("leaf0 != cert0");
  await send(reg, "setGroupRoot", [String(group.root), true]);
  if (real) { const p = await snarkjs.groth16.fullProve(rw, `${W}t4_registration/build/r20/main_reg_20_js/main_reg_20.wasm`, `${W}t4_registration/build/zk/reg20.zkey`); const c = await cdP(p.proof, p.publicSignals);
    await send(reg, "register", [c.pr, c.pub[0], c.pub[2], c.pub[3], []]); }
  else await send(reg, "register", [ZERO, String(group.root), String(poseidon3([2053858418n, BigInt(rw.human_sk), DOMAIN])), rw.leaf0, []]);
  if (String(await reg.currentRoot()) !== String(world.roots.root)) throw new Error("registry root != world root tree"); }
log("deployed", MODE, "gate", gate.address);
const snap = async () => provider.send("evm_snapshot", []);
let snapId = await snap();

// ---------------- one sequence ----------------
const P_ = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
async function runSequence(seqNo) {
  await provider.send("evm_revert", [snapId]); snapId = await snap(); nonce = await op.getTransactionCount();
  const r = rngOf(`${SEED}-${seqNo}`); const pick = (xs) => xs[Math.floor(r() * xs.length)];
  const T0 = (await provider.getBlock("latest")).timestamp + 10; let tick = 0, k = 0;
  const at = async () => { const t = T0 + TICK * tick + k; k++; if (k >= 500) throw new Error("too many txs in one tick"); await provider.send("evm_setNextBlockTimestamp", [t]); return t; };
  const notes = L8.newNoteTree(); const N = [];                  // client view: notes in insertion order {note, holder, cm, nf}
  let imt = RV.cloneImt(genesisImt); const history = [{ imt: RV.cloneImt(genesisImt), root: String(genesisImt.root) }]; const revokedAt = new Map();
  const ops = [], impl = []; let inserted = [], revEvents = []; let ctr = 0;
  const gateIf = new ethers.utils.Interface(art("ZkDacGateV9.sol", "ZkDacGateV9").abi), revIf = new ethers.utils.Interface(art("ZkDacRevocations.sol", "ZkDacRevocations").abi);
  const absorb = async (rc) => { for (const lg of rc.logs) { if (lg.address.toLowerCase() === gate.address.toLowerCase()) { try { const e = gateIf.parseLog(lg); if (e.name === "NoteInserted") inserted.push(String(e.args.cm)); } catch {} }
    if (lg.address.toLowerCase() === revs.address.toLowerCase()) { try { const e = revIf.parseLog(lg); if (e.name === "Revoked") revEvents.push({ entry: String(e.args.entry), t: (await provider.getBlock(rc.blockNumber)).timestamp }); } catch {} } } };
  const rootFor = (lin) => {                                       // the client's choice of revoked root: latest snapshot in which no lineage entry is revoked
    for (let i = history.length - 1; i >= 0; i--) if (lin.every((id) => !history[i].imt.has(L7.trunc(BigInt([...certIds.keys()][id]))))) return history[i]; return null; };
  const noteOf = (h, q) => ({ own: [BigInt(h.input.ent_Ax[h.D]), BigInt(h.input.ent_Ay[h.D])], q: BigInt(q), lin: L8.linOf(h.meta), rho: L8.rnd250("t7c-n-" + crypto.randomBytes(8).toString("hex")) });
  const nfOf = (h, n) => poseidon3([TAG_BNF, BigInt(h.meta.ents[h.D].sk), L8.noteCm(n)]);
  const witnessCheck = { agree: 0, disagree: [] };
  const len = 4 + Math.floor(r() * (MAXLEN - 3));
  for (let s = 0; s < len; s++) {
    const u = r(); let mop, accepted = false, why = "", category = "valid";
    const catOf = async (x, okAmount) => { if (!x) return "unknown note"; if (await gate.budgetSpent(x.nf)) return "spent note"; if (!okAmount) return "bad amount";
      const lin = holderLin(x.h); if (lin.some((id) => revokedAt.has(id) && tick > revokedAt.get(id) + DELTA)) return "revoked > Δ"; if (lin.some((id) => revokedAt.has(id))) return "revoked ≤ Δ (still live)"; return "valid"; };
    const live = N.map((x, i) => i); const anyIdx = () => (N.length && r() < 0.95 ? pick(live) : N.length + Math.floor(r() * 3));     // ~5 % unknown note
    if (u < 0.2 || N.length === 0) { category = "mint";                             // ---- mint
      const h = pick(world.holders), q = 1 + Math.floor(r() * 100); const n = noteOf(h, q);
      mop = `mint ${q} ${holderLin(h).join(" ")}`; const cm = L8.noteCm(n); let pr = ZERO;
      if (real) { const p = await snarkjs.groth16.fullProve(bwFor(imt, notes).mintWitness(n), `${W}t2_circuit_fix/zkdac_v8/build/budget_mint/budget_mint_js/budget_mint.wasm`, `${W}t2_circuit_fix/zkdac_v8/build/zk/budget_mint.zkey`); pr = (await cdP(p.proof, p.publicSignals)).pr; }
      await at(); const rc = await send(gate, "mint", [pr, String(cm), q]); accepted = rc.status === 1; if (accepted) { await absorb(rc); notes.insert(cm); N.push({ n, h, cm: String(cm), nf: String(nfOf(h, n)) }); }
    } else if (u < 0.45) {                                       // ---- split / delegate (transfer)
      const i = anyIdx(); const x = N[i]; const kids = x ? childOf(x.h) : []; const del = x && kids.length && r() < 0.5; const bad = r() < 0.15;
      const q = x ? Number(x.n.q) : 10; const q1 = Math.floor(r() * (q + 1)); const q2 = q - q1 + (bad ? 1 : 0);
      const child = del ? pick(kids) : null; const c = child ? certIds.get(String(child.meta.cert[child.D - 1])) : 0;
      mop = del ? `delegate ${i} ${c} ${q1} ${q2}` : `split ${i} ${q1} ${q2}`; category = await catOf(x, q1 + q2 === q);
      const snapR = x ? rootFor(holderLin(x.h)) : null;
      const pred = !!x && !!snapR && q1 + q2 === q;              // circuit statement TR-1..8 (note in tree, conservation, lineage non-revoked in the chosen root)
      let built = null; if (x && snapR) { try { built = bwFor(snapR.imt, notes).transferWitness(x.h, x.n, { to: child ?? undefined, q1, q2, label: "t7c" + ctr++ }); } catch (e) { built = null; } }
      if (real && built) { let sat = true; try { await snarkjs.wtns.calculate(built.input, `${W}t2_circuit_fix/zkdac_v8/build/budget_transfer/budget_transfer_js/budget_transfer.wasm`, path.join(os.tmpdir(), "t7c-r1.wtns")); } catch { sat = false; }
        if (sat === pred) witnessCheck.agree++; else witnessCheck.disagree.push({ s, mop, pred, sat }); }
      if (pred && built) { let pr = ZERO; if (real) { const p = await snarkjs.groth16.fullProve(built.input, `${W}t2_circuit_fix/zkdac_v8/build/budget_transfer/budget_transfer_js/budget_transfer.wasm`, `${W}t2_circuit_fix/zkdac_v8/build/zk/budget_transfer.zkey`); pr = (await cdP(p.proof, p.publicSignals)).pr; }
        await at(); const rc = await send(gate, "transferBudget", [pr, String(notes.root), snapR.root, x.nf, built.input.cm_out1, built.input.cm_out2]); accepted = rc.status === 1;
        if (accepted) { await absorb(rc); notes.insert(BigInt(built.input.cm_out1)); notes.insert(BigInt(built.input.cm_out2)); const oh = child ?? x.h;
          N.push({ n: built.out1, h: oh, cm: built.input.cm_out1, nf: String(nfOf(oh, built.out1)) }); N.push({ n: built.out2, h: x.h, cm: built.input.cm_out2, nf: String(nfOf(x.h, built.out2)) }); } else why = "contract"; }
      else why = "no witness";
    } else if (u < 0.7) {                                        // ---- execute
      const i = anyIdx(); const x = N[i]; const q = x ? Number(x.n.q) : 10; const over = r() < 0.15; const qs = over ? q + 1 + Math.floor(r() * 5) : Math.floor(r() * (q + 1));
      const qc = qs <= q ? q - qs : 0; mop = `execute ${i} ${qs} ${qc}`; category = await catOf(x, qs <= q); const snapR = x ? rootFor(holderLin(x.h)) : null;
      const pred = !!x && !!snapR && qs <= q;                    // circuit statement EX-4, EX-13..15 (chain fixed and valid)
      let built = null; if (x && snapR && qs <= q) built = actionInput(x.h, snapR.imt, notes, x.n, qs);
      if (built) { const nonceA = BigInt(++ctr); const act = { target: target.address, method: METHOD, amount: qs, nonce: String(nonceA), params: PARAMS };
        // now = the registerState block; execute is mined at t + 1 (now <= block time <= now + skew)
        const t = T0 + TICK * tick + k; const inp = built.input; L9.toV9(inp, "t7c-acc-" + crypto.randomBytes(8).toString("hex")); inp.now = String(t);
        inp.ctx_hash = String(L7.ctxHash({ chainId: CHAIN, verifier: gate.address, method: METHOD, target: target.address, params: PARAMS, amount: BigInt(qs), nonce: nonceA }));
        let pr = ZERO, ct = Array(x.h.D + 6).fill("0"), pubB = [String(notes.root), x.nf, inp.cm_change, String(qs)];
        if (real) { let ok = true; let p; try { p = await snarkjs.groth16.fullProve(inp, `${W}t2_circuit_fix/zkdac_v9_1/build/c${x.h.D}/main_c_d${x.h.D}_js/main_c_d${x.h.D}.wasm`, `${W}t2_circuit_fix/zkdac_v9_1/build/zk/c${x.h.D}.zkey`); } catch (e) { ok = false; if (process.env.DEBUG) console.error("EXEC WITNESS FAIL", String(e.message ?? e).slice(0, 300)); }
          if (ok === pred) witnessCheck.agree++; else witnessCheck.disagree.push({ s, mop, pred, sat: ok });
          if (ok) { const c = await cdP(p.proof, p.publicSignals); pr = c.pr; ct = p.publicSignals.slice(6, p.publicSignals.length - 4); pubB = p.publicSignals.slice(p.publicSignals.length - 4); } else built = null; }
        if (built && pred) { const roots = { issued: String(world.issued.root), revoked: snapR.root, root: String(world.roots.root) };
          await at(); await send(gate, "registerState", [roots.issued, roots.revoked, roots.root]);
          await at(); const rc = await send(gate, "execute", [pr, roots, t, act, ct, { noteRoot: pubB[0], budgetNf: pubB[1], cmChange: pubB[2], qSpent: pubB[3] }]);
          accepted = rc.status === 1;
          if (accepted) { await absorb(rc); notes.insert(BigInt(inp.cm_change)); const change = { own: x.n.own, q: BigInt(q - qs), lin: x.n.lin, rho: BigInt(inp.rho_change) }; N.push({ n: change, h: x.h, cm: inp.cm_change, nf: String(nfOf(x.h, change)) }); } else why = "contract"; }
        else why = "no witness"; }
      else { why = "no witness"; if (real && x && snapR && qs > q) witnessCheck.agree++; }
    } else if (u < 0.8) { category = "revoke";                   // ---- revoke an unrevoked certificate (issuer authority)
      const ids = [...certIds.values()].filter((id) => !revokedAt.has(id));
      if (!ids.length) { mop = "tick"; tick++; k = 0; accepted = true; } else {
      const id = pick(ids); const { h, hop } = certHolder(id); const entry = BigInt([...certIds.keys()][id]); mop = `revoke ${id}`;
      const tr = RV.transition(imt, entry, RV.certAuthority(h, hop, 0)); let pr = ZERO;
      if (real) { const p = await snarkjs.groth16.fullProve(tr.input, RV.WASM, `${W}t4_obligations/E7-obligations_20261009/revoke/build/zk/rt.zkey`); pr = (await cdP(p.proof, p.publicSignals)).pr; }
      await at(); const rc = await send(revs, "revoke", [pr, String(tr.newRoot), String(entry)]); accepted = rc.status === 1;
      if (accepted) { await absorb(rc); imt = tr.after; history.push({ imt: RV.cloneImt(imt), root: String(imt.root) }); revokedAt.set(id, tick); } }
    } else { mop = "tick"; category = "tick"; tick++; k = 0; accepted = true; }
    ops.push(mop); impl.cat = impl.cat ?? [];
    impl.cat.push(category);
    // implementation state, read from the chain (alpha)
    const spent = []; for (const cm of inserted) { const x = N.find((y) => y.cm === cm); spent.push(x ? ((await gate.budgetSpent(x.nf)) ? "1" : "0") : "?"); }
    const rev = revEvents.map((e) => `${certIds.get([...certIds.keys()].find((c) => c === e.entry))}@${Math.floor((e.t - T0) / TICK)}`).sort((a, b) => Number(a.split("@")[0]) - Number(b.split("@")[0]));
    impl.push({ accepted, why, size: inserted.length, minted: Number(await gate.totalMinted()), used: Number(await target.total()), now: tick, spent: spent.join(""), revoked: rev.join(","),
      rootMirror: String(await gate.noteRoot()) === String(notes.root) || inserted.length === 0 });
  }
  return { ops, impl, witnessCheck };
}

// ---------------- run, then the Lean model on the same ops ----------------
const seqs = []; const t0 = Date.now();
for (let n = 0; n < NSEQ; n++) { seqs.push(await runSequence(n)); if (n % 20 === 0 || real) log(`seq ${n + 1}/${NSEQ}`); }
const lean = execFileSync(HERE + ".lake/build/bin/refine", { input: seqs.map((s) => ["reset", `delta ${DELTA}`, ...s.ops].join("\n")).join("\n") + "\n" }).toString().trim().split("\n").filter((l) => l !== "reset");
const parse = (l) => { const [st, ...kv] = l.split(" "); const o = Object.fromEntries(kv.map((x) => { const i = x.indexOf("="); return [x.slice(0, i), x.slice(i + 1)]; })); return { ok: st === "ok", size: +o.size, minted: +o.minted, used: +o.used, now: +o.now, spent: o.spent ?? "", revoked: o.revoked ?? "" }; };
let li = 0, steps = 0, agreeSteps = 0; const mismatches = []; const byOp = {}; let mirrorBad = 0;
for (const [sn, s] of seqs.entries()) { let diverged = false;
  for (const [j, opx] of s.ops.entries()) { const m = parse(lean[li++]); const im = s.impl[j]; steps++; if (!im.rootMirror) mirrorBad++;
    const kind = opx.split(" ")[0] + " / " + s.impl.cat[j]; (byOp[kind] ??= { n: 0, model_ok: 0, impl_ok: 0, agree: 0 }); byOp[kind].n++; if (m.ok) byOp[kind].model_ok++; if (im.accepted) byOp[kind].impl_ok++;
    const same = m.ok === im.accepted && m.size === im.size && m.minted === im.minted && m.used === im.used && m.now === im.now && m.spent === im.spent && m.revoked === im.revoked;
    if (same && !diverged) { agreeSteps++; byOp[kind].agree++; } else if (!diverged) { diverged = true; mismatches.push({ seq: sn, step: j, op: opx, model: m, impl: im, prefix: s.ops.slice(0, j + 1) }); } } }
const wc = seqs.reduce((a, s) => ({ agree: a.agree + s.witnessCheck.agree, disagree: [...a.disagree, ...s.witnessCheck.disagree] }), { agree: 0, disagree: [] });
console.log(JSON.stringify({ mode: MODE, seed: SEED, sequences: NSEQ, delta_ticks: DELTA, tick_seconds: TICK, revocation_window_s: WIN, steps, steps_agree: agreeSteps, sequences_with_mismatch: mismatches.length,
  client_mirror_root_mismatches: mirrorBad, by_op: byOp, predicate_vs_real_witness: real ? { agree: wc.agree, disagree: wc.disagree } : "n/a (mock)", wall_s: Math.round((Date.now() - t0) / 1000), host: os.hostname(), mismatches: mismatches.slice(0, 20) }, null, 1));
anvil.kill(); process.exit(0);

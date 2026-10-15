// E7c suite B + G7 (PREREGISTRATION.md): independent v9.1 actions for the real gate, built like gen_fixtures_v91.mjs (shared issued tree, revocation IMT,
// registered-root tree and note tree mirroring the contracts) but one registered root per instance. Per D = 1..4, N instances (seed 7000 + 100 D + i):
// chain H<k> > A<k>_1 > ... > A<k>_D (H<k> = human k), one registration proof, one budget note (q = 10) minted to the terminal holder, one execute proof
// spending 7 (change 3), all made on the note root after every mint. Ciphertexts are encrypted to the E6 dealer committee (t = 3, n = 5, epoch 1), so
// E6c can open exactly what the gate emitted. G7: D = 4 instances with an off-curve key at hop j = 1..3 (#53), proved with the v9 circuit if v9.1 rejects.
// E7d: E7c gen_batch_v91.mjs with v9.2 paths (the variable V91 now points to zkdac_v9_2) plus F-2 rows: D = 2, 4 chains whose registered/issued holder is the
// identity point O with holder_sk = 0, proved with the v9.1 circuit (V91REAL) because v9.2 cannot produce a witness.
// Run from work/t4_contracts: N=30 node E7d-v92-gate_20261013/gen_batch_v92.mjs  ->  foundry/test/fixtures_V92_batch.json
import fs from "fs"; import crypto from "crypto"; import os from "os"; import path from "path";
import { buildInstanceV7, refreshAll, IMT, newRootTree, rootProof } from "../../t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs";
import { setBudget, noteCm, newNoteTree, linOf, rnd250 } from "../../t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs";
import { toV9 } from "../../t2_circuit_fix/zkdac_v9_2/scripts/lib_v9.mjs";
import { makeHuman, humanPrv, registerWitness, Group } from "../../t4_registration/scripts/lib_register.mjs";
import * as snarkjs from "snarkjs";
const BW = await import("../../t2_circuit_fix/zkdac_v8/scripts/budget_world.mjs");
const R = await import("../../t4_obligations/E7-obligations_20261009/revoke/revoke_lib.mjs");
const V2 = await import("../../t2_circuit_fix/zkdac_v2/scripts/lib.mjs");
const T = await import("../../t4_accountability/E6-threshold-opening_20261009/threshold.mjs");
const W = BW.W;
const N = Number(process.env.N ?? 30), OUT = process.env.OUT ?? "foundry/test/fixtures_V92_batch.json";
const V91REAL = "../t2_circuit_fix/zkdac_v9_1"; const V8 = "../t2_circuit_fix/zkdac_v8", V91 = "../t2_circuit_fix/zkdac_v9_2", V9 = "../t2_circuit_fix/zkdac_v9", REG = "../t4_registration";
const GATE = "0x000000000000000000000000000000000000dAC9", TARGET = "0x000000000000000000000000000000000000Ba5e";
const CHAIN = 31337n, NOW = 1000, METHOD = "0xa9059cbb", PARAMS = "0x1234abcd", DOMAIN = 0xd0a1n;
const exps = (D) => [5000, 4000, 3000, 2000].slice(0, D).map((e) => NOW + e);
// committee key: E6 dealer, t = 3, n = 5, epoch 1 (E6c O20 opens the emitted ciphertexts with it)
const E1 = T.deal({ t: 3, n: 5, epoch: 1, seed: "e6-20261009" }); const TPK = E1.pub.tpk.map(String);
const OTHER_TPK = T.mul(T.G, 12345n).map(String);                       // a valid subgroup point != TPK (B3: gate with another TPK)
// ---- off-curve key (G7): same patch as zkdac_v9_1/scripts/offcurve_poc.mjs ----
const X = JSON.parse(fs.readFileSync(new URL("../../t2_circuit_fix/zkdac_v9_1/results/offcurve_point.json", import.meta.url)));
{ const { eddsa, poseidon } = await V2.init(); const F = eddsa.F, bj = eddsa.babyJub; const L = 2736030358979909402780800718157159386076813972158567259200215660948447373041n;
  const A = [F.e(BigInt(X.Ax)), F.e(BigInt(X.Ay))]; const o2p = eddsa.prv2pub.bind(eddsa), osp = eddsa.signPoseidon.bind(eddsa);
  eddsa.prv2pub = (prv) => (isMagic(prv) ? A : isO(prv) ? [F.e(0n), F.e(1n)] : o2p(prv));          // F-2: prv2pub(MAGIC_O) = identity O
  eddsa.signPoseidon = (prv, msg) => { if (!isMagic(prv)) return osp(prv, msg); const r = 123456789123456789n; const R8 = bj.mulPointEscalar(bj.Base8, r);
    const h = F.toObject(poseidon([R8[0], R8[1], A[0], A[1], msg])); return { R8, S: (r + h * BigInt(X.q)) % L }; }; }
function isMagic(prv) { return Buffer.isBuffer(prv) && prv.length === 32 && prv.every((b) => b === 7); }
const MAGIC = Buffer.alloc(32, 7); const MAGIC_O = Buffer.alloc(32, 9); function isO(prv) { return Buffer.isBuffer(prv) && prv.length === 32 && prv.every((b) => b === 9); }
const key = (n) => (n.startsWith("H") ? humanPrv(Number(n.slice(1))) : crypto.createHash("sha256").update("e7c-node-" + n).digest());
// ---- shared state ----
const imt = await IMT.create(20); for (let k = 0; k < 20; k++) imt.insert(rnd250("v8-decoy-" + k));
const issued = new W.SparseTree(16); const roots = newRootTree(); const notes = newNoteTree();
let nonce = 0n;
async function inst(chain, seed, entPrv, amount, accSeed) {
  const D = chain.length - 1; const n = ++nonce;
  const { input, meta } = await buildInstanceV7({ D, seed, mode: "C", now: NOW, entPrv, rootOthers: 0, expiries: exps(D), accSeed,
    ctx: { chainId: CHAIN, verifier: GATE, method: METHOD, target: TARGET, params: PARAMS, amount: BigInt(amount), nonce: n } });
  return { chain, D, input, meta, nonce: n, seed };
}
function treeWitness(h) {
  const input = structuredClone(h.input); input.issued_root = String(issued.root);
  for (let i = 1; i < h.D; i++) { const p = issued.path(issued.index.get(String(h.meta.cert[i]))); input.m_sib[i] = p.sib; input.m_bit[i] = p.bit; }
  Object.assign(input, rootProof(roots, h.meta.cert[0])); refreshAll(input, { ...h.meta, imt }); return input;
}
const owner = (h) => [BigInt(h.input.ent_Ax[h.D]), BigInt(h.input.ent_Ay[h.D])];
const cd = async (proof, ps) => JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, ps)) + "]");
const pk = async (proof, ps) => { const c = await cd(proof, ps); return { a: c[0], b: c[1], c: c[2], pub: c[3] }; };
const tmp = path.join(os.tmpdir(), `e7c-${process.pid}.wtns`);
async function sat(dir, D, input) {
  try { await snarkjs.wtns.calculate(input, `${dir}/build/c${D}/main_c_d${D}_js/main_c_d${D}.wasm`, tmp); return { sat: true }; }
  catch (e) { const m = String(e.message ?? e).match(/template (\S+) line: (\d+)/); return { sat: false, fail: m ? `${m[1].replace(/_\d+$/, "")} L${m[2]}` : String(e).slice(0, 160) }; }
}
const humans = Array.from({ length: 128 }, (_, i) => makeHuman(i)); const group = new Group(humans.map((h) => h.id.commitment));
// ---- 1. holders: instances (certificates into the shared trees); an off-curve instance the registration circuit rejects is recorded and skipped ----
const H = []; let human = 0;
for (const D of [1, 2, 3, 4]) for (let i = 0; i < N; i++) {
  const k = human++; const chain = [`H${k}`, ...Array.from({ length: D }, (_, j) => `A${k}_${j + 1}`)];
  H.push({ kind: "batch", D, i, human: k, chain, entPrv: chain.map(key), seed: 7000 + 100 * D + i });
}
for (const j of [1, 2, 3]) { const k = human++; const chain = [`H${k}`, ...Array.from({ length: 4 }, (_, m) => `O${k}_${m + 1}`)]; const ep = chain.map(key); ep[j] = MAGIC;
  H.push({ kind: "offcurve", D: 4, j, human: k, chain, entPrv: ep, seed: 7900 + j }); }
for (const D of [2, 4]) { const k = human++; const chain = [`H${k}`, ...Array.from({ length: D }, (_, m) => `F${k}_${m + 1}`)]; const ep = chain.map(key); ep[D] = MAGIC_O;
  H.push({ kind: "f2", D, human: k, chain, entPrv: ep, seed: 7950 + D }); }
for (const h of H) {
  try { h.inst = await inst(h.chain, h.seed, h.entPrv, 7, `e7c-${h.chain.join(">")}`); }
  catch (e) { h.stage = "instance builder: " + String(e.message ?? e).slice(0, 160); h.inst = null; continue; }
  { const m = h.inst; h.rw = registerWitness({ human: humans[h.human], group, domain: DOMAIN, master: [m.input.ent_Ax[1], m.input.ent_Ay[1]], cap0: m.input.cap[0], expiry0: m.input.expiry[0] });
    if (h.rw.leaf0 !== m.meta.cert[0]) throw new Error("leaf0 != cert0 for human " + h.human);
    try { await snarkjs.wtns.calculate(h.rw, `${REG}/build/r20/main_reg_20_js/main_reg_20.wasm`, tmp); }
    catch (e) { if (h.kind !== "offcurve") throw e; h.stage = "registration witness unsatisfiable: " + String(e.message ?? e).slice(0, 160); h.inst = null; continue; } }
  for (let i = 1; i < h.D; i++) issued.append(h.inst.meta.cert[i]);
  roots.insert(BigInt(h.inst.meta.cert[0]));
}
// ---- 2. registrations (same order as the root-tree insertions) ----
const regs = [];
for (const h of H) { if (!h.inst) continue;
  const rp = await snarkjs.groth16.fullProve(h.rw, `${REG}/build/r20/main_reg_20_js/main_reg_20.wasm`, `${REG}/build/zk/reg20.zkey`); regs.push(await pk(rp.proof, rp.publicSignals));
}
process.stderr.write(`registered ${regs.length}\n`);
// ---- 3. mints ----
const bwShim = Object.assign(Object.create(BW.BudgetWorld.prototype), { w: { imt }, notes });
const mints = [];
for (const h of H) { if (!h.inst) continue;
  h.note = { own: owner(h.inst), q: 10n, lin: linOf(h.inst.meta), rho: rnd250("e7c-note-" + h.chain.join(">")) };
  const x = bwShim.mintWitness(h.note); const { proof, publicSignals } = await snarkjs.groth16.fullProve(x, `${V8}/build/budget_mint/budget_mint_js/budget_mint.wasm`, `${V8}/build/zk/budget_mint.zkey`);
  notes.insert(noteCm(h.note)); mints.push({ ...(await pk(proof, publicSignals)), cm: x.cm, q: x.q });
}
const noteRootAfterMints = String(notes.root); process.stderr.write(`minted ${mints.length}\n`);
// ---- 4. execute proofs on the final trees ----
const actions = [], offcurve = [], f2 = [];
for (const h of H) { if (!h.inst) { if (h.kind === "offcurve") offcurve.push({ j: h.j, stage: h.stage }); continue; }
  const input = treeWitness(h.inst); input.tpk = TPK; if (h.kind === "f2") input.holder_sk = "0";       // anyone knows O's secret
  const { input: inp } = setBudget(input, h.note, notes, 7n, rnd250("e7c-chg-" + h.chain.join(">")));
  toV9(inp, crypto.randomBytes(32).toString("hex"));                       // CSPRNG ciphertext randomness per action
  const ents = inp.ent_Ax.map((x, j) => [x, inp.ent_Ay[j]]);
  const rec = { D: h.D, nonce: String(h.inst.nonce), amount: "7", roots: [inp.issued_root, inp.revoked_root, inp.root_root], ents };
  if (h.kind === "batch") {
    const t0 = Date.now(); const { proof, publicSignals } = await snarkjs.groth16.fullProve(inp, `${V91}/build/c${h.D}/main_c_d${h.D}_js/main_c_d${h.D}.wasm`, `${V91}/build/zk/c${h.D}.zkey`);
    actions.push({ ...rec, i: h.i, proveMs: Date.now() - t0, ...(await pk(proof, publicSignals)), publicSignals, proof, ct: publicSignals.slice(6, publicSignals.length - 4) });
    process.stderr.write(`\rD=${h.D} ${h.i + 1}/${N}`);
  } else if (h.kind === "f2") {
    const row = { D: h.D, ...rec, v92: await sat(V91, h.D, inp), v91: await sat(V91REAL, h.D, inp) };
    if (row.v91.sat) { const { proof, publicSignals } = await snarkjs.groth16.fullProve(inp, `${V91REAL}/build/c${h.D}/main_c_d${h.D}_js/main_c_d${h.D}.wasm`, `${V91REAL}/build/zk/c${h.D}.zkey`);
      Object.assign(row, await pk(proof, publicSignals), { publicSignals, proof, ct: publicSignals.slice(6, publicSignals.length - 4) }); }
    f2.push(row); process.stderr.write(`\nF-2 D=${h.D} v9.2 ${JSON.stringify(row.v92)} v9.1 ${JSON.stringify(row.v91)}\n`);
  } else {
    const row = { j: h.j, ...rec, v91: await sat(V91, 4, inp), v9: await sat(V9, 4, inp) };
    if (row.v9.sat) { const { proof, publicSignals } = await snarkjs.groth16.fullProve(inp, `${V9}/build/c4/main_c_d4_js/main_c_d4.wasm`, `${V9}/build/zk/c4.zkey`);
      Object.assign(row, await pk(proof, publicSignals), { publicSignals, proof, ct: publicSignals.slice(6, publicSignals.length - 4) }); }
    offcurve.push(row); process.stderr.write(`\noffcurve j=${h.j} v9.1 ${JSON.stringify(row.v91)} v9 ${JSON.stringify(row.v9)}\n`);
  }
}
try { fs.unlinkSync(tmp); } catch {}
// ---- 5. one real revocation (certificate hop 1 of the first D = 2 instance), applied in the window tests ----
const rv = H.find((h) => h.kind === "batch" && h.D === 2 && h.i === 0);
const tr = R.transition(imt, BigInt(rv.inst.meta.cert[1]), R.certAuthority(rv.inst, 1, 0)); const rvp = await snarkjs.groth16.fullProve(tr.input, R.WASM, "../t4_obligations/E7-obligations_20261009/revoke/build/zk/rt.zkey");
const rvc = await cd(rvp.proof, rvp.publicSignals);
const out = { gate: GATE, target: TARGET, method: METHOD, reqCap: 1, params: PARAMS, now: NOW, domain: String(DOMAIN), groupRoot: String(group.root), rootRoot: String(roots.root),
  issuedRoot: String(issued.root), tpk: TPK, otherTpk: OTHER_TPK, committee: { t: 3, n: 5, epoch: 1, dealerSeed: "e6-20261009" }, revGenesisRoot: String(imt.root), revGenesisCount: imt.leaves.length,
  noteRootAfterMints, nPerD: N, regsLength: regs.length, mintsLength: mints.length, offcurveLength: offcurve.length, f2Length: f2.length, regs, mints, actions, offcurve, f2, revoke: { a: rvc[0], b: rvc[1], c: rvc[2], newRoot: String(tr.newRoot), entry: tr.input.entry, revokedInstance: { D: 2, i: 0 } } };
fs.writeFileSync(OUT, JSON.stringify(out));
// forge reads one small file per item (reading the whole fixture for every item copies it into EVM memory each time: MemoryOOG at N = 30)
const dir = OUT.replace(/\.json$/, ""); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const { regs: _r, mints: _m, actions: _a, offcurve: _o, f2: _f, ...meta } = out; fs.writeFileSync(`${dir}/meta.json`, JSON.stringify(meta));
regs.forEach((x, i) => fs.writeFileSync(`${dir}/reg_${i}.json`, JSON.stringify(x))); mints.forEach((x, i) => fs.writeFileSync(`${dir}/mint_${i}.json`, JSON.stringify(x)));
const slim = ({ publicSignals, proof, ents, ...x }) => x;
actions.forEach((x, k) => fs.writeFileSync(`${dir}/act_${k}.json`, JSON.stringify(slim(x)))); f2.forEach((x, r) => fs.writeFileSync(`${dir}/f2_${r}.json`, JSON.stringify({ hasProof: !!x.a, ...slim(x) }))); offcurve.forEach((x, r) => fs.writeFileSync(`${dir}/off_${r}.json`, JSON.stringify({ hasProof: !!x.a, ...slim(x) })));
console.error(`\nwrote ${OUT}: ${actions.length} actions, ${offcurve.length} off-curve rows, ${regs.length} registrations`); process.exit(0);

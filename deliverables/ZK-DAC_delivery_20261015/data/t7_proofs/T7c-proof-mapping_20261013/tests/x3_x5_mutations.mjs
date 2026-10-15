// T7c X3 (nullifier injectivity, canonical secrets) and X5 (non-framing) — PLAN.md. Witness-level mutations on the v9.1 action circuit (D = 2, 4),
// the v8 budget_transfer circuit and the registration circuit, in a shared E3/BudgetWorld world. Each row records the failing template and line.
// usage (this directory): node x3_x5_mutations.mjs > ../results/x3_x5.json 2> ../results/x3_x5.stderr
import fs from "fs"; import os from "os"; import path from "path"; import crypto from "crypto"; import { createRequire } from "module";
const W = new URL("../../../", import.meta.url).pathname;
const req = createRequire(W + "t2_circuit_fix/zkdac_v7/package.json"); const snarkjs = req("snarkjs"); const { poseidon3 } = req("poseidon-lite");
const BW = await import(W + "t2_circuit_fix/zkdac_v8/scripts/budget_world.mjs");
const L9 = await import(W + "t2_circuit_fix/zkdac_v9_1/scripts/lib_v9.mjs");
const V2 = await import(W + "t2_circuit_fix/zkdac_v2/scripts/lib.mjs");
const REG = await import(W + "t4_registration/scripts/lib_register.mjs");
const { noteCm, rnd250 } = await import(W + "t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs");
const L = 2736030358979909402780800718157159386076813972158567259200215660948447373041n, P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n, TAG_BNF = 2053857902n;
const tmp = path.join(os.tmpdir(), `x35-${process.pid}.wtns`);
const WASM = { v91: (D) => `${W}t2_circuit_fix/zkdac_v9_1/build/c${D}/main_c_d${D}_js/main_c_d${D}.wasm`, xfer: `${W}t2_circuit_fix/zkdac_v8/build/budget_transfer/budget_transfer_js/budget_transfer.wasm`,
  reg: `${W}t4_registration/build/r20/main_reg_20_js/main_reg_20.wasm` };
async function sat(wasm, input) { try { await snarkjs.wtns.calculate(input, wasm, tmp); return { sat: true }; }
  catch (e) { const m = String(e.message ?? e).match(/template (\S+) line: (\d+)/); return { sat: false, at: m ? `${m[1].replace(/_\d+$/, "")} L${m[2]}` : String(e).slice(0, 100) }; } }
const rows = []; const row = async (id, name, wasm, input, expectSat, expectAt) => { const r = await sat(wasm, input);
  const pass = r.sat === expectSat && (!expectAt || (r.at ?? "").startsWith(expectAt)); rows.push({ id, name, expected: expectSat ? "SAT" : `UNSAT${expectAt ? " at " + expectAt : ""}`, got: r.sat ? "SAT" : `UNSAT at ${r.at}`, pass });
  if (!pass) console.error("FAIL", id, name, r); return r; };
const clone = (x) => structuredClone(x);
// ---- world: two chains per depth, plus a victim V in the middle of one chain ----
const bw = await BW.BudgetWorld.create(20);
const hs = {}; for (const D of [2, 4]) { hs[D] = await bw.add(["H", "M", ...Array.from({ length: D - 1 }, (_, i) => `A${D}_${i}`)], 300 + D); hs["b" + D] = await bw.add(["H", "M", ...Array.from({ length: D - 1 }, (_, i) => `B${D}_${i}`)], 400 + D); }
const notes = {}; for (const k of Object.keys(hs)) notes[k] = bw.insert(bw.note(hs[k], 50, "x35-" + k));
const act = (k, q = 7) => { const { input } = bw.actionWitness(hs[k], notes[k], q, "x35-" + k); return L9.toV9(input, "x35-" + k + crypto.randomBytes(8).toString("hex")); };

// ---------- controls ----------
for (const D of [2, 4]) await row("ctl", `honest action D=${D}`, WASM.v91(D), act(D), true);
// ---------- X3a / X3b: action circuit ----------
for (const D of [2, 4]) { const base = act(D);
  { const x = clone(base); x.holder_sk = String(BigInt(x.holder_sk) + L); await row("X3a", `D=${D} holder_sk + l (same public key, aliased scalar)`, WASM.v91(D), x, false, "ZkDacChainV9 L200"); }
  { const x = clone(base); const sk2 = BigInt("0x" + crypto.randomBytes(31).toString("hex")) % L; x.holder_sk = String(sk2);
    x.budget_nf = String(poseidon3([TAG_BNF, sk2, BigInt(noteCm(notes[D]))])); await row("X3b", `D=${D} same note, another secret (second nullifier for one note)`, WASM.v91(D), x, false, "ZkDacChainV9 L194"); }
  { const x = clone(base); x.budget_nf = String(poseidon3([TAG_BNF, BigInt(x.holder_sk), BigInt(noteCm(notes["b" + D]))])); await row("X3b", `D=${D} nullifier of another note with this note's witness`, WASM.v91(D), x, false, "ZkDacChainV9 L225"); }
  { const x = clone(base); x.rho_in = String(BigInt(x.rho_in) + 1n); await row("X3a", `D=${D} input note not in the tree (rho changed)`, WASM.v91(D), x, false, "BinaryMerkleRoot"); }
  { const x = clone(base); x.q_spent = String(BigInt(x.q_in) + 1n); x.q_change = String(P - 1n); await row("X3b", `D=${D} q_spent = q_in + 1, q_change = p - 1 (field wrap)`, WASM.v91(D), x, false, "Num2Bits"); }
}
// ---------- X3a / X3b: transfer circuit ----------
{ const h = hs[2]; const { input } = bw.transferWitness(h, notes[2], { q1: 20, q2: 30, label: "x3t" });
  await row("ctl", "honest transfer (split)", WASM.xfer, input, true);
  { const x = clone(input); x.sk = String(BigInt(x.sk) + L); await row("X3a", "transfer sk + l", WASM.xfer, x, false, "BudgetTransfer L56"); }
  { const x = clone(input); x.nullifier = String(poseidon3([TAG_BNF, BigInt(x.sk), BigInt(noteCm(notes.b2))])); await row("X3b", "transfer: nullifier of another note", WASM.xfer, x, false, "BudgetTransfer L58"); }
  { const x = clone(input); x.q1 = String(BigInt(x.q_in) + 1n); x.q2 = String(P - 1n); await row("X3b", "transfer: q1 = q_in + 1, q2 = p - 1 (field wrap)", WASM.xfer, x, false, "Num2Bits"); } }
// ---------- X3a: registration circuit ----------
{ const humans = Array.from({ length: 4 }, (_, i) => REG.makeHuman(i)); const group = new REG.Group(humans.map((h) => h.id.commitment));
  const w = REG.registerWitness({ human: humans[1], group, domain: 0xd0a1n, master: ["5299619240641551281634865583518297030282874472190772894086521144482721001553", "16950150798460657717958625567821834550301663161624707787222815936182638968203"], cap0: 255n, expiry0: 9999n });
  await row("ctl", "honest registration", WASM.reg, w, true);
  { const x = clone(w); x.human_sk = String(BigInt(x.human_sk) + L); await row("X3a", "registration s + l (second nullifier for one human)", WASM.reg, x, false, "ZkDacRegister L32"); }
  { const x = clone(w); x.nf_domain = String(poseidon3([2053858418n, BigInt(x.human_sk), 0xd0a2n])); await row("X3a", "registration nullifier for another domain", WASM.reg, x, false, "ZkDacRegister L48"); } }

// ---------- X5 non-framing ----------
// victim V: an honest key the adversary has no secret for. The chain H > M > ... places V at hop j; the generator (which knows V's key only because it
// builds the honest instance) is used for everything EXCEPT V's own signature / secret, which the adversary replaces.
const { eddsa } = await V2.init(); const F = eddsa.F; const advPrv = crypto.createHash("sha256").update("x5-adversary").digest();
const sigFields = (s) => ({ S: String(s.S), R8x: String(F.toObject(s.R8[0])), R8y: String(F.toObject(s.R8[1])) });
for (const D of [2, 4]) for (let j = 0; j <= D; j++) {
  const chain = ["H", "M", ...Array.from({ length: D - 1 }, (_, i) => `C${D}_${i}`)]; chain[j] = `V`;           // the victim at hop j
  const h = await bw.add(chain, 500 + 10 * D + j); const n = bw.insert(bw.note(h, 50, `x5-${D}-${j}`));
  const { input } = bw.actionWitness(h, n, 7, `x5-${D}-${j}`); const base = L9.toV9(input, `x5-${D}-${j}`);
  if (j === 0) await row("ctl", `honest chain with V at hop 0, D=${D}`, WASM.v91(D), base, true);
  if (j < D) {   // V is the signer of certificate j
    const set = (x, s) => { x.sig_S[j] = s.S; x.sig_R8x[j] = s.R8x; x.sig_R8y[j] = s.R8y; };
    { const x = clone(base); set(x, { S: "0", R8x: "0", R8y: "1" }); await row("X5a", `D=${D} V at hop ${j}: no signature (S = 0, R8 = O)`, WASM.v91(D), x, false, "EdDSAPoseidonVerifier"); }
    { const x = clone(base); set(x, sigFields(eddsa.signPoseidon(advPrv, F.e(BigInt(h.meta.cert[j]))))); await row("X5a", `D=${D} V at hop ${j}: certificate signed by the adversary's key`, WASM.v91(D), x, false, "EdDSAPoseidonVerifier"); }
    { const other = bw.w.holders.find((g) => g !== h && g.chain.includes("V") && g.chain.indexOf("V") < g.D && g.meta.cert[g.chain.indexOf("V")] !== h.meta.cert[j]);
      if (other) { const k = other.chain.indexOf("V"); const x = clone(base); set(x, { S: other.input.sig_S[k], R8x: other.input.sig_R8x[k], R8y: other.input.sig_R8y[k] });
        await row("X5a", `D=${D} V at hop ${j}: V's real signature replayed from another certificate`, WASM.v91(D), x, false, "EdDSAPoseidonVerifier"); } }
  } else {       // V is the terminal holder: the adversary does not know V's secret
    const x = clone(base); const sk = BigInt("0x" + crypto.randomBytes(31).toString("hex")) % L; x.holder_sk = String(sk); x.budget_nf = String(poseidon3([TAG_BNF, sk, BigInt(noteCm(n))]));
    await row("X5a", `D=${D} V as terminal holder, adversary's secret`, WASM.v91(D), x, false, "ZkDacChainV9 L194");
  }
}
// X5b: paste the public ciphertext words of one of V's actions into the adversary's own (otherwise valid) witness
{ const v = act(4), a = act("b4"); const x = clone(a);
  for (const k of ["acc_c1x", "acc_c1y", "acc_c2x", "acc_c2y", "acc_e", "acc_esign"]) x[k] = clone(v[k]);
  await row("X5b", "D=4 adversary's witness with V's ciphertext words (own r, K kept)", WASM.v91(4), x, false, "AccHybridCompressed");
  const y = clone(a); for (const k of ["acc_r", "acc_kx", "acc_ky", "acc_c1x", "acc_c1y", "acc_c2x", "acc_c2y", "acc_e", "acc_esign"]) y[k] = clone(v[k]);
  await row("X5b", "D=4 adversary's witness with V's whole ciphertext opening (r, K, words)", WASM.v91(4), y, false, "AccHybridCompressed"); }
// extra, not pre-registered (finding F-2): holder_sk = 0 gives ent[D] = identity
{ const bj = eddsa.babyJub; const x = { pt: [String(F.toObject(bj.mulPointEscalar(bj.Base8, 0n)[0])), String(F.toObject(bj.mulPointEscalar(bj.Base8, 0n)[1]))] };
  rows.push({ id: "F-2 (extra)", name: "0·B8 (public key of holder_sk = 0)", expected: "identity (0, 1)", got: x.pt.join(","), pass: x.pt.join() === "0,1" }); }
try { fs.unlinkSync(tmp); } catch {}
const failed = rows.filter((r) => !r.pass);
console.log(JSON.stringify({ total: rows.length, failed: failed.length, rows }, null, 1)); console.error(`${rows.length} rows, ${failed.length} not as expected`); process.exit(0);

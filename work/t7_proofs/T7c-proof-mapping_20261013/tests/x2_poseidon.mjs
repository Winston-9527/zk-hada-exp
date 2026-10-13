// T7c X2 (PLAN.md): Poseidon uses and domain separation (X2a inventory), known-answer agreement circuit / circomlibjs / poseidon-lite (X2b; the Solidity
// side runs in forge: ../../../t4_contracts/foundry/test/T7cPoseidonKat.t.sol), keystream mask distinctness (X2c).
// usage (this directory): node x2_poseidon.mjs > ../results/x2_poseidon.json 2> ../results/x2_poseidon.stderr
import fs from "fs"; import os from "os"; import path from "path"; import crypto from "crypto"; import { createRequire } from "module";
const W = new URL("../../../", import.meta.url).pathname;
const req = createRequire(W + "t2_circuit_fix/zkdac_v7/package.json");
const snarkjs = req("snarkjs"); const { buildPoseidon, buildBabyjub } = req("circomlibjs"); const PL = req("poseidon-lite");
const P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const rnd = () => BigInt("0x" + crypto.randomBytes(32).toString("hex")) % P;
const out = {};

// ---------- X2a: inventory (file:line, read from main 806b485; the grep counts below are checked against the source at run time) ----------
const C = "t2_circuit_fix/zkdac_v9_1/circuits/zkdac_chain_v9.circom", A = "t2_circuit_fix/zkdac_v9_1/circuits/accountability_v9.circom", I = "t2_circuit_fix/zkdac_v7/circuits/imt.circom",
  X = "t2_circuit_fix/zkdac_v8/circuits/budget_transfer.circom", M = "t2_circuit_fix/zkdac_v8/circuits/budget_mint.circom", G = "t4_registration/circuits/register.circom",
  V = "t4_obligations/E7-obligations_20261009/revoke/circuits/revoke_transition.circom";
const uses = [
  { arity: 2, use: "Merkle node: issued tree (fixed depth 16)", inputs: "(left, right)", tag: null, ns: "issued tree", at: [`${C}:52`] },
  { arity: 2, use: "Merkle node: IMT path (depth 20)", inputs: "(left, right)", tag: null, ns: "revocation IMT", at: [`${I}:35`, `${X}:30`, `${V}:24`] },
  { arity: 2, use: "Merkle node: LeanIMT (note tree, registered-root tree, Semaphore group; variable depth)", inputs: "(left, right)", tag: null, ns: "note / root / group trees", at: ["binary-merkle-root.circom:46", "InternalLeanIMT.sol:67,169 (PoseidonT3)"] },
  { arity: 2, use: "Semaphore identity commitment (group-tree leaf)", inputs: "(A.x, A.y), A = s·B8", tag: null, ns: "group tree leaf", at: [`${G}:35`] },
  { arity: 3, use: "key entry (revocation IMT key)", inputs: "(KEY_TAG, A.x, A.y)", tag: "KEY_TAG 2053861995", ns: "revocation set", at: [`${C}:166`, `${X}:75`, `${V}:46`] },
  { arity: 3, use: "budget nullifier", inputs: "(TAG_BNF, sk, cm)", tag: "TAG_BNF 2053857902", ns: "Gate.budgetSpent", at: [`${C}:224`, `${X}:57`] },
  { arity: 3, use: "registration nullifier", inputs: "(TAG_REG, s, domain)", tag: "TAG_REG 2053858418", ns: "Reg.leafOfNullifier", at: [`${G}:46`] },
  { arity: 3, use: "state root", inputs: "(issued_root, revoked_root, root_root)", tag: null, ns: "public input only (Gate.stateOf value)", at: [`${C}:207`, "ZkDacGateV9.sol:118 (PoseidonT4)"] },
  { arity: 3, use: "IMT leaf", inputs: "(value, next_index < 2^20, next_value)", tag: null, ns: "revocation IMT leaf", at: [`${I}:69`, `${X}:25`, `${V}:61`, `${V}:68`] },
  { arity: 3, use: "keystream mask", inputs: "(K.x, K.y, j), j = 0..D+1", tag: null, ns: "not stored (added to ciphertext words)", at: [`${A}:22`, `${A}:27`] },
  { arity: 5, use: "EdDSA-Poseidon challenge (circomlib)", inputs: "(R8.x, R8.y, A.x, A.y, M)", tag: null, ns: "signature", at: ["eddsaposeidon.circom:55"] },
  { arity: 7, use: "certificate hash (hop i)", inputs: "(i, issuer.x, issuer.y, holder.x, holder.y, cap, expiry)", tag: "hop index i (0..D-1) in slot 0", ns: "issued tree, root tree, revocation set, note lineage", at: [`${C}:119`, `${X}:87`, `${G}:52`, `${V}:42`] },
  { arity: 8, use: "budget note commitment", inputs: "(own.x, own.y, q, lin[0..3], rho)", tag: null, ns: "note tree leaf", at: [`${C}:216`, `${C}:228`, `${X}:44,95,98 (Poseidon(4+L), L=4)`, `${M}:9`] },
];
// pairs inside one arity that share a namespace without a constant tag: the only ones whose separation must be argued
const shared = [];
for (let a = 0; a < uses.length; a++) for (let b = a + 1; b < uses.length; b++) { const u = uses[a], v = uses[b];
  if (u.arity !== v.arity) continue; const sameNs = u.ns.split(/[ ,/]+/).some((w) => w.length > 3 && v.ns.includes(w)); const tagged = u.tag && v.tag && u.tag !== v.tag;
  shared.push({ arity: u.arity, a: u.use, b: v.use, separated_by: tagged ? "distinct constant tags" : sameNs ? "NONE (same namespace) -> argue" : "different namespaces (outputs never compared)" }); }
// cross-arity: the revocation set holds H_7 (certificates) and H_3 (key entries)
const crossArity = [{ set: "revocation IMT", members: "H_7 certificate hashes and H_3(KEY_TAG, ·) key entries (both truncated to 252 bits)", separated_by: "different Poseidon widths (t = 8 vs t = 4: different permutations and round constants); a collision across widths is assumed infeasible (Poseidon-CR, multi-width)" },
  { set: "group tree (LeanIMT)", members: "leaf H_2(A) vs internal node H_2(l, r) at private depth", separated_by: "structural: the leaf must be H_2 of a curve point with a known discrete log (RG-1); passing an internal node as a leaf needs (l, r) = s·B8" },
  { set: "note tree / root tree (LeanIMT, private depth)", members: "leaf H_8 / H_7 computed in-circuit vs internal node H_2", separated_by: "different widths: an internal node would have to be an H_8 (H_7) output of opened fields" }];
{ // grep check: number of Poseidon instantiations per file must equal the inventory's count for that file
  const count = (f) => (fs.readFileSync(W + f, "utf8").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n").match(/Poseidon\((?:\d+|4 \+ L)\)/g) ?? []).length;   // code only, comments stripped
  const inv = (f) => uses.flatMap((u) => u.at).filter((s) => s.startsWith(f)).reduce((n, s) => n + s.split(":")[1].split(" ")[0].split(",").length, 0);
  out.X2a = { uses, pairs_same_arity: shared, cross_arity: crossArity, grep_check: [C, A, I, X, M, G, V].map((f) => ({ file: f, poseidon_in_source: count(f), in_inventory: inv(f) })) }; }

// ---------- X2b: known answers ----------
const N = Number(process.env.N ?? 1000); const poseidon = await buildPoseidon(); const Fp = poseidon.F;
const WASM = new URL("../build/kat/poseidon_kat_js/poseidon_kat.wasm", import.meta.url).pathname; const tmp = path.join(os.tmpdir(), `x2-${process.pid}.wtns`);
const wc = await (await import(new URL("../build/kat/poseidon_kat_js/witness_calculator.js", import.meta.url).pathname)).default(fs.readFileSync(WASM));
const plite = { 2: PL.poseidon2, 3: PL.poseidon3, 7: PL.poseidon7, 8: PL.poseidon8 };
const kat = { 2: [], 3: [] }; let agree = { circ_vs_circomlibjs: 0, circomlibjs_vs_lite: 0 }, total = 0;
for (let r = 0; r < N; r++) {
  const inp = { a2: [rnd(), rnd()], a3: [rnd(), rnd(), rnd()], a7: Array.from({ length: 7 }, rnd), a8: Array.from({ length: 8 }, rnd) };
  if (r < 3) { inp.a2 = [0n, 0n]; inp.a3 = [0n, 0n, 0n]; }                                 // include zero inputs
  const w = await wc.calculateWitness(Object.fromEntries(Object.entries(inp).map(([k, v]) => [k, v.map(String)])), true);   // w[1..4] = outputs o2, o3, o7, o8
  for (const [j, n] of [[1, 2], [2, 3], [3, 7], [4, 8]]) { const x = inp["a" + n]; const c = Fp.toObject(poseidon(x)); const l = plite[n](x); total++;
    if (w[j] === c) agree.circ_vs_circomlibjs++; else console.error("FAIL circ", n, r); if (c === l) agree.circomlibjs_vs_lite++; else console.error("FAIL lite", n, r);
    if (n <= 3) kat[n].push([...x.map(String), String(c)]); }
}
fs.writeFileSync(W + "t4_contracts/foundry/test/t7c_poseidon_kat.json", JSON.stringify({ n: N, k2: kat[2].flatMap((r) => r.slice(0, 2)), o2: kat[2].map((r) => r[2]), k3: kat[3].flatMap((r) => r.slice(0, 3)), o3: kat[3].map((r) => r[3]) }));   // flat arrays: one read each in forge
out.X2b = { inputs_per_arity: N, arities: [2, 3, 7, 8], comparisons: total, ...Object.fromEntries(Object.entries(agree).map(([k, v]) => [k, `${v}/${total}`])), solidity: "forge test --match-contract T7cPoseidonKat (results/x2_solidity.txt)" };

// ---------- X2c: keystream masks distinct ----------
{ const bj = await buildBabyjub(); let dup = 0; const D = 4;
  for (let r = 0; r < 1000; r++) { const K = bj.mulPointEscalar(bj.Base8, rnd() % bj.subOrder); const kx = bj.F.toObject(K[0]), ky = bj.F.toObject(K[1]);
    const m = new Set(Array.from({ length: D + 2 }, (_, j) => String(Fp.toObject(poseidon([kx, ky, BigInt(j)]))))); if (m.size !== D + 2) dup++; }
  out.X2c = { fresh_K: 1000, masks_per_K: "D + 2 = 6 (j = 0..5)", K_with_a_repeated_mask: dup }; }
console.log(JSON.stringify(out, (k, v) => (typeof v === "bigint" ? String(v) : v), 1)); console.error("done"); process.exit(0);

// Independent plaintext oracle for v9 (ATTACKS_PREREGISTRATION_v9.md): oracle_v6 rules (with its action-nullifier rule neutralised: v9 has no action
// nullifier) + state root + compressed accountability opening + budget note rules. Poseidon / keccak via poseidon-lite / @noble (independent of the
// generator's circomlibjs); ElGamal decryption and the square root for x recovery via circomlibjs babyJub (shared with the generator; disclosed).
import { oracleV6, worldFromMetaV6 } from "../v6/oracle_v6.mjs";
import { poseidon2, poseidon3, poseidon7, poseidon8 } from "poseidon-lite";
import { buildBabyjub } from "circomlibjs";
const RP = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const B = (x) => BigInt(x); const md = (x) => ((x % RP) + RP) % RP;
const TAG = 1952805748n, TAG_BNF = 2053857902n;
let BJ; async function bj() { return (BJ ??= await buildBabyjub()); }
async function dec(tsk, c1, c2) { const b = await bj(), F = b.F; const s = b.mulPointEscalar([F.e(B(c1[0])), F.e(B(c1[1]))], tsk);
  const m = b.addPoint([F.e(B(c2[0])), F.e(B(c2[1]))], [F.neg(s[0]), s[1]]); return [F.toObject(m[0]), F.toObject(m[1])]; }
// own BigInt Tonelli-Shanks (independent of the generator). circomlibjs' (wasm) F.sqrt does not return on quadratic non-residues: run 1 of this
// oracle hung on a mutated ciphertext word (see RESULTS_v9.md).
const pw = (b, e) => { let r = 1n; b = md(b); while (e > 0n) { if (e & 1n) r = (r * b) % RP; b = (b * b) % RP; e >>= 1n; } return r; };
function sqrtMod(a) { a = md(a); if (a === 0n) return 0n; if (pw(a, (RP - 1n) / 2n) !== 1n) return null;
  let q = RP - 1n, s = 0n; while ((q & 1n) === 0n) { q >>= 1n; s++; } let z = 2n; while (pw(z, (RP - 1n) / 2n) !== RP - 1n) z++;
  let m = s, c = pw(z, q), t = pw(a, q), r = pw(a, (q + 1n) / 2n);
  while (t !== 1n) { let i = 0n, t2 = t; while (t2 !== 1n) { t2 = (t2 * t2) % RP; i++; } const bb = pw(c, 1n << (m - i - 1n)); m = i; c = (bb * bb) % RP; t = (t * c) % RP; r = (r * bb) % RP; }
  return r; }
async function xFromY(y, parity) { const yy = md(B(y) * B(y)); const den = md(168700n - 168696n * yy); if (den === 0n) return null;
  const x2 = md(md(1n - yy) * pw(den, RP - 2n)); const r = sqrtMod(x2); if (r === null) return null; let x = r; if ((x & 1n) !== parity) x = md(-x); return x; }
export async function openCompressed(input, tsk, N) {
  const K = await dec(tsk, [input.acc_c1x, input.acc_c1y], [input.acc_c2x, input.acc_c2y]);
  const bits = md(B(input.acc_esign) - poseidon3([K[0], K[1], B(N)])); if (bits >= 1n << B(N)) return null;
  const out = []; for (let j = 0; j < N; j++) { const y = md(B(input.acc_e[j]) - poseidon3([K[0], K[1], B(j)])); const x = await xFromY(y, (bits >> B(j)) & 1n); if (x === null) return null; out.push([x, y]); }
  return out;
}
const certs = (input, D) => Array.from({ length: D }, (_, i) => poseidon7([B(i), B(input.ent_Ax[i]), B(input.ent_Ay[i]), B(input.ent_Ax[i + 1]), B(input.ent_Ay[i + 1]), B(input.cap[i]), B(input.expiry[i])]));
export async function oracleV9(input, world, D) {
  const fail = (why) => ({ accept: false, why });
  const req = B(input.act_req_cap); const expectedNf = poseidon3([TAG, B(input.holder_sk), poseidon2([B(input.ctx_hash), req])]);
  const base = await oracleV6({ ...input, nullifier: String(expectedNf) }, { ...world, spent: new Set() }, D); if (!base.accept) return base;
  if (B(input.state_root) !== poseidon3([B(input.issued_root), B(input.revoked_root), B(input.root_root)])) return fail("state_root != Poseidon(issued, revoked, root)");
  // accountability (compressed)
  if (B(input.tpk[0]) !== B(world.tpk[0]) || B(input.tpk[1]) !== B(world.tpk[1])) return fail("tpk != committee key");
  const N = D + 1; if (input.acc_e.length !== N) return fail("ciphertext count");
  for (const w of [input.acc_c1x, input.acc_c1y, input.acc_c2x, input.acc_c2y, ...input.acc_e, input.acc_esign]) if (B(w) >= RP) return fail("ciphertext word >= field order");
  let got; try { got = await openCompressed(input, world.tsk, N); } catch (e) { return fail("opening failed: " + String(e.message).slice(0, 40)); }
  if (!got) return fail("opening failed (parity word out of range or y not on the curve)");
  for (let j = 0; j < N; j++) if (got[j][0] !== B(input.ent_Ax[j]) || got[j][1] !== B(input.ent_Ay[j])) return fail(`opening of key ${j} != ent[${j}]`);
  // budget
  const lin = [0, 1, 2, 3].map((j) => (j < D ? certs(input, D)[j] : 0n)); const own = [B(input.ent_Ax[D]), B(input.ent_Ay[D])];
  for (const q of [input.q_in, input.q_spent, input.q_change]) if (B(q) >= 1n << 64n) return fail("budget amount >= 2^64");
  if (B(input.q_in) !== B(input.q_spent) + B(input.q_change)) return fail("q_in != q_spent + q_change");
  const cmIn = poseidon8([own[0], own[1], B(input.q_in), ...lin, B(input.rho_in)]);
  if (!world.note_roots.has(B(input.note_root))) return fail("note_root is not a current note root");
  // run 1 checked "cm_in is a note of the world" and "note_root is current" separately (A20e gaps); membership must be IN the tree with that root
  const inTree = world.notesByRoot ? world.notesByRoot.get(B(input.note_root)) : world.notes;
  if (!inTree || !inTree.has(cmIn)) return fail("input note (owner ent[D], lineage = this chain) is not in the note tree with root note_root");
  if (B(input.budget_nf) !== poseidon3([TAG_BNF, B(input.holder_sk), cmIn])) return fail("budget_nf != H(TAG_BNF, holder secret, cm_in)");
  if (world.budgetSpent?.has(B(input.budget_nf))) return fail("budget nullifier already spent");
  if (B(input.cm_change) !== poseidon8([own[0], own[1], B(input.q_change), ...lin, B(input.rho_change)])) return fail("change note != (ent[D], q_change, same lineage)");
  if (B(input.q_spent) !== B(world.action.amount)) return fail("q_spent != amount of the executed action");
  return { accept: true, why: "all checks passed; opening = ent[0..D]; budget conserved" };
}
export function worldFromMetaV9(meta, extra = {}) {
  const notes = new Set(meta.noteTree.leaves.map(BigInt));
  return { ...worldFromMetaV6(meta), tsk: meta.tsk, tpk: meta.tpk.map(BigInt), notes, note_roots: new Set([B(meta.noteTree.root)]), notesByRoot: new Map([[B(meta.noteTree.root), notes]]), budgetSpent: new Set(), ...extra };
}

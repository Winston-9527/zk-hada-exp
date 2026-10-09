// Independent plaintext oracle for v7 (= oracle_v6 + R6 accountability, #30): tpk must be the committee key, and decrypting the PUBLIC ciphertexts
// with the committee secret must give exactly ent[0..D] in order. Mode A: per-key ElGamal; mode C: ElGamal-encapsulated K + Poseidon keystream
// (keystream via poseidon-lite, independent of circomlibjs; ElGamal decryption via circomlibjs babyJub, shared with the generator).
import { oracleV6, worldFromMetaV6 } from "../v6/oracle_v6.mjs";
import { poseidon3 } from "poseidon-lite";
import { buildBabyjub } from "circomlibjs";
const RP = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const B = (x) => BigInt(x); const md = (x) => ((x % RP) + RP) % RP;
let BJ; async function bj() { return (BJ ??= await buildBabyjub()); }
async function dec(tsk, c1, c2) {
  const b = await bj(), F = b.F;
  const s = b.mulPointEscalar([F.e(B(c1[0])), F.e(B(c1[1]))], tsk);
  const m = b.addPoint([F.e(B(c2[0])), F.e(B(c2[1]))], [F.neg(s[0]), s[1]]);
  return [F.toObject(m[0]), F.toObject(m[1])];
}
export async function openChain(input, world, mode, N) {
  if (mode === "A") { const out = []; for (let j = 0; j < N; j++) out.push(await dec(world.tsk, [input.acc_c1x[j], input.acc_c1y[j]], [input.acc_c2x[j], input.acc_c2y[j]])); return out; }
  const K = await dec(world.tsk, [input.acc_c1x[0], input.acc_c1y[0]], [input.acc_c2x[0], input.acc_c2y[0]]);
  return Array.from({ length: N }, (_, j) => [0, 1].map((b) => md(B(input.acc_e[j][b]) - poseidon3([K[0], K[1], BigInt(2 * j + b)]))));
}
export async function oracleV7(input, world, D, mode) {
  const base = await oracleV6(input, world, D); if (!base.accept) return base;
  if (B(input.tpk[0]) !== B(world.tpk[0]) || B(input.tpk[1]) !== B(world.tpk[1])) return { accept: false, why: "tpk != committee key" };
  const N = D + 1; const want = input.ent_Ax.map((x, i) => [B(x), B(input.ent_Ay[i])]);
  if (mode === "A" && [input.acc_c1x, input.acc_c1y, input.acc_c2x, input.acc_c2y].some((a) => a.length !== N)) return { accept: false, why: "ciphertext count" };
  if (mode === "C" && input.acc_e.length !== N) return { accept: false, why: "ciphertext count" };
  for (const w of [...input.acc_c1x, ...input.acc_c1y, ...input.acc_c2x, ...input.acc_c2y, ...(mode === "C" ? input.acc_e.flat() : [])]) if (B(w) >= RP) return { accept: false, why: "ciphertext word >= field order" };
  let got; try { got = await openChain(input, world, mode, N); } catch (e) { return { accept: false, why: "opening failed: " + String(e.message).slice(0, 40) }; }
  for (let j = 0; j < N; j++) if (got[j][0] !== want[j][0] || got[j][1] !== want[j][1]) return { accept: false, why: `opening of ciphertext ${j} != ent[${j}]` };
  return { accept: true, why: "all checks passed; opening = ent[0..D]" };
}
export function worldFromMetaV7(meta, extra = {}) { return { ...worldFromMetaV6(meta), tsk: meta.tsk, tpk: meta.tpk.map(BigInt), ...extra }; }

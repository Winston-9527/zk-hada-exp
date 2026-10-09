// Witness builder for circuits/note_transfer.circom (H3 pre-study). Poseidon = poseidon-lite (= circomlib), LeanIMT note tree (zk-kit),
// revocation IMT = the generators' indexed Merkle tree (zkdac_v4/scripts/imt.mjs).
import { createRequire } from "module"; import fs from "fs"; import os from "os"; import path from "path"; import crypto from "crypto";
const v7 = new URL("../../t2_circuit_fix/zkdac_v7/", import.meta.url).pathname; const req = createRequire(v7 + "package.json");
export const snarkjs = req("snarkjs");
const { poseidon2, poseidon3, poseidon6, poseidon8 } = req("poseidon-lite"); const { LeanIMT } = req("@zk-kit/lean-imt"); const { buildBabyjub } = req("circomlibjs");
const { IMT, trunc } = await import(v7 + "../zkdac_v4/scripts/imt.mjs");
export { IMT, trunc, poseidon3 };
const bj = await buildBabyjub(); const L_ORDER = bj.subOrder;
export const L = 4, RD = 20, NT = 20, TAG_NF = 1853189228n, TAG_EDGE = 1701078885n, KEY_TAG = 2053861995n;
export const WASM = new URL("build/note_transfer_js/note_transfer.wasm", import.meta.url).pathname;
export function key(label) { const sk = BigInt("0x" + crypto.createHash("sha256").update("h3-key-" + label).digest("hex")) % L_ORDER; const P = bj.mulPointEscalar(bj.Base8, sk); return { sk, pk: [bj.F.toObject(P[0]), bj.F.toObject(P[1])] }; }
export const cm = (n) => poseidon8([n.own[0], n.own[1], n.q, ...n.lin, n.rho]);
export const edgeId = (parent, child, rho1) => poseidon6([TAG_EDGE, parent[0], parent[1], child[0], child[1], rho1]);
export const keyEntry = (pk) => poseidon3([KEY_TAG, pk[0], pk[1]]);
export const rho = (label) => BigInt("0x" + crypto.createHash("sha256").update("h3-rho-" + label).digest("hex")) % (1n << 250n);
export class World { static async create() { const w = new World(); w.notes = new LeanIMT((a, b) => poseidon2([a, b])); w.rev = await IMT.create(RD); for (let k = 0; k < 10; k++) w.rev.insert(rho("decoy" + k)); return w; }
  add(n) { this.notes.insert(cm(n)); return n; } }
// transfer witness: input note n (owner key k), out1 {own, q, rho} (delegate flag), out2 {q, rho}, q_spent, ctx
export function transfer(w, n, k, { q_spent = 0n, q1, rho1, child = null, q2, rho2, ctx = 7n }) {
  const delegate = child ? 1n : 0n; const o1own = child ?? n.own;
  const firstFree = n.lin.findIndex((x) => x === 0n);
  const lin1 = [...n.lin]; if (delegate) lin1[firstFree] = edgeId(n.own, child, rho1);
  const out1 = { own: o1own, q: q1, lin: lin1, rho: rho1 }, out2 = { own: n.own, q: q2, lin: [...n.lin], rho: rho2 };
  const idx = w.notes.indexOf(cm(n)); const p = w.notes.generateProof(idx); const sib = p.siblings.map(String); while (sib.length < NT) sib.push("0");
  const zero = { low_value: "0", low_next_index: "0", low_next_value: "0", sib: Array(RD).fill("0"), bit: Array(RD).fill("0") };
  const nm = n.lin.map((e) => (e === 0n ? zero : w.rev.nonMemberWitness(e))); const km = w.rev.nonMemberWitness(keyEntry(n.own));
  const input = { note_root: String(w.notes.root), revoked_root: String(w.rev.root), nullifier: String(poseidon3([TAG_NF, k.sk, cm(n)])), cm_out1: String(cm(out1)), cm_out2: String(cm(out2)),
    q_spent: String(q_spent), ctx_hash: String(ctx), own: n.own.map(String), q_in: String(n.q), lin: n.lin.map(String), rho_in: String(n.rho), sk: String(k.sk),
    nt_depth: String(p.siblings.length), nt_index: String(p.index), nt_sib: sib,
    r_low_value: nm.map((x) => x.low_value), r_low_next_index: nm.map((x) => x.low_next_index), r_low_next_value: nm.map((x) => x.low_next_value), r_sib: nm.map((x) => x.sib), r_bit: nm.map((x) => x.bit),
    k_low_value: km.low_value, k_low_next_index: km.low_next_index, k_low_next_value: km.low_next_value, k_sib: km.sib, k_bit: km.bit,
    o1: o1own.map(String), q1: String(q1), rho1: String(rho1), delegate: String(delegate), q2: String(q2), rho2: String(rho2) };
  return { input, out1, out2 };
}
const tmp = path.join(os.tmpdir(), `note-${process.pid}.wtns`);
export async function satisfiable(input) { try { await snarkjs.wtns.calculate(input, WASM, tmp); return true; } catch { return false; } finally { try { fs.unlinkSync(tmp); } catch {} } }

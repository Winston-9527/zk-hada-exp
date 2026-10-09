// E6 (#6, #30): threshold opening of v7 R6 accountability ciphertexts without reconstructing the committee secret.
// Trusted dealer + Feldman VSS over the BabyJub prime-order subgroup <Base8>; each member releases a partial decryption D_i = s_i·c1 with a
// Chaum–Pedersen DLEQ proof bound to (epoch, event, member); the combiner interpolates IN THE GROUP (Σ λ_i D_i = tsk·c1) and never sees s_i.
// Points are [x, y] with canonical BigInt coordinates. Not constant-time (circomlibjs double-and-add): research prototype only.
import { createRequire } from "module";
import crypto from "crypto";
const req = createRequire(new URL("../../t2_circuit_fix/zkdac_v7/package.json", import.meta.url));
const { buildBabyjub } = req("circomlibjs");
const { poseidon3 } = req("poseidon-lite");          // keystream recomputed independently of the generator (which uses circomlibjs Poseidon)

export const bj = await buildBabyjub();
const F = bj.F;
export const L = bj.subOrder;                         // prime subgroup order l ≈ 2^250.6
export const P_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const mod = (a, m = L) => ((a % m) + m) % m;
const toF = (P) => [F.e(P[0]), F.e(P[1])];
const fromF = (P) => [F.toObject(P[0]), F.toObject(P[1])];
export const ID = [0n, 1n];
export const G = fromF(bj.Base8);
export const add = (P, Q) => fromF(bj.addPoint(toF(P), toF(Q)));
export const neg = (P) => [mod(-P[0], P_FIELD), P[1]];
export const mul = (P, k) => fromF(bj.mulPointEscalar(toF(P), mod(k)));
export const mulRaw = (P, k) => fromF(bj.mulPointEscalar(toF(P), k));     // no reduction mod l (needed to build small-order points)
export const eq = (P, Q) => P[0] === Q[0] && P[1] === Q[1];
export const onCurve = (P) => { try { return bj.inCurve(toF(P)); } catch { return false; } };
export const inSubgroup = (P) => onCurve(P) && eq(mulRaw(P, L), ID);
// valid group element for opening: on-curve, in the prime-order subgroup, not the identity
export const validPoint = (P) => Array.isArray(P) && P.length === 2 && P.every((c) => typeof c === "bigint" && c >= 0n && c < P_FIELD) && inSubgroup(P) && !eq(P, ID);

export const randScalar = () => mod(BigInt("0x" + crypto.randomBytes(64).toString("hex")));     // 512 bits mod l: bias ≈ 2^-261
const seededScalar = (tag) => mod(BigInt("0x" + crypto.createHash("sha512").update(tag).digest("hex")));
const ptStr = (P) => `${P[0]},${P[1]}`;
// Fiat–Shamir challenge (SHA-512 mod l), domain-separated and bound to epoch, event id, member index and every group element
export function challenge(epoch, ev, i, Y, c1, D, A1, A2) {
  const s = ["zkdac-e6-dleq-v1", epoch, ev, i, ptStr(Y), ptStr(c1), ptStr(D), ptStr(A1), ptStr(A2)].join("|");
  return mod(BigInt("0x" + crypto.createHash("sha512").update(s).digest("hex")));
}

// ---------------- dealer (trusted; knows tsk = a_0) ----------------
export function deal({ t, n, epoch, seed }) {
  const a = Array.from({ length: t }, (_, k) => seededScalar(`e6-dealer|${seed}|${epoch}|${k}`));
  const f = (x) => a.reduce((acc, ak, k) => mod(acc + ak * (BigInt(x) ** BigInt(k))), 0n);
  const commitments = a.map((ak) => mul(G, ak));                       // Feldman A_k
  const members = Array.from({ length: n }, (_, j) => ({ i: j + 1, epoch, s: f(j + 1) }));
  const pub = { t, n, epoch, commitments, tpk: commitments[0], Y: members.map((m) => mul(G, m.s)) };
  return { pub, members, _tsk: a[0] };                                // _tsk is never passed to opening code (O16)
}
// member-side Feldman check: s_i·G == Σ_k i^k A_k
export function feldmanCheck(pub, member) {
  let rhs = ID; for (let k = 0; k < pub.commitments.length; k++) rhs = add(rhs, mul(pub.commitments[k], BigInt(member.i) ** BigInt(k)));
  return eq(mul(G, member.s), rhs) && eq(rhs, pub.Y[member.i - 1]);
}
// deployment check for the gate's TPK (T3 A19i): prime-order subgroup point, not identity, equal to the committed A_0
export function checkTpk(tpk, pub) { return validPoint(tpk) && (pub ? eq(tpk, pub.commitments[0]) : true); }

// ---------------- DLEQ (Chaum–Pedersen) ----------------
export function dleqProve(epoch, ev, i, s, Y, c1, D) {
  const w = randScalar(); const A1 = mul(G, w), A2 = mul(c1, w);
  const ch = challenge(epoch, ev, i, Y, c1, D, A1, A2);
  return { A1, A2, z: mod(w + ch * s) };
}
export function dleqVerify(epoch, ev, i, Y, c1, D, pf) {
  if (!pf || !validPoint(pf.A1) || !onCurve(pf.A2) || !inSubgroup(pf.A2)) return false;
  if (typeof pf.z !== "bigint" || pf.z < 0n || pf.z >= L) return false;
  const ch = challenge(epoch, ev, i, Y, c1, D, pf.A1, pf.A2);
  return eq(mul(G, pf.z), add(pf.A1, mul(Y, ch))) && eq(mul(c1, pf.z), add(pf.A2, mul(D, ch)));
}

// ---------------- member: release a share for one ciphertext ----------------
// ctx = { epoch, ev, tpk, c1s } from a VERIFIED action (caller verifies the Groth16 proof first; see open.mjs). Returns null = refuse.
export function memberShare(pub, member, ctx) {
  if (ctx.epoch !== member.epoch || ctx.epoch !== pub.epoch) return { refuse: "EPOCH_MISMATCH" };
  if (!eq(ctx.tpk, pub.tpk)) return { refuse: "TPK_MISMATCH" };
  const out = [];
  for (const c1 of ctx.c1s) {
    if (!validPoint(c1)) return { refuse: "INVALID_C1" };
    const D = mul(c1, member.s);
    out.push({ D, pf: dleqProve(ctx.epoch, ctx.ev, member.i, member.s, pub.Y[member.i - 1], c1, D) });
  }
  return { i: member.i, epoch: ctx.epoch, ev: ctx.ev, parts: out };
}

// ---------------- combiner: never receives s_i ----------------
export function lagrangeAt0(idx) {
  return idx.map((i) => idx.reduce((acc, j) => (j === i ? acc : mod(acc * BigInt(j) * inv(mod(BigInt(j) - BigInt(i))))), 1n));
}
function inv(a) { let [r0, r1, s0, s1] = [L, mod(a), 0n, 1n]; while (r1 !== 0n) { const q = r0 / r1; [r0, r1] = [r1, r0 - q * r1]; [s0, s1] = [s1, s0 - q * s1]; } if (r0 !== 1n) throw new Error("no inverse"); return mod(s0); }
// Validates every submitted share, blames invalid ones, interpolates in the group. Returns { status, S[] (= tsk·c1 per ciphertext), used, blame }.
// opts.skipEpochCheck / opts.forceWith: only for negative controls (O3 forced, O10 naive combiner).
export function combine(pub, ctx, shares, opts = {}) {
  const blame = [], valid = new Map(), seen = new Map();
  for (const sh of shares) { seen.set(sh?.i, (seen.get(sh?.i) ?? 0) + 1); }
  for (const sh of shares) {
    const why = (() => {
      if (!sh || !Number.isInteger(sh.i) || sh.i < 1 || sh.i > pub.n) return "BAD_INDEX";
      if (seen.get(sh.i) > 1) return "DUPLICATE_INDEX";
      if (!opts.skipEpochCheck && (sh.epoch !== ctx.epoch || sh.epoch !== pub.epoch)) return "EPOCH_MISMATCH";
      if (sh.ev !== ctx.ev) return "EVENT_MISMATCH";
      if (!Array.isArray(sh.parts) || sh.parts.length !== ctx.c1s.length) return "BAD_ARITY";
      for (let j = 0; j < ctx.c1s.length; j++) {
        const { D, pf } = sh.parts[j];
        if (!validPoint(D)) return "INVALID_D";
        if (!dleqVerify(sh.epoch, ctx.ev, sh.i, pub.Y[sh.i - 1], ctx.c1s[j], D, pf)) return "DLEQ_FAIL";
      }
      return null;
    })();
    if (why) blame.push({ i: sh?.i, why }); else valid.set(sh.i, sh);
  }
  let idx = [...valid.keys()].sort((a, b) => a - b);
  if (opts.forceWith) idx = opts.forceWith;
  else if (idx.length < pub.t) return { status: "INSUFFICIENT", valid: idx, blame };
  else idx = idx.slice(0, pub.t);
  const lam = lagrangeAt0(idx);
  const S = ctx.c1s.map((_, j) => idx.reduce((acc, i, k) => add(acc, mul(valid.get(i).parts[j].D, lam[k])), ID));
  return { status: "OK", S, used: idx, valid: [...valid.keys()].sort((a, b) => a - b), blame };
}

// ---------------- v7 public-signal layout and decryption ----------------
// public signals: 7 v6 inputs, tpk[2], then mode C: c1x, c1y, c2x, c2y, e[N][2]; mode A: c1x[N], c1y[N], c2x[N], c2y[N]
export function parseCt(publicSignals, mode, D) {
  const ps = publicSignals.map(BigInt), N = D + 1, tpk = [ps[7], ps[8]], o = 9;
  if (mode === "C") return { tpk, c1s: [[ps[o], ps[o + 1]]], c2s: [[ps[o + 2], ps[o + 3]]], e: Array.from({ length: N }, (_, j) => [ps[o + 4 + 2 * j], ps[o + 5 + 2 * j]]) };
  const c1x = ps.slice(o, o + N), c1y = ps.slice(o + N, o + 2 * N), c2x = ps.slice(o + 2 * N, o + 3 * N), c2y = ps.slice(o + 3 * N, o + 4 * N);
  return { tpk, c1s: c1x.map((x, j) => [x, c1y[j]]), c2s: c2x.map((x, j) => [x, c2y[j]]) };
}
export const eventId = (publicSignals) => crypto.createHash("sha256").update("zkdac-e6-ev-v1|" + publicSignals.join(",")).digest("hex");
// from S_j = tsk·c1_j: mode C -> K = c2 − S, keystream; mode A -> P_j = c2_j − S_j
export function decryptWith(ct, S, mode) {
  if (mode === "A") return ct.c2s.map((c2, j) => add(c2, neg(S[j])));
  const K = add(ct.c2s[0], neg(S[0]));
  return ct.e.map((e, j) => [0, 1].map((b) => mod(e[b] - poseidon3([K[0], K[1], BigInt(2 * j + b)]), P_FIELD)));
}
// recovered keys must be valid subgroup points (consistency check on the opening output)
export const consistent = (pts) => pts.every((p) => onCurve(p) && inSubgroup(p));

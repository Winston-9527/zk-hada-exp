// E6c front end for v9.1 (PREREGISTRATION.md): public-signal layout, event id, member/combiner flow and compressed decryption. The threshold
// library (dealer, Feldman, DLEQ, combine) is E6's threshold.mjs, imported unchanged.
// v9.1 public signals: state_root, now, ctx_hash, act_req_cap, tpk[2], c1[2], c2[2], e[D+1], esign, note_root, budget_nf, cm_change, q_spent
import fs from "fs"; import { createRequire } from "module";
export const T = await import("../E6-threshold-opening_20261009/threshold.mjs");
const V91 = new URL("../../t2_circuit_fix/zkdac_v9_1/", import.meta.url).pathname, V9 = new URL("../../t2_circuit_fix/zkdac_v9/", import.meta.url).pathname;
export const snarkjs = createRequire(V91 + "package.json")("snarkjs");
const L9 = await import(V91 + "scripts/lib_v9.mjs");
const vks = {}; export const vk = (D, ver = "v91") => (vks[ver + D] ??= JSON.parse(fs.readFileSync(`${ver === "v91" ? V91 : V9}zk/vk_c${D}.json`)));
export const IDX = (D) => ({ tpk: 4, c1x: 6, c1y: 7, c2x: 8, c2y: 9, e0: 10, eD: 10 + D, esign: 11 + D, len: D + 16 });
export function parseCt(publicSignals, D) {
  const ps = publicSignals.map(BigInt), I = IDX(D); if (ps.length !== I.len) throw new Error(`layout: ${ps.length} public signals for D=${D}`);
  return { tpk: [ps[4], ps[5]], c1s: [[ps[6], ps[7]]], c2: [ps[8], ps[9]], e: ps.slice(10, 11 + D), esign: ps[11 + D] };
}
export const eventId = T.eventId;                                                       // SHA-256("zkdac-e6-ev-v1|" + public signals)
// decryption from S = tsk·c1 (combined in the group): K = c2 − S, Poseidon keystream, parity word (lib_v9.openWithS)
export function decrypt(ct, S) { const r = L9.openWithS({ c1: ct.c1s[0].map(String), c2: ct.c2.map(String), e: ct.e.map(String), esign: String(ct.esign) }, S.map(String)); return r; }
export const truth = (f, pts) => Array.isArray(pts) && pts.length === f.ents.length && pts.every((p, j) => p && String(p[0]) === String(f.ents[j][0]) && String(p[1]) === String(f.ents[j][1]));
export const wrongAt = (f, pts) => (Array.isArray(pts) ? pts.map((p, j) => !(p && String(p[0]) === String(f.ents[j][0]) && String(p[1]) === String(f.ents[j][1]))) : null);
// the action as an auditor sees it: verify the Groth16 proof, then derive the epoch from the TPK in the public signals
export async function present(f, epochs, publicSignals = f.publicSignals, { checkProof = true, ver = "v91" } = {}) {
  if (checkProof && !(await snarkjs.groth16.verify(vk(f.D, ver), publicSignals, f.proof))) return { refuse: "PROOF_INVALID" };
  let ct; try { ct = parseCt(publicSignals, f.D); } catch (e) { return { refuse: "LAYOUT" }; }
  const ep = epochs.find((E) => T.eq(E.pub.tpk, ct.tpk)); if (!ep) return { refuse: "UNKNOWN_TPK" };
  return { ct, ep, ctx: { epoch: ep.pub.epoch, ev: eventId(publicSignals), tpk: ct.tpk, c1s: ct.c1s } };
}
export const share = (E, i, ctx) => T.memberShare(E.pub, E.members[i - 1], ctx);
export function openWith(a, shares, opts) { const r = T.combine(a.ep.pub, a.ctx, shares, opts); return r.status === "OK" ? { ...r, pts: decrypt(a.ct, r.S[0]) } : r; }
// committees: (3, 5) uses E6's dealer seed so E7c's gate ciphertexts (encrypted to E6's epoch-1 TPK) can be opened (O20)
export const COMMITTEES = [{ t: 2, n: 3, seed: "e6c-2of3" }, { t: 3, n: 5, seed: "e6-20261009" }, { t: 5, n: 9, seed: "e6c-5of9" }];
export const dealC = (c, epoch) => T.deal({ t: c.t, n: c.n, epoch, seed: c.seed });
export const fxFile = (c, epoch) => new URL(`results/fixtures_t${c.t}n${c.n}_e${epoch}.json`, import.meta.url).pathname;

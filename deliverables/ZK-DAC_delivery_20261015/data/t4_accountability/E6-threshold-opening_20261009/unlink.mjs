// E6 U1/U2 (PREREGISTRATION.md): linkage of the public accountability ciphertexts across actions (mode C, D = 4). Empirical only, not a proof.
// usage: node unlink.mjs > results/unlink.json. Ciphertexts are produced by the v7 generator's encryptChain (the same values the circuit constrains);
// proofs are not needed (Groth16 proofs are zero-knowledge; the question is whether the ciphertext words themselves link actions).
import crypto from "crypto"; import * as T from "./threshold.mjs";
const v7 = new URL("../../t2_circuit_fix/zkdac_v7/", import.meta.url).pathname;
const { buildInstanceV7, encryptChain } = await import(v7 + "scripts/lib_v7.mjs");
const { pub } = T.deal({ t: 3, n: 5, epoch: 1, seed: "e6-20261009" });
const CHAINS = 20, ACTIONS = 10, D = 4;
const words = (inp) => [inp.acc_c1x[0], inp.acc_c1y[0], inp.acc_c2x[0], inp.acc_c2y[0], ...inp.acc_e.flat()].map(BigInt);
async function corpus(deterministic) {
  const out = [];
  for (let c = 0; c < CHAINS; c++) {
    const { input, meta } = await buildInstanceV7({ D, seed: 7000 + c, mode: "C" });
    for (let k = 0; k < ACTIONS; k++) {
      const inp = { ...input }; await encryptChain(inp, meta.accEnts, pub.tpk, "C", deterministic ? `${D}-${7000 + c}-C` : crypto.randomBytes(32).toString("hex"));
      out.push({ chain: c, w: words(inp) });
    }
  }
  return out;
}
const PF = T.P_FIELD, m = (x) => ((x % PF) + PF) % PF;
function u1(cs) {
  const dupWords = (() => { const seen = new Map(); let d = 0; cs.forEach((a, ai) => a.w.forEach((x) => { if (seen.has(x) && seen.get(x) !== ai) d++; seen.set(x, ai); })); return d; })();
  const dupDiffs = (() => { const seen = new Map(); let d = 0; cs.forEach((a, ai) => { const e = a.w.slice(4); for (let j = 0; j < e.length; j++) for (let k = j + 1; k < e.length; k++) { const key = `${j},${k},${m(e[j] - e[k])}`; if (seen.has(key) && seen.get(key) !== ai) d++; seen.set(key, ai); } }); return d; })();
  const identicalActions = (() => { const s = new Set(cs.map((a) => a.w.join())); return cs.length - s.size; })();
  return { actions: cs.length, words_per_action: cs[0].w.length, equal_word_across_actions: dupWords, equal_within_action_difference_across_actions: dupDiffs, identical_actions: identicalActions };
}
const MASK = (1n << 64n) - 1n, pop = (x) => { let c = 0; while (x) { x &= x - 1n; c++; } return c; };
const dist = (a, b) => a.w.reduce((s, x, j) => s + pop((x & MASK) ^ (b.w[j] & MASK)), 0);
function auc(same, diff) { let s = 0; for (const x of same) for (const y of diff) s += x < y ? 1 : x === y ? 0.5 : 0; return s / (same.length * diff.length); }
function rng(seed) { let x = BigInt("0x" + crypto.createHash("sha256").update(seed).digest("hex").slice(0, 15)); return () => { x = (x * 6364136223846793005n + 1442695040888963407n) & ((1n << 63n) - 1n); return Number(x >> 20n) / 2 ** 43; }; }
function u2(cs, label) {
  const same = [], diff = []; const r = rng("e6-u2-" + label);
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) if (cs[i].chain === cs[j].chain) same.push(dist(cs[i], cs[j]));
  while (diff.length < same.length) { const i = Math.floor(r() * cs.length), j = Math.floor(r() * cs.length); if (cs[i].chain !== cs[j].chain) diff.push(dist(cs[i], cs[j])); }
  const A = auc(same, diff), bs = [];
  for (let b = 0; b < 1000; b++) { const pick = (xs) => xs.map(() => xs[Math.floor(r() * xs.length)]); bs.push(auc(pick(same), pick(diff))); }
  bs.sort((x, y) => x - y);
  return { same_chain_pairs: same.length, diff_chain_pairs: diff.length, feature: "sum over 14 words of Hamming distance of the low 64 bits (smaller => predicted same chain)", auc: +A.toFixed(4), ci95: [+bs[25].toFixed(4), +bs[974].toFixed(4)], mean_dist_same: +(same.reduce((s, x) => s + x, 0) / same.length).toFixed(2), mean_dist_diff: +(diff.reduce((s, x) => s + x, 0) / diff.length).toFixed(2) };
}
const fresh = await corpus(false), det = await corpus(true);
const res = { date: new Date().toISOString(), chains: CHAINS, actions_per_chain: ACTIONS, D, mode: "C",
  U1_fresh: u1(fresh), U1_neg_deterministic_accSeed: u1(det), U2_fresh: u2(fresh, "fresh"), U2_neg_deterministic_accSeed: u2(det, "det"),
  note: "bootstrap resamples pairs, which share actions (not independent); CI is indicative. AUC ~ 0.5 is evidence of no gross linkage for this feature only, not IND-CPA." };
console.log(JSON.stringify(res, null, 1)); process.exit(0);

// E3.4 observation leakage of revocation entries (PREREGISTRATION.md L1–L3; L4/L5 come from e32_e33). usage: node e34_leakage.mjs > results/e34_leakage.json
// World W with three revocations applied (cert M→S2, cert S2→S21, key S3) plus the 20 decoys.
import { createRequire } from "module";
import * as W from "./world.mjs";
const v7 = new URL("../../t2_circuit_fix/zkdac_v7/", import.meta.url).pathname;
const { poseidon7 } = createRequire(v7 + "package.json")("poseidon-lite");
const chains = [["H", "M"]];
for (let a = 1; a <= 4; a++) { chains.push(["H", "M", `S${a}`]); for (let b = 1; b <= 3; b++) { chains.push(["H", "M", `S${a}`, `S${a}${b}`]); for (let c = 1; c <= 2; c++) chains.push(["H", "M", `S${a}`, `S${a}${b}`, `S${a}${b}${c}`]); } }
chains.push(["H'", "M'"], ["H'", "M'", "T1"], ["H'", "M'", "T2"], ["H", "M", "S1", "X"], ["H", "M", "S4", "X"]);
const w = await W.World.create(20); for (const c of chains) await w.add(c);
const certOf = (path) => BigInt(w.certOf(path, path.length - 2));
const revoked = { "cert M>S2": certOf(["H", "M", "S2"]), "cert S2>S21": certOf(["H", "M", "S2", "S21"]), "key S3": BigInt(w.keyEntry("S3")) };
// public signals of every holder's action, taken BEFORE the revocations (actions that happened and were observed)
const PUB = ["issued_root", "revoked_root", "root_root", "nullifier", "now", "ctx_hash", "act_req_cap"];
const publicOf = (inp) => [...PUB.map((k) => inp[k]), ...inp.tpk, ...inp.acc_c1x, ...inp.acc_c1y, ...inp.acc_c2x, ...inp.acc_c2y, ...inp.acc_e.flat()].map(BigInt);
const pubs = w.holders.map((h) => ({ chain: h.chain, sig: publicOf(w.witness(h)) }));
for (const v of Object.values(revoked)) w.imt.insert(v);
const entries = w.imt.leaves.slice(1).map((l) => l.value);           // what the operator publishes (truncated 252-bit values)
const out = { date: new Date().toISOString() };

// L1: public observer
{ const S = new Set(pubs.flatMap((p) => p.sig.flatMap((x) => [x, W.trunc(x)])));
  out.L1 = { actions: pubs.length, public_words: pubs.reduce((a, p) => a + p.sig.length, 0), revocation_entries: entries.length, exact_or_truncated_matches: entries.filter((e) => S.has(e)).length }; }

// L2: auditor who opened the actions of some holders (knows ent[0..D] of those chains), tests key entries H("zkrk", A)
{ const opened = ["H>M>S3>S31>S311", "H>M>S1>S11>S111", "H'>M'>T1"]; const known = new Map();
  for (const h of w.holders.filter((x) => opened.includes(x.chain.join(">")))) h.chain.forEach((n, j) => known.set(n, W.keyHash(h.meta, { Ax: h.input.ent_Ax[j], Ay: h.input.ent_Ay[j] })));
  const E = new Set(entries); const linked = [...known].filter(([, kh]) => E.has(W.trunc(kh))).map(([n]) => n);
  out.L2 = { opened_chains: opened, keys_known: known.size, revoked_key_entries_linked: linked, note: "the auditor learns that key S3, seen in an opened action, is revoked; nothing about cert entries without cap/expiry (L3)" }; }

// L3: brute force of a certificate entry by someone who knows both keys of edge S2->S21 (hop 2): search cap ⊆ parent cap 0x3F and expiry in [now, now + 9000]
{ const h = w.holders.find((x) => x.chain.join(">") === "H>M>S2>S21"); const i = 2; const [ax, ay, bx, by] = [h.input.ent_Ax[i], h.input.ent_Ay[i], h.input.ent_Ax[i + 1], h.input.ent_Ay[i + 1]].map(BigInt);
  const target = W.trunc(revoked["cert S2>S21"]); const t0 = performance.now(); let tried = 0, found = null;
  outer: for (let cap = 0; cap <= 0x3F; cap++) { if ((cap & ~0x3F) !== 0) continue; for (let e = 1000; e <= 10000; e++) { tried++; if (W.trunc(poseidon7([BigInt(i), ax, ay, bx, by, BigInt(cap), BigInt(e)])) === target) { found = { cap, expiry: e }; break outer; } } }
  const ms = performance.now() - t0, rate = tried / (ms / 1000);
  const space = (capBits, expiries) => 2 ** capBits * expiries;
  const yrs = (n) => n / rate / 3.156e7;
  out.L3 = { demo: { edge: "S2->S21 (hop 2)", prior: "cap ⊆ 0x3F (64 values), expiry ∈ [1000, 10000]", hashes_tried: tried, found, ms: +ms.toFixed(0), poseidon7_per_s_single_thread_js: Math.round(rate) },
    cost_single_thread_years: { "cap 32 bits unknown, expiry to the second within 1 year": yrs(space(32, 3.156e7)), "cap 32 bits unknown, expiry to the day within 1 year": yrs(space(32, 365)),
      "cap ⊆ known 8-bit parent cap, expiry to the second within 1 year": yrs(space(8, 3.156e7)), "cap ⊆ known 8-bit parent cap, expiry to the hour within 1 year": yrs(space(8, 8766)) },
    note: "certificate entries carry no salt: anyone who knows both keys of an edge and has a narrow prior on (cap, expiry) can recognise its revocation" }; }
console.log(JSON.stringify(out, null, 1)); process.exit(0);

// E3.1 (PREREGISTRATION.md): revocation scenarios R0–R7 on world W, adversarial witnesses A1–A6, ablation L (leaf-only revocation check).
// usage: node e31_world.mjs > results/e31_world.json. Expected outcomes come from node-name semantics (oracle), not from hashes.
import { createRequire } from "module"; import fs from "fs"; import os from "os"; import path from "path";
import * as W from "./world.mjs";
const v7 = new URL("../../t2_circuit_fix/zkdac_v7/", import.meta.url).pathname;
const snarkjs = createRequire(v7 + "package.json")("snarkjs");
const ABL = new URL("ablation/build/main_c_d4_leafonly_js/main_c_d4_leafonly.wasm", import.meta.url).pathname;
const tmp = path.join(os.tmpdir(), `e3abl-${process.pid}.wtns`);
async function satL(input) { try { await snarkjs.wtns.calculate(input, ABL, tmp); return true; } catch { return false; } finally { try { fs.unlinkSync(tmp); } catch {} } }
const sat = (h, input) => (input ? W.satisfiable(h.D, input, "C") : Promise.resolve(false));

// ---------- world W ----------
const chains = [["H", "M"]];
for (let a = 1; a <= 4; a++) { chains.push(["H", "M", `S${a}`]);
  for (let b = 1; b <= 3; b++) { chains.push(["H", "M", `S${a}`, `S${a}${b}`]); for (let c = 1; c <= 2; c++) chains.push(["H", "M", `S${a}`, `S${a}${b}`, `S${a}${b}${c}`]); } }
chains.push(["H'", "M'"], ["H'", "M'", "T1"], ["H'", "M'", "T2"]);
chains.push(["H", "M", "S1", "X"], ["H", "M", "S4", "X"]);
async function buildWorld() { const w = await W.World.create(20); for (const c of chains) await w.add(c); return w; }

// revocation spec: { edge: [parentName, childName] } or { key: name }. Oracle: a chain is hit iff it contains the edge (consecutive) or the key at position >= 2.
const hits = (chain, r) => r.edge ? chain.some((n, i) => i > 0 && chain[i - 1] === r.edge[0] && n === r.edge[1]) : r.key ? chain.indexOf(r.key) >= 2 : false;
function entryOf(w, r) {
  if (r.edge) { const h = w.holders.find((x) => hits(x.chain, r)); const hop = h.chain.findIndex((n, i) => i > 0 && h.chain[i - 1] === r.edge[0] && n === r.edge[1]) - 1; return { value: BigInt(h.meta.cert[hop]), slot: { kind: "r", hop } }; }
  if (r.key) return { value: BigInt(w.keyEntry(r.key)), slot: { kind: "k" } };
  return { value: BigInt("0x" + "e3".repeat(31)) % (1n << 250n) };
}
const SCEN = { R0: null, R1: { edge: ["H", "M"] }, R2: { edge: ["M", "S2"] }, R3: { edge: ["S2", "S21"] }, R4: { edge: ["S21", "S211"] }, R5: { key: "S3" }, R6: { random: true },
  R7a: { edge: ["S1", "X"] }, R7b: { key: "X" } };
const rows = []; const row = (o) => { rows.push(o); if (!o.pass) console.error("UNEXPECTED", JSON.stringify(o)); };

// witness with every revocation slot honest EXCEPT the revoked entry's slot, which is left as in `stale` (for A3 / ablation)
function partialWitness(w, h, stale, skip) {   // skip: Set of entry values (BigInt) whose slots stay as in `stale`
  const inp = structuredClone(stale); inp.revoked_root = String(w.imt.root);
  for (let i = 0; i < h.D; i++) { if (skip.has(BigInt(h.meta.cert[i]))) continue; const x = w.imt.nonMemberWitness(h.meta.cert[i]);
    inp.r_low_value[i] = x.low_value; inp.r_low_next_index[i] = x.low_next_index; inp.r_low_next_value[i] = x.low_next_value; inp.r_sib[i] = x.sib; inp.r_bit[i] = x.bit; }
  for (let j = 2; j <= h.D; j++) { const kh = W.keyHash(h.meta, { Ax: h.input.ent_Ax[j], Ay: h.input.ent_Ay[j] }); if (skip.has(BigInt(kh))) continue; const x = w.imt.nonMemberWitness(kh); const t = j - 2;
    inp.k_low_value[t] = x.low_value; inp.k_low_next_index[t] = x.low_next_index; inp.k_low_next_value[t] = x.low_next_value; inp.k_sib[t] = x.sib; inp.k_bit[t] = x.bit; }
  return inp;
}
const slotsOf = (h, entry) => { const s = []; for (let i = 0; i < h.D; i++) if (BigInt(h.meta.cert[i]) === entry.value) s.push(["r", i]);
  for (let j = 2; j <= h.D; j++) if (BigInt(W.keyHash(h.meta, { Ax: h.input.ent_Ax[j], Ay: h.input.ent_Ay[j] })) === entry.value) s.push(["k", j - 2]); return s; };

for (const [id, r] of Object.entries(SCEN)) {
  const w = await buildWorld();
  const stale = new Map(w.holders.map((h) => [h, w.witness(h)]));          // pre-revocation witnesses
  const oldRoot = String(w.imt.root);
  const entry = r ? entryOf(w, r) : null; if (entry) w.imt.insert(entry.value);
  let ok = 0, n = 0;
  const targets = [];
  for (const h of w.holders) {
    const target = !!r && hits(h.chain, r); if (target) targets.push(h);
    const inp = w.witness(h); const acc = await sat(h, inp); n++;
    const pass = acc === !target; if (pass) ok++;
    row({ exp: "E3.1", scenario: id, holder: h.chain.join(">"), D: h.D, expected: target ? "reject" : "accept", observed: inp ? (acc ? "accept" : "reject") : "reject (no non-membership witness)", pass });
  }
  console.error(`${id}: ${ok}/${n} as expected, ${targets.length} targets`);
  if (!r || r.random) continue;
  // ---- adversarial witnesses ----
  for (const h of targets) {
    const s = stale.get(h);
    const a1 = { ...structuredClone(s), revoked_root: String(w.imt.root) };
    row({ exp: "A1", scenario: id, holder: h.chain.join(">"), expected: "reject", observed: (await sat(h, a1)) ? "accept" : "reject", get pass() { return this.observed === "reject"; } });
    const a2 = await sat(h, s);
    row({ exp: "A2", scenario: id, holder: h.chain.join(">"), expected: "accept (POLICY: old root; gate window decides)", observed: a2 ? "accept" : "reject", pass: a2, policy: true, oldRoot });
  }
  { // A3: every IMT leaf as low leaf for the revoked entry's slot, on the shallowest target
    const h = targets.reduce((a, b) => (b.D < a.D ? b : a)); const base = partialWitness(w, h, stale.get(h), new Set([entry.value])); let accepted = 0, tried = 0;
    for (const [kind, t] of slotsOf(h, entry)) for (let li = 0; li < w.imt.leaves.length; li++) {
      const L = w.imt.leaves[li], p = w.imt.path(li), inp = structuredClone(base);
      inp[`${kind}_low_value`][t] = String(L.value); inp[`${kind}_low_next_index`][t] = String(L.nextIndex); inp[`${kind}_low_next_value`][t] = String(L.nextValue);
      inp[`${kind}_sib`][t] = p.sib.map(String); inp[`${kind}_bit`][t] = p.bit.map(String); tried++; if (await sat(h, inp)) accepted++;
    }
    row({ exp: "A3", scenario: id, holder: h.chain.join(">"), expected: "all reject", observed: `${accepted}/${tried} accepted`, pass: accepted === 0 && tried > 0 });
  }
  { // A4 rotation through the revoked edge / key
    const head = r.edge ? r.edge[1] : r.key; const hc = targets.find((h) => h.chain[h.chain.length - 1] === head).chain;
    if (hc.length <= 4) { const z = await w.add([...hc, `Z_${id}`]); const inp = w.witness(z);
      row({ exp: "A4", scenario: id, holder: z.chain.join(">"), expected: "reject", observed: inp ? ((await sat(z, inp)) ? "accept" : "reject") : "reject (no non-membership witness)", pass: !inp || !(await sat(z, inp)) }); }
  }
  { // A5 re-issuance by unrevoked S1 to the head's key
    const head = r.edge ? r.edge[1] : r.key; if (!["H", "M", "S1", "X"].includes(head)) {
      const chainA5 = head === "S211" ? ["H", "M", "S2", "S22", "S211"] : ["H", "M", "S1", head];
      const hh = await w.add(chainA5); const inp = w.witness(hh); const acc = inp ? await sat(hh, inp) : false; const exp = r.key ? "reject" : "accept (POLICY: new authorization by an unrevoked delegator)";
      row({ exp: "A5", scenario: id, holder: chainA5.join(">"), expected: exp, observed: acc ? "accept" : inp ? "reject" : "reject (no non-membership witness)", pass: acc === !r.key, policy: !r.key }); }
  }
  { // A6 skip the revoked hop: reuse the signature from the revoked certificate
    const node = r.edge ? r.edge[1] : r.key;                                    // node to drop; needs a target chain that continues below it
    const rest = targets.find((h) => h.chain.indexOf(node) >= 1 && h.chain.indexOf(node) + 1 < h.chain.length);
    const tc = rest?.chain ?? [], cut = tc.indexOf(node);
    if (!rest) row({ exp: "A6", scenario: id, expected: "reject", observed: "not applicable (revoked node has no descendant)", pass: true, na: true });
    else { const skipped = [...tc.slice(0, cut), ...tc.slice(cut + 1)]; const hop = cut - 1;
      const hs = await W.holderInstance(skipped, 900); for (let i = 1; i < hs.D; i++) w.issued.append(hs.meta.cert[i]);   // worst case: the forged cert is "issued"
      let inp; try { inp = w.witness(hs); } catch (e) { inp = null; row({ exp: "A6", scenario: id, holder: skipped.join(">"), expected: "reject", observed: `reject (witness construction impossible: ${String(e.message).slice(0, 60)})`, pass: true }); }
      if (inp) { const donor = rest.input;                                      // signature of the revoked / skipped hop
      inp.sig_S[hop] = donor.sig_S[hop]; inp.sig_R8x[hop] = donor.sig_R8x[hop]; inp.sig_R8y[hop] = donor.sig_R8y[hop];
      row({ exp: "A6", scenario: id, holder: skipped.join(">"), note: `hop ${hop} signature taken from ${tc.join(">")}`, expected: "reject", observed: (await sat(hs, inp)) ? "accept" : "reject", get pass() { return this.observed === "reject"; } }); } }
  }
  // ---- ablation L (leaf-only), depth-4 holders, R2 R3 R5 ----
  if (["R2", "R3", "R5"].includes(id)) {
    let fa = 0, tn = 0, nonOk = 0, nn = 0;
    for (const h of w.holders.filter((x) => x.D === 4 && stale.get(x))) {
      const inp = partialWitness(w, h, stale.get(h), new Set([entry.value])); const acc = await satL(inp); const target = hits(h.chain, r);
      const lastHit = slotsOf(h, entry).some(([k, t]) => (k === "r" && t === 3) || (k === "k" && t === 2));
      if (target) { tn++; if (acc) fa++; row({ exp: "L", scenario: id, holder: h.chain.join(">"), expected: lastHit ? "reject (own last cert/key revoked)" : "accept (FALSE ACCEPT under L)", observed: acc ? "accept" : "reject", pass: acc === !lastHit, ablation: true }); }
      else { nn++; if (acc) nonOk++; }
    }
    row({ exp: "L-summary", scenario: id, expected: "targets accepted under L unless own last entry revoked; non-targets accept", observed: `targets accepted ${fa}/${tn}; non-targets accepted ${nonOk}/${nn}`, pass: nonOk === nn, ablation: true });
    // enumeration fix under L: insert each target's last certificate and last key
    const before = w.imt.leaves.length; const tg = w.holders.filter((x) => x.D === 4 && hits(x.chain, r) && stale.get(x));   // original world holders only (not A4/A5 additions)
    const skip = new Set([entry.value]); for (const h of tg) { w.imt.insert(BigInt(h.meta.cert[3])); skip.add(BigInt(h.meta.cert[3])); }
    let still = 0; for (const h of tg) { const inp = partialWitness(w, h, stale.get(h), skip); if (await satL(inp)) still++; }
    row({ exp: "L-enumerate", scenario: id, expected: "targets blocked under L only after one insert per descendant", observed: `${w.imt.leaves.length - before} extra inserts for ${tg.length} depth-4 targets; still accepted ${still}`, pass: still === 0, ablation: true });
  }
}
const bad = rows.filter((x) => !x.pass);
console.log(JSON.stringify({ date: new Date().toISOString(), holders: chains.length, rows, unexpected: bad.length }, null, 1));
console.error(`${rows.length} rows, ${bad.length} unexpected`); process.exit(0);

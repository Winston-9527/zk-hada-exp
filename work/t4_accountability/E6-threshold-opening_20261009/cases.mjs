// E6 pre-registered cases O1–O17 (PREREGISTRATION.md). usage: node cases.mjs > results/cases.json
// Opening flow: verify the Groth16 action proof -> members check epoch/TPK/c1 and release (D_i, DLEQ) -> combiner validates, interpolates in the group.
import { createRequire } from "module"; import fs from "fs";
import * as T from "./threshold.mjs";
const v7 = new URL("../../t2_circuit_fix/zkdac_v7/", import.meta.url).pathname;
const snarkjs = createRequire(v7 + "package.json")("snarkjs");
const load = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url)));
const FX1 = load("results/fixtures_C_e1.json"), FX2 = load("results/fixtures_C_e2.json"), FXA = load("results/fixtures_A_e1.json");
const E1 = T.deal({ t: 3, n: 5, epoch: 1, seed: FX1.dealerSeed }), E2 = T.deal({ t: 3, n: 5, epoch: 2, seed: FX1.dealerSeed });
const EPOCHS = [E1, E2];
const vks = {}; const vk = (mode, D) => (vks[mode + D] ??= JSON.parse(fs.readFileSync(`${v7}zk/vk_${mode.toLowerCase()}${D}.json`)));
const rows = []; const row = (id, variant, expected, observed, pass, extra = {}) => { rows.push({ id, variant, expected, observed, pass, ...extra }); if (!pass) console.error("FAIL", id, variant, observed); };
const truth = (f, pts) => pts.length === f.ents.length && pts.every((p, j) => String(p[0]) === f.ents[j][0] && String(p[1]) === f.ents[j][1]);
const subsets = (arr, k) => k === 0 ? [[]] : arr.flatMap((x, i) => subsets(arr.slice(i + 1), k - 1).map((s) => [x, ...s]));

// the action as an auditor sees it (public signals + proof from the gate event); epoch is derived from the TPK in the public signals
async function present(f, publicSignals = f.publicSignals, { checkProof = true } = {}) {
  if (checkProof && !(await snarkjs.groth16.verify(vk(f.mode, f.D), publicSignals, f.proof))) return { refuse: "PROOF_INVALID" };
  const ct = T.parseCt(publicSignals, f.mode, f.D);
  const ep = EPOCHS.find((E) => T.eq(E.pub.tpk, ct.tpk));
  if (!ep) return { refuse: "UNKNOWN_TPK" };
  return { ct, ep, ctx: { epoch: ep.pub.epoch, ev: T.eventId(publicSignals), tpk: ct.tpk, c1s: ct.c1s } };
}
const share = (E, i, ctx) => T.memberShare(E.pub, E.members[i - 1], ctx);
const openWith = (a, shares, opts) => { const r = T.combine(a.ep.pub, a.ctx, shares, opts); return r.status === "OK" ? { ...r, pts: T.decryptWith(a.ct, r.S, a.ct.e ? "C" : "A") } : r; };
const clone = (x) => structuredClone(x);
const N5 = [1, 2, 3, 4, 5];

// ---------- O1 / O2 / O3: honest subsets, D = 1..4 (3 actions per D), mode C; mode A D = 4 (3 actions) ----------
for (const [label, FX] of [["C", FX1], ["A", FXA]]) for (const D of [...new Set(FX.fixtures.map((f) => f.D))]) {
  const fs3 = FX.fixtures.filter((f) => f.D === D).slice(0, 3);
  let o1 = 0, o1n = 0, o2 = 0, o2n = 0, o3 = 0, o3n = 0, forcedWrong = 0, forcedOnCurve = 0, forcedPts = 0;
  for (const f of fs3) {
    const a = await present(f); const all = N5.map((i) => share(a.ep, i, a.ctx));
    for (const S of subsets(N5, 3)) { const r = openWith(a, S.map((i) => all[i - 1])); o1n++; if (r.status === "OK" && truth(f, r.pts) && T.consistent(r.pts)) o1++; }
    for (const S of [...subsets(N5, 4), N5]) { const r = openWith(a, S.map((i) => all[i - 1])); o2n++; if (r.status === "OK" && truth(f, r.pts)) o2++; }
    for (const S of subsets(N5, 2)) {
      const r = openWith(a, S.map((i) => all[i - 1])); o3n++; if (r.status === "INSUFFICIENT") o3++;
      const fr = openWith(a, S.map((i) => all[i - 1]), { forceWith: S });               // negative control: interpolate with t-1 shares anyway
      if (!truth(f, fr.pts)) forcedWrong++; forcedPts += fr.pts.length; forcedOnCurve += fr.pts.filter((p) => T.onCurve(p)).length;
    }
  }
  row("O1", `mode ${label} D=${D}: 10 three-subsets x ${fs3.length} actions`, "open, exact", `${o1}/${o1n} exact`, o1 === o1n);
  row("O2", `mode ${label} D=${D}: 4- and 5-subsets x ${fs3.length} actions`, "open, exact", `${o2}/${o2n} exact`, o2 === o2n);
  row("O3", `mode ${label} D=${D}: 2-subsets x ${fs3.length} actions`, "INSUFFICIENT", `${o3}/${o3n} INSUFFICIENT`, o3 === o3n);
  row("O3", `mode ${label} D=${D}: forced Lagrange on 2 shares (negative control)`, "points != ent", `${forcedWrong}/${o3n} wrong; on-curve ${forcedOnCurve}/${forcedPts} recovered points`, forcedWrong === o3n);
}

// fixed actions for the remaining cases (mode C, D = 4)
const C4 = FX1.fixtures.filter((f) => f.D === 4), fA = C4[0], fB = C4[1];
const a = await present(fA), b = await present(fB);
const hon = N5.map((i) => share(E1, i, a.ctx)), honB = N5.map((i) => share(E1, i, b.ctx));
const blameOf = (r, i) => r.blame.find((x) => x.i === i)?.why ?? "none";

// ---------- O4 / O5: duplicates ----------
{ const r = openWith(a, [hon[0], clone(hon[0]), hon[1]]); row("O4", "member 1 twice + member 2", "duplicate rejected -> INSUFFICIENT", `${r.status}; m1 ${blameOf(r, 1)}`, r.status === "INSUFFICIENT" && blameOf(r, 1) === "DUPLICATE_INDEX"); }
{ const fake = { ...clone(hon[1]), i: 1 }; const r = openWith(a, [hon[0], fake, hon[2]]); row("O5", "index 1 twice (own share + member 2's share relabelled) + member 3", "both index-1 copies rejected -> INSUFFICIENT", `${r.status}; blame ${JSON.stringify(r.blame)}`, r.status === "INSUFFICIENT" && r.blame.length === 2); }

// ---------- O6: wrong D_i ----------
const forged = {};
{ const s = clone(hon[0]); s.parts[0].D = T.add(s.parts[0].D, T.G); forged.plusG = s; }
{ const s = clone(hon[0]); s.parts[0].D = T.mul(T.G, T.randScalar()); forged.random = s; }
{ const sp = T.randScalar(), c1 = a.ctx.c1s[0], D = T.mul(c1, sp); const s = clone(hon[0]); s.parts[0] = { D, pf: T.dleqProve(1, a.ctx.ev, 1, sp, T.mul(T.G, sp), c1, D) };
  forged.otherKey = s; row("O6", "sanity: the s' DLEQ proof verifies against Y' = s'G", "true", String(T.dleqVerify(1, a.ctx.ev, 1, T.mul(T.G, sp), c1, D, s.parts[0].pf)), T.dleqVerify(1, a.ctx.ev, 1, T.mul(T.G, sp), c1, D, s.parts[0].pf)); }
for (const [k, s] of Object.entries(forged)) { const r = openWith(a, [s, hon[1], hon[2]]); row("O6", `member 1 D_i ${k} + members 2,3`, "share rejected -> INSUFFICIENT", `${r.status}; m1 ${blameOf(r, 1)}`, r.status === "INSUFFICIENT" && blameOf(r, 1) !== "none"); }

// ---------- O7: tampered proof ----------
const tampered = {};
{ const s = clone(hon[0]); s.parts[0].pf.z = (s.parts[0].pf.z + 1n) % T.L; tampered["z+1"] = s; }
{ const s = clone(hon[0]); s.parts[0].pf.A1 = T.mul(T.G, T.randScalar()); tampered["A1 replaced (changes ch)"] = s; }
{ const s = clone(hon[0]); [s.parts[0].pf.A1, s.parts[0].pf.A2] = [s.parts[0].pf.A2, s.parts[0].pf.A1]; tampered["A1/A2 swapped"] = s; }
for (const [k, s] of Object.entries(tampered)) { const r = openWith(a, [s, hon[1], hon[2]]); row("O7", `member 1 proof ${k}`, "share rejected", `${r.status}; m1 ${blameOf(r, 1)}`, r.status === "INSUFFICIENT" && blameOf(r, 1) === "DLEQ_FAIL"); }

// ---------- O8 / O9: replay across events ----------
{ const r = openWith(a, [honB[0], hon[1], hon[2]]); row("O8", "member 1's share for action B submitted for action A", "rejected", `${r.status}; m1 ${blameOf(r, 1)}`, r.status === "INSUFFICIENT" && blameOf(r, 1) !== "none"); }
{ const s = { ...clone(honB[0]), ev: a.ctx.ev }; const r = openWith(a, [s, hon[1], hon[2]]); row("O8", "same, ev field relabelled to action A", "rejected", `${r.status}; m1 ${blameOf(r, 1)}`, r.status === "INSUFFICIENT" && blameOf(r, 1) === "DLEQ_FAIL"); }
{ const ev2 = "f".repeat(64); const ctx2 = { ...a.ctx, ev: ev2 }; const s = { ...clone(hon[0]), ev: ev2 };   // same c1 and D_i, other event label
  const r = T.combine(E1.pub, ctx2, [s, share(E1, 2, ctx2), share(E1, 3, ctx2)]); row("O9", "same D_i and c1, proof relabelled to another event id", "rejected (challenge binds ev)", `${r.status}; m1 ${blameOf(r, 1)}`, r.status === "INSUFFICIENT" && blameOf(r, 1) === "DLEQ_FAIL"); }

// ---------- O10 / O11: key epochs ----------
const f2 = FX2.fixtures[0], a2 = await present(f2);
row("O10", "action under TPK_2: epoch derived from public TPK", "epoch 2", `epoch ${a2.ep.pub.epoch}`, a2.ep.pub.epoch === 2);
{ const ref = share(E1, 1, a2.ctx); row("O10", "epoch-1 member asked to share for an epoch-2 action", "refuse", ref.refuse ?? "released", ref.refuse === "EPOCH_MISMATCH"); }
const ctxAs1 = { ...a2.ctx, epoch: 1, tpk: E1.pub.tpk };        // a confused / malicious epoch-1 member that ignores the TPK check
const old = N5.map((i) => T.memberShare(E1.pub, E1.members[i - 1], ctxAs1));
{ const r = T.combine(E2.pub, a2.ctx, old.slice(0, 3)); row("O10", "3 epoch-1 shares for the epoch-2 action (proper combiner)", "rejected EPOCH_MISMATCH", `${r.status}; blame ${[...new Set(r.blame.map((x) => x.why))]}`, r.status === "INSUFFICIENT" && r.blame.every((x) => x.why === "EPOCH_MISMATCH")); }
{ const r = T.combine(E1.pub, ctxAs1, old.slice(0, 3)); const pts = T.decryptWith(a2.ct, r.S, "C");
  row("O10", "naive combiner using the shares' claimed epoch-1 keys (negative control)", "points != ent", `${r.status}; exact ${truth(f2, pts)}; consistency check ${T.consistent(pts)}`, r.status === "OK" && !truth(f2, pts), { note: "shows why the epoch must come from the TPK bound in the proof" }); }
{ const new2 = [1, 2].map((i) => share(E2, i, a2.ctx)); const r = T.combine(E2.pub, a2.ctx, [...new2, old[2]]);
  row("O11", "2 epoch-2 shares + 1 epoch-1 share", "INSUFFICIENT", `${r.status}; blame ${JSON.stringify(r.blame)}`, r.status === "INSUFFICIENT" && blameOf(r, 3) === "EPOCH_MISMATCH"); }
{ const r = openWith(a2, [1, 3, 5].map((i) => share(E2, i, a2.ctx))); row("O10", "epoch-2 action opened by epoch-2 members (control)", "open, exact", `${r.status}; exact ${truth(f2, r.pts)}`, r.status === "OK" && truth(f2, r.pts)); }

// ---------- O12: robustness ----------
{ const m4 = clone(hon[3]); m4.parts[0].pf.z = (m4.parts[0].pf.z + 1n) % T.L; const r = openWith(a, [forged.otherKey, hon[1], hon[2], m4, hon[4]]);
  row("O12", "5 submitted: m1 forged (s' with valid DLEQ for Y'), m4 z+1, m2/m3/m5 honest", "open; m1, m4 identified", `${r.status}; exact ${truth(fA, r.pts ?? [])}; used ${r.used}; blame ${JSON.stringify(r.blame)}`, r.status === "OK" && truth(fA, r.pts) && r.blame.map((x) => x.i).join() === "1,4"); }

// ---------- O13: tampered ciphertext with the original proof ----------
const ps = fA.publicSignals, bump = (k) => ps.map((x, j) => (j === k ? String((BigInt(x) + 1n) % T.P_FIELD) : x));
const variants = { "c1x+1": bump(9), "c2x+1": bump(11), "e[0][0]+1": bump(13), "e[4][1]+1": bump(22), "c1 from action B": ps.map((x, j) => (j === 9 || j === 10 ? fB.publicSignals[j] : x)) };
for (const [k, sig] of Object.entries(variants)) {
  const p = await present(fA, sig); row("O13", `${k}, original proof`, "proof fails -> refuse", p.refuse ?? "released", p.refuse === "PROOF_INVALID");
  const q = await present(fA, sig, { checkProof: false }); let obs;
  if (q.refuse) obs = q.refuse; else { const sh = N5.map((i) => share(E1, i, q.ctx)); if (sh[0].refuse) obs = `member refuses ${sh[0].refuse}`; else { const r = openWith(q, sh.slice(0, 3)); obs = `exact ${truth(fA, r.pts)}; consistency ${T.consistent(r.pts)}`; } }
  row("O13", `${k}, control WITHOUT proof check`, "points != ent (or member refuses)", obs, !obs.startsWith("exact true"));
}

// ---------- O14: invalid c1 presented directly to a member ----------
const T8 = T.mulRaw([T.bj.F.toObject(T.bj.Generator[0]), T.bj.F.toObject(T.bj.Generator[1])], T.L);   // full-group generator times l
row("O14", "sanity: T = l·Generator has order 8", "order 8", `4T = id: ${T.eq(T.mulRaw(T8, 4n), T.ID)}, 8T = id: ${T.eq(T.mulRaw(T8, 8n), T.ID)}`, !T.eq(T.mulRaw(T8, 4n), T.ID) && T.eq(T.mulRaw(T8, 8n), T.ID));
const badC1 = { identity: T.ID, "order 2 (0,-1)": [0n, T.P_FIELD - 1n], "order 8": T8, "off-curve": [a.ctx.c1s[0][0], (a.ctx.c1s[0][1] + 1n) % T.P_FIELD], "c1 + T (outside subgroup)": T.add(a.ctx.c1s[0], T8) };
for (const [k, c1] of Object.entries(badC1)) { const r = share(E1, 1, { ...a.ctx, c1s: [c1] }); row("O14", `c1 = ${k}`, "refuse", r.refuse ?? "released", r.refuse === "INVALID_C1"); }

// ---------- O15: TPK deployment check ----------
const tpkCases = { honest: [E1.pub.tpk, true], identity: [T.ID, false], "order 2": [[0n, T.P_FIELD - 1n], false], "order 8": [T8, false], "TPK + T (outside subgroup)": [T.add(E1.pub.tpk, T8), false], "off-curve": [[E1.pub.tpk[0], E1.pub.tpk[1] + 1n], false], "valid point != A_0": [T.mul(T.G, 12345n), false] };
for (const [k, [p, exp]] of Object.entries(tpkCases)) { const v = T.checkTpk(p, E1.pub); row("O15", `TPK ${k}`, exp ? "accept" : "reject", v ? "accept" : "reject", v === exp); }

// ---------- O16: no reconstruction of tsk (structural) ----------
{ const src = fs.readFileSync(new URL("threshold.mjs", import.meta.url), "utf8"); const body = src.slice(src.indexOf("export function combine"), src.indexOf("// ---------------- v7 public-signal"));
  const usesSecret = /\.s\b|_tsk|members/.test(body); const shareKeys = new Set(hon.flatMap((s) => Object.keys(s)));
  row("O16", "combine() source never touches member secrets / _tsk; shares carry only {i, epoch, ev, parts:[{D, pf:{A1,A2,z}}]}", "holds", `secret refs in combine: ${usesSecret}; share keys ${[...shareKeys]}`, !usesSecret && [...shareKeys].join() === "i,epoch,ev,parts"); }

// ---------- O17: Feldman complaint ----------
row("O17", "honest shares pass the Feldman check (epochs 1, 2)", "pass", `${[...E1.members, ...E2.members].filter((m, k) => T.feldmanCheck(k < 5 ? E1.pub : E2.pub, m)).length}/10`, E1.members.every((m) => T.feldmanCheck(E1.pub, m)) && E2.members.every((m) => T.feldmanCheck(E2.pub, m)));
{ const bad = { ...E1.members[1], s: (E1.members[1].s + 1n) % T.L }; row("O17", "dealer sends member 2 the share s_2 + 1", "check fails (complaint)", T.feldmanCheck(E1.pub, bad) ? "pass" : "fail", !T.feldmanCheck(E1.pub, bad)); }

const failed = rows.filter((r) => !r.pass);
console.log(JSON.stringify({ date: new Date().toISOString(), committee: "t=3, n=5 (trusted dealer, Feldman VSS)", fixtures: ["results/fixtures_C_e1.json", "results/fixtures_C_e2.json", "results/fixtures_A_e1.json"], total: rows.length, failed: failed.length, rows }, (k, v) => (typeof v === "bigint" ? String(v) : v), 1));
console.error(`${rows.length} rows, ${failed.length} not as pre-registered`); process.exit(0);

// E6c cases (PREREGISTRATION.md): O1–O17 of E6 ported to v9.1 compressed ciphertexts, every committee / depth where stated, plus O20 (ciphertexts the
// real v9.1 gate emitted in E7c) and O21 (the v9 off-curve proofs of E7c G7). usage: node cases_v91.mjs > results/cases.json 2> results/cases.stderr
import fs from "fs"; import os from "os";
import { T, snarkjs, vk, IDX, parseCt, present, share, openWith, truth, wrongAt, decrypt, COMMITTEES, dealC, fxFile } from "./lib_v91_open.mjs";
const BATCH = process.env.BATCH ?? new URL("../../t4_contracts/foundry/test/fixtures_V91_batch.json", import.meta.url).pathname;
const rows = []; const row = (id, variant, expected, observed, pass, extra = {}) => { rows.push({ id, variant, expected, observed, pass, ...extra }); if (!pass) console.error("FAIL", id, variant, observed); };
const subsets = (arr, k) => (k === 0 ? [[]] : arr.flatMap((x, i) => subsets(arr.slice(i + 1), k - 1).map((s) => [x, ...s])));
const clone = (x) => structuredClone(x); const load = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const blameOf = (r, i) => r.blame.find((x) => x.i === i)?.why ?? "none";
const perf = {}; const tm = (k, ms) => (perf[k] ??= []).push(ms); const now = () => performance.now();
const DS = [1, 2, 3, 4];

for (const c of COMMITTEES) {
  const E1 = dealC(c, 1), E2 = dealC(c, 2), EPOCHS = [E1, E2]; const NI = Array.from({ length: c.n }, (_, k) => k + 1); const lab = `(${c.t},${c.n})`;
  const FX1 = load(fxFile(c, 1)); const FX2 = fs.existsSync(fxFile(c, 2)) ? load(fxFile(c, 2)) : null;
  if (FX1.tpk.join() !== E1.pub.tpk.map(String).join()) throw new Error("fixture TPK != committee TPK " + lab);
  for (const D of DS) {
    const cell = FX1.fixtures.filter((f) => f.D === D);
    // ---------- O1 / O2 / O3 on the first 3 actions; O1-all on every action ----------
    let o1 = 0, o1n = 0, o2 = 0, o2n = 0, o3 = 0, o3n = 0, fw = 0, fOn = 0, fPts = 0, all = 0;
    for (const [k, f] of cell.entries()) {
      let t0 = now(); const a = await present(f, EPOCHS); tm(`verify ${lab} D=${D}`, now() - t0);
      if (a.refuse) { row("O1-all", `${lab} D=${D} action ${k}`, "presentable", a.refuse, false); continue; }
      t0 = now(); const sh = NI.map((i) => share(a.ep, i, a.ctx)); tm(`share ${lab} D=${D}`, (now() - t0) / c.n);
      t0 = now(); const ok = T.dleqVerify(a.ctx.epoch, a.ctx.ev, 1, a.ep.pub.Y[0], a.ctx.c1s[0], sh[0].parts[0].D, sh[0].parts[0].pf); tm(`dleqVerify ${lab} D=${D}`, now() - t0);
      t0 = now(); const r = openWith(a, sh.slice(0, c.t)); tm(`combine+decrypt ${lab} D=${D}`, now() - t0); if (ok && r.status === "OK" && truth(f, r.pts)) all++;
      if (k >= 3) continue;
      for (const S of subsets(NI, c.t)) { const r = openWith(a, S.map((i) => sh[i - 1])); o1n++; if (r.status === "OK" && truth(f, r.pts)) o1++; }
      for (let m = c.t + 1; m <= c.n; m++) for (const S of subsets(NI, m)) { const r = openWith(a, S.map((i) => sh[i - 1])); o2n++; if (r.status === "OK" && truth(f, r.pts)) o2++; }
      for (const S of subsets(NI, c.t - 1)) { const r = openWith(a, S.map((i) => sh[i - 1])); o3n++; if (r.status === "INSUFFICIENT") o3++;
        const fr = T.combine(a.ep.pub, a.ctx, S.map((i) => sh[i - 1]), { forceWith: S }); const pts = decrypt(a.ct, fr.S[0]);
        if (!truth(f, pts)) fw++; const valid = (pts ?? []).filter((p) => p && T.onCurve(p)); fPts += f.ents.length; fOn += valid.length; }
    }
    row("O1", `${lab} D=${D}: every ${c.t}-subset x 3 actions`, "open, exact", `${o1}/${o1n} exact`, o1 === o1n && o1n > 0);
    row("O2", `${lab} D=${D}: every larger subset x 3 actions`, "open, exact", `${o2}/${o2n} exact`, o2 === o2n && o2n > 0);
    row("O3", `${lab} D=${D}: every ${c.t - 1}-subset x 3 actions`, "INSUFFICIENT", `${o3}/${o3n} INSUFFICIENT`, o3 === o3n && o3n > 0);
    row("O3", `${lab} D=${D}: forced Lagrange on ${c.t - 1} shares (negative control)`, "keys != ent", `${fw}/${o3n} wrong; ${fOn}/${fPts} recovered keys are curve points`, fw === o3n);
    row("O1-all", `${lab} D=${D}: members 1..${c.t}, every action of the cell`, "open, exact", `${all}/${cell.length} exact`, all === cell.length && cell.length > 0);
    // ---------- O12 robustness: n − t malicious + t honest, all n submitted ----------
    { const f = cell[0], a = await present(f, EPOCHS); const sh = NI.map((i) => share(a.ep, i, a.ctx)); const bad = NI.slice(0, c.n - c.t);
      const subm = sh.map((s, k) => { if (!bad.includes(k + 1)) return s; const x = clone(s);
        if (k % 2 === 0) { const sp = T.randScalar(), c1 = a.ctx.c1s[0], Dp = T.mul(c1, sp); x.parts[0] = { D: Dp, pf: T.dleqProve(a.ctx.epoch, a.ctx.ev, k + 1, sp, T.mul(T.G, sp), c1, Dp) }; }
        else x.parts[0].pf.z = (x.parts[0].pf.z + 1n) % T.L; return x; });
      const r = openWith(a, subm); row("O12", `${lab} D=${D}: members ${bad.join(",")} malicious (own-key DLEQ / z+1), ${c.t} honest, all ${c.n} submitted`, `open; ${bad.join(",")} blamed`,
        `${r.status}; exact ${truth(f, r.pts ?? [])}; blame ${r.blame.map((x) => x.i).join(",")}`, r.status === "OK" && truth(f, r.pts) && r.blame.map((x) => x.i).join() === bad.join()); }
    // ---------- (3, 5): the remaining cases on every D ----------
    if (c.t !== 3) continue;
    const fA = cell[0], fB = cell[1]; const a = await present(fA, EPOCHS), b = await present(fB, EPOCHS);
    const hon = NI.map((i) => share(E1, i, a.ctx)), honB = NI.map((i) => share(E1, i, b.ctx));
    { const r = openWith(a, [hon[0], clone(hon[0]), hon[1]]); row("O4", `D=${D}: member 1 twice + member 2`, "INSUFFICIENT (duplicate)", `${r.status}; m1 ${blameOf(r, 1)}`, r.status === "INSUFFICIENT" && blameOf(r, 1) === "DUPLICATE_INDEX"); }
    { const fake = { ...clone(hon[1]), i: 1 }; const r = openWith(a, [hon[0], fake, hon[2]]); row("O5", `D=${D}: index 1 twice (member 2's share relabelled) + member 3`, "both rejected -> INSUFFICIENT", `${r.status}; blame ${JSON.stringify(r.blame)}`, r.status === "INSUFFICIENT" && r.blame.length === 2); }
    const forged = {};
    { const s = clone(hon[0]); s.parts[0].D = T.add(s.parts[0].D, T.G); forged["D_i + Base8"] = s; }
    { const s = clone(hon[0]); s.parts[0].D = T.mul(T.G, T.randScalar()); forged["random point"] = s; }
    { const sp = T.randScalar(), c1 = a.ctx.c1s[0], Dp = T.mul(c1, sp); const s = clone(hon[0]); s.parts[0] = { D: Dp, pf: T.dleqProve(1, a.ctx.ev, 1, sp, T.mul(T.G, sp), c1, Dp) }; forged["s'·c1 with valid own DLEQ"] = s; }
    for (const [k, s] of Object.entries(forged)) { const r = openWith(a, [s, hon[1], hon[2]]); row("O6", `D=${D}: member 1 ${k} + members 2,3`, "rejected -> INSUFFICIENT", `${r.status}; m1 ${blameOf(r, 1)}`, r.status === "INSUFFICIENT" && blameOf(r, 1) !== "none"); }
    const tampered = {};
    { const s = clone(hon[0]); s.parts[0].pf.z = (s.parts[0].pf.z + 1n) % T.L; tampered["z+1"] = s; }
    { const s = clone(hon[0]); s.parts[0].pf.A1 = T.mul(T.G, T.randScalar()); tampered["A1 replaced"] = s; }
    { const s = clone(hon[0]); [s.parts[0].pf.A1, s.parts[0].pf.A2] = [s.parts[0].pf.A2, s.parts[0].pf.A1]; tampered["A1/A2 swapped"] = s; }
    for (const [k, s] of Object.entries(tampered)) { const r = openWith(a, [s, hon[1], hon[2]]); row("O7", `D=${D}: member 1 proof ${k}`, "rejected DLEQ_FAIL", `${r.status}; m1 ${blameOf(r, 1)}`, r.status === "INSUFFICIENT" && blameOf(r, 1) === "DLEQ_FAIL"); }
    { const r = openWith(a, [honB[0], hon[1], hon[2]]); row("O8", `D=${D}: member 1's share for action B submitted for A`, "rejected", `${r.status}; m1 ${blameOf(r, 1)}`, r.status === "INSUFFICIENT" && blameOf(r, 1) !== "none"); }
    { const s = { ...clone(honB[0]), ev: a.ctx.ev }; const r = openWith(a, [s, hon[1], hon[2]]); row("O8", `D=${D}: same, ev relabelled to A`, "rejected DLEQ_FAIL", `${r.status}; m1 ${blameOf(r, 1)}`, r.status === "INSUFFICIENT" && blameOf(r, 1) === "DLEQ_FAIL"); }
    { const ev2 = "f".repeat(64); const ctx2 = { ...a.ctx, ev: ev2 }; const s = { ...clone(hon[0]), ev: ev2 };
      const r = T.combine(E1.pub, ctx2, [s, share(E1, 2, ctx2), share(E1, 3, ctx2)]); row("O9", `D=${D}: same D_i and c1 relabelled to another event id`, "rejected DLEQ_FAIL", `${r.status}; m1 ${blameOf(r, 1)}`, r.status === "INSUFFICIENT" && blameOf(r, 1) === "DLEQ_FAIL"); }
    if (FX2) { const f2 = FX2.fixtures.find((x) => x.D === D), a2 = await present(f2, EPOCHS);
      row("O10", `D=${D}: action under TPK_2 -> epoch from the public TPK`, "epoch 2", `epoch ${a2.ep?.pub.epoch}`, a2.ep?.pub.epoch === 2);
      { const ref = share(E1, 1, a2.ctx); row("O10", `D=${D}: epoch-1 member asked for an epoch-2 action`, "refuse EPOCH_MISMATCH", ref.refuse ?? "released", ref.refuse === "EPOCH_MISMATCH"); }
      const ctxAs1 = { ...a2.ctx, epoch: 1, tpk: E1.pub.tpk }; const old = NI.map((i) => T.memberShare(E1.pub, E1.members[i - 1], ctxAs1));
      { const r = T.combine(E2.pub, a2.ctx, old.slice(0, 3)); row("O10", `D=${D}: 3 epoch-1 shares for the epoch-2 action`, "rejected EPOCH_MISMATCH", `${r.status}; ${[...new Set(r.blame.map((x) => x.why))]}`, r.status === "INSUFFICIENT" && r.blame.every((x) => x.why === "EPOCH_MISMATCH")); }
      { const r = T.combine(E1.pub, ctxAs1, old.slice(0, 3)); const pts = decrypt(a2.ct, r.S[0]);
        row("O10", `D=${D}: naive combiner trusting the shares' epoch (negative control)`, "keys != ent", `${r.status}; exact ${truth(f2, pts)}`, r.status === "OK" && !truth(f2, pts)); }
      { const r = T.combine(E2.pub, a2.ctx, [share(E2, 1, a2.ctx), share(E2, 2, a2.ctx), old[2]]); row("O11", `D=${D}: 2 epoch-2 shares + 1 epoch-1 share`, "INSUFFICIENT", `${r.status}; blame ${JSON.stringify(r.blame)}`, r.status === "INSUFFICIENT" && blameOf(r, 3) === "EPOCH_MISMATCH"); }
      { const r = openWith(a2, [1, 3, 5].map((i) => share(E2, i, a2.ctx))); row("O10", `D=${D}: epoch-2 action opened by epoch-2 members (control)`, "open, exact", `${r.status}; exact ${truth(f2, r.pts ?? [])}`, r.status === "OK" && truth(f2, r.pts)); }
      { let ok = 0; for (const f of FX2.fixtures.filter((x) => x.D === D)) { const x = await present(f, EPOCHS); const r = openWith(x, [1, 2, 3].map((i) => share(E2, i, x.ctx))); if (r.status === "OK" && truth(f, r.pts)) ok++; }
        row("O10", `D=${D}: every epoch-2 action opened by epoch-2 members`, "open, exact", `${ok}/${FX2.fixtures.filter((x) => x.D === D).length}`, ok === FX2.fixtures.filter((x) => x.D === D).length); } }
    // O13: ciphertext substitution with the original proof
    const I = IDX(D), ps = fA.publicSignals, bump = (k) => ps.map((x, j) => (j === k ? String((BigInt(x) + 1n) % T.P_FIELD) : x));
    const variants = { "c1x+1": bump(I.c1x), "c1y+1": bump(I.c1y), "c2x+1": bump(I.c2x), "e[0]+1": bump(I.e0), [`e[${D}]+1`]: bump(I.eD), "esign+1": bump(I.esign),
      "c1 from action B": ps.map((x, j) => (j === I.c1x || j === I.c1y ? fB.publicSignals[j] : x)) };
    for (const [k, sig] of Object.entries(variants)) {
      const p = await present(fA, EPOCHS, sig); row("O13", `D=${D}: ${k}, original proof`, "proof fails -> refuse", p.refuse ?? "released", p.refuse === "PROOF_INVALID");
      const q = await present(fA, EPOCHS, sig, { checkProof: false }); let obs;
      if (q.refuse) obs = q.refuse; else { const sh = NI.map((i) => share(E1, i, q.ctx)); if (sh[0].refuse) obs = `member refuses ${sh[0].refuse}`; else { const r = openWith(q, sh.slice(0, 3)); obs = `exact ${truth(fA, r.pts)}`; } }
      row("O13", `D=${D}: ${k}, control WITHOUT proof check`, "keys != ent (or refuse)", obs, !obs.startsWith("exact true"));
    }
    // O14: invalid c1 presented directly to a member
    const T8 = T.mulRaw([T.bj.F.toObject(T.bj.Generator[0]), T.bj.F.toObject(T.bj.Generator[1])], T.L);
    const badC1 = { identity: T.ID, "order 2": [0n, T.P_FIELD - 1n], "order 8": T8, "off-curve": [a.ctx.c1s[0][0], (a.ctx.c1s[0][1] + 1n) % T.P_FIELD], "c1 + order-8 point": T.add(a.ctx.c1s[0], T8) };
    for (const [k, c1] of Object.entries(badC1)) { const r = share(E1, 1, { ...a.ctx, c1s: [c1] }); row("O14", `D=${D}: c1 = ${k}`, "refuse INVALID_C1", r.refuse ?? "released", r.refuse === "INVALID_C1"); }
  }
  // ---------- O15 / O17 per committee ----------
  const T8 = T.mulRaw([T.bj.F.toObject(T.bj.Generator[0]), T.bj.F.toObject(T.bj.Generator[1])], T.L);
  const tpkCases = { honest: [E1.pub.tpk, true], identity: [T.ID, false], "order 2": [[0n, T.P_FIELD - 1n], false], "order 8": [T8, false], "TPK + order-8 point": [T.add(E1.pub.tpk, T8), false], "off-curve": [[E1.pub.tpk[0], E1.pub.tpk[1] + 1n], false], "valid point != A_0": [T.mul(T.G, 12345n), false] };
  for (const [k, [p, exp]] of Object.entries(tpkCases)) { const v = T.checkTpk(p, E1.pub); row("O15", `${lab}: TPK ${k}`, exp ? "accept" : "reject", v ? "accept" : "reject", v === exp); }
  row("O17", `${lab}: honest shares pass Feldman (epochs 1, 2)`, "pass", `${[...E1.members.map((m) => T.feldmanCheck(E1.pub, m)), ...E2.members.map((m) => T.feldmanCheck(E2.pub, m))].filter(Boolean).length}/${2 * c.n}`,
    E1.members.every((m) => T.feldmanCheck(E1.pub, m)) && E2.members.every((m) => T.feldmanCheck(E2.pub, m)));
  { const bad = { ...E1.members[1], s: (E1.members[1].s + 1n) % T.L }; row("O17", `${lab}: dealer sends member 2 the share s_2 + 1`, "complaint", T.feldmanCheck(E1.pub, bad) ? "pass" : "fail", !T.feldmanCheck(E1.pub, bad)); }
}
// ---------- O16 (structural) ----------
{ const src = fs.readFileSync(new URL("../E6-threshold-opening_20261009/threshold.mjs", import.meta.url), "utf8"); const body = src.slice(src.indexOf("export function combine"), src.indexOf("// ---------------- v7 public-signal"));
  const usesSecret = /\.s\b|_tsk|members/.test(body); row("O16", "combine() never touches member secrets / _tsk (threshold.mjs unchanged from E6)", "holds", `secret refs in combine: ${usesSecret}`, !usesSecret); }
// ---------- O20 / O21: ciphertexts from the real v9.1 gate (E7c) ----------
if (fs.existsSync(BATCH)) {
  const B = load(BATCH); const c = COMMITTEES.find((x) => x.t === 3); const E1 = dealC(c, 1);
  row("O20", "E7c batch committee TPK = (3,5) epoch-1 TPK", "equal", String(B.tpk.join() === E1.pub.tpk.map(String).join()), B.tpk.join() === E1.pub.tpk.map(String).join());
  for (const D of DS) { const acts = B.actions.filter((x) => x.D === D); let ok = 0, ctEq = 0;
    for (const f of acts) { if (f.ct.join() === f.publicSignals.slice(6, f.publicSignals.length - 4).join()) ctEq++;
      const a = await present(f, [E1]); if (a.refuse) continue; const r = openWith(a, [1, 3, 5].map((i) => share(E1, i, a.ctx))); if (r.status === "OK" && truth(f, r.pts)) ok++; }
    row("O20", `D=${D}: gate-emitted ciphertexts (E7c B1 asserts Accountability ct = these words) opened by members 1,3,5`, "open, exact", `${ok}/${acts.length} exact; ct = proof words ${ctEq}/${acts.length}`, ok === acts.length && ctEq === acts.length && acts.length > 0); }
  for (const o of B.offcurve.filter((x) => x.proof)) { const f = { ...o, D: 4 }; const a = await present(f, [E1], f.publicSignals, { ver: "v9" });
    if (a.refuse) { row("O21", `j=${o.j}: v9 off-curve proof`, "presentable with the v9 VK", a.refuse, false); continue; }
    const r = openWith(a, [1, 3, 5].map((i) => share(E1, i, a.ctx))); const w = wrongAt(f, r.pts);
    row("O21", `j=${o.j}: v9 off-curve proof (accepted by a v9 gate in E7c), opened`, `wrong key exactly at hop ${o.j}`, `${r.status}; wrong at [${(w ?? []).map((x, k) => (x ? k : null)).filter((x) => x !== null)}]`,
      r.status === "OK" && Array.isArray(w) && w.every((x, k) => x === (k === o.j))); }
} else row("O20", "E7c batch fixture", "present", "missing " + BATCH, false);

const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const perfOut = Object.fromEntries(Object.entries(perf).map(([k, v]) => [k, { n: v.length, median_ms: +q(v, 0.5).toFixed(3), p95_ms: +q(v, 0.95).toFixed(3), mean_ms: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3),
  sd_ms: +Math.sqrt(v.reduce((a, b) => a + (b - v.reduce((x, y) => x + y, 0) / v.length) ** 2, 0) / Math.max(1, v.length - 1)).toFixed(3) }]));
const failed = rows.filter((r) => !r.pass);
console.log(JSON.stringify({ date: new Date().toISOString(), host: os.hostname(), cpu: `${os.cpus()[0].model} x${os.cpus().length}`, node: process.version, total: rows.length, failed: failed.length, rows, perf: perfOut },
  (k, v) => (typeof v === "bigint" ? String(v) : v), 1));
console.error(`${rows.length} rows, ${failed.length} not as pre-registered`); process.exit(0);

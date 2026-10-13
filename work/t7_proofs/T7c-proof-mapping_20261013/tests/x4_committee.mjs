// T7c X4 (PLAN.md): committee configuration. X4b records what E6's threshold.mjs does today for invalid configurations (no change to that library),
// then tests a validator `validCommittee` (this file) on the same cases. usage: node x4_committee.mjs > ../results/x4_committee.json
const W = new URL("../../../", import.meta.url).pathname;
const T = await import(W + "t4_accountability/E6-threshold-opening_20261009/threshold.mjs");
const out = { today: [], validator: [] };
const tryDeal = (cfg) => { try { const d = T.deal(cfg); return { dealt: true, t: d.pub.t, n: d.pub.n, commitments: d.pub.commitments.length, members: d.members.length, tpkValid: T.validPoint(d.pub.tpk) }; } catch (e) { return { dealt: false, error: String(e.message ?? e).slice(0, 80) }; } };
// validator: what a deployment must check before fixing TPK in a gate (OP-6). Pure function of the public committee description.
export function validCommittee(pub) {
  const why = [];
  if (!Number.isInteger(pub.t) || !Number.isInteger(pub.n)) why.push("t, n not integers");
  if (!(pub.t >= 1)) why.push("t < 1"); if (!(pub.n >= 1)) why.push("n < 1"); if (pub.t > pub.n) why.push("t > n");
  if (!Array.isArray(pub.commitments) || pub.commitments.length !== pub.t) why.push("Feldman vector length != t");
  if (!Array.isArray(pub.Y) || pub.Y.length !== pub.n) why.push("member key count != n");
  for (const [k, A] of (pub.commitments ?? []).entries()) if (!T.validPoint(A)) { why.push(`commitment ${k} not a valid subgroup point`); break; }
  for (const [i, Y] of (pub.Y ?? []).entries()) if (!T.validPoint(Y)) { why.push(`member key ${i + 1} invalid`); break; }
  if (pub.commitments?.[0] && !T.eq(pub.tpk, pub.commitments[0])) why.push("tpk != A_0");
  if (pub.Y && pub.commitments) for (let i = 1; i <= pub.n; i++) {             // Y_i must equal the Feldman evaluation sum_k i^k A_k
    let rhs = T.ID; for (let k = 0; k < pub.commitments.length; k++) rhs = T.add(rhs, T.mul(pub.commitments[k], BigInt(i) ** BigInt(k)));
    if (!T.eq(rhs, pub.Y[i - 1])) { why.push(`Y_${i} != Feldman evaluation`); break; } }
  const keys = new Set((pub.Y ?? []).map((y) => y.join())); if (keys.size !== (pub.Y ?? []).length) why.push("duplicate member keys");
  return { valid: why.length === 0, why };
}
const good = (t, n) => T.deal({ t, n, epoch: 1, seed: `x4-${t}-${n}` }).pub;
const cases = [
  ["honest (2,3)", () => good(2, 3), true], ["honest (3,5)", () => good(3, 5), true], ["honest (5,9)", () => good(5, 9), true],
  ["t = 0", () => ({ ...good(3, 5), t: 0 }), false], ["t > n (t = 6, n = 5)", () => ({ ...good(3, 5), t: 6 }), false], ["n = 0", () => ({ ...good(3, 5), n: 0, Y: [] }), false],
  ["Feldman vector too short", () => { const p = good(3, 5); return { ...p, commitments: p.commitments.slice(0, 2) }; }, false],
  ["Feldman vector too long", () => { const p = good(3, 5); return { ...p, commitments: [...p.commitments, T.mul(T.G, 7n)] }; }, false],
  ["duplicate member (Y_2 = Y_1)", () => { const p = good(3, 5); const Y = [...p.Y]; Y[1] = Y[0]; return { ...p, Y }; }, false],
  ["tpk = identity", () => ({ ...good(3, 5), tpk: T.ID }), false], ["tpk = valid point != A_0", () => ({ ...good(3, 5), tpk: T.mul(T.G, 12345n) }), false],
  ["A_1 small-order", () => { const p = good(3, 5); const c = [...p.commitments]; c[1] = [0n, T.P_FIELD - 1n]; return { ...p, commitments: c }; }, false],
];
for (const [cfg, label] of [[{ t: 0, n: 5, epoch: 1, seed: "x" }, "t = 0"], [{ t: 6, n: 5, epoch: 1, seed: "x" }, "t > n"], [{ t: 3, n: 0, epoch: 1, seed: "x" }, "n = 0"], [{ t: -1, n: 5, epoch: 1, seed: "x" }, "t < 0"]])
  out.today.push({ case: label, deal: tryDeal(cfg) });
{ const p = good(3, 5); const a = { epoch: 1, ev: "x", tpk: p.tpk, c1s: [T.mul(T.G, 99n)] };
  const pub6 = { ...p, t: 6 }; let r; try { r = T.combine(pub6, a, []).status; } catch (e) { r = "throws " + String(e.message).slice(0, 60); }
  out.today.push({ case: "combine with t > n", result: r, note: "no shares can ever reach t: opening impossible, not detected at setup" }); }
for (const [label, mk, exp] of cases) { const v = validCommittee(mk()); out.validator.push({ case: label, expected: exp ? "valid" : "invalid", got: v.valid ? "valid" : "invalid", why: v.why, pass: v.valid === exp }); }
out.summary = { validator_cases: out.validator.length, validator_pass: out.validator.filter((x) => x.pass).length, gate_checks_tpk_on_chain: false, note: "the gate stores tpk immutably without checks (T3 A22i; Gate 77-78): validCommittee is an off-chain deployment check" };
console.log(JSON.stringify(out, (k, v) => (typeof v === "bigint" ? String(v) : v), 1)); process.exit(0);

// H3 pre-study C2/C3 witness cases on circuits/note_transfer.circom. usage: node cases.mjs > results/cases.json
import * as N from "./note_lib.mjs";
const rows = []; const row = (id, c, exp, ok, extra = {}) => { const pass = exp === ok; rows.push({ id, case: c, expected: exp ? "accept" : "reject", observed: ok ? "accept" : "reject", pass, ...extra }); if (!pass) console.error("UNEXPECTED", id, c); };
const P = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const w = await N.World.create();
const K = { P: N.key("P"), A: N.key("A"), B: N.key("B"), C: N.key("C"), D: N.key("D"), Bf: N.key("B-fresh") };
// root note of P: budget 100, lineage [root edge]
const root = w.add({ own: K.P.pk, q: 100n, lin: [N.edgeId([0n, 1n], K.P.pk, N.rho("root")), 0n, 0n, 0n], rho: N.rho("n0") });
// build a chain by real transfers: P -> A (60) -> B (40) -> C (15); every step is checked for satisfiability and its outputs are added to the tree
async function step(id, n, k, args, label) { const t = N.transfer(w, n, k, args); const ok = await N.satisfiable(t.input); row(id, label, true, ok); w.add(t.out1); w.add(t.out2); return t; }
const t1 = await step("C3", root, K.P, { q1: 60n, rho1: N.rho("1a"), child: K.A.pk, q2: 40n, rho2: N.rho("1b") }, "depth 1: P delegates 60 to A, change 40");
const nA = t1.out1;
const t2 = await step("C3", nA, K.A, { q1: 40n, rho1: N.rho("2a"), child: K.B.pk, q2: 20n, rho2: N.rho("2b") }, "depth 2: A delegates 40 to B, change 20");
const nB = t2.out1;
const t3 = await step("C3", nB, K.B, { q1: 15n, rho1: N.rho("3a"), q2: 25n, rho2: N.rho("3b") }, "depth 3: B splits 15 / 25 (same owner)");
const t4 = await step("C3", t3.out1, K.B, { q1: 15n, rho1: N.rho("4a"), child: K.C.pk, q2: 0n, rho2: N.rho("4b") }, "depth 3: B delegates 15 to C");
const nC = t4.out1;
const t5 = await step("C3", nC, K.C, { q_spent: 5n, q1: 0n, rho1: N.rho("5a"), q2: 10n, rho2: N.rho("5b") }, "depth 4: C spends 5, change 10");
const nC2 = t5.out2;
const t6 = await step("C3", t3.out2, K.B, { q1: 25n, rho1: N.rho("6a"), child: K.Bf.pk, q2: 0n, rho2: N.rho("6b") }, "depth 3: B 'rotates' 25 to its fresh key B' (lineage grows)");
const nBf = t6.out1;
row("C3", "depth 4 note cannot delegate further (no free lineage slot)", false, await N.satisfiable(N.transfer(w, nC2, K.C, { q1: 5n, rho1: N.rho("x"), child: K.D.pk, q2: 5n, rho2: N.rho("y") }).input));

// C2 negatives on A's remaining note (t2.out2, 20 units, depth 2)
const nA2 = t2.out2; const base = () => N.transfer(w, nA2, K.A, { q_spent: 5n, q1: 5n, rho1: N.rho("n1"), q2: 10n, rho2: N.rho("n2") });
{ const t = base(); row("C3", "control: A spends 5, split 5 / 10", true, await N.satisfiable(t.input)); }
{ const t = base(); t.input.q2 = "11"; t.input.cm_out2 = String(N.cm({ ...t.out2, q: 11n })); row("C2", "q_spent + q1 + q2 = q_in + 1 (out2 commitment consistent)", false, await N.satisfiable(t.input)); }
{ const t = base(); const q1 = P - 1n, q2 = (20n - 5n - q1 + P) % P; t.input.q1 = String(q1); t.input.q2 = String(q2); t.input.cm_out1 = String(N.cm({ ...t.out1, q: q1 })); t.input.cm_out2 = String(N.cm({ ...t.out2, q: q2 }));
  row("C2", "field wrap: q1 = p - 1, q2 chosen so the field sum matches", false, await N.satisfiable(t.input)); }
{ const t = base(); const lin = [...t.out2.lin]; lin[1] = 0n; t.input.cm_out2 = String(N.cm({ ...t.out2, lin })); row("C2", "change note drops the last lineage entry", false, await N.satisfiable(t.input)); }
{ const t = base(); const lin = [...t.out1.lin]; lin[1] = 0n; t.input.cm_out1 = String(N.cm({ ...t.out1, lin })); row("C2", "split output drops the last lineage entry", false, await N.satisfiable(t.input)); }
{ const t = base(); t.input.o1 = K.D.pk.map(String); t.input.cm_out1 = String(N.cm({ ...t.out1, own: K.D.pk })); row("C2", "out1 to another owner without the delegate edge", false, await N.satisfiable(t.input)); }
{ const t = N.transfer(w, nA2, K.A, { q1: 5n, rho1: N.rho("d1"), child: K.D.pk, q2: 15n, rho2: N.rho("d2") }); t.input.cm_out1 = String(N.cm({ ...t.out1, lin: [...nA2.lin] }));
  row("C2", "delegate to D but out1 omits the new edge", false, await N.satisfiable(t.input)); }
{ const t = base(); t.input.sk = String(K.B.sk); row("C2", "wrong sk (B's key on A's note)", false, await N.satisfiable(t.input)); }
{ const t = base(); const lin = [nA2.lin[0], 0n, nA2.lin[1], 0n]; t.input.lin = lin.map(String); row("C2", "input lineage with a hole (skip slot 1's revocation check)", false, await N.satisfiable(t.input)); }

// revocation: revoke edge A->B (lin[2] of B's notes; lin = [root, P->A, A->B, ...]). B's split output, B's rotated note and C's note must all be frozen; A's own note stays usable.
const eAB = nB.lin[2]; const before = { C: N.transfer(w, nC2, K.C, { q_spent: 1n, q1: 0n, rho1: N.rho("r1"), q2: 9n, rho2: N.rho("r2") }).input };
w.rev.insert(eAB);
for (const [label, note, key] of [["C (grandchild, via split + delegate)", nC2, K.C], ["B' (rotated fresh key)", nBf, K.Bf]]) {
  let ok = false, why = "no non-membership witness"; try { const t = N.transfer(w, note, key, { q_spent: 1n, q1: 0n, rho1: N.rho("s1" + label), q2: note.q - 1n, rho2: N.rho("s2" + label) }); ok = await N.satisfiable(t.input); why = "unsatisfiable"; } catch {}
  row("C2", `after revoking A->B: spend by ${label}`, false, ok, { why }); }
{ const t = N.transfer(w, nA2, K.A, { q_spent: 5n, q1: 5n, rho1: N.rho("m1"), q2: 10n, rho2: N.rho("m2") }); row("C3", "after revoking A->B: A's own note (sibling side) still spends", true, await N.satisfiable(t.input)); }
{ const t = { ...before.C, revoked_root: String(w.rev.root) }; row("C2", "C with its pre-revocation witness and the NEW revoked root", false, await N.satisfiable(t)); }
{ row("C2", "C with its pre-revocation witness and the OLD revoked root (POLICY: gate window, as E3 A2)", true, await N.satisfiable(before.C), { policy: true }); }
{ // exhaustive low-leaf substitution for the revoked slot (lin[2]) of C's note
  const t = before.C; let acc = 0; for (let i = 0; i < w.rev.leaves.length; i++) { const Lf = w.rev.leaves[i], p = w.rev.path(i); const x = structuredClone(t); x.revoked_root = String(w.rev.root);
    x.r_low_value[2] = String(Lf.value); x.r_low_next_index[2] = String(Lf.nextIndex); x.r_low_next_value[2] = String(Lf.nextValue); x.r_sib[2] = p.sib.map(String); x.r_bit[2] = p.bit.map(String);
    for (const j of [0, 1, 3]) { const m = w.rev.nonMemberWitness(BigInt(t.lin[j])); x.r_low_value[j] = m.low_value; x.r_low_next_index[j] = m.low_next_index; x.r_low_next_value[j] = m.low_next_value; x.r_sib[j] = m.sib; x.r_bit[j] = m.bit; }
    const km = w.rev.nonMemberWitness(N.keyEntry(nC2.own)); Object.assign(x, { k_low_value: km.low_value, k_low_next_index: km.low_next_index, k_low_next_value: km.low_next_value, k_sib: km.sib, k_bit: km.bit });
    if (await N.satisfiable(x)) acc++; }
  rows.push({ id: "C2", case: `revoked slot of C's note: every IMT leaf (${w.rev.leaves.length}) as low leaf`, expected: "all reject", observed: `${acc}/${w.rev.leaves.length} accepted`, pass: acc === 0 }); }
// owner-key revocation
w.rev.insert(N.keyEntry(K.A.pk)); { let ok = false; try { ok = await N.satisfiable(N.transfer(w, nA2, K.A, { q1: 20n, rho1: N.rho("k1"), q2: 0n, rho2: N.rho("k2") }).input); } catch {} row("C2", "A's key revoked: A cannot move its note", false, ok); }
console.log(JSON.stringify({ date: new Date().toISOString(), rows, unexpected: rows.filter((r) => !r.pass).length }, null, 1));
console.error(`${rows.length} rows, ${rows.filter((r) => !r.pass).length} unexpected`); process.exit(0);

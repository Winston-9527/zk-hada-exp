// H3 pre-study M1–M6 (PREREGISTRATION.md): three authorization semantics on the same workloads. Plain JS reference model, no circuits.
// S1 per-edge caps (attenuation + per-action max_amount, #16 option 2): stateless except a per-action nullifier.
// S2 public atomic ledger: remaining[root_id], decremented per spend; root_id is public on every spend.
// S3 private notes: UTXO notes {owner, q, lineage}, nullifier per note, conservation, lineage only grows, spend requires no revoked edge / owner key.
// usage: node model.mjs > results/model.json
let seed = 0x2545F4914F6CDD1Dn; const rnd = () => { seed ^= seed << 13n; seed &= (1n << 64n) - 1n; seed ^= seed >> 7n; seed ^= seed << 17n; seed &= (1n << 64n) - 1n; return Number(seed % 1000000n) / 1e6; };
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------------- S1 ----------------
class S1 { constructor() { this.cert = new Map(); this.used = new Set(); this.accepted = 0; }
  issue(parent, child, max) { const pm = parent ? this.cert.get(parent) : Infinity; if (max > pm) return false; this.cert.set(child, max); return true; }
  spend(agent, amount, nonce) { const k = `${agent}/${nonce}`; if (this.used.has(k) || !(amount <= (this.cert.get(agent) ?? -1))) return false; this.used.add(k); this.accepted += amount; return true; } }
// ---------------- S2 ----------------
class S2 { constructor() { this.remaining = new Map(); this.rootOf = new Map(); this.accepted = 0; this.publicLog = []; }
  mint(root, b) { this.remaining.set(root, b); this.rootOf.set(root, root); }
  issue(parent, child) { this.rootOf.set(child, this.rootOf.get(parent)); }
  spend(agent, amount) { const r = this.rootOf.get(agent); this.publicLog.push(r); if ((this.remaining.get(r) ?? 0) < amount) return false; this.remaining.set(r, this.remaining.get(r) - amount); this.accepted += amount; return true; } }
// ---------------- S3 ----------------
class S3 {
  constructor({ dropLineageOnSplit = false } = {}) { this.notes = []; this.nullified = new Set(); this.revokedEdges = new Set(); this.revokedKeys = new Set(); this.minted = 0; this.spent = 0; this.mutant = dropLineageOnSplit; this.violations = []; this.edgeCtr = 0; }
  mint(owner, q) { this.minted += q; return this._out(owner, q, []); }
  _out(owner, q, lineage) { const id = this.notes.length; this.notes.push({ id, owner, q, lineage: [...lineage] }); return id; }
  _ok(n) { const x = this.notes[n]; return x && !this.nullified.has(n) && !x.lineage.some((e) => this.revokedEdges.has(e)) && !this.revokedKeys.has(x.owner); }
  _consume(n) { this.nullified.add(n); }
  // returns new note ids or null if rejected. Ground truth used by M6: a spend is "legitimate" only if no ancestor edge of the note's TRUE history is revoked.
  split(n, q1) { if (!this._ok(n) || q1 <= 0 || q1 >= this.notes[n].q) return null; const x = this.notes[n]; this._consume(n);
    const lin = this.mutant ? x.lineage.slice(0, -1) : x.lineage;                       // mutant: drops the last lineage entry
    const a = this._out(x.owner, q1, lin), b = this._out(x.owner, x.q - q1, x.lineage); this.notes[a].trueLineage = x.trueLineage ?? x.lineage; this.notes[b].trueLineage = x.trueLineage ?? x.lineage; return [a, b]; }
  delegate(n, child, q1) { if (!this._ok(n) || q1 <= 0 || q1 > this.notes[n].q) return null; const x = this.notes[n]; this._consume(n); const e = `e${this.edgeCtr++}:${x.owner}>${child}`;
    const a = this._out(child, q1, [...x.lineage, e]); this.notes[a].trueLineage = [...(x.trueLineage ?? x.lineage), e];
    const out = [a]; if (x.q - q1 > 0) { const b = this._out(x.owner, x.q - q1, x.lineage); this.notes[b].trueLineage = x.trueLineage ?? x.lineage; out.push(b); } return out; }
  spend(n, a) { const x = this.notes[n]; if (!x) return null; const legit = !this.nullified.has(n) && !(x.trueLineage ?? x.lineage).some((e) => this.revokedEdges.has(e));
    if (!this._ok(n) || a <= 0 || a > x.q) { return null; }
    if (!legit) this.violations.push({ kind: this.nullified.has(n) ? "double-spend" : "spend-from-revoked-lineage", note: n });
    this._consume(n); this.spent += a; const out = []; if (x.q - a > 0) { const b = this._out(x.owner, x.q - a, x.lineage); this.notes[b].trueLineage = x.trueLineage ?? x.lineage; out.push(b); } return out; }
  revokeEdge(e) { this.revokedEdges.add(e); }
  unspentBalance() { return this.notes.reduce((s, x) => s + (this.nullified.has(x.id) ? 0 : x.q), 0); }
  invariant() { return this.minted === this.spent + this.unspentBalance(); }
}
const out = { date: new Date().toISOString() };

// M1 sibling amplification
{ const s1 = new S1(); s1.issue(null, "P", 100); s1.issue("P", "A", 100); s1.issue("P", "B", 100); s1.spend("A", 100, 1); s1.spend("B", 100, 1);
  const s2 = new S2(); s2.mint("P", 100); s2.issue("P", "A"); s2.issue("P", "B"); s2.spend("A", 100); s2.spend("B", 100);
  const s3 = new S3(); const r = s3.mint("P", 100); const [a, b] = s3.delegate(r, "A", 100); const tryB = s3.delegate(a === undefined ? r : r, "B", 100);   // P's note already consumed
  const sa = s3.spend(a, 100);
  out.M1 = { S1_accepted: s1.accepted, S2_accepted: s2.accepted, S3_accepted: s3.spent, S3_second_delegation_of_same_note: tryB === null ? "rejected (note already consumed)" : "accepted", budget: 100 }; }

// M2 E2 core: 100 units, 32 agents × 10, one block, random order
{ const agents = Array.from({ length: 32 }, (_, i) => `A${i}`);
  const s1 = new S1(); s1.issue(null, "P", 100); agents.forEach((g) => s1.issue("P", g, 10)); shuffle([...agents]).forEach((g) => s1.spend(g, 10, 1));
  const s2 = new S2(); s2.mint("P", 100); agents.forEach((g) => s2.issue("P", g)); let ok2 = 0; shuffle([...agents]).forEach((g) => { if (s2.spend(g, 10)) ok2++; });
  // S3a: one shared note (all agents know it); every tx in the block was built against the same note version -> nullifier serialises
  const s3a = new S3(); const r = s3a.mint("P", 100); let ok3a = 0; for (const g of shuffle([...agents])) if (s3a.spend(r, 10)) ok3a++;
  // S3b: parent pre-splits into 10 notes of 10 delegated to the first 10 agents; the other 22 hold nothing
  const s3b = new S3(); let cur = s3b.mint("P", 100); const held = new Map();
  for (let i = 0; i < 10; i++) { const o = s3b.delegate(cur, agents[i], 10); held.set(agents[i], o[0]); cur = o[1]; }
  let ok3b = 0; for (const g of shuffle([...agents])) if (held.has(g) && s3b.spend(held.get(g), 10)) ok3b++;
  out.M2 = { budget: 100, agents: 32, each: 10, S1_accepted_total: s1.accepted, S2: { succeeded: ok2, rejected: 32 - ok2, accepted_total: s2.accepted },
    S3_one_shared_note: { succeeded_in_block: ok3a, note: "one success per note version per block; the change note must be re-proved for the next block" },
    S3_presplit_10x10: { succeeded_in_block: ok3b, accepted_total: s3b.spent, presplit_transactions: 10 }, invariants: [s3a.invariant(), s3b.invariant()] }; }

// M3 repetition
{ const s1 = new S1(); s1.issue(null, "P", 100); s1.issue("P", "A", 10); for (let k = 0; k < 50; k++) s1.spend("A", 10, k);
  const s2 = new S2(); s2.mint("P", 100); s2.issue("P", "A"); for (let k = 0; k < 50; k++) s2.spend("A", 10);
  const s3 = new S3(); let n = s3.delegate(s3.mint("P", 100), "A", 100)[0]; for (let k = 0; k < 50 && n !== undefined; k++) { const o = s3.spend(n, 10); n = o?.[0]; }
  out.M3 = { S1_accepted: s1.accepted, S2_accepted: s2.accepted, S3_accepted: s3.spent }; }

// M4 revocation laundering
{ const s3 = new S3(); const r = s3.mint("P", 100); const [a] = s3.delegate(r, "A", 60); const [b, aRest] = s3.delegate(a, "B", 40);
  const edgeAB = s3.notes[b].lineage.at(-1);
  const [b1, b2] = s3.split(b, 15); const [bRot, b2Rest] = s3.delegate(b2, "B-fresh-key", 25);   // "rotation" = delegate to own fresh key (lineage grows)
  const [c] = s3.delegate(b1, "C", 15);
  s3.revokeEdge(edgeAB);
  const tries = { split_output: s3.spend(bRot === undefined ? b1 : b1, 1), rotated: s3.spend(bRot, 1), grandchild_C: s3.spend(c, 1), sibling_A_rest: s3.spend(aRest, 1) };
  out.M4 = { revoked: edgeAB, S3: Object.fromEntries(Object.entries(tries).map(([k, v]) => [k, v === null ? "rejected (frozen)" : "accepted"])),
    invariant_holds: s3.invariant(), frozen_balance: [b1, bRot, c].filter((x) => x !== undefined && !s3.nullified.has(x)).reduce((s, x) => s + s3.notes[x].q, 0),
    S2: "a per-root counter has no per-edge state: blocking only B's subtree needs either public lineage on every spend or root-level revocation (kills A too)" }; }

// M5 privacy cost of S2: linkability of spends under one root
{ const s2 = new S2(); s2.mint("P", 1000); for (let i = 0; i < 20; i++) s2.issue("P", `A${i}`); for (let i = 0; i < 20; i++) for (let k = 0; k < 5; k++) s2.spend(`A${i}`, 1);
  const pairs = s2.publicLog.length * (s2.publicLog.length - 1) / 2; let linked = 0; for (let i = 0; i < s2.publicLog.length; i++) for (let j = i + 1; j < s2.publicLog.length; j++) if (s2.publicLog[i] === s2.publicLog[j]) linked++;
  out.M5 = { spends: s2.publicLog.length, S2_publicly_linked_pairs: `${linked}/${pairs}`, S1_S3: "no public field shared between spends (nullifiers / commitments)" }; }

// M6 small-model exhaustive check of S3 (and a mutant)
function explore(mutant, maxOps) {
  let states = 0, violations = [], invariantFailures = 0;
  const ops = (s) => { const L = []; s.notes.forEach((x) => { if (s.nullified.has(x.id)) { L.push(["spend", x.id, 1]); return; }   // double-spend attempt on consumed notes
      for (let q = 1; q < x.q; q++) L.push(["split", x.id, q]); for (const c of ["C1", "C2"]) for (let q = 1; q <= x.q; q++) L.push(["delegate", x.id, c, q]); for (let q = 1; q <= x.q; q++) L.push(["spend", x.id, q]); });
    for (const e of new Set(s.notes.flatMap((x) => x.trueLineage ?? x.lineage))) if (!s.revokedEdges.has(e)) L.push(["revoke", e]); return L; };
  const clone = (s) => { const t = new S3({ dropLineageOnSplit: mutant }); t.notes = s.notes.map((x) => ({ ...x, lineage: [...x.lineage], trueLineage: x.trueLineage && [...x.trueLineage] })); t.nullified = new Set(s.nullified); t.revokedEdges = new Set(s.revokedEdges); t.revokedKeys = new Set(s.revokedKeys); t.minted = s.minted; t.spent = s.spent; t.edgeCtr = s.edgeCtr; return t; };
  const dfs = (s, d) => { states++; if (!s.invariant()) invariantFailures++; if (s.violations.length) { violations.push(...s.violations); return; } if (d === maxOps) return;
    for (const op of ops(s)) { const t = clone(s); if (op[0] === "split") t.split(op[1], op[2]); else if (op[0] === "delegate") t.delegate(op[1], op[2], op[3]); else if (op[0] === "spend") t.spend(op[1], op[2]); else t.revokeEdge(op[1]); dfs(t, d + 1); } };
  const s0 = new S3({ dropLineageOnSplit: mutant }); const r = s0.mint("P", 4); s0.notes[r].lineage = ["root"]; s0.notes[r].trueLineage = ["root"];
  const t0 = Date.now(); dfs(s0, 0); return { max_ops: maxOps, states_explored: states, invariant_failures: invariantFailures, violations: violations.length, example: violations[0] ?? null, ms: Date.now() - t0 };
}
out.M6 = { S3: explore(false, 5), mutant_drop_lineage_on_split: explore(true, 5) };
console.log(JSON.stringify(out, null, 1));

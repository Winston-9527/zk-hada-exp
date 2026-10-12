// T5b part A (PREREGISTRATION.md): every agent blocked in the final T5 world, evaluated by the circuit with the best available non-membership
// witness for each revoked hop (pred = predecessor leaf, own = the revoked key's own leaf); 64 unblocked agents as honest controls.
// Offline on ../T5-e2e-scale_20261010/state (mirror, as E6b gen.mjs). usage: node revoke_circuit.mjs > results/revoke_circuit.json
const C = await import(new URL("../T5-e2e-scale_20261010/common.mjs", import.meta.url).pathname);
const W91 = await import(new URL("../../t2_circuit_fix/zkdac_v9_1/scripts/witness_v9.mjs", import.meta.url).pathname);
const BUILD = { v9: `${C.P.V9}/build`, "v9.1": new URL("../../t2_circuit_fix/zkdac_v9_1/build", import.meta.url).pathname };
const { createRequire } = await import("module"); const { poseidon3 } = createRequire(new URL("../../t2_circuit_fix/zkdac_v8/package.json", import.meta.url).pathname)("poseidon-lite");
const creds = C.loadCreds(), st = C.loadState(), m = await C.Mirror.from(st);
const revoked = new Set((st.revokedEdges ?? []).map((id) => creds[id].cert[creds[id].D - 1]));
const blocked = creds.filter((c) => c.cert.slice(1).some((x) => revoked.has(x)));
const free = C.shuffle(creds.filter((c) => !c.cert.slice(1).some((x) => revoked.has(x))).map((c) => c.id), "t5b-controls").slice(0, 64).map((id) => creds[id]);
const S = String; const inImt = (k) => m.imt.leaves.some((l) => l.value === k);
C.log("revoked edges", revoked.size, "blocked agents", blocked.length, "imt leaves", m.imt.leaves.length);
function honest(c) {   // as T5 prepare S1/S2 (no chain): current roots, issued paths, root proof, key slots, note, accountability
  const ag = C.agentObj(c); const input = structuredClone(ag.input); input.issued_root = S(m.issued.root);
  for (let i = 1; i < c.D; i++) { const p = m.issued.path(m.issued.index.get(S(ag.meta.cert[i]))); input.m_sib[i] = p.sib; input.m_bit[i] = p.bit; }
  Object.assign(input, C.L7.rootProof(m.roots, ag.meta.cert[0]));
  const meta = { ...ag.meta, imt: m.imt };
  for (let i = 0; i < c.D; i++) { const k = C.L9.trunc(ag.meta.cert[i]); if (inImt(k)) continue; const w = m.imt.nonMemberWitness(ag.meta.cert[i]);
    input.r_low_value[i] = w.low_value; input.r_low_next_index[i] = w.low_next_index; input.r_low_next_value[i] = w.low_next_value; input.r_sib[i] = w.sib; input.r_bit[i] = w.bit; }
  C.L9.refreshKeys(input, meta);
  const note = C.noteOf(st.agents[c.id].note); const cmIn = C.L8.noteCm(note);
  input.now = S(st.NOW + 100000); input.act_req_cap = "1"; input.ctx_hash = S(C.L7.ctxHash({ chainId: C.CHAIN, verifier: st.addrs.gate, method: C.METHOD, target: st.addrs.target, params: C.PARAMS, amount: 1n, nonce: 7n }));
  const change = { own: note.own, q: note.q - 1n, lin: note.lin, rho: C.L8.rnd250(`t5b-chg-${c.id}`) };
  Object.assign(input, { note_root: S(m.notes.root), budget_nf: S(poseidon3([C.L8.TAG_BNF, BigInt(input.holder_sk), cmIn])), cm_change: S(C.L8.noteCm(change)),
    q_spent: "1", q_in: S(note.q), rho_in: S(note.rho), q_change: S(change.q), rho_change: S(change.rho), ...C.L8.notePath(m.notes, cmIn) });
  return { input, ag };
}
function setLeaf(input, i, idx) { const L = m.imt.leaves[idx], p = m.imt.path(idx); input.r_low_value[i] = S(L.value); input.r_low_next_index[i] = S(L.nextIndex); input.r_low_next_value[i] = S(L.nextValue); input.r_sib[i] = p.sib.map(S); input.r_bit[i] = p.bit.map(S); }
async function evalBoth(D, input, seed) { C.L9.toV9(input, seed); const r = {}; for (const [v, b] of Object.entries(BUILD)) { const ok = await W91.satisfiable(D, input, b); r[v] = ok ? "accept" : W91.lastFail; } return r; }
const rows = [];
for (const c of free) { const { input } = honest(c); rows.push({ kind: "control_free", agent: c.id, D: c.D, ...(await evalBoth(c.D, input, `t5b-${c.id}`)) }); }
for (const c of blocked) { const { input, ag } = honest(c); const hops = [];
  for (let i = 0; i < c.D; i++) if (inImt(C.L9.trunc(ag.meta.cert[i]))) hops.push(i);
  for (const variant of ["pred", "own"]) { const x = structuredClone(input);
    for (const i of hops) { const k = C.L9.trunc(ag.meta.cert[i]); setLeaf(x, i, variant === "pred" ? m.imt.lowIndex(k) : m.imt.leaves.findIndex((l) => l.value === k)); }
    rows.push({ kind: `blocked_${variant}`, agent: c.id, D: c.D, revoked_hops: hops, ...(await evalBoth(c.D, x, `t5b-${c.id}-${variant}`)) }); }
  if (rows.length % 50 === 0) C.log(rows.length); }
const summ = {}; for (const r of rows) for (const v of Object.keys(BUILD)) { const k = `${r.kind} ${v}`; summ[k] ??= {}; summ[k][r[v]] = (summ[k][r[v]] ?? 0) + 1; }
const falseAccepts = rows.filter((r) => r.kind.startsWith("blocked") && (r.v9 === "accept" || r["v9.1"] === "accept"));
console.log(JSON.stringify({ world: "T5 final (1 % + 10 % revocations)", revoked_edges: revoked.size, blocked_agents: blocked.length, controls: free.length, summary: summ, false_accepts: falseAccepts, rows }, null, 1));
process.exit(0);

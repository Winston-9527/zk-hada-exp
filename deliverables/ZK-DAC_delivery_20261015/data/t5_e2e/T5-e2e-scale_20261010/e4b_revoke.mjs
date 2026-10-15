// T5 E4b step 3 (PREREGISTRATION.md): revocation at scale, r = 1% then 10% (cumulative) of the delegation edges (certificates at hop >= 1).
// usage: node e4b_revoke.mjs 1  > results/e4b_revoke_1.json ; node e4b_revoke.mjs 10 > results/e4b_revoke_10.json
import fs from "fs";
import * as C from "./common.mjs";
const rate = Number(process.argv[2]); if (![1, 10].includes(rate)) throw new Error("rate 1 or 10");
const creds = C.loadCreds(); const st = C.loadState(); const m = await C.Mirror.from(st);
const ch = await C.connect(); const K = await C.contracts(ch, st.addrs); const ERR = C.errMap();
// ---------- which edges ----------
const edges = creds.filter((c) => c.D >= 2).map((c) => c.id);                      // edge into agent c = its last certificate cert[D-1]
const perm = C.shuffle(edges, "t5-revoke"); const n = Math.round((rate / 100) * edges.length);
st.revokedEdges ??= []; const prev = st.revokedEdges.length;
if (JSON.stringify(st.revokedEdges) !== JSON.stringify(perm.slice(0, prev))) throw new Error("revoked edges do not follow the pre-registered order");
const now_ = perm.slice(prev, n);
const certSet = (ids) => new Set(ids.map((id) => creds[id].cert[creds[id].D - 1]));
const blockedBy = (S) => new Set(creds.filter((c) => c.cert.slice(1).some((x) => S.has(x))).map((c) => c.id));
const before = blockedBy(certSet(st.revokedEdges)), after = blockedBy(certSet(perm.slice(0, n)));
const newly = [...after].filter((id) => !before.has(id)), free = creds.map((c) => c.id).filter((id) => !after.has(id));
const sDesc = C.shuffle(newly, `t5-revtx-${rate}-d`).slice(0, 32), sFree = C.shuffle(free, `t5-revtx-${rate}-f`).slice(0, 32);
C.log(`rate ${rate}%: revoke ${now_.length} edges (total ${n}); blocked agents ${before.size} -> ${after.size}; sample ${sDesc.length} desc + ${sFree.length} free`);
// ---------- in-flight proofs built BEFORE the revocation ----------
const pre = []; for (const id of [...sDesc, ...sFree]) pre.push(await C.prepare(ch, K, m, st, C.agentObj(creds[id])));
const preRevokedRoot = String(m.imt.root);
// ---------- revocations: real revoke_transition proofs + ZkDacRevocations txs, by each certificate's issuer ----------
const revRows = [];
for (const id of now_) { const c = creds[id]; const ag = C.agentObj(c); const hop = c.D - 1; const entry = BigInt(c.cert[hop]);
  const tr = C.RV.transition(m.imt, entry, C.RV.certAuthority({ input: c.input, meta: ag.meta }, hop, 0));
  let t = performance.now(); const p = await C.snarkjs.groth16.fullProve(tr.input, C.RV.WASM, C.P.RVK); const proveMs = performance.now() - t;
  const cdv = await C.cd(p.proof, p.publicSignals);
  const rc = await (await K.revs.revoke({ a: cdv[0], b: cdv[1], c: cdv[2] }, String(tr.newRoot), tr.input.entry, { nonce: ch.nonces[0]++ })).wait();
  m.imt.insert(entry); st.imtEntries.push(String(entry)); st.revokedEdges.push(id);
  if (String(await K.revs.root()) !== String(m.imt.root)) throw new Error("revocation root mismatch");
  revRows.push({ agent: id, hop, imt_size_before: m.imt.leaves.length - 1, prove_ms: +proveMs.toFixed(1), gas: rc.gasUsed.toNumber() }); }
C.saveState(st);
await ch.provider.send("evm_increaseTime", [C.RWIN + 1]); await ch.provider.send("evm_mine", []);
// ---------- in-flight proofs after the window ----------
const subRow = async (pr, label) => { await C.submit(ch, K, pr); const r = { label, agent: pr.ag.id, D: pr.D, status: pr.status, gasUsed: pr.gasUsed };
  if (pr.status === 1) C.afterSuccess(m, st, pr); else r.reason = await C.revertReason(ch, pr.tx.hash, ERR); return r; };
const inflight = []; for (const pr of pre) inflight.push(await subRow(pr, sDesc.includes(pr.ag.id) ? "descendant_prebuilt" : "free_prebuilt"));
// rebuilt on the new state: free agents must succeed (re-proof = availability cost); descendants must not get a witness
const rebuilt = []; const tR = performance.now(); let regState = null;
for (const id of sFree) { const pr = await C.prepare(ch, K, m, st, C.agentObj(creds[id])); if (pr.registerState) regState = pr.registerState; rebuilt.push({ ...(await subRow(pr, "free_rebuilt")), local_ms: C.row(pr).local_ms }); }
const rebuildMs = performance.now() - tR;
for (const id of sDesc) { let r; try { await C.prepare(ch, K, m, st, C.agentObj(creds[id]), { witnessOnly: true }); r = { label: "descendant_fresh", agent: id, outcome: "WITNESS_BUILT (unexpected)" }; }
  catch (e) { r = { label: "descendant_fresh", agent: id, outcome: e.code === "NO_WITNESS" ? "NO_WITNESS" : "ERROR " + String(e.message).slice(0, 80) }; } rebuilt.push(r); }
C.saveState(st);
// ---------- witness level, every agent ----------
const wl = { false_accept: [], collateral_denial: [], blocked_ok: 0, free_ok: 0, errors: [] }; const tW = performance.now();
for (const c of creds) { let sat;
  try { sat = (await C.prepare(ch, K, m, st, C.agentObj(c), { witnessOnly: true })).sat; } catch (e) { if (e.code === "NO_WITNESS") sat = false; else { wl.errors.push({ agent: c.id, error: String(e.message).slice(0, 120) }); continue; } }
  const exp = after.has(c.id);
  if (exp && sat) wl.false_accept.push(c.id); else if (!exp && !sat) wl.collateral_denial.push(c.id); else if (exp) wl.blocked_ok++; else wl.free_ok++; }
const wlMs = performance.now() - tW;
fs.writeFileSync(C.RES + `e4b_revoke_${rate}_rows.json`, JSON.stringify({ revocations: revRows, inflight, rebuilt }));
const cnt = (rows, label, f) => rows.filter((r) => r.label === label && f(r)).length;
console.log(JSON.stringify({ date: new Date().toISOString(), rate_pct: rate, edges_total: edges.length, revoked_now: now_.length, revoked_total: n, revoked_by_hop: Object.fromEntries([1, 2, 3].map((h) => [h, now_.filter((id) => creds[id].D - 1 === h).length])),
  blocked_expected_before: before.size, blocked_expected_after: after.size, newly_blocked: newly.length, pre_revoked_root: preRevokedRoot, new_revoked_root: String(m.imt.root),
  revocation: { n: revRows.length, prove_ms: revRows.map((r) => r.prove_ms), gas: revRows.map((r) => r.gas), imt_size_after: m.imt.leaves.length },
  inflight: { descendant_prebuilt: { n: sDesc.length, StaleRevokedRoot: cnt(inflight, "descendant_prebuilt", (r) => r.reason === "StaleRevokedRoot"), accepted: cnt(inflight, "descendant_prebuilt", (r) => r.status === 1) },
    free_prebuilt: { n: sFree.length, StaleRevokedRoot: cnt(inflight, "free_prebuilt", (r) => r.reason === "StaleRevokedRoot"), accepted: cnt(inflight, "free_prebuilt", (r) => r.status === 1) } },
  rebuilt: { free_rebuilt: { n: sFree.length, accepted: cnt(rebuilt, "free_rebuilt", (r) => r.status === 1), wall_ms: Math.round(rebuildMs) }, registerState_new_combination: regState,
    descendant_fresh: { n: sDesc.length, NO_WITNESS: cnt(rebuilt, "descendant_fresh", (r) => r.outcome === "NO_WITNESS") } },
  witness_level_all_agents: { agents: creds.length, false_accept: wl.false_accept.length, collateral_denial: wl.collateral_denial.length, blocked_ok: wl.blocked_ok, free_ok: wl.free_ok, errors: wl.errors, ids_false_accept: wl.false_accept, ids_collateral_denial: wl.collateral_denial, wall_ms: Math.round(wlMs) } }));
process.exit(0);

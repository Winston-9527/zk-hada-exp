// E8 A1 (PREREGISTRATION.md): service access. Operator O (D = 1) > agents A0..A2 (D = 2); tools search/fetch/compute/admin = methods with cap bits 0..3.
// A call = reserve(tool, requestId) through the gate (ServiceEscrow) -> local HTTP gateway serves only a reserved id -> gateway commits or fails;
// a crash after serving leaves the reservation open (uncertain). usage: SEED=0 PORT=8821 node a1.mjs > results/A1/0.json
import fs from "fs"; import os from "os"; import http from "http"; import crypto from "crypto"; import { World, ethers, sel } from "./e8lib.mjs";
const SEED = Number(process.env.SEED ?? 0), PORT = Number(process.env.PORT ?? 8821); const HERE = new URL(".", import.meta.url).pathname;
const tr = JSON.parse(fs.readFileSync(`${HERE}traces/A1/${SEED}.json`)); const wall0 = Date.now();
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), `A1-${SEED}`, ...a);
const w = await World.create({ port: PORT, tag: `A1-${SEED}`, log });
const FAR = 4_000_000_000; const TOOLS = ["search", "fetch", "compute", "admin"]; const M = Object.fromEntries(TOOLS.map((t, i) => [t, { m: sel(`${t}(bytes32)`), cap: 1 << i }]));
const O = await w.issue(["H0", "O"], [0b0111], [FAR]); await w.deployGate(O.meta.tpk.map(String)); await w.registerRoot(O);
const T0plan = w.clock + 600;                 // agents are issued before T0; the expiring agent's certificate ends at T0 + trace.expiry.at
const A = []; for (let i = 0; i < 3; i++) A.push(await w.issue(["H0", "O", `A${i}`], [0b0111, tr.caps[i]], [FAR, i === tr.expiry.agent ? T0plan + tr.expiry.at : FAR]));
await w.publish(); for (const t of TOOLS) await w.setMethod(M[t].m, M[t].cap);
const escrow = await w.deploy("E8Apps.sol", "E8ServiceEscrow", [w.gate.address, w.gatewayWallet.address]);
let nO = await w.mint(O, 200); const note = [];
for (let i = 0; i < 3; i++) { const t = await w.transfer(O, nO, { to: A[i], q1: tr.budget, q2: nO.q - BigInt(tr.budget) }); note.push(t.out1); nO = t.out2; }
// ---------- local HTTP gateway: serves a request only if its reservation exists on chain ----------
const gw = http.createServer(async (rq, rs) => { const u = new URL(rq.url, "http://x"); const id = u.searchParams.get("id");
  const st = (await escrow.res(id)).st; if (st !== 1) { rs.writeHead(403); rs.end(JSON.stringify({ error: "no reservation", st })); return; }
  rs.writeHead(200); rs.end(JSON.stringify({ tool: u.searchParams.get("tool"), result: crypto.createHash("sha256").update(id).digest("hex") })); });
await new Promise((r) => gw.listen(PORT + 1000, "127.0.0.1", r));
const call = (id, tool) => new Promise((res, rej) => http.get(`http://127.0.0.1:${PORT + 1000}/serve?id=${id}&tool=${tool}`, (r) => { let b = ""; r.on("data", (d) => (b += d)); r.on("end", () => res({ code: r.statusCode, body: JSON.parse(b) })); }).on("error", rej));
await w.advanceTo(T0plan); const T0 = w.clock; log("setup done", Math.round((Date.now() - wall0) / 1000), "s");
let rid = 0; const reqId = () => ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`A1-${SEED}-${rid++}`));
async function reserve(agent, tool, amount = 1, extra = {}) {
  const id = reqId(); const p = await w.prepare(A[agent], note[agent], { method: M[tool].m, reqCap: M[tool].cap, amount, params: ethers.utils.defaultAbiCoder.encode(["bytes32"], [id]), target: escrow, ...extra });
  return { id, p }; }
async function serve(id, tool, outcome) {      // the gateway's side after a reservation was accepted
  const r = await call(id, tool); if (r.code !== 200) return { served: false, code: r.code };
  if (outcome === "commit") await w.opTx(escrow, "commit", [id, "0x" + r.body.result], w.gatewayWallet); else if (outcome === "fail") await w.opTx(escrow, "fail", [id], w.gatewayWallet);
  return { served: true, final: outcome === "crash" ? "uncertain" : outcome }; }
const rows = []; const oldNote = {};
for (const e of tr.events) {
  await w.advanceTo(T0 + e.t); const row = { t: e.t, type: e.type, kind: e.kind ?? null, agent: e.agent, tool: e.tool ?? null };
  if (e.type === "call") {
    const { id, p } = await reserve(e.agent, e.tool);
    if (p.layer) Object.assign(row, { accepted: false, layer: p.layer, reason: p.reason });
    else { const t1 = performance.now(); const [o] = await w.submit([p]); Object.assign(row, { accepted: o.status === 1, layer: o.layer, reason: o.reason, gas: o.gas });
      if (o.status === 1) { note[e.agent] = p.change; const tR = performance.now(); await escrow.res(id); row.T = { ...p.T, ...o.T, S9_action_execution_readback: performance.now() - tR };
        Object.assign(row, await serve(id, e.tool, e.outcome)); row.outcome_planned = e.outcome; } }
    // the gateway refuses an id that was never reserved
    if (!row.accepted) row.gateway_refuses_unreserved = (await call(id, e.tool)).code === 403;
  } else if (e.type === "concurrent") {        // two calls built on the same note, in the same block: one must fail with BudgetSpent, then retry
    const a = await reserve(e.agent, e.tools[0]), b = await reserve(e.agent, e.tools[1]); const os_ = await w.submit([a.p, b.p]);
    row.first = os_.map((o) => ({ accepted: o.status === 1, reason: o.reason })); const winner = os_[0].status === 1 ? a : b; note[e.agent] = winner.p.change;
    const loserTool = winner === a ? e.tools[1] : e.tools[0]; const r = await reserve(e.agent, loserTool); const [o] = await w.submit([r.p]); if (o.status === 1) note[e.agent] = r.p.change;
    row.retry_accepted = o.status === 1; row.accepted = os_.filter((x) => x.status === 1).length + (o.status === 1 ? 1 : 0); for (const x of [winner, r]) await serve(x.id, "search", "commit");
  } else if (e.type === "permchange") {        // narrower certificate for the same agent key, fresh budget note on it, then revoke the old edge
    const old = A[e.agent]; const nw = await w.issue(old.chain, [0b0111, e.caps], old.expiries); await w.publish();
    const t = await w.transfer(O, nO, { to: nw, q1: tr.budget, q2: nO.q - BigInt(tr.budget) }); nO = t.out2;
    row.stranded_on_old_cert = Number(note[e.agent].q); oldNote[e.agent] = note[e.agent]; Object.assign(row, { revoke: await w.revokeEdge(old) }); A[e.agent] = nw; note[e.agent] = t.out1;
  } else if (e.type === "revoke") { Object.assign(row, await w.revokeEdge(A[e.agent])); }
  else if (e.type === "attack") {
    let p;
    if (e.kind === "over_budget") ({ p } = await reserve(e.agent, e.tool, e.amount));
    else if (e.kind === "after_revocation") ({ p } = await reserve(e.agent, e.tool, 1, { imt: A[e.agent].preRevocationImt }));
    else if (e.kind === "tool_removed_by_permchange") { const old = w.creds.find((c) => c.name === `A${e.agent}` && c.revoked); ({ p } = await reserve(e.agent, e.tool, 1)); row.with_new_cert = p.layer;
      if (old) { const q = await w.prepare(old, oldNote[e.agent], { method: M[e.tool].m, reqCap: M[e.tool].cap, amount: 1, params: ethers.utils.defaultAbiCoder.encode(["bytes32"], [reqId()]), target: escrow, imt: old.preRevocationImt });
        row.with_old_cert = q.layer ?? (await w.submit([q]))[0]; } }
    else ({ p } = await reserve(e.agent, e.tool));                                      // tool_without_cap, after_expiry
    let res = { layer: p.layer, reason: p.reason, accepted: false };
    if (!p.layer) { const [o] = await w.submit([p]); res = { layer: o.layer, reason: o.reason, accepted: o.status === 1 }; }
    if (e.kind === "tool_removed_by_permchange" && typeof row.with_old_cert === "object") { const o = row.with_old_cert; row.with_old_cert = { accepted: o.status === 1, layer: o.layer, reason: o.reason }; if (o.status === 1) res.accepted = true; }
    Object.assign(row, res, { blocked: !res.accepted });
  }
  rows.push(row); log(e.t, e.type, e.kind ?? e.tool ?? "", row.accepted === undefined ? "" : row.accepted ? `accepted ${row.final ?? ""}` : `blocked ${row.layer} ${row.reason}`);
}
const calls = rows.filter((r) => r.type === "call"); const attacks = rows.filter((r) => r.type === "attack");
const out = { app: "A1", seed: SEED,
  calls: { n: calls.length, reserved: calls.filter((r) => r.accepted).length, committed: calls.filter((r) => r.final === "commit").length, failed: calls.filter((r) => r.final === "fail").length,
           uncertain: calls.filter((r) => r.final === "uncertain").length, refused: calls.filter((r) => !r.accepted).map((r) => ({ t: r.t, agent: r.agent, tool: r.tool, layer: r.layer, reason: r.reason })) },
  escrow: { reserved: (await escrow.reserved()).toNumber(), committed: (await escrow.committed()).toNumber(), failed: (await escrow.failed()).toNumber() },
  concurrent: rows.filter((r) => r.type === "concurrent"),
  attacks: { n: attacks.length, blocked: attacks.filter((r) => r.blocked).length, by_kind: Object.fromEntries(attacks.map((r) => [r.kind, { blocked: r.blocked, layer: r.layer, reason: r.reason, ...(r.with_old_cert ? { with_old_cert: r.with_old_cert } : {}) }])) },
  hard: { all_attacks_blocked: attacks.every((r) => r.blocked), gateway_refused_every_unreserved_id: calls.filter((r) => !r.accepted).every((r) => r.gateway_refuses_unreserved),
          spend_le_budget: [0, 1, 2].every((i) => rows.filter((r) => r.agent === i && r.type === "call" && r.accepted).length <= tr.budget * 2) },
  rows, wall_s: Math.round((Date.now() - wall0) / 1000), host: os.hostname() };
console.log(JSON.stringify(out)); log("done calls", out.calls.reserved, "/", out.calls.n, "commit", out.calls.committed, "fail", out.calls.failed, "uncertain", out.calls.uncertain, "attacks blocked", out.attacks.blocked, "/", out.attacks.n, JSON.stringify(out.hard));
gw.close(); w.close(); process.exit(0);

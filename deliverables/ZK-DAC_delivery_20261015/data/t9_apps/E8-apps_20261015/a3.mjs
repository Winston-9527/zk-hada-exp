// E8 A3 (PREREGISTRATION.md): bounded multi-agent procurement. Operator O (D = 1) > planner P (D = 2) > sub-agents S0..S(n-1) (D = 3).
// Categories c0..c2 = methods with cap bits 0..2. P splits 24 purchases; injected: offline sub-agent, a misbehaving sub-agent (attacks, then revoked),
// transient target errors (retry), and attacks. usage: SEED=0 PORT=8831 node a3.mjs > results/A3/0.json
import fs from "fs"; import os from "os"; import { World, ethers, sel } from "./e8lib.mjs";
const SEED = Number(process.env.SEED ?? 0), PORT = Number(process.env.PORT ?? 8831); const HERE = new URL(".", import.meta.url).pathname;
const tr = JSON.parse(fs.readFileSync(`${HERE}traces/A3/${SEED}.json`)); const wall0 = Date.now();
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), `A3-${SEED}`, ...a);
const w = await World.create({ port: PORT, tag: `A3-${SEED}`, log });
const FAR = 4_000_000_000; const CAT = [0, 1, 2].map((b) => ({ m: sel(`buy_c${b}(uint256)`), cap: 1 << b }));
const O = await w.issue(["H0", "O"], [0b111], [FAR]); await w.deployGate(O.meta.tpk.map(String)); await w.registerRoot(O);
const P = await w.issue(["H0", "O", "P"], [0b111, 0b111], [FAR, FAR]);
const S = []; for (let i = 0; i < tr.n; i++) S.push(await w.issue(["H0", "O", "P", `S${i}`], [0b111, 0b111, tr.caps[i]], [FAR, FAR, FAR]));
await w.publish(); for (const c of CAT) await w.setMethod(c.m, c.cap);
const proc = await w.deploy("E8Apps.sol", "E8Procurement", [w.gate.address, w.op.address]);
for (const id of tr.transient) await w.opTx(proc, "setTransient", [id, true]);
// budget: O > P (B), P > each sub-agent the sum of its assigned prices; P keeps the rest for reassignment
let nO = await w.mint(O, tr.B); let nP; { const t = await w.transfer(O, nO, { to: P, q1: tr.B, q2: 0 }); nP = t.out1; }
const queue = S.map(() => []); tr.items.forEach((it, k) => queue[tr.assign[k]].push(it));
const note = []; for (let i = 0; i < tr.n; i++) { const q = queue[i].reduce((s, x) => s + x.price, 0); if (q === 0) { note.push(null); continue; }
  const t = await w.transfer(P, nP, { to: S[i], q1: q, q2: nP.q - BigInt(q) }); note.push(t.out1); nP = t.out2; }
const T0 = w.clock; log("setup done: sub-agents", tr.n, "B", tr.B, Math.round((Date.now() - wall0) / 1000), "s");
const rows = []; const down = new Set(); const enc = (id) => ethers.utils.defaultAbiCoder.encode(["uint256"], [id]);
async function buy(i, it, extra = {}) {
  const p = await w.prepare(S[i], extra.note ?? note[i], { method: CAT[extra.cat ?? it.cat].m, reqCap: CAT[extra.cat ?? it.cat].cap, amount: extra.price ?? it.price, params: enc(it.id), target: proc, ...extra });
  if (p.layer) return { accepted: false, layer: p.layer, reason: p.reason };
  const [o] = await w.submit([p]); if (o.status === 1 && !extra.note) note[i] = p.change;
  return { accepted: o.status === 1, layer: o.layer, reason: o.reason, gas: o.gas, T: o.status === 1 ? { ...p.T, ...o.T } : null }; }
async function reassign(i, why) {             // P moves sub-agent i's remaining items to capable live sub-agents, with fresh budget from P
  const stranded = note[i] ? Number(note[i].q) : 0;    // budget delegated to i that P cannot reclaim (no claw-back in the protocol)
  const moved = []; for (const it of queue[i].splice(0)) {
    if (nP.q < BigInt(it.price)) { moved.push({ item: it.id, to: null, why: "planner budget exhausted" }); continue; }
    const cand = S.map((_, j) => j).filter((j) => j !== i && !down.has(j) && (tr.caps[j] >> it.cat & 1)); const j = cand.sort((a, b) => queue[a].length - queue[b].length)[0];
    if (j === undefined) { moved.push({ item: it.id, to: null }); continue; }
    const t = await w.transfer(P, nP, { to: S[j], q1: it.price, q2: nP.q - BigInt(it.price) }); nP = t.out2; queue[j].push({ ...it, note: t.out1 }); moved.push({ item: it.id, to: j }); }
  rows.push({ t: (w.clock - T0), type: "reassign", agent: i, why, moved, stranded_budget: stranded, planner_left: Number(nP.q) }); }
// purchases interleave across sub-agents in rounds of ROUND s (amendment A1: 30 s, so the faults at t = 100..260 hit a running task); trace events fire at their times
const ROUND = 30; const evs = [...tr.events]; let t = 10;
while (queue.some((q, i) => q.length && !down.has(i)) || evs.length) {
  while (evs.length && evs[0].t <= t) { const e = evs.shift(); await w.advanceTo(T0 + e.t); const row = { t: e.t, type: e.type, kind: e.kind ?? null, agent: e.agent };
    if (e.type === "offline") { down.add(e.agent); await reassign(e.agent, "offline"); }
    else if (e.type === "revoke") { Object.assign(row, await w.revokeEdge(S[e.agent])); down.add(e.agent); await reassign(e.agent, "revoked"); }
    else if (e.type === "attack") { const it = { id: 9000 + rows.length, cat: e.cat ?? 0, price: e.price }; let r;
      if (e.kind === "category_outside_cap") r = await buy(e.agent, it, { cat: e.cat, price: e.price, note: note[e.agent] ?? undefined });
      else if (e.kind === "over_budget") r = await buy(e.agent, it, { price: e.price, cat: [0, 1, 2].find((b) => tr.caps[e.agent] >> b & 1) });
      else if (e.kind === "other_agents_note") { const v = note[e.victim] ?? note.find(Boolean); r = await buy(e.agent, it, { note: v, cat: [0, 1, 2].find((b) => tr.caps[e.agent] >> b & 1), price: e.price }); }
      else if (e.kind === "after_revocation") { const nn = note[e.agent]; row.attacker_note_q = nn ? Number(nn.q) : 0;
        if (!nn || nn.q < BigInt(e.price)) r = { accepted: false, layer: "untestable", reason: "attacker note has no funds left" };     // reported; not counted as a revocation block
        else r = await buy(e.agent, it, { cat: e.cat, price: e.price, imt: S[e.agent].preRevocationImt, note: nn }); }
      Object.assign(row, r, { blocked: !r.accepted }); }
    rows.push(row); log(e.t, e.type, e.kind ?? "", row.accepted === undefined ? "" : row.accepted ? "ACCEPTED" : `blocked ${row.layer} ${row.reason}`); }
  await w.advanceTo(T0 + t);
  for (let i = 0; i < tr.n; i++) { if (down.has(i) || !queue[i].length) continue; const it = queue[i][0];
    let r = await buy(i, it, it.note ? { note: it.note } : {}); const row = { t, type: "buy", agent: i, item: it.id, cat: it.cat, price: it.price };
    if (!r.accepted && r.layer === "target" && /Transient/.test(r.reason)) { row.transient = { layer: r.layer, reason: r.reason }; await w.opTx(proc, "setTransient", [it.id, false]); r = await buy(i, it, it.note ? { note: it.note } : {}); row.retried = true; }
    Object.assign(row, { accepted: r.accepted, layer: r.layer, reason: r.reason, gas: r.gas ?? null, T: r.T ?? null }); if (r.accepted) queue[i].shift();
    else { row.stuck = true; queue[i].shift(); }                                                // a non-transient refusal of a planned purchase is reported
    rows.push(row); }
  t += ROUND; if (t > 5000) break;
}
const items = (await proc.items()).toNumber(), spent = (await proc.spent()).toNumber(); const attacks = rows.filter((r) => r.type === "attack");
const out = { app: "A3", seed: SEED, n: tr.n, B: tr.B, items_bought: items, spent, task_success: items === tr.items.length && spent <= tr.B,
  attacks: { n: attacks.length, blocked: attacks.filter((r) => r.blocked).length, by_kind: Object.fromEntries(attacks.map((r) => [r.kind, { blocked: r.blocked, layer: r.layer, reason: r.reason }])) },
  hard: { all_attacks_blocked: attacks.every((r) => r.blocked), spend_le_B: spent <= tr.B },
  buys: { n: rows.filter((r) => r.type === "buy").length, accepted: rows.filter((r) => r.type === "buy" && r.accepted).length, transient_retried: rows.filter((r) => r.retried).length, stuck: rows.filter((r) => r.stuck).map((r) => ({ item: r.item, agent: r.agent, layer: r.layer, reason: r.reason })) },
  reassignments: rows.filter((r) => r.type === "reassign"), unassignable_items: rows.filter((r) => r.type === "reassign").flatMap((r) => r.moved.filter((m) => m.to === null)).length,
  stranded_budget_total: rows.filter((r) => r.type === "reassign").reduce((s, r) => s + r.stranded_budget, 0), rows, wall_s: Math.round((Date.now() - wall0) / 1000), host: os.hostname() };
console.log(JSON.stringify(out)); log("done items", items, "/", tr.items.length, "spent", spent, "/", tr.B, "success", out.task_success, "attacks blocked", out.attacks.blocked, "/", out.attacks.n, JSON.stringify(out.hard)); w.close(); process.exit(0);

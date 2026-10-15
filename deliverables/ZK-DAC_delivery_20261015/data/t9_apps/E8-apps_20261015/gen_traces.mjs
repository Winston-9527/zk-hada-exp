// E8 deterministic trace generator (PREREGISTRATION.md "Trace generation"). Frozen distribution; usage: node gen_traces.mjs <A1|A2|A3> <seed> > traces/<app>/<seed>.json
// Every trace: { app, seed, ...world parameters, events: [{ t (logical seconds from T0), type, ... }] } sorted by t. Attack events carry `kind` and are
// KNOWN over-authorization attempts; they must all be blocked.
import crypto from "crypto";
const [app, seedS] = process.argv.slice(2); const seed = Number(seedS);
const rng = (() => { let c = 0; return () => crypto.createHash("sha256").update(`e8-trace-${app}-${seed}-${c++}`).digest().readUInt32BE(0) / 2 ** 32; })();
const U = (a, b) => a + Math.floor(rng() * (b - a + 1)); const pick = (xs) => xs[Math.floor(rng() * xs.length)];
const shuffle = (xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
let tr;
if (app === "A1") {
  // tools: search (bit 0), fetch (bit 1), compute (bit 2), admin (bit 3, granted to nobody). Operator cap 0b0111.
  const caps = [0b0111, 0b0011, 0b0101]; const tools = ["search", "fetch", "compute"]; const budget = 20, expiryAgent = 2, expiryAt = 300;
  const ev = []; let t = 20;
  const outcome = () => { const u = rng(); return u < 0.05 ? "crash" : u < 0.15 ? "fail" : "commit"; };     // P(fail) = 0.10, P(crash) = 0.05
  for (let k = 0; k < 24; k++) { const a = k % 3; const allowed = tools.filter((_, i) => caps[a] >> i & 1); ev.push({ t, type: "call", agent: a, tool: pick(allowed), outcome: outcome() }); t += U(8, 16); }
  const tPerm = 140 + U(0, 20), tRev = 200 + U(0, 20);
  ev.push({ t: tPerm, type: "permchange", agent: 0, caps: 0b0101 });                                  // agent 0 loses fetch
  ev.push({ t: tPerm + 40, type: "call", agent: 0, tool: "search", outcome: "commit", note: "after permission change" });
  ev.push({ t: tRev, type: "revoke", agent: 1 });
  ev.push({ t: 60 + U(0, 30), type: "concurrent", agent: 2, tools: ["search", "compute"], outcome: "commit" });
  ev.push({ t: 30 + U(0, 10), type: "attack", kind: "tool_without_cap", agent: pick([0, 1, 2]), tool: "admin" });
  ev.push({ t: tPerm + 50, type: "attack", kind: "tool_removed_by_permchange", agent: 0, tool: "fetch" });
  ev.push({ t: tRev + 60, type: "attack", kind: "after_revocation", agent: 1, tool: "search" });
  ev.push({ t: expiryAt + 20, type: "attack", kind: "after_expiry", agent: expiryAgent, tool: "search" });
  ev.push({ t: 100 + U(0, 20), type: "attack", kind: "over_budget", agent: pick([0, 2]), tool: "search", amount: budget + 5 });
  tr = { app, seed, caps, tools, budget, expiry: { agent: expiryAgent, at: expiryAt }, events: ev.filter((e) => !(e.type === "call" && e.agent === 1 && e.t > tRev) && !(e.type === "call" && e.agent === expiryAgent && e.t > expiryAt - 10)) };
} else if (app === "A2") {
  // methods: pay (bit 0), approve (bit 1). Agent 0 holds both; agents 1, 2 pay only. Budgets in token units.
  const caps = [0b11, 0b01, 0b01], budget = [60, 60, 60]; const ev = []; let t = 20; const pays = [];
  for (let k = 0; k < 18; k++) { const a = k % 3; const amount = U(1, 6); pays.push({ t, type: "pay", agent: a, amount, recipient: U(1, 5) }); t += U(6, 12); }
  const under = U(6, 11); pays[under].underfunded = true;                                             // the vault cannot cover this one: target reverts, retry after top-up
  ev.push(...pays); ev.push({ t: pays[4].t + 3, type: "approve", agent: 0, amount: U(5, 15), recipient: 9 });
  const tRev = pays[12].t + 2; ev.push({ t: tRev, type: "revoke", agent: 2 });
  ev.push({ t: 30 + U(0, 10), type: "attack", kind: "approve_without_cap", agent: 1, amount: 5, recipient: 9 });
  ev.push({ t: 50 + U(0, 10), type: "attack", kind: "over_budget", agent: 1, amount: 61, recipient: 3 });
  ev.push({ t: pays[7].t + 4, type: "attack", kind: "replay", agent: pays[7].agent, of: 7 });
  ev.push({ t: tRev + 60, type: "attack", kind: "after_revocation", agent: 2, amount: 2, recipient: 4 });
  tr = { app, seed, caps, budget, underfundedIndex: under, events: ev.filter((e) => !(e.type === "pay" && e.agent === 2 && e.t > tRev)) };
} else if (app === "A3") {
  // categories c0, c1, c2 (bits 0..2). Planner P cap 0b111; sub-agents get 1-2 categories, every category covered by >= 2 sub-agents.
  const n = U(4, 8); let caps;
  do { caps = Array.from({ length: n }, () => { const k = U(1, 2); return shuffle([0, 1, 2]).slice(0, k).reduce((s, b) => s | (1 << b), 0); }); }
  while (![0, 1, 2].every((b) => caps.filter((c) => c >> b & 1).length >= 2));
  const items = Array.from({ length: 24 }, (_, i) => ({ id: 1000 + i, cat: U(0, 2), price: U(1, 10) }));
  const B = Math.ceil(items.reduce((s, x) => s + x.price, 0) * 1.25);
  const assign = items.map((it) => { const ok = caps.map((c, i) => [c, i]).filter(([c]) => c >> it.cat & 1).map(([, i]) => i); return pick(ok); });
  const offline = pick([...Array(n).keys()]); let misbehaving; do { misbehaving = pick([...Array(n).keys()]); } while (misbehaving === offline);
  const transient = shuffle(items.map((x) => x.id)).slice(0, 2);
  const outside = [0, 1, 2].find((b) => !(caps[misbehaving] >> b & 1));
  const ev = [{ t: 100, type: "offline", agent: offline }, { t: 160, type: "attack", kind: outside === undefined ? "category_outside_cap_none" : "category_outside_cap", agent: misbehaving, cat: outside ?? 0, price: 3 },
    { t: 170, type: "attack", kind: "over_budget", agent: misbehaving, price: B }, { t: 180, type: "attack", kind: "other_agents_note", agent: misbehaving, victim: (misbehaving + 1) % n, price: 2 },
    { t: 190, type: "revoke", agent: misbehaving }, { t: 260, type: "attack", kind: "after_revocation", agent: misbehaving, cat: [0, 1, 2].find((b) => caps[misbehaving] >> b & 1), price: 2 }];
  tr = { app, seed, n, caps, items, assign, B, offline, misbehaving, transient, events: ev };
} else throw new Error("app A1 | A2 | A3");
tr.events.sort((a, b) => a.t - b.t); console.log(JSON.stringify(tr, null, 1));

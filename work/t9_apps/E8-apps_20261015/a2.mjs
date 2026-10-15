// E8 A2 (PREREGISTRATION.md): sandbox assets. Treasury O (D = 1) > agents A0..A2 (D = 2); Vault holds a test ERC-20 and pays / approves on authorization.
// usage: SEED=0 PORT=8801 node a2.mjs > results/A2/0.json      (trace from traces/A2/<seed>.json)
import fs from "fs"; import os from "os"; import { World, ethers, sel, L8 } from "./e8lib.mjs";
const SEED = Number(process.env.SEED ?? 0), PORT = Number(process.env.PORT ?? 8801); const HERE = new URL(".", import.meta.url).pathname;
const tr = JSON.parse(fs.readFileSync(`${HERE}traces/A2/${SEED}.json`)); const wall0 = Date.now();
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), `A2-${SEED}`, ...a);
const w = await World.create({ port: PORT, tag: `A2-${SEED}`, log });
const FAR = 4_000_000_000; const PAY = sel("pay(address,uint256)"), APPROVE = sel("approve(address,uint256)");
const O = await w.issue(["H0", "O"], [0b11], [FAR]); await w.deployGate(O.meta.tpk.map(String)); await w.registerRoot(O);
const A = []; for (let i = 0; i < 3; i++) A.push(await w.issue(["H0", "O", `A${i}`], [0b11, tr.caps[i]], [FAR, FAR]));
await w.publish(); await w.setMethod(PAY, 1); await w.setMethod(APPROVE, 2);
const token = await w.deploy("E8Apps.sol", "E8TestToken"); const vault = await w.deploy("E8Apps.sol", "E8Vault", [w.gate.address, token.address, PAY, APPROVE]);
const pays = tr.events.filter((e) => e.type === "pay"); const ui = pays.findIndex((p) => p.underfunded);
const fund0 = pays.slice(0, ui).reduce((s, p) => s + p.amount, 0) + pays[ui].amount - 1;               // the underfunded payment cannot be covered
await w.opTx(token, "mint", [vault.address, fund0]);
let nO = await w.mint(O, tr.budget.reduce((a, b) => a + b, 0)); const note = [];
for (let i = 0; i < 3; i++) { const t = await w.transfer(O, nO, { to: A[i], q1: tr.budget[i], q2: nO.q - BigInt(tr.budget[i]) }); note.push(t.out1); nO = t.out2; }
const recip = (k) => ethers.utils.getAddress("0x" + (0xe800 + k).toString(16).padStart(40, "0")); const enc = (k) => ethers.utils.defaultAbiCoder.encode(["address"], [recip(k)]);
const T0 = w.clock; log("setup done", Math.round((Date.now() - wall0) / 1000), "s");
const rows = []; const accepted = {}; const issuance = A.map((c) => c.issuanceMs);
async function act(e, agent, n, method, reqCap, amount, k, extra = {}) {
  const t0 = performance.now(); const p = await w.prepare(A[agent], n, { method, reqCap, amount, params: enc(k), target: vault, ...extra });
  if (p.layer) return { ...p, accepted: false };
  const [o] = await w.submit([p]); const tRead = performance.now(); await vault.paid(); const S9 = performance.now() - tRead;
  return { layer: o.layer, reason: o.reason, accepted: o.status === 1, gas: o.gas, T: { ...p.T, ...o.T, S9_action_execution_readback: S9 }, p, total_ms: performance.now() - t0 };
}
for (const e of tr.events) {
  await w.advanceTo(T0 + e.t); const row = { t: e.t, type: e.type, kind: e.kind ?? null, agent: e.agent };
  if (e.type === "pay" || e.type === "approve") {
    const method = e.type === "pay" ? PAY : APPROVE, reqCap = e.type === "pay" ? 1 : 2; const before = (await token.balanceOf(vault.address)).toNumber();
    let r = await act(e, e.agent, note[e.agent], method, reqCap, e.amount, e.recipient);
    if (e.underfunded) {                       // atomicity: the target reverted, so the whole execute rolled back
      row.first_attempt = { layer: r.layer, reason: r.reason }; row.nullifier_unspent_after_revert = r.p ? !(await w.gate.budgetSpent(r.p.nfSpent)) : null;
      row.vault_balance_unchanged = (await token.balanceOf(vault.address)).toNumber() === before;
      await w.opTx(token, "mint", [vault.address, 1000]); r = await act(e, e.agent, note[e.agent], method, reqCap, e.amount, e.recipient); row.retried = true; }
    Object.assign(row, { layer: r.layer, reason: r.reason, accepted: r.accepted, gas: r.gas ?? null, T: r.T ?? null, amount: e.amount });
    if (r.accepted) { note[e.agent] = r.p.change; accepted[rows.length] = r.p; }
  } else if (e.type === "revoke") { Object.assign(row, await w.revokeEdge(A[e.agent])); }
  else if (e.type === "attack") {
    let r;
    if (e.kind === "approve_without_cap") r = await act(e, e.agent, note[e.agent], APPROVE, 2, e.amount, e.recipient);
    else if (e.kind === "over_budget") r = await act(e, e.agent, note[e.agent], PAY, 1, e.amount, e.recipient);
    else if (e.kind === "after_revocation") r = await act(e, e.agent, note[e.agent], PAY, 1, e.amount, e.recipient, { imt: A[e.agent].preRevocationImt });
    else if (e.kind === "replay") { const idx = rows.findIndex((x) => x.type === "pay" && x.accepted && x.agent === e.agent); const p = accepted[idx];
      const [o] = await w.submit([p]); r = { layer: o.layer, reason: o.reason, accepted: o.status === 1 }; row.replayed_row = idx; }
    Object.assign(row, { layer: r.layer, reason: r.reason, accepted: r.accepted, blocked: !r.accepted });
  }
  rows.push(row); log(e.t, e.type, e.kind ?? "", row.accepted === undefined ? "" : row.accepted ? "accepted" : `blocked ${row.layer} ${row.reason}`);
}
// ---------- checks ----------
const legit = rows.filter((r) => r.type === "pay" || r.type === "approve"); const attacks = rows.filter((r) => r.type === "attack");
let recipients = 0; for (let k = 0; k < 10; k++) recipients += (await token.balanceOf(recip(k))).toNumber();
const paidRows = rows.filter((r) => r.type === "pay" && r.accepted).reduce((s, r) => s + r.amount, 0);
const out = { app: "A2", seed: SEED, legit: { n: legit.length, settled: legit.filter((r) => r.accepted).length },
  attacks: { n: attacks.length, blocked: attacks.filter((r) => r.blocked).length, by_kind: Object.fromEntries(attacks.map((r) => [r.kind, { blocked: r.blocked, layer: r.layer, reason: r.reason }])) },
  hard: { all_attacks_blocked: attacks.every((r) => r.blocked), token_conservation: recipients === paidRows && (await vault.paid()).toNumber() === paidRows,
          spend_le_budget: tr.budget.every((b, i) => rows.filter((r) => r.agent === i && r.accepted && r.type !== "revoke").reduce((s, r) => s + (r.amount ?? 0), 0) <= b) },
  atomicity: rows.filter((r) => r.retried).map((r) => ({ first: r.first_attempt, nullifier_unspent_after_revert: r.nullifier_unspent_after_revert, vault_balance_unchanged: r.vault_balance_unchanged, retry_accepted: r.accepted })),
  issuance_ms: issuance, rows, wall_s: Math.round((Date.now() - wall0) / 1000), host: os.hostname() };
console.log(JSON.stringify(out)); log("done", "settled", out.legit.settled, "/", out.legit.n, "attacks blocked", out.attacks.blocked, "/", out.attacks.n, "hard", JSON.stringify(out.hard)); w.close(); process.exit(0);

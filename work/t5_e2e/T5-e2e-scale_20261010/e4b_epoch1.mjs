// T5 E4b step 2 (PREREGISTRATION.md): every agent builds a fresh action proof (1 unit) against the SAME snapshot S0; then all txs go to the mempool
// (automine off) and blocks of the anvil gas limit (30M) are mined at 12 s intervals until the mempool is empty.
// usage: node e4b_epoch1.mjs > results/e4b_epoch1.json   (per-agent rows -> results/e4b_epoch1_rows.jsonl)
import fs from "fs";
import * as C from "./common.mjs";
const creds = C.loadCreds(); const st = C.loadState(); const m = await C.Mirror.from(st);
const ch = await C.connect(); const K = await C.contracts(ch, st.addrs); const ERR = C.errMap();
const b0 = await ch.provider.getBlock("latest"); const S0 = { block: b0.number, ts: b0.timestamp, noteRoot: String(m.notes.root), noteLeaves: st.noteLeaves.length, gasLimit: b0.gasLimit.toString() };
C.log("S0", S0);
const prs = []; const tGen = performance.now(); const errs = [];
for (const c of creds) { try { prs.push(await C.prepare(ch, K, m, st, C.agentObj(c))); } catch (e) { errs.push({ agent: c.id, error: String(e.message).slice(0, 200) }); }
  if (prs.length % 100 === 0) C.log("proofs", prs.length, "elapsed s", ((performance.now() - tGen) / 1000).toFixed(0)); }
const genMs = performance.now() - tGen;
if ((await ch.provider.getBlockNumber()) !== S0.block) throw new Error("a block was mined during proof generation: S0 not shared");
// gas limit = estimate at S0 + one extra Poseidon hash per note-tree level: a later position in the batch can hash more LeanIMT levels on insert than the
// S0 estimate (smoke run: 20/34 "out of gas" with estimate x 1.1). 28,000 >= the measured cost of one extra level (27,1xx gas, E4a smoke).
const depth = m.notes.depth + 1;
for (const pr of prs) pr.gl = (await K.gate.connect(ch.wallets[0]).estimateGas.execute(...(await C.execArgs(pr)))).add(28000 * depth);
await ch.provider.send("evm_setAutomine", [false]); await ch.provider.send("anvil_setBlockTimestampInterval", [12]);
const tSend = performance.now();
for (const [i, pr] of prs.entries()) await C.submit(ch, K, pr, { w: i % 10, wait: false, gasLimit: pr.gl });
const sendMs = performance.now() - tSend; C.log("submitted", prs.length);
const blocks = [];
for (let k = 0; k < 400; k++) { await ch.provider.send("evm_mine", []); const b = await ch.provider.getBlock("latest"); blocks.push({ number: b.number, ts: b.timestamp, txs: b.transactions.length, gasUsed: b.gasUsed.toNumber(), gasLimit: b.gasLimit.toNumber() }); if (b.transactions.length === 0) break; }
await ch.provider.send("anvil_removeBlockTimestampInterval", []); await ch.provider.send("evm_setAutomine", [true]);
const rows = [];
for (const pr of prs) { const rc = await ch.provider.getTransactionReceipt(pr.tx.hash); pr.rc = rc; pr.status = rc ? rc.status : null; pr.gasUsed = rc?.gasUsed.toNumber(); pr.calldataBytes = (pr.tx.data.length - 2) / 2;
  const r = C.row(pr); r.block = rc?.blockNumber; r.txIndex = rc?.transactionIndex; r.gasLimitSet = pr.gl.toNumber();
  if (rc && rc.status === 0) r.reason = await C.revertReason(ch, pr.tx.hash, ERR);
  const acc = rc?.logs.find((l) => l.topics[0] === K.gate.interface.getEventTopic("Accountability")); r.accountabilityLogDataBytes = acc ? (acc.data.length - 2) / 2 : null;
  rows.push(r); }
const ok = prs.filter((p) => p.status === 1).sort((a, b) => a.rc.blockNumber - b.rc.blockNumber || a.rc.transactionIndex - b.rc.transactionIndex);
for (const pr of ok) C.afterSuccess(m, st, pr);
if (String(await K.gate.noteRoot()) !== String(m.notes.root)) throw new Error("note root mismatch after epoch 1");
C.saveState(st);
fs.writeFileSync(C.RES + "e4b_epoch1_rows.jsonl", rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
const reasons = {}; for (const r of rows.filter((r) => r.status !== 1)) reasons[r.reason ?? "not mined"] = (reasons[r.reason ?? "not mined"] ?? 0) + 1;
const used = blocks.filter((b) => b.txs > 0);
const firstRetire = used[0]?.ts, lastIncl = used.at(-1)?.ts;
console.log(JSON.stringify({ date: new Date().toISOString(), S0, agents: creds.length, proofs_built: prs.length, build_errors: errs, proof_generation_wall_ms: Math.round(genMs), send_wall_ms: Math.round(sendMs),
  accepted: ok.length, failed_by_reason: reasons, blocks: used, blocks_used: used.length, empty_block_after: blocks.at(-1),
  chain_time_drain_s: lastIncl - S0.ts, note_root_R0_retired_at: firstRetire, last_inclusion_minus_R0_retirement_s: lastIncl - firstRetire, note_window_s: C.NWIN,
  note_leaves_after: st.noteLeaves.length, budget_nullifiers_added: ok.length }));
process.exit(0);

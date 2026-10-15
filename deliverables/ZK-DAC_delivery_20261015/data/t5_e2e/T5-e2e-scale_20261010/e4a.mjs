// T5 E4a (PREREGISTRATION.md): lifecycle latency of fresh v9 actions on the shared world, stages S1..S8.
// usage: node e4a.mjs plan                 -> prints the plan (agents per block / cold slots), deterministic from the pre-registered seeds
//        node e4a.mjs steady <block 1..3>  -> 1 warm-up per D, then 10 actions per D in shuffled order; rows -> results/e4a_steady.jsonl
//        node e4a.mjs cold <slot 0..39>    -> ONE action in this fresh process; rows -> results/e4a_cold.jsonl
const T0 = performance.now();                                   // ms since process start: node bootstrap
const C = await import("./common.mjs"); const tImport = performance.now() - T0;
import fs from "fs";
const [mode, arg] = process.argv.slice(2);
function plan(creds) {
  const p = { steady: {}, warm: {}, cold: [] }; const coldPool = {};
  for (const D of [1, 2, 3, 4]) { const ids = C.shuffle(creds.filter((c) => c.D === D).map((c) => c.id), `t5-agents-${D}`);
    const steady = ids.slice(0, 30), rest = ids.slice(30); const cyc = rest.length ? [...rest, ...steady] : steady; let k = 0;   // reuse only when the pool is exhausted (D = 1)
    p.steady[D] = [0, 1, 2].map((b) => steady.slice(10 * b, 10 * b + 10)); p.warm[D] = [0, 1, 2].map(() => cyc[k++ % cyc.length]); coldPool[D] = Array.from({ length: 10 }, () => cyc[k++ % cyc.length]); }
  p.cold = C.shuffle([1, 2, 3, 4].flatMap((D) => coldPool[D].map((id, i) => ({ D, id, i }))), "t5-cold");
  return p;
}
const tL = performance.now(); const creds = C.loadCreds(); const st = C.loadState(); const m = await C.Mirror.from(st); const walletLoad = performance.now() - tL;
const P_ = plan(creds);
if (mode === "plan") { console.log(JSON.stringify({ steady: P_.steady, warm: P_.warm, cold: P_.cold })); process.exit(0); }
const ch = await C.connect(); const K = await C.contracts(ch, st.addrs); const ERR = C.errMap();
fs.mkdirSync(C.RES, { recursive: true });
async function one(id, extra) {
  const ag = C.agentObj(creds[id]); let pr;
  try { pr = await C.prepare(ch, K, m, st, ag); await C.submit(ch, K, pr); }
  catch (e) { return { agent: id, D: creds[id].D, error: String(e.message ?? e).slice(0, 200), ...extra }; }
  const r = C.row(pr); if (pr.status === 1) C.afterSuccess(m, st, pr); else r.reason = await C.revertReason(ch, pr.tx.hash, ERR);
  r.e2e_ms = +(r.local_ms + pr.T.S5_verify + pr.T.S6_submit + pr.T.S7_inclusion).toFixed(2);
  return { ...r, pr, ...extra };
}
async function verifierGas(pr) {   // controlled verifier-only gas: a real tx to the verifier (gasLimit 1M), gasUsed minus intrinsic 21000 and calldata gas.
  // (estimateGas is NOT usable: the snarkjs verifier returns false instead of reverting when gas runs short, so the binary search under-reports — smoke run)
  const D = pr.D; const v = new C.ethers.Contract(st.addrs.verifiers[D - 1], C.art(`Groth16VerifierV9CD${D}.sol`, `Groth16VerifierV9CD${D}`).abi, ch.wallets[0]);
  const c = await C.cd(pr.proof, pr.s); const ok = await v.verifyProof(c[0], c[1], c[2], c[3]);
  const data = v.interface.encodeFunctionData("verifyProof", [c[0], c[1], c[2], c[3]]); const bytes = Buffer.from(data.slice(2), "hex");
  const cdg = [...bytes].reduce((a, b) => a + (b === 0 ? 4 : 16), 0);
  const tx = await ch.wallets[0].sendTransaction({ to: v.address, data, gasLimit: 1000000, nonce: ch.nonces[0]++ }); const rc = await tx.wait(); const used = rc.gasUsed.toNumber();
  return { D, verify_true: ok, tx_gasUsed: used, calldata_gas: cdg, verifier_exec_gas: used - 21000 - cdg, calldata_bytes: bytes.length };
}
const strip = ({ pr, ...r }) => r;
if (mode === "steady") { const b = Number(arg); if (!(b >= 1 && b <= 3)) throw new Error("block 1..3");
  const f = C.RES + "e4a_steady.jsonl"; const app = (r) => fs.appendFileSync(f, JSON.stringify(r) + "\n");
  for (const D of C.shuffle([1, 2, 3, 4], `t5-warm-${b}`)) { const r = await one(P_.warm[D][b - 1], { block: b, kind: "warmup" }); app(strip(r)); C.log("warmup D", D, r.local_ms ?? r.error); }
  const order = C.shuffle([1, 2, 3, 4].flatMap((D) => P_.steady[D][b - 1].map((id) => ({ D, id }))), `t5-block-${b}`); const vg = {};
  for (const [i, x] of order.entries()) { const r = await one(x.id, { block: b, kind: "measured", pos: i });
    if (b === 1 && r.pr && !vg[x.D]) { vg[x.D] = await verifierGas(r.pr); fs.appendFileSync(C.RES + "e4a_verifier_gas.jsonl", JSON.stringify(vg[x.D]) + "\n"); }
    app(strip(r)); C.log(`block ${b} #${i} D=${x.D} local ${r.local_ms ?? "ERR " + r.error} prove ${r.T?.S4_prove} gas ${r.gasUsed}`); }
  C.saveState(st);
  fs.appendFileSync(C.RES + "e4a_process.jsonl", JSON.stringify({ mode, block: b, node_boot_ms: +T0.toFixed(1), import_ms: +tImport.toFixed(1), wallet_load_ms: +walletLoad.toFixed(1), rss_end: C.rss() }) + "\n");
}
if (mode === "cold") { const slot = P_.cold[Number(arg)]; if (!slot) throw new Error("slot 0..39");
  const r = await one(slot.id, { slot: Number(arg), kind: "cold", node_boot_ms: +T0.toFixed(1), import_ms: +tImport.toFixed(1), wallet_load_ms: +walletLoad.toFixed(1) });
  fs.appendFileSync(C.RES + "e4a_cold.jsonl", JSON.stringify(strip(r)) + "\n"); C.saveState(st);
  C.log(`cold slot ${arg} D=${slot.D} local ${r.local_ms ?? "ERR " + r.error} prove ${r.T?.S4_prove}`);
}
process.exit(0);

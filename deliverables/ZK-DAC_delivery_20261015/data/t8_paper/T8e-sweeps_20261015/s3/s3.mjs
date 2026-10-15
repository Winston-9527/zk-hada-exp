// T8e S3 (PREREGISTRATION.md): number of agents N. World = 8-ary trees of depth 4 under masters (585 nodes each), agents = the first N nodes in DFS
// pre-order (exactly N; mostly D = 4). Credentials built off-chain in 8 worker processes. Chain: ZkDacGateV9 with REAL v9.2 action verifiers; budget
// mint / transfer and registration verifiers are accept-all (only to fill the trees quickly). One note per agent. Then 10 real actions, sequential.
// usage: N=1024 PORT=8771 node s3.mjs > results/s3_n1024.json      (worker mode: node s3.mjs --worker <N> <shard> <shards>)
import fs from "fs"; import os from "os"; import path from "path"; import crypto from "crypto"; import { spawn, execFileSync } from "child_process"; import { createRequire } from "module";
const HERE = new URL(".", import.meta.url).pathname, W = path.resolve(HERE, "../../..") + "/";
const L7 = await import(W + "t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs");
const FAR = [4e9, 3.9e9, 3.8e9, 3.7e9];
function agentsOf(N) { const out = []; for (let m = 0; out.length < N; m++) { const rec = (chain) => { if (out.length >= N) return; out.push(chain); if (chain.length - 1 < 4) for (let k = 0; k < 8; k++) rec([...chain, `${chain.at(-1)}.${k}`]); }; rec([`H${m}`, `M${m}`]); } return out; }
const keyOf = (n) => crypto.createHash("sha256").update("t8e-s3-node-" + n).digest();
if (process.argv[2] === "--worker") {                       // build credentials for one shard
  const [N, sh, nsh] = process.argv.slice(3).map(Number); const out = [];
  for (const [i, chain] of agentsOf(N).entries()) { if (i % nsh !== sh) continue; const D = chain.length - 1;
    const t = performance.now(); const { input, meta } = await L7.buildInstanceV7({ D, seed: 11, mode: "C", now: 1000, entPrv: chain.map(keyOf), rootOthers: 0, expiries: FAR.slice(0, D), accSeed: `t8e-s3-${chain.join(">")}` });
    out.push({ i, chain, D, cert: meta.cert.map(String), sks: meta.ents.map((e) => String(e.sk)), tpk: meta.tpk.map(String), input, ms: performance.now() - t }); }
  fs.writeFileSync(process.argv[6], JSON.stringify(out)); process.exit(0);
}
const { ethers } = createRequire(W + "t4_contracts/package.json")("ethers"); const snarkjs = createRequire(W + "t2_circuit_fix/zkdac_v7/package.json")("snarkjs");
const L8 = await import(W + "t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs"); const L9 = await import(W + "t2_circuit_fix/zkdac_v9_2/scripts/lib_v9.mjs"); const BW = await import(W + "t2_circuit_fix/zkdac_v8/scripts/budget_world.mjs");
const PL = createRequire(W + "t2_circuit_fix/zkdac_v7/package.json")("poseidon-lite");
const N = Number(process.env.N), PORT = Number(process.env.PORT ?? 8771), V92 = W + "t2_circuit_fix/zkdac_v9_2", OUT = W + "t4_contracts/foundry/out";
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), `N${N}`, ...a); const wall0 = Date.now(); const T = {};
// ---------- credentials (cached per N; 8 workers) ----------
const CACHE = `${HERE}build/creds_${N}.json`; fs.mkdirSync(`${HERE}build`, { recursive: true }); let creds;
if (fs.existsSync(CACHE)) { creds = JSON.parse(fs.readFileSync(CACHE)); T.creds_cached = true; }
else { const t = Date.now(); const P = 8; await Promise.all(Array.from({ length: P }, (_, s) => new Promise((res, rej) => { const p = spawn(process.execPath, [new URL(import.meta.url).pathname, "--worker", String(N), String(s), String(P), `${CACHE}.${s}`], { stdio: ["ignore", "ignore", "inherit"] }); p.on("exit", (c) => (c === 0 ? res() : rej(new Error("worker " + c)))); })));
  creds = []; for (let s = 0; s < P; s++) { creds.push(...JSON.parse(fs.readFileSync(`${CACHE}.${s}`))); fs.unlinkSync(`${CACHE}.${s}`); } creds.sort((a, b) => a.i - b.i); fs.writeFileSync(CACHE, JSON.stringify(creds));
  T.creds_build_wall_s = (Date.now() - t) / 1000; T.creds_per_cred_ms_mean = creds.reduce((s, c) => s + c.ms, 0) / creds.length; }
if (creds.length !== N) throw new Error("creds != N"); const byD = [1, 2, 3, 4].map((d) => creds.filter((c) => c.D === d).length); log("creds", N, "by D", byD.join("/"));
const metaOf = (c) => ({ D: c.D, cert: c.cert.map(BigInt), P: (xs) => PL[`poseidon${xs.length}`](xs.map(BigInt)), ents: c.sks.map((sk) => ({ sk: BigInt(sk) })) });
// ---------- mirror (off-chain trees) ----------
let t = performance.now();
const imt = await L7.IMT.create(20); for (let k = 0; k < 20; k++) imt.insert(L8.rnd250("t8e-s3-decoy-" + k));
const issued = new BW.W.SparseTree(16); for (const c of creds) for (let i = 1; i < c.D; i++) if (issued.index.get(c.cert[i]) === undefined) issued.append(BigInt(c.cert[i]));
const roots = L7.newRootTree(); for (const c of creds.filter((c) => c.D === 1)) roots.insert(BigInt(c.cert[0]));
T.mirror_trees_build_ms = performance.now() - t;
// ---------- chain ----------
const anvil = spawn("anvil", ["--port", String(PORT), "--silent", "--gas-limit", "300000000", "--code-size-limit", "100000", "--no-mining"], { stdio: "ignore" }); process.on("exit", () => anvil.kill());
const provider = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:${PORT}`); provider.pollingInterval = 5;
for (let i = 0; i < 300; i++) { try { await provider.getBlockNumber(); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
const op = ethers.Wallet.fromMnemonic("test test test test test test test test test test test junk").connect(provider); let nonce = await op.getTransactionCount();   // anvil's public default account
let clock = (await provider.getBlock("latest")).timestamp + 5; const mine = async () => { clock += 2; await provider.send("evm_setNextBlockTimestamp", [clock]); await provider.send("evm_mine", []); };
const art = (f, n) => JSON.parse(fs.readFileSync(`${OUT}/${f}/${n}.json`)); const LIBS = {};
async function sendMany(calls) { const hs = []; for (const [c, fn, args] of calls) hs.push((await c[fn](...args, { nonce: nonce++, gasLimit: 5_000_000 })).hash);
  do { await mine(); } while ((await Promise.all(hs.map((h) => provider.getTransactionReceipt(h)))).some((r) => !r)); const rs = await Promise.all(hs.map((h) => provider.getTransactionReceipt(h))); if (rs.some((r) => r.status !== 1)) throw new Error("setup tx reverted"); return rs; }
async function deploy(f, n, args = []) { const a = art(f, n); let code = a.bytecode.object.slice(2);
  for (const refs of Object.values(a.bytecode.linkReferences ?? {})) for (const [lib, locs] of Object.entries(refs)) for (const { start, length } of locs) code = code.slice(0, 2 * start) + LIBS[lib].slice(2).toLowerCase() + code.slice(2 * (start + length));
  const tx = new ethers.ContractFactory(a.abi, "0x" + code, op).getDeployTransaction(...args); tx.nonce = nonce++; tx.gasLimit = 29_000_000; const h = (await op.sendTransaction(tx)).hash;
  do { await mine(); } while (!(await provider.getTransactionReceipt(h))); const r = await provider.getTransactionReceipt(h); return new ethers.Contract(r.contractAddress, a.abi, op); }
t = Date.now();
LIBS.PoseidonT3 = (await deploy("PoseidonT3.sol", "PoseidonT3")).address; LIBS.PoseidonT4 = (await deploy("PoseidonT4.sol", "PoseidonT4")).address;
const ACC = (await deploy("T7cRefineHelpers.sol", "T7cAcceptAll")).address; const ZERO = { a: [0, 0], b: [[0, 0], [0, 0]], c: [0, 0] };
const reg = await deploy("ZkDacRegistry.sol", "ZkDacRegistry", [ACC, op.address, "53409", 1_000_000_000]);
const revs = await deploy("ZkDacRevocations.sol", "ZkDacRevocations", [ACC, String(imt.root), imt.leaves.length, 30]);
const target = await deploy("T7cRefineHelpers.sol", "T7cSumTarget"); const vs = []; for (const d of [1, 2, 3, 4]) vs.push((await deploy(`Groth16VerifierV92CD${d}.sol`, `Groth16VerifierV92CD${d}`)).address);
const gate = await deploy("ZkDacGateV9.sol", "ZkDacGateV9", [vs, [7, 8, 9, 10], reg.address, revs.address, op.address, String(issued.root), 300, 3600, creds[0].tpk, [ACC, ACC, 600]]);
const REQCAP = Number(creds[0].input.act_req_cap); await sendMany([[gate, "setMethod", ["0xa9059cbb", REQCAP, true]], [reg, "setGroupRoot", ["1", true]]]);
for (let s = 0; s < roots.size; s += 50) await sendMany(creds.filter((c) => c.D === 1).slice(s, s + 50).map((c, k) => [reg, "register", [ZERO, "1", String(1000 + s + k), c.cert[0], []]]));
if (String(await reg.currentRoot()) !== String(roots.root)) throw new Error("registry root");
await sendMany([[gate, "registerState", [String(issued.root), String(imt.root), String(roots.root)]]]);
const notes = L8.newNoteTree(); const note = new Map();
for (let s = 0; s < N; s += 200) { const calls = []; for (const c of creds.slice(s, s + 200)) { const n = { own: [BigInt(c.input.ent_Ax[c.D]), BigInt(c.input.ent_Ay[c.D])], q: 1000n, lin: L8.linOf(metaOf(c)), rho: L8.rnd250(`t8e-s3-n-${c.i}`) };
  note.set(c.i, n); notes.insert(L8.noteCm(n)); calls.push([gate, "mint", [ZERO, String(L8.noteCm(n)), "1000"]]); } await sendMany(calls); }
if (String(await gate.noteRoot()) !== String(notes.root)) throw new Error("note root");
T.chain_setup_wall_s = (Date.now() - t) / 1000;
// client mirror size: what an agent-side indexer keeps (leaves of the four structures)
const mirror = JSON.stringify({ issued: [...issued.index.keys()], imt: imt.leaves.map((l) => [String(l.value), String(l.nextIndex), String(l.nextValue)]), roots: creds.filter((c) => c.D === 1).map((c) => c.cert[0]), notes: creds.map((c) => String(L8.noteCm(note.get(c.i)))) });
t = performance.now(); { const m = JSON.parse(mirror); const it = new BW.W.SparseTree(16); for (const x of m.issued) it.append(BigInt(x)); const nt = L8.newNoteTree(); for (const x of m.notes) nt.insert(BigInt(x)); const rt = L7.newRootTree(); for (const x of m.roots) rt.insert(BigInt(x)); }
T.mirror_bytes = mirror.length; T.mirror_rebuild_ms = performance.now() - t;
log("setup done", Math.round((Date.now() - wall0) / 1000), "s");
// ---------- 10 real actions (stratified by depth, seeded) ----------
const rng = (() => { let k = 0; return () => crypto.createHash("sha256").update(`t8e-s3-pick-${N}-${k++}`).digest().readUInt32BE(0) / 2 ** 32; })();
const depths = [1, 2, 3, 4].filter((d) => byD[d - 1] > 0); const rows = []; const tmp = path.join(os.tmpdir(), `t8e-s3-${process.pid}.wtns`);
for (let a = 0; a < 10; a++) { const d = depths[a % depths.length]; const pool = creds.filter((c) => c.D === d); const c = pool[Math.floor(rng() * pool.length)]; const S = {};
  let t0 = performance.now(); const x = structuredClone(c.input); x.issued_root = String(issued.root);
  for (let i = 1; i < c.D; i++) { const p = issued.path(issued.index.get(c.cert[i])); x.m_sib[i] = p.sib; x.m_bit[i] = p.bit; }
  Object.assign(x, L7.rootProof(roots, c.cert[0])); L7.refreshAll(x, { ...metaOf(c), imt }); S.S2_path_fetch = performance.now() - t0; t0 = performance.now();
  const n = note.get(c.i); const { input } = L8.setBudget(x, n, notes, 1n, L8.rnd250(`t8e-s3-chg-${a}`)); L9.toV9(input, crypto.randomBytes(16).toString("hex")); input.now = String(clock);
  input.ctx_hash = String(L7.ctxHash({ chainId: 31337n, verifier: gate.address, method: "0xa9059cbb", target: target.address, params: "0x1234abcd", amount: 1n, nonce: BigInt(a + 1) })); S.S3_assembly = performance.now() - t0; t0 = performance.now();
  await snarkjs.wtns.calculate(input, `${V92}/build/c${c.D}/main_c_d${c.D}_js/main_c_d${c.D}.wasm`, tmp); S.S4_witness = performance.now() - t0; t0 = performance.now();
  const { proof, publicSignals: ps } = await snarkjs.groth16.prove(`${V92}/build/zk/c${c.D}.zkey`, tmp); S.S5_prove = performance.now() - t0; t0 = performance.now();
  const ok = await snarkjs.groth16.verify(JSON.parse(fs.readFileSync(`${V92}/zk/vk_c${c.D}.json`)), ps, proof); S.S6_verify = performance.now() - t0;
  const cd = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, ps)) + "]");
  const h = (await gate.execute({ a: cd[0], b: cd[1], c: cd[2] }, { issued: String(issued.root), revoked: String(imt.root), root: String(roots.root) }, clock, { target: target.address, method: "0xa9059cbb", amount: 1, nonce: String(a + 1), params: "0x1234abcd" },
    ps.slice(6, ps.length - 4), { noteRoot: ps.at(-4), budgetNf: ps.at(-3), cmChange: ps.at(-2), qSpent: ps.at(-1) }, { nonce: nonce++, gasLimit: 2_000_000 })).hash;
  await mine(); const r = await provider.getTransactionReceipt(h); let idx = null; for (const lg of r.logs) { try { const e = gate.interface.parseLog(lg); if (e.name === "NoteInserted") idx = e.args.index.toNumber(); } catch {} }
  if (r.status === 1) { notes.insert(BigInt(ps.at(-2))); note.set(c.i, { ...n, q: n.q - 1n, rho: BigInt(input.rho_change) }); }
  rows.push({ agent: c.chain.at(-1), D: c.D, status: r.status, offchain_valid: ok, gas: r.gasUsed.toNumber(), change_note_index: idx, popcount: idx === null ? null : idx.toString(2).split("1").length - 1, ...S }); log("action", a, "D", c.D, "status", r.status, "gas", r.gasUsed.toNumber()); }
try { fs.unlinkSync(tmp); } catch {}
const mem = process.memoryUsage();
console.log(JSON.stringify({ N, agents_by_D: byD, masters: byD[0], issued_leaves: issued.index.size, imt_leaves: imt.leaves.length, note_leaves: notes.size, timings: T, rows, rss_bytes_end: mem.rss, wall_s: Math.round((Date.now() - wall0) / 1000), host: os.hostname(), machine: os.cpus()[0].model }));
anvil.kill(); process.exit(0);

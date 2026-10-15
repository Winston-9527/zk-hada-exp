// T5c I3 (PREREGISTRATION_I3.md): verifier gas and full execute gas, v9.2 (acc on) vs v9.2-noacc (acc off), D = 1..4, real proofs and real verifiers.
// Both gates get the same note tree: 100 prefilled notes, then the four agents' notes in the same order; executions in the same order (paired note indices).
// usage: node i3_gas.mjs > results/i3/gas.json
import fs from "fs"; import path from "path"; import os from "os"; import crypto from "crypto"; import { spawn } from "child_process"; import { createRequire } from "module";
const HERE = new URL(".", import.meta.url).pathname, W = path.resolve(HERE, "../..") + "/";
const { ethers } = createRequire(W + "t4_contracts/package.json")("ethers");
const req7 = createRequire(W + "t2_circuit_fix/zkdac_v7/package.json"); const snarkjs = req7("snarkjs"); const { poseidon3 } = req7("poseidon-lite");
const L7 = await import(W + "t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs"); const L8 = await import(W + "t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs");
const L9 = await import(W + "t2_circuit_fix/zkdac_v9_2/scripts/lib_v9.mjs"); const BW = await import(W + "t2_circuit_fix/zkdac_v8/scripts/budget_world.mjs");
const RG = await import(W + "t4_registration/scripts/lib_register.mjs");
const OUT = W + "t4_contracts/foundry/out", V = { on: W + "t2_circuit_fix/zkdac_v9_2", off: W + "t2_circuit_fix/zkdac_v9_2_noacc" };
const ACC = ["tpk", "acc_r", "acc_kx", "acc_ky", "acc_c1x", "acc_c1y", "acc_c2x", "acc_c2y", "acc_e", "acc_esign"];
const art = (f, n) => JSON.parse(fs.readFileSync(`${OUT}/${f}/${n}.json`)); const S = String;
const METHOD = "0xa9059cbb", PARAMS = "0x1234abcd", DOMAIN = 0xd0a1n, CHAIN = 31337n, PORT = Number(process.env.PORT ?? 8931);
const anvil = spawn("anvil", ["--port", String(PORT), "--silent", "--gas-limit", "300000000", "--code-size-limit", "100000"], { stdio: "ignore" }); process.on("exit", () => anvil.kill());
const provider = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:${PORT}`); provider.pollingInterval = 5;
for (let i = 0; i < 200; i++) { try { await provider.getBlockNumber(); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
const op = ethers.Wallet.fromMnemonic("test test test test test test test test test test test junk").connect(provider);   // anvil's public default account (local only)
let nonce = await op.getTransactionCount(); const tx = async (p) => (await p).wait();
const LIBS = {};
async function deploy(f, n, args = []) { const a = art(f, n); let code = a.bytecode.object.slice(2);
  for (const refs of Object.values(a.bytecode.linkReferences ?? {})) for (const [lib, locs] of Object.entries(refs)) for (const { start, length } of locs) code = code.slice(0, 2 * start) + LIBS[lib].slice(2).toLowerCase() + code.slice(2 * (start + length));
  const c = await new ethers.ContractFactory(a.abi, "0x" + code, op).deploy(...args, { nonce: nonce++, gasLimit: 30_000_000 }); await c.deployed(); return c; }
LIBS.PoseidonT3 = (await deploy("PoseidonT3.sol", "PoseidonT3")).address; LIBS.PoseidonT4 = (await deploy("PoseidonT4.sol", "PoseidonT4")).address;
const ACCEPT = (await deploy("T7cRefineHelpers.sol", "T7cAcceptAll")).address; const ZERO = { a: [0, 0], b: [[0, 0], [0, 0]], c: [0, 0] };
// ---- world: one chain per D under one master; real registration-free (accept-all registry), real trees ----
const key = (n) => (n === "H" ? RG.humanPrv(0) : crypto.createHash("sha256").update("i3-node-" + n).digest());
const chains = [["H", "M"], ["H", "M", "A"], ["H", "M", "A", "B"], ["H", "M", "A", "B", "C"]];
const imt = await L7.IMT.create(20); for (let k = 0; k < 20; k++) imt.insert(L8.rnd250("i3-decoy-" + k));
const issued = new BW.W.SparseTree(16), roots = L7.newRootTree(); const H = [];
for (const ch of chains) { const D = ch.length - 1; const { input, meta } = await L7.buildInstanceV7({ D, seed: 11, mode: "C", now: 1000, entPrv: ch.map(key), rootOthers: 0, expiries: [4e9, 3.9e9, 3.8e9, 3.7e9].slice(0, D), accSeed: `i3-${D}` });
  for (let i = 1; i < D; i++) if (issued.index.get(S(meta.cert[i])) === undefined) issued.append(meta.cert[i]); if (roots.indexOf(BigInt(meta.cert[0])) < 0) roots.insert(BigInt(meta.cert[0])); H.push({ D, input, meta }); }
for (const h of H) { const x = h.input; x.issued_root = S(issued.root); for (let i = 1; i < h.D; i++) { const p = issued.path(issued.index.get(S(h.meta.cert[i]))); x.m_sib[i] = p.sib; x.m_bit[i] = p.bit; }
  Object.assign(x, L7.rootProof(roots, h.meta.cert[0])); L7.refreshAll(x, { ...h.meta, imt }); }
const reg = await deploy("ZkDacRegistry.sol", "ZkDacRegistry", [ACCEPT, op.address, DOMAIN.toString(), 1_000_000_000]);
{ const hu = RG.makeHuman(0); const group = new RG.Group([hu.id.commitment]); await tx(reg.setGroupRoot(S(group.root), true, { nonce: nonce++ }));
  const rw = RG.registerWitness({ human: hu, group, domain: DOMAIN, master: [H[0].input.ent_Ax[1], H[0].input.ent_Ay[1]], cap0: H[0].input.cap[0], expiry0: H[0].input.expiry[0] });
  await tx(reg.register(ZERO, S(group.root), S(poseidon3([2053858418n, BigInt(rw.human_sk), DOMAIN])), rw.leaf0, [], { nonce: nonce++ })); }
const revs = await deploy("ZkDacRevocations.sol", "ZkDacRevocations", [ACCEPT, S(imt.root), imt.leaves.length, 30]);
const target = await deploy("T7cRefineHelpers.sol", "T7cSumTarget");
const vOn = [], vOff = []; for (const d of [1, 2, 3, 4]) { vOn.push(await deploy(`Groth16VerifierV92CD${d}.sol`, `Groth16VerifierV92CD${d}`)); vOff.push(await deploy(`Groth16VerifierV92NoAccCD${d}.sol`, `Groth16VerifierV92NoAccCD${d}`)); }
const cfg = [ACCEPT, ACCEPT, 600];
const gates = { on: await deploy("ZkDacGateV9.sol", "ZkDacGateV9", [vOn.map((v) => v.address), [7, 8, 9, 10], reg.address, revs.address, op.address, S(issued.root), 300, 3600, H[0].meta.tpk.map(S), cfg]),
                off: await deploy("ZkDacGateV9NoAcc.sol", "ZkDacGateV9NoAcc", [vOff.map((v) => v.address), [1, 2, 3, 4], reg.address, revs.address, op.address, S(issued.root), 300, 3600, cfg]) };
const REQCAP = Number(H[0].input.act_req_cap);
const trees = {}; const notes = {};
for (const [k, g] of Object.entries(gates)) { await tx(g.setMethod(METHOD, REQCAP, true, { nonce: nonce++ })); await tx(g.registerState(S(issued.root), S(imt.root), S(roots.root), { nonce: nonce++ }));
  trees[k] = L8.newNoteTree(); for (let i = 0; i < 100; i++) { const cm = L8.rnd250("i3-prefill-" + i); await tx(g.mint(ZERO, S(cm), "1", { nonce: nonce++ })); trees[k].insert(cm); }
  notes[k] = H.map((h) => ({ own: [BigInt(h.input.ent_Ax[h.D]), BigInt(h.input.ent_Ay[h.D])], q: 1000n, lin: L8.linOf(h.meta), rho: L8.rnd250(`i3-note-${h.D}`) }));
  for (const n of notes[k]) { await tx(g.mint(ZERO, S(L8.noteCm(n)), "1000", { nonce: nonce++ })); trees[k].insert(L8.noteCm(n)); } }
await tx(target.onAuthorized(METHOD, 1, PARAMS, { nonce: nonce++ }));      // warm the shared target's storage (attempt 1: its first-call SSTOREs landed on the first measured execute)
const now = (await provider.getBlock("latest")).timestamp; const rows = [];
for (const [i, h] of H.entries()) for (const k of ["on", "off"]) {
  const g = gates[k]; const { input } = L8.setBudget(structuredClone(h.input), notes[k][i], trees[k], 1n, L8.rnd250(`i3-chg-${h.D}`)); L9.toV9(input, `i3-acc-${h.D}`); input.now = S(now);
  input.ctx_hash = S(L7.ctxHash({ chainId: CHAIN, verifier: g.address, method: METHOD, target: target.address, params: PARAMS, amount: 1n, nonce: BigInt(h.D) }));
  if (k === "off") for (const f of ACC) delete input[f];
  const { proof, publicSignals: ps } = await snarkjs.groth16.fullProve(input, `${V[k]}/build/c${h.D}/main_c_d${h.D}_js/main_c_d${h.D}.wasm`, `${V[k]}/build/zk/c${h.D}.zkey`);
  const cd = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, ps)) + "]"); const pr = { a: cd[0], b: cd[1], c: cd[2] };
  const ver = (k === "on" ? vOn : vOff)[h.D - 1]; const vtx = await (await op.sendTransaction({ to: ver.address, data: ver.interface.encodeFunctionData("verifyProof", [cd[0], cd[1], cd[2], cd[3]]), nonce: nonce++, gasLimit: 3_000_000 })).wait();
  const vok = await ver.verifyProof(cd[0], cd[1], cd[2], cd[3]);
  const roots_ = { issued: S(issued.root), revoked: S(imt.root), root: S(roots.root) }; const act = { target: target.address, method: METHOD, amount: 1, nonce: S(h.D), params: PARAMS };
  const b = { noteRoot: ps.at(-4), budgetNf: ps.at(-3), cmChange: ps.at(-2), qSpent: ps.at(-1) };
  const args = k === "on" ? [pr, roots_, now, act, ps.slice(6, ps.length - 4), b] : [pr, roots_, now, act, h.D, b];
  const etx = await g.execute(...args, { nonce: nonce++, gasLimit: 5_000_000 }); const erc = await etx.wait(); trees[k].insert(BigInt(b.cmChange));
  rows.push({ D: h.D, acc: k, public_inputs: ps.length, verifier_verified: vok, verifier_tx_gas: vtx.gasUsed.toNumber(), execute_status: erc.status, execute_gas: erc.gasUsed.toNumber(),
              execute_calldata_bytes: (etx.data.length - 2) / 2, change_note_index: Number(await g.noteRoot().then(() => trees[k].size - 1)) });
  console.error(JSON.stringify(rows.at(-1))); }
console.log(JSON.stringify({ machine: `${os.cpus()[0].model}`, prefilled_notes: 100, rows }, null, 1)); anvil.kill(); process.exit(0);

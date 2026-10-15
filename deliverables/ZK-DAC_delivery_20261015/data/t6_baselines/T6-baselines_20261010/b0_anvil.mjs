// T6 B0 (PREREGISTRATION.md Table 2 item 1): plaintext lower bound PlainChainGate (../../t4_contracts/foundry/src/PlainChainGate.sol), real txs on anvil
// (prague, same flags as T5). Per D = 1..4: 10 fresh chains (fresh keys); for each, the FIRST execute (fresh ledger slots, comparable to a v9 action that
// always writes fresh storage) and a SECOND execute on the same chain (warm slots). Sanity rejections: over-budget, revoked cert, revoked key, bad
// holder signature, replay. usage: node b0_anvil.mjs > results/b0_anvil.json   (starts anvil on :8570; anvil keys are public test keys)
import { createRequire } from "module"; import { spawn } from "child_process"; import fs from "fs";
const TC = new URL("../../t4_contracts/", import.meta.url).pathname; const { ethers } = createRequire(TC + "package.json")("ethers");
const PORT = 8570; const anvil = spawn("anvil", ["--port", String(PORT), "--chain-id", "31337", "--hardfork", "prague", "--gas-limit", "30000000", "--silent"], { stdio: "ignore" });
process.on("exit", () => anvil.kill());
const provider = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:${PORT}`);
for (let i = 0; i < 50; i++) { try { await provider.getBlockNumber(); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }
const op = ethers.Wallet.fromMnemonic("test test test test test test test test test test test junk").connect(provider); let nonce = await op.getTransactionCount();
const art = (f, n) => JSON.parse(fs.readFileSync(`${TC}foundry/out/${f}/${n}.json`));
const deploy = async (f, n, args = []) => { const a = art(f, n); const c = await new ethers.ContractFactory(a.abi, a.bytecode.object, op).deploy(...args, { nonce: nonce++ }); await c.deployed(); return c; };
const gate = await deploy("PlainChainGate.sol", "PlainChainGate", [op.address]); const target = await deploy("Targets.sol", "MockTarget");
const METHOD = "0xa9059cbb", PARAMS = "0x1234abcd"; await (await gate.setMethod(METHOD, 1, { nonce: nonce++ })).wait();
const ERR = {}; for (const e of Object.values(gate.interface.errors)) ERR[gate.interface.getSighash(e)] = e.name;
const chainId = (await provider.getNetwork()).chainId; const now = (await provider.getBlock("latest")).timestamp;
const CAP = [255, 63, 15, 3], EXP = [4e7, 3e7, 2e7, 1e7].map((e) => now + e), ALLOT = [1000000, 100000, 10000, 1000];
const enc = ethers.utils.defaultAbiCoder;
const certHash = (hop, c, parent) => ethers.utils.keccak256(enc.encode(["uint256", "address", "uint256", "address", "address", "uint32", "uint64", "uint128", "bytes32"], [chainId, gate.address, hop, c.issuer, c.holder, c.cap, c.expiry, c.allot, parent]));
const ctxHash = (a) => ethers.utils.keccak256(enc.encode(["uint256", "address", "bytes4", "address", "bytes", "uint256", "uint256"], [chainId, gate.address, a.method, a.target, a.params, a.amount, a.nonce]));
const sign = (w, h) => w.signMessage(ethers.utils.arrayify(h));
async function newChain(D) { const ws = Array.from({ length: D + 1 }, () => ethers.Wallet.createRandom());
  await (await gate.setRoot(ws[0].address, true, { nonce: nonce++ })).wait();
  const chain = [], sigs = []; let parent = ethers.constants.HashZero;
  for (let i = 0; i < D; i++) { const c = { issuer: ws[i].address, holder: ws[i + 1].address, cap: CAP[i], expiry: EXP[i], allot: ALLOT[i] }; const h = certHash(i, c, parent); chain.push(c); sigs.push(await sign(ws[i], h)); parent = h; }
  return { ws, chain, sigs, D }; }
let actNonce = 0;
async function act(ch, amount, { badSig = false, reuse = null } = {}) { const a = reuse ?? { target: target.address, method: METHOD, amount, nonce: ++actNonce, params: PARAMS };
  const hs = await sign(badSig ? ethers.Wallet.createRandom() : ch.ws[ch.D], ctxHash(a));
  const tx = await gate.execute(ch.chain, ch.sigs, a, hs, { nonce: nonce++, gasLimit: 2000000 }); const rc = await provider.waitForTransaction(tx.hash);
  let reason = null; if (rc.status === 0) { const tr = await provider.send("debug_traceTransaction", [tx.hash, { tracer: "callTracer" }]); reason = ERR[(tr.output ?? "").slice(0, 10)] ?? tr.output; }
  return { status: rc.status, gasUsed: rc.gasUsed.toNumber(), calldata_bytes: (tx.data.length - 2) / 2, reason, a }; }
const rows = [], sanity = [];
for (const D of [1, 2, 3, 4]) for (let k = 0; k < 10; k++) { const ch = await newChain(D); const r1 = await act(ch, 1), r2 = await act(ch, 1); rows.push({ D, k, first: r1, second: r2 }); }
for (const D of [2, 4]) { const ch = await newChain(D);
  sanity.push({ D, case: "over budget (leaf allot + 1)", ...(await act(ch, ALLOT[D - 1] + 1)) });
  sanity.push({ D, case: "bad holder signature", ...(await act(ch, 1, { badSig: true })) });
  const ok = await act(ch, 1); sanity.push({ D, case: "valid", ...ok }); sanity.push({ D, case: "replay of the same action", ...(await act(ch, 1, { reuse: ok.a })) });
  // revoke the last certificate by its issuer
  const g = gate.connect(ch.ws[D - 1].connect(provider)); await (await op.sendTransaction({ to: ch.ws[D - 1].address, value: ethers.utils.parseEther("1"), nonce: nonce++ })).wait();
  let parent = ethers.constants.HashZero; for (let i = 0; i < D - 1; i++) parent = certHash(i, ch.chain[i], parent);
  await (await g.revokeCert(D - 1, ch.chain[D - 1], parent)).wait(); sanity.push({ D, case: "last certificate revoked by its issuer", ...(await act(ch, 1)) });
  const ch2 = await newChain(D); await (await op.sendTransaction({ to: ch2.ws[D].address, value: ethers.utils.parseEther("1"), nonce: nonce++ })).wait();
  await (await gate.connect(ch2.ws[D].connect(provider)).revokeKey()).wait(); sanity.push({ D, case: "holder key revoked", ...(await act(ch2, 1)) }); }
for (const s of sanity) delete s.a; for (const r of rows) { delete r.first.a; delete r.second.a; }
console.log(JSON.stringify({ date: new Date().toISOString(), client: await provider.send("web3_clientVersion", []), hardfork: "prague", rows, sanity })); anvil.kill(); process.exit(0);

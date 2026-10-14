// E6e world M, phase 1 (PREREGISTRATION.md "World M"): D = 3, 32 masters x 4 parents x 4 agents, m rounds; witnesses built sequentially (shared note tree)
// and written to build/inputs/<k>.json (secret, not committed); public per-action record to build/actions.jsonl; adversary knowledge to results/knowledge.json.
// usage: node witness.mjs [m=8] 2> results/gen_witness.stderr
import crypto from "crypto"; import fs from "fs"; import { createRequire } from "module";
const W = new URL("../../", import.meta.url).pathname;
const L7 = await import(W + "t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs"); const L8 = await import(W + "t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs");
const L9 = await import(W + "t2_circuit_fix/zkdac_v9_2/scripts/lib_v9.mjs"); const BW = await import(W + "t2_circuit_fix/zkdac_v8/scripts/budget_world.mjs");
const { poseidon3 } = createRequire(W + "t2_circuit_fix/zkdac_v9_2/package.json")("poseidon-lite");
const M = Number(process.argv[2] ?? 8), D = 3, NM = 32, NP = 4, NA = 4;
const seedRng = (tag) => { let c = 0; return () => crypto.createHash("sha256").update(`e6e-M-${tag}-${c++}`).digest().readUInt32BE(0) / 2 ** 32; };
const shuffle = (xs, tag) => { const r = seedRng(tag), a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const key = (name) => crypto.createHash("sha256").update(`e6e-M-${name}`).digest();
const rnd = (bytes) => BigInt("0x" + crypto.randomBytes(bytes).toString("hex"));       // CSPRNG, as a wallet
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);
const agents = [];
for (let m = 0; m < NM; m++) for (let p = 0; p < NP; p++) for (let a = 0; a < NA; a++) agents.push([`H${m}`, `M${m}`, `M${m}.${p}`, `M${m}.${p}.a${a}`]);
const EXP = [4_000_000_000, 3_999_000_000, 3_998_000_000];
const imt = await L7.IMT.create(20); for (let k = 0; k < 20; k++) imt.insert(L8.rnd250(`e6e-M-decoy-${k}`));
const issued = new BW.W.SparseTree(16), roots = L7.newRootTree(); const H = [];
for (const [i, chain] of agents.entries()) {
  const { input, meta } = await L7.buildInstanceV7({ D, seed: 50_000 + i, mode: "C", now: 1_000_000, entPrv: chain.map(key), rootOthers: 0, expiries: EXP, accSeed: `e6e-M-${i}` });
  for (let j = 1; j < D; j++) if (issued.index.get(String(meta.cert[j])) === undefined) issued.append(meta.cert[j]);
  if (roots.indexOf(BigInt(meta.cert[0])) < 0) roots.insert(BigInt(meta.cert[0]));
  H.push({ id: chain[3], parent: chain[2], master: chain[1], chain, input, meta });
  if (i % 64 === 63) log("instances", i + 1);
}
for (const h of H) {
  const x = h.input; x.issued_root = String(issued.root);
  for (let j = 1; j < D; j++) { const p = issued.path(issued.index.get(String(h.meta.cert[j]))); x.m_sib[j] = p.sib; x.m_bit[j] = p.bit; }
  Object.assign(x, L7.rootProof(roots, h.meta.cert[0])); L7.refreshAll(x, { ...h.meta, imt });
}
const notes = L8.newNoteTree(); const note = {}, knowledge = {};
for (const h of shuffle(H, "mint")) { const n = { own: [BigInt(h.input.ent_Ax[D]), BigInt(h.input.ent_Ay[D])], q: 10_000n, lin: L8.linOf(h.meta), rho: rnd(31) % (1n << 250n) }; notes.insert(L8.noteCm(n)); note[h.id] = n;
  knowledge[h.id] = { chain: h.chain, parent: h.parent, master: h.master, Ax: h.input.ent_Ax.map(String), Ay: h.input.ent_Ay.map(String), cert: h.meta.cert.slice(0, D).map(String),
    keyHash: h.input.ent_Ax.map((ax, j) => String(poseidon3([2053861995n, BigInt(ax), BigInt(h.input.ent_Ay[j])]))), note0: { cm: String(L8.noteCm(n)), rho: String(n.rho), q: "10000" } }; }
fs.writeFileSync("results/knowledge.json", JSON.stringify(knowledge));
log("built", H.length, "agents; issued certs", issued.index.size, "roots", NM);
const GATE = "0x000000000000000000000000000000000000dAC9", TARGETS = ["0x000000000000000000000000000000000000Ba5e", "0x000000000000000000000000000000000000B0b0"];
const METHODS = ["0xa9059cbb", "0x095ea7b3"]; const ri = (n) => Number(rnd(4) % BigInt(n));
fs.mkdirSync("build/inputs", { recursive: true }); const act = fs.openSync("build/actions.jsonl", "w"); let k = 0;
for (let round = 0; round < M; round++) {
  for (const h of shuffle(H, `round-${round}`)) {
    const input = structuredClone(h.input); const n = note[h.id];
    const amount = BigInt(1 + ri(9)), method = METHODS[ri(2)], target = TARGETS[ri(2)], params = "0x" + crypto.randomBytes(4).toString("hex"), nonce = rnd(8);
    const now = 1_000_000 + 600 * round + ri(60); input.now = String(now);
    input.ctx_hash = String(L7.ctxHash({ chainId: 31337n, verifier: GATE, method, target, params, amount, nonce }));
    const { input: x, change } = L8.setBudget(input, n, notes, amount, rnd(31) % (1n << 250n));
    L9.toV9(x, crypto.randomBytes(32).toString("hex"));
    fs.writeFileSync(`build/inputs/${k}.json`, JSON.stringify(x));
    fs.writeSync(act, JSON.stringify({ k, round, agent: h.id, parent: h.parent, master: h.master, amount: String(amount), method, target, params, nonce: String(nonce), now,
      roots: [x.issued_root, x.revoked_root, x.root_root] }) + "\n");
    notes.insert(BigInt(x.cm_change)); note[h.id] = change; k++;
  }
  log("round", round, "witnesses done");
}
process.exit(0);

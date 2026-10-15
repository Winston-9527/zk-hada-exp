// E6d world generator (PREREGISTRATION.md "Worlds"). Offline: one world = own humans, keys, issued tree, registered-root tree, revocation IMT (20 decoys),
// note tree; K = 64 agents at depth D; m rounds, every agent acts once per round in a seeded shuffled order, spending its current note. Real v9.2 proofs.
// Action fields i.i.d. and independent of identity. usage: node gen.mjs <w 1..8> [m=16] > results/world_w<w>.jsonl 2> results/gen_w<w>.stderr
import crypto from "crypto"; import fs from "fs"; import { createRequire } from "module";
const W = new URL("../../", import.meta.url).pathname;
const req = createRequire(W + "t2_circuit_fix/zkdac_v7/package.json"); const snarkjs = req("snarkjs");
const L7 = await import(W + "t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs"); const L8 = await import(W + "t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs");
const L9 = await import(W + "t2_circuit_fix/zkdac_v9_2/scripts/lib_v9.mjs"); const BW = await import(W + "t2_circuit_fix/zkdac_v8/scripts/budget_world.mjs");
const V92 = W + "t2_circuit_fix/zkdac_v9_2";
const w = Number(process.argv[2]), M = Number(process.argv[3] ?? 16);
// world table (PREREGISTRATION.md): D, levels above the parents as fan-outs [masters, level2 per master, parents per level2 ...], children per parent
const CFG = { 1: { D: 2, top: [8], kids: 8 }, 2: { D: 2, top: [16], kids: 4 }, 3: { D: 3, top: [2, 4], kids: 8 }, 4: { D: 3, top: [4, 4], kids: 4 },
  5: { D: 3, top: [8, 1], kids: 8 }, 6: { D: 4, top: [2, 2, 2], kids: 8 }, 7: { D: 4, top: [2, 4, 2], kids: 4 }, 8: { D: 4, top: [4, 1, 2], kids: 8 } }[w];
if (!CFG) throw new Error("world 1..8");
const seedRng = (tag) => { let c = 0; return () => crypto.createHash("sha256").update(`e6d-w${w}-${tag}-${c++}`).digest().readUInt32BE(0) / 2 ** 32; };
const shuffle = (xs, tag) => { const r = seedRng(tag), a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const key = (name) => crypto.createHash("sha256").update(`e6d-w${w}-${name}`).digest();
const rnd = (bytes) => BigInt("0x" + crypto.randomBytes(bytes).toString("hex"));       // CSPRNG, as a wallet
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), `w${w}`, ...a);
// ---- tree of chains: [H_m, M_m, ...levels..., parent, agent] ----
let parents = CFG.top[0] === 0 ? [] : Array.from({ length: CFG.top[0] }, (_, m) => [`H${m}`, `M${m}`]);
for (const f of CFG.top.slice(1)) parents = parents.flatMap((c) => Array.from({ length: f }, (_, k) => [...c, `${c[c.length - 1]}.${k}`]));
if (parents[0].length !== CFG.D) throw new Error("structure does not give depth D - 1 parents");
const agents = parents.flatMap((c) => Array.from({ length: CFG.kids }, (_, k) => [...c, `${c[c.length - 1]}.a${k}`]));
if (agents.length !== 64) throw new Error("K != 64");
// ---- instances and shared trees ----
const D = CFG.D, EXP = [4_000_000_000, 3_999_000_000, 3_998_000_000, 3_997_000_000].slice(0, D);
const imt = await L7.IMT.create(20); for (let k = 0; k < 20; k++) imt.insert(L8.rnd250(`e6d-w${w}-decoy-${k}`));
const issued = new BW.W.SparseTree(16), roots = L7.newRootTree(); const H = [];
for (const [i, chain] of agents.entries()) {
  const { input, meta } = await L7.buildInstanceV7({ D, seed: 1000 * w + i, mode: "C", now: 1_000_000, entPrv: chain.map(key), rootOthers: 0, expiries: EXP, accSeed: `e6d-${w}-${i}` });
  for (let j = 1; j < D; j++) issued.append(meta.cert[j]); if (roots.indexOf(BigInt(meta.cert[0])) < 0) roots.insert(BigInt(meta.cert[0]));
  H.push({ id: chain[chain.length - 1], parent: chain[chain.length - 2], master: chain[1], chain, input, meta });
}
for (const h of H) {                                                            // tree witnesses against the final snapshot
  const x = h.input; x.issued_root = String(issued.root);
  for (let j = 1; j < D; j++) { const p = issued.path(issued.index.get(String(h.meta.cert[j]))); x.m_sib[j] = p.sib; x.m_bit[j] = p.bit; }
  Object.assign(x, L7.rootProof(roots, h.meta.cert[0])); L7.refreshAll(x, { ...h.meta, imt });
}
const notes = L8.newNoteTree(); const note = {};
for (const h of shuffle(H, "mint")) { const n = { own: [BigInt(h.input.ent_Ax[D]), BigInt(h.input.ent_Ay[D])], q: 10_000n, lin: L8.linOf(h.meta), rho: rnd(31) % (1n << 250n) }; notes.insert(L8.noteCm(n)); note[h.id] = n; }
log("built", H.length, "agents, D", D, "parents", parents.length, "masters", CFG.top[0]);
// ---- actions ----
const GATE = "0x000000000000000000000000000000000000dAC9", TARGETS = ["0x000000000000000000000000000000000000Ba5e", "0x000000000000000000000000000000000000B0b0"];
const METHODS = ["0xa9059cbb", "0x095ea7b3"]; const wasm = `${V92}/build/c${D}/main_c_d${D}_js/main_c_d${D}.wasm`, zkey = `${V92}/build/zk/c${D}.zkey`;
const ri = (n) => Number(rnd(4) % BigInt(n));
for (let round = 0; round < M; round++) {
  for (const h of shuffle(H, `round-${round}`)) {
    const input = structuredClone(h.input); const n = note[h.id];
    const amount = BigInt(1 + ri(9)), method = METHODS[ri(2)], target = TARGETS[ri(2)], params = "0x" + crypto.randomBytes(4).toString("hex"), nonce = rnd(8);
    const now = 1_000_000 + 600 * round + ri(60);
    input.now = String(now);
    input.ctx_hash = String(L7.ctxHash({ chainId: 31337n, verifier: GATE, method, target, params, amount, nonce }));
    const { input: x, change } = L8.setBudget(input, n, notes, amount, rnd(31) % (1n << 250n));
    L9.toV9(x, crypto.randomBytes(32).toString("hex"));
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(x, wasm, zkey);
    const cd = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, publicSignals)) + "]");
    console.log(JSON.stringify({ world: w, D, round, agent: h.id, parent: h.parent, master: h.master, amount: String(amount), method, target, now,
      proof: [...cd[0], ...cd[1].flat(), ...cd[2]], pub: publicSignals, roots: [x.issued_root, x.revoked_root, x.root_root] }));
    notes.insert(BigInt(x.cm_change)); note[h.id] = change;
  }
  log("round", round, "done");
}
process.exit(0);

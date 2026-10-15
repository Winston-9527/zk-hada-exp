// E6b transcript generator (PREREGISTRATION.md "Corpus"). Offline on the T5 world (mirror trees from ../../t5_e2e/T5-e2e-scale_20261010/state/):
// K = 64 D=4 agents (8 parents x 8 children under M0/M1, all unrevoked), m = 8 sequential actions each, round-robin with the agent order shuffled
// per round; every action spends the agent's current note and inserts its change note. Real Groth16 proofs (v9 c4 zkey).
// usage: node gen.mjs fresh > results/transcripts_fresh.jsonl ; node gen.mjs p1 > results/transcripts_p1.jsonl
import crypto from "crypto"; import fs from "fs"; import os from "os"; import path from "path";
const C = await import(new URL("../../t5_e2e/T5-e2e-scale_20261010/common.mjs", import.meta.url).pathname);
const variant = process.argv[2]; if (!["fresh", "p1"].includes(variant)) throw new Error("variant fresh | p1");
const { createRequire } = await import("module"); const { poseidon3 } = createRequire(new URL("../../t2_circuit_fix/zkdac_v8/package.json", import.meta.url).pathname)("poseidon-lite");
const creds = C.loadCreds(), st = C.loadState(), m = await C.Mirror.from(st);
const revoked = new Set((st.revokedEdges ?? []).map((id) => creds[id].cert[creds[id].D - 1]));
const blocked = (c) => c.cert.slice(1).some((x) => revoked.has(x));
const byName = Object.fromEntries(creds.map((c) => [c.name, c]));
// parents: D = 3 nodes under M0 / M1 whose 8 children and themselves are all unblocked
const parents = creds.filter((c) => c.D === 3 && /^M[01]\./.test(c.name) && !blocked(c) && [0, 1, 2, 3, 4, 5, 6, 7].every((k) => byName[`${c.name}.${k}`] && !blocked(byName[`${c.name}.${k}`])));
const chosen = C.shuffle(parents.map((p) => p.id), "e6b-parents").slice(0, 8);
if (chosen.length < 8) throw new Error("not enough unrevoked parents: " + chosen.length);
const agents = chosen.flatMap((pid) => [0, 1, 2, 3, 4, 5, 6, 7].map((k) => byName[`${creds[pid].name}.${k}`].id));
const NOW = st.NOW + 100000, M_ = 8, D = 4;
const wasm = `${C.P.V9}/build/c4/main_c_d4_js/main_c_d4.wasm`, zkey = `${C.P.V9}/build/zk/c4.zkey`;
const tmp = path.join(os.tmpdir(), `e6b-${process.pid}.wtns`);
const notes = Object.fromEntries(agents.map((id) => [id, C.noteOf(st.agents[id].note)]));
C.log(variant, "agents", agents.length, "parents", chosen.map((p) => creds[p].name).join(" "));
for (let round = 0; round < M_; round++) {
  for (const id of C.shuffle(agents, `e6b-round-${variant}-${round}`)) {
    const c = creds[id]; const ag = C.agentObj(c); const input = structuredClone(ag.input);
    input.issued_root = String(m.issued.root);
    for (let i = 1; i < D; i++) { const p = m.issued.path(m.issued.index.get(String(ag.meta.cert[i]))); input.m_sib[i] = p.sib; input.m_bit[i] = p.bit; }
    Object.assign(input, C.L7.rootProof(m.roots, ag.meta.cert[0])); C.L7.refreshAll(input, { ...ag.meta, imt: m.imt });
    const note = notes[id]; const cmIn = C.L8.noteCm(note);
    const ctxNonce = BigInt("0x" + crypto.randomBytes(8).toString("hex"));
    input.now = String(NOW); input.act_req_cap = "1";
    input.ctx_hash = String(C.L7.ctxHash({ chainId: C.CHAIN, verifier: st.addrs.gate, method: C.METHOD, target: st.addrs.target, params: C.PARAMS, amount: 1n, nonce: ctxNonce }));
    const change = { own: note.own, q: note.q - 1n, lin: note.lin, rho: C.L8.rnd250("e6b-chg-" + crypto.randomBytes(16).toString("hex")) };
    Object.assign(input, { note_root: String(m.notes.root), budget_nf: String(poseidon3([C.L8.TAG_BNF, BigInt(input.holder_sk), cmIn])), cm_change: String(C.L8.noteCm(change)),
      q_spent: "1", q_in: String(note.q), rho_in: String(note.rho), q_change: String(change.q), rho_change: String(change.rho), ...C.L8.notePath(m.notes, cmIn) });
    C.L9.toV9(input, variant === "p1" ? `e6b-p1-${id}` : crypto.randomBytes(32).toString("hex"));   // P1: one accSeed per agent (randomness reuse)
    const { proof, publicSignals } = await C.snarkjs.groth16.fullProve(input, wasm, zkey);
    const cd = await C.cd(proof, publicSignals);
    console.log(JSON.stringify({ variant, round, agent: id, name: c.name, parent: c.parent, master: c.chain[1], proof: [...cd[0], ...cd[1].flat(), ...cd[2]], pub: publicSignals,
      roots: [input.issued_root, input.revoked_root, input.root_root], cert2: c.cert[2] }));
    m.notes.insert(BigInt(input.cm_change)); notes[id] = change;
  }
  C.log(variant, "round", round, "done");
}
try { fs.unlinkSync(tmp); } catch {}
process.exit(0);

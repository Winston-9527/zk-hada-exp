// E6 P1/P2 (PREREGISTRATION.md): opening cost per action. usage: node bench.mjs > results/bench.json
// Per action: action-proof verify (snarkjs), t member shares (partial decryption + DLEQ prove), combine (validate t shares + group interpolation +
// keystream decryption). Committee variants (2,3) and (5,9): ciphertexts re-encrypted to that committee's TPK with the generator's encryptChain
// (no new proof; proof verification is independent of the committee and timed separately on the (3,5) fixtures).
import { createRequire } from "module"; import fs from "fs"; import os from "os"; import crypto from "crypto"; import * as T from "./threshold.mjs";
const v7 = new URL("../../t2_circuit_fix/zkdac_v7/", import.meta.url).pathname;
const snarkjs = createRequire(v7 + "package.json")("snarkjs"); const { encryptChain } = await import(v7 + "scripts/lib_v7.mjs");
const load = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url)));
const stats = (xs) => { const n = xs.length, mu = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1)), s = [...xs].sort((a, b) => a - b);
  return { n, mean: +mu.toFixed(2), sd: +sd.toFixed(2), median: +((s[(n - 1) >> 1] + s[n >> 1]) / 2).toFixed(2), p95: +s[Math.min(n - 1, Math.ceil(0.95 * n) - 1)].toFixed(2) }; };
const now = () => performance.now();
async function measure(E, fixtures, getAction) {
  const tv = [], tsh = [], tcomb = [], tdleq = []; let exact = 0;
  for (const f of fixtures) {
    const { ct, ps, proofCheck } = await getAction(f);
    let t0 = now(); if (proofCheck) { if (!(await snarkjs.groth16.verify(proofCheck.vk, ps, f.proof))) throw new Error("proof"); tv.push(now() - t0); }
    const ctx = { epoch: E.pub.epoch, ev: T.eventId(ps), tpk: ct.tpk, c1s: ct.c1s };
    const shares = []; for (let i = 1; i <= E.pub.t; i++) { t0 = now(); shares.push(T.memberShare(E.pub, E.members[i - 1], ctx)); tsh.push(now() - t0); }
    t0 = now(); const sh = shares[0].parts[0]; T.dleqVerify(ctx.epoch, ctx.ev, 1, E.pub.Y[0], ctx.c1s[0], sh.D, sh.pf); tdleq.push(now() - t0);
    t0 = now(); const r = T.combine(E.pub, ctx, shares); const pts = T.decryptWith(ct, r.S, f.mode); tcomb.push(now() - t0);
    if (pts.every((p, j) => String(p[0]) === f.ents[j][0] && String(p[1]) === f.ents[j][1])) exact++;
  }
  return { exact: `${exact}/${fixtures.length}`, ...(tv.length ? { action_proof_verify_ms: stats(tv) } : {}), member_share_ms: stats(tsh), dleq_verify_per_ciphertext_ms: stats(tdleq), combine_and_decrypt_ms: stats(tcomb) };
}
const FX1 = load("results/fixtures_C_e1.json"), FXA = load("results/fixtures_A_e1.json");
const E35 = T.deal({ t: 3, n: 5, epoch: 1, seed: FX1.dealerSeed });
const fromFixture = (f) => ({ ct: T.parseCt(f.publicSignals, f.mode, f.D), ps: f.publicSignals, proofCheck: { vk: JSON.parse(fs.readFileSync(`${v7}zk/vk_${f.mode.toLowerCase()}${f.D}.json`)) } });
const out = { date: new Date().toISOString(), machine: `${os.cpus()[0].model} x${os.cpus().length}`, node: process.version, note: "ms; single-threaded JS (circomlibjs babyJub, not constant-time)", P1: {} };
for (const D of [1, 2, 3, 4]) { out.P1[`C_D${D}_t3n5`] = await measure(E35, FX1.fixtures.filter((f) => f.D === D), fromFixture); console.error("C D" + D, out.P1[`C_D${D}_t3n5`].combine_and_decrypt_ms.mean); }
out.P1.A_D4_t3n5 = await measure(E35, FXA.fixtures, fromFixture); console.error("A D4 done");
for (const [t, n] of [[2, 3], [5, 9]]) {
  const E = T.deal({ t, n, epoch: 1, seed: `e6-bench-${t}-${n}` });
  const reenc = async (f) => { const inp = {}; await encryptChain(inp, f.ents.map((p) => p.map(BigInt)), E.pub.tpk, "C", crypto.randomBytes(32).toString("hex"));
    const ps = [...f.publicSignals.slice(0, 7), ...E.pub.tpk.map(String), inp.acc_c1x[0], inp.acc_c1y[0], inp.acc_c2x[0], inp.acc_c2y[0], ...inp.acc_e.flat()];
    return { ct: T.parseCt(ps, "C", f.D), ps, proofCheck: null }; };
  out.P1[`C_D4_t${t}n${n}`] = await measure(E, FX1.fixtures.filter((f) => f.D === 4), reenc); console.error(`t${t}n${n} done`);
}
// P2: canonical opening transcript per share per ciphertext: index (1 B) + epoch (4 B) + D_i (32 B compressed) + proof (A1, A2 compressed 32 B each, z 32 B)
const perShare = 1 + 4 + 32 + 96;
out.P2 = { bytes_per_share_per_ciphertext: perShare, form: "commitment form (A1, A2, z); the (ch, z) form would be 1+4+32+64 = 101 B",
  mode_C_t3: 3 * perShare, mode_A_D4_t3: 3 * 5 * perShare, mode_C_t5: 5 * perShare };
console.log(JSON.stringify(out, null, 1)); process.exit(0);

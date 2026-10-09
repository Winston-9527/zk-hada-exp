// H3 pre-study C1: note_transfer proving time (N fresh transfers) + a forge fixture (real proof, the tree leaves at proof time, revocation genesis).
// usage: node bench.mjs 10 > results/bench.json   (writes ../../t4_contracts/foundry/test/fixtures_h3note.json)
import fs from "fs"; import os from "os"; import path from "path"; import * as N from "./note_lib.mjs";
const RUNS = Number(process.argv[2] ?? 10), zkey = new URL("build/zk/nt.zkey", import.meta.url).pathname, vk = JSON.parse(fs.readFileSync(new URL("zk/vk_nt.json", import.meta.url)));
const tmp = path.join(os.tmpdir(), `ntb-${process.pid}.wtns`); const tw = [], tp = [], tv = []; let ok = 0, fixture = null;
for (let r = 0; r < RUNS; r++) {
  const w = await N.World.create(); const P = N.key("bP" + r), A = N.key("bA" + r);
  for (let k = 0; k < 30; k++) w.notes.insert(N.rho(`other-${r}-${k}`));                        // other notes in the tree
  const root = w.add({ own: P.pk, q: 1000n, lin: [N.edgeId([0n, 1n], P.pk, N.rho("root" + r)), 0n, 0n, 0n], rho: N.rho("n0-" + r) });
  const t = N.transfer(w, root, P, { q_spent: 100n, q1: 300n, rho1: N.rho("a" + r), child: A.pk, q2: 600n, rho2: N.rho("b" + r), ctx: 1234n + BigInt(r) });   // spend + delegate + change
  let t0 = performance.now(); await N.snarkjs.wtns.calculate(t.input, N.WASM, tmp); tw.push(performance.now() - t0);
  t0 = performance.now(); const { proof, publicSignals } = await N.snarkjs.groth16.prove(zkey, tmp); tp.push(performance.now() - t0);
  t0 = performance.now(); if (await N.snarkjs.groth16.verify(vk, publicSignals, proof)) ok++; tv.push(performance.now() - t0);
  if (r === 0) { const cd = JSON.parse("[" + (await N.snarkjs.groth16.exportSolidityCallData(proof, publicSignals)) + "]");
    const leaves = []; for (let i = 0; i < w.notes.size; i++) leaves.push(String(w.notes.leaves[i]));
    fixture = { a: cd[0], b: cd[1], c: cd[2], pub: cd[3], leaves, revGenesisRoot: String(w.rev.root), revGenesisCount: w.rev.leaves.length }; }
}
const st = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length, sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)), s = [...xs].sort((a, b) => a - b); return { mean: +m.toFixed(1), sd: +sd.toFixed(1), median: +((s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2).toFixed(1) }; };
fs.writeFileSync(new URL("../../t4_contracts/foundry/test/fixtures_h3note.json", import.meta.url), JSON.stringify(fixture, null, 1));
try { fs.unlinkSync(tmp); } catch {}
console.log(JSON.stringify({ machine: `${os.cpus()[0].model} x${os.cpus().length}`, node: process.version, constraints: { nonlinear: 45397, linear: 38461, total: 83858 }, public_inputs: 7, runs: RUNS, verified: `${ok}/${RUNS}`, witness_ms: st(tw), prove_ms: st(tp), verify_ms: st(tv) }, null, 1)); process.exit(0);

// T8e S1: proving benchmark of ZkDacChainV9(D, h, h, h, h). Instances = v9.2 instances with all four Merkle structures rebuilt at depth h
// (issued SparseTree(h), revocation IMT(h) with 20 decoys, registered-root and note LeanIMTs padded to h). 10 fresh instances (seeds 1000..1009).
// usage: node bench_h.mjs <D> <h> [N=10] > results/bench_d<D>_h<h>_run<k>.json
import fs from "fs"; import os from "os"; import path from "path"; import { createRequire } from "module";
const HERE = new URL(".", import.meta.url).pathname, W = path.resolve(HERE, "../../..") + "/";
const snarkjs = createRequire(W + "t2_circuit_fix/zkdac_v7/package.json")("snarkjs");
const L7 = await import(W + "t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs"); const L8 = await import(W + "t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs");
const L9 = await import(W + "t2_circuit_fix/zkdac_v9_2/scripts/lib_v9.mjs"); const BW = await import(W + "t2_circuit_fix/zkdac_v8/scripts/budget_world.mjs");
const D = Number(process.argv[2]), h = Number(process.argv[3]), N = Number(process.argv[4] ?? 10); const name = `main_d${D}_h${h}`;
const wasm = `${HERE}build/${name}/${name}_js/${name}.wasm`, zkey = `${HERE}build/${name}/${name}.zkey`, vk = JSON.parse(fs.readFileSync(`${HERE}build/${name}/vk.json`));
const pad = (a, n) => { const x = a.map(String).slice(0, n); for (const v of a.slice(n)) if (String(v) !== "0") throw new Error("path deeper than h"); while (x.length < n) x.push("0"); return x; };
const stats = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)); const s = [...xs].sort((a, b) => a - b); return { mean: +m.toFixed(1), sd: +sd.toFixed(1), median: +((s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2).toFixed(1) }; };
async function instance(seed) {
  const { input, meta } = await L7.buildInstanceV7({ D, seed, mode: "C", now: 1000, rootOthers: 0, accSeed: `t8e-s1-${D}-${h}-${seed}` });
  const imt = await L7.IMT.create(h); for (let k = 0; k < 20; k++) imt.insert(L8.rnd250(`t8e-decoy-${seed}-${k}`));
  const issued = new BW.W.SparseTree(h); for (let k = 0; k < 8; k++) issued.append(L8.rnd250(`t8e-other-${seed}-${k}`)); for (let i = 1; i < D; i++) issued.append(meta.cert[i]);
  const roots = L7.newRootTree(); for (let k = 0; k < 5; k++) roots.insert(L8.rnd250(`t8e-root-${seed}-${k}`)); roots.insert(BigInt(meta.cert[0]));
  const notes = L8.newNoteTree(); for (let k = 0; k < 9; k++) notes.insert(L8.rnd250(`t8e-note-${seed}-${k}`));
  const x = input; x.issued_root = String(issued.root);
  for (let i = 0; i < D; i++) { if (i === 0) { x.m_sib[0] = Array(h).fill("0"); x.m_bit[0] = Array(h).fill("0"); continue; } const p = issued.path(issued.index.get(String(meta.cert[i]))); x.m_sib[i] = p.sib.map(String); x.m_bit[i] = p.bit.map(String); }
  const rp = L7.rootProof(roots, meta.cert[0]); Object.assign(x, rp); x.rt_sib = pad(rp.rt_sib, h);
  L7.refreshAll(x, { ...meta, imt });
  const n = { own: [BigInt(x.ent_Ax[D]), BigInt(x.ent_Ay[D])], q: 1000n, lin: L8.linOf(meta), rho: L8.rnd250(`t8e-rho-${seed}`) }; notes.insert(L8.noteCm(n));
  const { input: y } = L8.setBudget(x, n, notes, 7n, L8.rnd250(`t8e-chg-${seed}`)); y.nt_sib = pad(y.nt_sib, h); L9.toV9(y, `t8e-acc-${D}-${h}-${seed}`); return y; }
const tmp = path.join(os.tmpdir(), `t8e-s1-${process.pid}.wtns`); const tw = [], tp = [], tv = []; let ok = 0, npub = 0;
for (let r = 0; r < N; r++) { const x = await instance(1000 + r);
  let t = performance.now(); await snarkjs.wtns.calculate(x, wasm, tmp); tw.push(performance.now() - t);
  t = performance.now(); const { proof, publicSignals } = await snarkjs.groth16.prove(zkey, tmp); tp.push(performance.now() - t); npub = publicSignals.length;
  t = performance.now(); if (await snarkjs.groth16.verify(vk, publicSignals, proof)) ok++; tv.push(performance.now() - t); }
try { fs.unlinkSync(tmp); } catch {}
console.log(JSON.stringify({ circuit: name, D, h, machine: `${os.cpus()[0].model} x${os.cpus().length}`, runs: N, verified: `${ok}/${N}`, public_inputs: npub, witness_ms: stats(tw), prove_ms: stats(tp), verify_ms: stats(tv) }));
process.exit(0);

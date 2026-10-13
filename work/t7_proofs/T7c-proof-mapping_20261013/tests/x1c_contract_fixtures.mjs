// T7c X1c contract level: real revoke_transition proofs that are satisfiable in the circuit but must be rejected by ZkDacRevocations (RV-C1):
// (iii') next_index = count + 1 (empty slot), (v') a stale old_root with its own consistent witness; plus the honest control.
// usage: node x1c_contract_fixtures.mjs  -> ../../../t4_contracts/foundry/test/t7c_revoke_fixtures.json
import fs from "fs"; import crypto from "crypto"; import { createRequire } from "module";
const W = new URL("../../../", import.meta.url).pathname;
const req = createRequire(W + "t2_circuit_fix/zkdac_v7/package.json"); const snarkjs = req("snarkjs"); const { buildBabyjub } = req("circomlibjs");
const { IMT, trunc } = await import(W + "t2_circuit_fix/zkdac_v4/scripts/imt.mjs");
const R = await import(W + "t4_obligations/E7-obligations_20261009/revoke/revoke_lib.mjs");
const { rnd250 } = await import(W + "t2_circuit_fix/zkdac_v8/scripts/lib_v8.mjs");
const ZK = W + "t4_obligations/E7-obligations_20261009/revoke/build/zk/rt.zkey";
const bj = await buildBabyjub(); const F = bj.F; const H3 = (await IMT.create(1)).H;
const key = (tag) => { const sk = BigInt("0x" + crypto.createHash("sha256").update(tag).digest("hex")) % bj.subOrder; const A = bj.mulPointEscalar(bj.Base8, sk);
  const ia = [F.toObject(A[0]), F.toObject(A[1])]; return { a: { kind: 0, who: 0, ia, sk }, entry: H3([2053861995n, ia[0], ia[1]]) }; };
const imt = await IMT.create(20); for (let k = 0; k < 20; k++) imt.insert(rnd250("v8-decoy-" + k));
const genesis = { root: String(imt.root), count: imt.leaves.length };
const cd = async (input) => { const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, R.WASM, ZK); const c = JSON.parse("[" + (await snarkjs.groth16.exportSolidityCallData(proof, publicSignals)) + "]"); return { a: c[0], b: c[1], c: c[2], pub: c[3] }; };
const k1 = key("x1c-1"), k2 = key("x1c-2"), k3 = key("x1c-3");
const t1 = R.transition(imt, k1.entry, k1.a); const honest1 = await cd(t1.input);                 // genesis -> R1 (honest)
// (iii') from genesis, slot count + 1: circuit-satisfiable
const lo = imt.lowIndex(trunc(k2.entry)); const ni = imt.leaves.length + 1; const t = R.cloneImt(imt); const low = imt.leaves[lo]; const lp = imt.path(lo);
t._set(lo, { value: low.value, nextIndex: BigInt(ni), nextValue: trunc(k2.entry) }); const np = t.path(ni); t._set(ni, { value: trunc(k2.entry), nextIndex: low.nextIndex, nextValue: low.nextValue });
const skip = await cd({ ...t1.input, old_root: String(imt.root), new_root: String(t.root), entry: String(k2.entry), next_index: String(ni), ia: k2.a.ia.map(String), sk: String(k2.a.sk),
  low_value: String(low.value), low_next_index: String(low.nextIndex), low_next_value: String(low.nextValue), low_sib: lp.sib.map(String), low_bit: lp.bit.map(String), new_sib: np.sib.map(String) });
// (v') after R1 is applied: a proof on the stale genesis root (its own consistent witness)
const stale = await cd(R.transition(imt, k3.entry, k3.a).input);
const after1 = R.transition(imt, k1.entry, k1.a).after; const honest2 = await cd(R.transition(after1, k3.entry, k3.a).input);   // control on the current root
fs.writeFileSync(W + "t4_contracts/foundry/test/t7c_revoke_fixtures.json", JSON.stringify({ genesisRoot: genesis.root, genesisCount: genesis.count, honest1, skip, stale, honest2 }));
console.error("wrote t7c_revoke_fixtures.json"); process.exit(0);

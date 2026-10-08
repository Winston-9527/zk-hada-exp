// Re-check (found during #28): v3/v4 A05 put A's certificates into B's issued tree via extraLeaves at index 200000+ (>= 2^16), i.e. NOT in
// issued_root, while the oracle counted them as registered. Re-run A05 / A05b / A05c on v4 with the leaves at in-range indices (base 40000).
// usage: node v6/recheck_A05_inrange_v4.mjs > v6/results/recheck_A05_inrange_v4.json
import { buildInstanceV4 as buildInstance } from "../../t2_circuit_fix/zkdac_v4/scripts/lib_v4.mjs";
import { satisfiable } from "../../t2_circuit_fix/zkdac_v4/scripts/witness_v4.mjs";
const D = 4, S = (x) => x.toString(), clone = (o) => JSON.parse(JSON.stringify(o)); const out = [];
for (const base of [200000, 40000]) {
  const { input: IA, meta: MA } = await buildInstance({ D, seed: 11 });
  const { input: IB, meta: MB } = await buildInstance({ D, seed: 22, extraLeaves: MA.cert, extraLeafBase: base });
  const m = clone(IB); const p = MB.merklePath(MB.merkleIdx(MA.cert[0]));
  m.sig_S[0] = IA.sig_S[0]; m.sig_R8x[0] = IA.sig_R8x[0]; m.sig_R8y[0] = IA.sig_R8y[0]; m.cap[0] = IA.cap[0]; m.expiry[0] = IA.expiry[0];
  m.ent_Ax[0] = IA.ent_Ax[0]; m.ent_Ay[0] = IA.ent_Ay[0]; m.m_sib[0] = p.sib.map(S); m.m_bit[0] = p.bit.map(S);
  const m2 = clone(m); m2.ent_Ax[1] = IA.ent_Ax[1]; m2.ent_Ay[1] = IA.ent_Ay[1];
  // isolation: A's own cert0 + its in-tree path inside B's tree with A's full hop 0 (ent0, ent1) and B's original hops 1..: only cert1 should fail
  const pathOk = clone(IB); const p0 = MB.merklePath(MB.merkleIdx(MA.cert[0])); pathOk.m_sib[0] = p0.sib.map(S); pathOk.m_bit[0] = p0.bit.map(S);
  out.push({ extraLeafBase: base, in_tree: base + 17 * 3 < 2 ** 16, A05: await satisfiable(D, m), A05b: await satisfiable(D, m2), A05c_control: await satisfiable(D, IB),
    A_cert0_path_in_B_tree_with_B_hop0_EXPECT_REJECT: await satisfiable(D, pathOk) });
}
console.log(JSON.stringify(out, null, 1)); process.exit(0);

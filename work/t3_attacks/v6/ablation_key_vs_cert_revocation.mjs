// Ablation (#28): what does key revocation buy over certificate revocation? Agent key K (ent[2]) holds TWO incoming certificates:
// chain 1 (human H1 -> master M1 -> K) and chain 2 (human H2 -> master M2 -> K). K is compromised; the attacker signs a fresh certificate
// K -> attacker key (registered in the delegation tree) and proves through chain 2. The revoker knows only chain 1.
//   v5 (certificate revocation only): revoke everything known about K = chain 1's cert1 (incoming) and cert2 (outgoing).
//   v6 (key revocation): one entry H(KEY_TAG, K).
// Also: the same attack through chain 1 (the known parent) under v5. Circuit outcomes only (statement-level oracle rows are in attacks_v6).
// usage: node v6/ablation_key_vs_cert_revocation.mjs > v6/results/ablation_key_vs_cert.json
import { buildInstanceV5 } from "../../t2_circuit_fix/zkdac_v5/scripts/lib_v5.mjs";
import { satisfiable as sat5 } from "../../t2_circuit_fix/zkdac_v5/scripts/witness_v5.mjs";
import { buildInstanceV6, keyHash, refreshAll, init, SUBORDER } from "../../t2_circuit_fix/zkdac_v6/scripts/lib_v6.mjs";
import { satisfiable as sat6 } from "../../t2_circuit_fix/zkdac_v6/scripts/witness_v6.mjs";
import { refreshRevocation } from "../../t2_circuit_fix/zkdac_v4/scripts/lib_v4.mjs";
import crypto from "crypto";
const D = 3, S = (x) => x.toString(), clone = (o) => JSON.parse(JSON.stringify(o));
const { eddsa } = await init(); const F = eddsa.F, bj = eddsa.babyJub;
const sk = BigInt("0x" + crypto.createHash("sha256").update("ablation-attacker").digest("hex").slice(0, 60)) % SUBORDER;
const A = bj.mulPointEscalar(bj.Base8, sk), att = { Ax: F.toObject(A[0]), Ay: F.toObject(A[1]) };
const K = (await buildInstanceV5({ D, seed: 1 })).meta.ents[2];               // chain 1 (seed 1) defines K
const kPrv = [undefined, undefined, K.prv];
// attacker chain = chain `seed` with hop 2 replaced by K -> attacker (fresh cert registered at an in-range index)
async function attackChain(build, seed) {
  const probe = (await build({ D, seed, entPrv: kPrv })).meta;
  const c2 = probe.P([2, K.Ax, K.Ay, att.Ax, att.Ay, 3, 2000]);
  const { input, meta } = await build({ D, seed, entPrv: kPrv, extraLeaves: [c2], extraLeafBase: 40000 });
  const m = clone(input); m.ent_Ax[3] = S(att.Ax); m.ent_Ay[3] = S(att.Ay); m.cap[2] = "3"; m.expiry[2] = "2000";
  const sg = eddsa.signPoseidon(K.prv, F.e(c2)); m.sig_S[2] = S(sg.S); m.sig_R8x[2] = S(F.toObject(sg.R8[0])); m.sig_R8y[2] = S(F.toObject(sg.R8[1]));
  const p = meta.merklePath(meta.merkleIdx(c2)); m.m_sib[2] = p.sib.map(S); m.m_bit[2] = p.bit.map(S);
  m.holder_sk = S(sk); m.nullifier = S(meta.P([1952805748n, sk, meta.P([BigInt(m.ctx_hash), BigInt(m.act_req_cap)])]));
  return { m, meta: { ...meta, cert: [meta.cert[0], meta.cert[1], c2] }, orig: meta };
}
const rows = [];
const chain1 = (await buildInstanceV5({ D, seed: 1 })).meta;                   // what the revoker knows about K
for (const [label, seed] of [["chain 2 (unknown parent M2)", 2], ["chain 1 (known parent M1)", 1]]) {
  { // v5: revoke chain 1's cert1 (incoming to K) and cert2 (outgoing from K)
    const { m, meta } = await attackChain(buildInstanceV5, seed);
    rows.push({ circuit: "v5", path: label, revoked: "none", accepted: await sat5(D, refreshRevocation(clone(m), meta)) });
    meta.imt.insert(BigInt(chain1.cert[1])); meta.imt.insert(BigInt(chain1.cert[2]));
    let ok = false, why = "";
    try { ok = await sat5(D, refreshRevocation(clone(m), meta)); } catch (e) { why = "no witness: " + String(e.message).slice(0, 40); }
    rows.push({ circuit: "v5", path: label, revoked: "chain-1 cert1 (incoming) + cert2 (outgoing), 2 entries", accepted: ok, note: why || undefined });
  }
  { // v6: one key entry
    const { m, meta } = await attackChain(buildInstanceV6, seed);
    rows.push({ circuit: "v6", path: label, revoked: "none", accepted: await sat6(D, refreshAll(clone(m), meta)) });
    meta.imt.insert(keyHash(meta, K));
    let ok = false, why = "";
    try { ok = await sat6(D, refreshAll(clone(m), meta)); } catch (e) { why = "no witness: " + String(e.message).slice(0, 40); }
    rows.push({ circuit: "v6", path: label, revoked: "key K, 1 entry", accepted: ok, note: why || undefined });
  }
}
console.log(JSON.stringify({ D, rows }, null, 1)); process.exit(0);

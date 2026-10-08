// Registration proof (#17), witness level: Semaphore interop, R1 properties, negatives, end-to-end with the v4 action circuit.
import { makeHuman, humanPrv, registerWitness, nfDomain, leaf0Of, Group, TAG_REG } from "./lib_register.mjs";
import { buildInstanceV4 } from "../../t2_circuit_fix/zkdac_v4/scripts/lib_v4.mjs";
import { satisfiable as actionSat } from "../../t2_circuit_fix/zkdac_v4/scripts/witness_v4.mjs";
import * as snarkjs from "snarkjs"; import os from "os"; import path from "path";
const MAX = 20, WASM = new URL(`../build/r${MAX}/main_reg_${MAX}_js/main_reg_${MAX}.wasm`, import.meta.url).pathname;
const L = 2736030358979909402780800718157159386076813972158567259200215660948447373041n;
const tmp = path.join(os.tmpdir(), "reg-" + process.pid + ".wtns");
const sat = async (w) => { try { await snarkjs.wtns.calculate(w, WASM, tmp); return true; } catch { return false; } };
const clone = (o) => JSON.parse(JSON.stringify(o));
const humans = Array.from({ length: 40 }, (_, i) => makeHuman(i));
const group = new Group(humans.slice(0, 37).map((h) => h.id.commitment));     // humans 37..39 are NOT members
const DOMAIN = 0xd0a1n, master = [5299619240641551281634865583518297030282874472190772894086521144482721001553n, 16950150798460657717958625567821834550301663161624707787222815936182638968203n];
const out = { group_size: group.size, group_depth: group.depth, MAX_DEPTH: MAX, valid: { tried: 0, accepted: 0 }, r1: {}, negatives: [], end_to_end: [] };
// 1) every member can register (real Semaphore identities, LeanIMT proofs of varying length)
for (const h of humans.slice(0, 37)) { out.valid.tried++; if (await sat(registerWitness({ human: h, group, domain: DOMAIN, master, cap0: 0xFF, expiry0: 6000 }))) out.valid.accepted++; }
// 2) R1 properties of nf_domain
const s0 = humans[0].id.secretScalar;
out.r1 = {
  same_human_same_domain_two_masters_same_nf: registerWitness({ human: humans[0], group, domain: DOMAIN, master, cap0: 0xFF, expiry0: 6000 }).nf_domain ===
    registerWitness({ human: humans[0], group, domain: DOMAIN, master: [master[0], master[1]], cap0: 0x0F, expiry0: 7000 }).nf_domain,
  same_human_other_domain_different_nf: nfDomain(s0, DOMAIN) !== nfDomain(s0, DOMAIN + 1n),
  other_humans_distinct_nf: new Set(humans.map((h) => nfDomain(h.id.secretScalar, DOMAIN).toString())).size === humans.length,
};
{ // computed, not asserted: Semaphore v4's own nullifier for scope = domain is Poseidon(scope, s); ours must differ for every human
  const { poseidon2 } = await import("poseidon-lite");
  out.r1.differs_from_semaphore_nullifier_with_scope_domain = humans.every((h) => poseidon2([DOMAIN, h.id.secretScalar]) !== nfDomain(h.id.secretScalar, DOMAIN));
}
// 3) negatives (all must be rejected)
const base = registerWitness({ human: humans[3], group, domain: DOMAIN, master, cap0: 0xFF, expiry0: 6000 });
const neg = async (name, w) => out.negatives.push({ name, accepted: await sat(w) });
{ const w = clone(base); w.human_sk = humans[4].id.secretScalar.toString(); await neg("other member's secret, own path/nf/leaf0", w); }
{ const w = clone(base); w.human_sk = (BigInt(w.human_sk) + L).toString(); await neg("secret alias s + l", w); }
{ const w = clone(base); const s2 = BigInt(w.human_sk) + L; w.human_sk = s2.toString(); w.nf_domain = nfDomain(s2, DOMAIN).toString(); await neg("secret alias s + l with matching nf (second nullifier)", w); }
{ const outsider = humans[38]; const g2 = new Group([...humans.slice(0, 37).map((h) => h.id.commitment), outsider.id.commitment]);
  const w = registerWitness({ human: outsider, group: g2, domain: DOMAIN, master, cap0: 0xFF, expiry0: 6000 }); w.group_root = base.group_root; await neg("non-member (proof against a group that includes them, root of the real group)", w); }
{ const w = clone(base); w.depth = String(MAX + 1); w.group_root = "0"; await neg("depth > MAX_DEPTH with group_root 0 (BinaryMerkleRoot returns 0)", w); }
{ const w = clone(base); w.nf_domain = nfDomain(BigInt(w.human_sk), DOMAIN + 1n).toString(); await neg("nf for another domain", w); }
{ const w = clone(base); w.nf_domain = nfDomain(12345n, DOMAIN).toString(); await neg("nf from unrelated secret", w); }
{ const w = clone(base); w.nf_domain = (BigInt(w.nf_domain) + 1n).toString(); await neg("nf + 1", w); }
{ const w = clone(base); w.master_Ax = (BigInt(w.master_Ax) + 1n).toString(); await neg("leaf0 for a different master than claimed", w); }
{ const w = clone(base); w.cap0 = "255"; w.leaf0 = leaf0Of(humans[3].id.publicKey, master, 0xFFFF, 6000).toString(); await neg("leaf0 with larger cap than witnessed", w); }
{ const w = clone(base); w.cap0 = (2n ** 32n).toString(); w.leaf0 = leaf0Of(humans[3].id.publicKey, master, 2n ** 32n, 6000).toString(); await neg("cap0 >= 2^32", w); }
{ const w = clone(base); w.expiry0 = (2n ** 64n).toString(); w.leaf0 = leaf0Of(humans[3].id.publicKey, master, 0xFF, 2n ** 64n).toString(); await neg("expiry0 >= 2^64", w); }
{ const { poseidon7 } = await import("poseidon-lite"); const pk = humans[3].id.publicKey; const w = clone(base);
  w.leaf0 = poseidon7([1n, pk[0], pk[1], master[0], master[1], 0xFFn, 6000n]).toString(); await neg("leaf0 with hop index 1 (non-root certificate)", w); }
{ const w = clone(base); w.siblings[0] = (BigInt(w.siblings[0]) + 1n).toString(); await neg("tampered sibling", w); }
// 4) end-to-end: the registered human key is ent[0] of a real v4 action chain; leaf0 equals the chain's hop-0 certificate hash
for (const D of [1, 2, 4]) {
  const h = humans[5 + D];
  const { input, meta } = await buildInstanceV4({ D, entPrv: [humanPrv(5 + D)] });
  const pkOk = BigInt(input.ent_Ax[0]) === h.id.publicKey[0] && BigInt(input.ent_Ay[0]) === h.id.publicKey[1];
  const w = registerWitness({ human: h, group, domain: DOMAIN, master: [input.ent_Ax[1], input.ent_Ay[1]], cap0: input.cap[0], expiry0: input.expiry[0] });
  out.end_to_end.push({ D, ent0_is_semaphore_identity: pkOk, leaf0_equals_action_cert0: w.leaf0 === String(meta.cert[0]),
    registration_accepted: await sat(w), action_accepted: await actionSat(D, input) });
}
out.summary = { valid: `${out.valid.accepted}/${out.valid.tried}`, r1_all_true: Object.values(out.r1).every(Boolean),
  negatives_accepted: out.negatives.filter((x) => x.accepted).map((x) => x.name), negatives: out.negatives.length,
  end_to_end_ok: out.end_to_end.every((e) => e.ent0_is_semaphore_identity && e.leaf0_equals_action_cert0 && e.registration_accepted && e.action_accepted) };
console.log(JSON.stringify(out, null, 1)); process.exit(0);

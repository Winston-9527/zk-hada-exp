// Witness generation for the registration proof (#17), using real Semaphore v4 identities and groups (LeanIMT).
import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import { poseidon3, poseidon7 } from "poseidon-lite";
import crypto from "crypto";
export const TAG_REG = 2053858418n;          // ASCII "zkdr"
export const humanPrv = (i) => crypto.createHash("sha256").update("human-" + i).digest();   // 32 raw bytes, deterministic test keys
export const makeHuman = (i) => { const prv = humanPrv(i); return { prv, id: new Identity(prv) }; };
export const nfDomain = (s, domain) => poseidon3([TAG_REG, BigInt(s), BigInt(domain)]);
export const leaf0Of = (pk, master, cap0, expiry0) => poseidon7([0n, pk[0], pk[1], BigInt(master[0]), BigInt(master[1]), BigInt(cap0), BigInt(expiry0)]);
export function registerWitness({ human, group, domain, master, cap0, expiry0, MAX_DEPTH = 20 }) {
  const idx = group.indexOf(human.id.commitment); if (idx < 0) throw new Error("identity not in group");
  const p = group.generateMerkleProof(idx);
  const siblings = p.siblings.map(String); while (siblings.length < MAX_DEPTH) siblings.push("0");
  const s = human.id.secretScalar, pk = human.id.publicKey;
  return { group_root: p.root.toString(), domain: BigInt(domain).toString(), nf_domain: nfDomain(s, domain).toString(),
    leaf0: leaf0Of(pk, master, cap0, expiry0).toString(), human_sk: s.toString(), master_Ax: BigInt(master[0]).toString(), master_Ay: BigInt(master[1]).toString(),
    cap0: BigInt(cap0).toString(), expiry0: BigInt(expiry0).toString(), depth: String(p.siblings.length), index: String(p.index), siblings };
}
export { Identity, Group };

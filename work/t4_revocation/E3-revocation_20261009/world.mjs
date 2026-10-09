// E3 world: several delegation chains that share prefixes, with ONE issued tree, ONE revocation IMT and ONE registered-root tree.
// Each holder's v7 (mode C) witness comes from the v7 generator (keys fixed through entPrv, so shared edges give identical certificates and signatures),
// then its tree witnesses are replaced by paths in the shared trees.
import crypto from "crypto";
const v7 = new URL("../../t2_circuit_fix/zkdac_v7/", import.meta.url).pathname;
const L7 = await import(v7 + "scripts/lib_v7.mjs");
const { satisfiable } = await import(v7 + "scripts/witness_v7.mjs");
export const { buildInstanceV7, refreshAll, IMT, newRootTree, rootProof, keyHash, init, trunc } = L7;
export { satisfiable };
export const MD = 16;
export const prvOf = (name) => crypto.createHash("sha256").update(`e3-node-${name}`).digest();
const { eddsa, poseidon } = await init(); const P = (xs) => eddsa.F.toObject(poseidon(xs.map(BigInt)));
export { P };

// index-addressed sparse Poseidon Merkle tree (same hashing as the circuit's MerkleMember: bit 0 => H(cur, sib), bit 1 => H(sib, cur))
export class SparseTree {
  constructor(depth) { this.depth = depth; this.zero = [0n]; for (let l = 0; l < depth; l++) this.zero.push(P([this.zero[l], this.zero[l]])); this.levels = Array.from({ length: depth + 1 }, () => new Map()); this.n = 0; this.index = new Map(); }
  set(i, leaf) { let idx = BigInt(i); this.levels[0].set(idx, BigInt(leaf));
    for (let l = 0; l < this.depth; l++) { const a = this.levels[l].get(idx & ~1n) ?? this.zero[l], b = this.levels[l].get(idx | 1n) ?? this.zero[l]; idx >>= 1n; this.levels[l + 1].set(idx, P([a, b])); } }
  append(leaf) { const k = String(leaf); if (this.index.has(k)) return this.index.get(k); const i = this.n++; this.set(i, leaf); this.index.set(k, i); return i; }
  get root() { return this.levels[this.depth].get(0n) ?? this.zero[this.depth]; }
  path(i) { let idx = BigInt(i); const sib = [], bit = []; for (let l = 0; l < this.depth; l++) { sib.push(String(this.levels[l].get(idx ^ 1n) ?? this.zero[l])); bit.push(String(Number(idx & 1n))); idx >>= 1n; } return { sib, bit }; }
}

// chain = array of node names [root human, master, ...]; D = chain.length - 1
export async function holderInstance(chain, seed) {
  const D = chain.length - 1;
  const { input, meta } = await buildInstanceV7({ D, seed, mode: "C", entPrv: chain.map(prvOf), rootOthers: 0, accSeed: `e3-${chain.join("/")}` });
  return { chain, D, input, meta };
}
export class World {
  static async create(nDecoys = 20) { const w = new World(); w.imt = await IMT.create(20); w.issued = new SparseTree(MD); w.roots = newRootTree(); w.holders = [];
    for (let k = 0; k < nDecoys; k++) w.imt.insert(BigInt("0x" + crypto.createHash("sha256").update(`e3-decoy-${k}`).digest("hex")) % (1n << 250n));
    return w; }
  async add(chain, seed) {
    const h = await holderInstance(chain, seed ?? 100 + this.holders.length);
    for (let i = 1; i < h.D; i++) this.issued.append(h.meta.cert[i]);
    const c0 = BigInt(h.meta.cert[0]); if (this.roots.indexOf(c0) < 0) this.roots.insert(c0);
    this.holders.push(h); return h;
  }
  // (re)build every tree witness of h against the CURRENT shared trees; returns null if no non-membership witness exists (revoked entry)
  witness(h) {
    const input = structuredClone(h.input);
    input.issued_root = String(this.issued.root);
    for (let i = 1; i < h.D; i++) { const p = this.issued.path(this.issued.index.get(String(h.meta.cert[i]))); input.m_sib[i] = p.sib; input.m_bit[i] = p.bit; }
    Object.assign(input, rootProof(this.roots, h.meta.cert[0]));
    try { refreshAll(input, { ...h.meta, imt: this.imt }); } catch (e) { if (/is a member/.test(String(e))) return null; throw e; }
    return input;
  }
  certOf(chain, hop) { return this.holders.find((h) => h.chain.length > hop + 1 && h.chain.slice(0, hop + 2).join() === chain.slice(0, hop + 2).join()).meta.cert[hop]; }
  keyEntry(name) { const h = this.holders.find((x) => x.chain.includes(name)); const j = h.chain.indexOf(name); return keyHash(h.meta, { Ax: h.input.ent_Ax[j], Ay: h.input.ent_Ay[j] }); }
}

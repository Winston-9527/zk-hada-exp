pragma circom 2.1.6;
// ZK-DAC master-agent registration proof (issue #17): carries R1 (one master per human per domain) and R2 (master legitimacy),
// so that action proofs (v4) never expose the per-domain nullifier.
// Statement: I know the secret scalar s of a Semaphore v4 identity in the group with root `group_root`, and
//   nf_domain = Poseidon(TAG_REG, s, domain)                                   (R1)
//   leaf0     = Poseidon(0, A_x, A_y, master_x, master_y, cap0, expiry0)       (R2; identical to v4's hop-0 certificate hash)
// where A = s * Base8 is the identity's public key, i.e. the human key is ent[0] of the v4 chain ("key merged" decision in #17).
// The EdDSA signature on cert0 is not checked here: knowing s already authorises it, and every v4 action proof checks it anyway.
include "poseidon.circom";
include "babyjub.circom";
include "bitify.circom";
include "comparators.circom";
include "binary-merkle-root.circom";            // @zk-kit/binary-merkle-root.circom 2.0.0, the membership check used by Semaphore v4

template ZkDacRegister(MAX_DEPTH) {
    // ---- public ----
    signal input group_root;
    signal input domain;
    signal input nf_domain;
    signal input leaf0;
    // ---- private ----
    signal input human_sk;
    signal input master_Ax; signal input master_Ay;
    signal input cap0; signal input expiry0;
    signal input depth; signal input index; signal input siblings[MAX_DEPTH];

    // canonical secret scalar (s < subgroup order l), so one identity has exactly one nullifier per domain
    component skBits = Num2Bits(251); skBits.in <== human_sk;
    component skLt = LessThan(251);
    skLt.in[0] <== human_sk;
    skLt.in[1] <== 2736030358979909402780800718157159386076813972158567259200215660948447373041;
    skLt.out === 1;

    component pk = BabyPbk(); pk.in <== human_sk;
    component idc = Poseidon(2);                    // Semaphore v4 identity commitment
    idc.inputs[0] <== pk.Ax; idc.inputs[1] <== pk.Ay;

    // BinaryMerkleRoot returns 0 for depth > MAX_DEPTH (and an empty LeanIMT also has root 0): bound depth here, not in the contract
    component dBits = Num2Bits(8); dBits.in <== depth;
    component dLe = LessEqThan(8); dLe.in[0] <== depth; dLe.in[1] <== MAX_DEPTH; dLe.out === 1;
    component mr = BinaryMerkleRoot(MAX_DEPTH);
    mr.leaf <== idc.out; mr.depth <== depth; mr.index <== index;
    for (var i = 0; i < MAX_DEPTH; i++) { mr.siblings[i] <== siblings[i]; }
    group_root === mr.out;

    component nf = Poseidon(3);                     // TAG_REG = ASCII "zkdr"; differs from Semaphore's Poseidon(scope, s) and from v4's action tag
    nf.inputs[0] <== 2053858418; nf.inputs[1] <== human_sk; nf.inputs[2] <== domain;
    nf_domain === nf.out;

    component capBits = Num2Bits(32); capBits.in <== cap0;      // same ranges as the v4 action circuit
    component expBits = Num2Bits(64); expBits.in <== expiry0;
    component c0 = Poseidon(7);
    c0.inputs[0] <== 0;
    c0.inputs[1] <== pk.Ax; c0.inputs[2] <== pk.Ay;
    c0.inputs[3] <== master_Ax; c0.inputs[4] <== master_Ay;
    c0.inputs[5] <== cap0; c0.inputs[6] <== expiry0;
    leaf0 === c0.out;
}

pragma circom 2.0.0;
include "./circomlib_shared/eddsaposeidon.circom";
include "./circomlib_shared/bitify.circom";
include "./circomlib_shared/poseidon.circom";


template Merkle2Verify() {{
    signal input leaf;
    signal input sib0; signal input sib1;
    signal input path0; signal input path1;
    signal input expected_root;
    signal input merkle_enabled;
    path0 * (path0 - 1) === 0;
    path1 * (path1 - 1) === 0;
    signal left0; signal right0;
    left0 <== leaf + path0 * (sib0 - leaf);
    right0 <== sib0 + path0 * (leaf - sib0);
    component h0 = Poseidon(2);
    h0.inputs[0] <== left0; h0.inputs[1] <== right0;
    signal left1; signal right1;
    left1 <== h0.out + path1 * (sib1 - h0.out);
    right1 <== sib1 + path1 * (h0.out - sib1);
    component h1 = Poseidon(2);
    h1.inputs[0] <== left1; h1.inputs[1] <== right1;
    merkle_enabled * (expected_root - h1.out) === 0;
}}


template RevokedVerify() {{
    signal input revocation_id;
    signal input sib0; signal input sib1;
    signal input path0; signal input path1;
    signal input revoked_root;
    signal input rev_enabled;
    path0 * (path0 - 1) === 0;
    path1 * (path1 - 1) === 0;
    component leaf_hash = Poseidon(2);
    leaf_hash.inputs[0] <== revocation_id;
    leaf_hash.inputs[1] <== 0;
    signal left0; signal right0;
    left0 <== leaf_hash.out + path0 * (sib0 - leaf_hash.out);
    right0 <== sib0 + path0 * (leaf_hash.out - sib0);
    component h0 = Poseidon(2);
    h0.inputs[0] <== left0; h0.inputs[1] <== right0;
    signal left1; signal right1;
    left1 <== h0.out + path1 * (sib1 - h0.out);
    right1 <== sib1 + path1 * (h0.out - sib1);
    component h1 = Poseidon(2);
    h1.inputs[0] <== left1; h1.inputs[1] <== right1;
    rev_enabled * (revoked_root - h1.out) === 0;
}}


template Attenuation() {{
    signal input cap_parent;
    signal input cap_child;
    component parent_bits = Num2Bits(32);
    component child_bits = Num2Bits(32);
    parent_bits.in <== cap_parent;
    child_bits.in <== cap_child;
    for (var i = 0; i < 32; i++) {{
        child_bits.out[i] * (1 - parent_bits.out[i]) === 0;
    }}
}}


template Dmax4DelegationChain() {
    signal input signer0_Ax;
    signal input signer0_Ay;
    signal input sig0_S;
    signal input sig0_R8x;
    signal input sig0_R8y;
    signal input child0_Ax;
    signal input child0_Ay;
    signal input cert0_cap;
    signal input cert0_expiry;
    signal input issued_sib0_0;
    signal input issued_sib0_1;
    signal input issued_path0_0;
    signal input issued_path0_1;
    signal input revoked_sib0_0;
    signal input revoked_sib0_1;
    signal input revoked_path0_0;
    signal input revoked_path0_1;
    signal input signer1_Ax;
    signal input signer1_Ay;
    signal input sig1_S;
    signal input sig1_R8x;
    signal input sig1_R8y;
    signal input child1_Ax;
    signal input child1_Ay;
    signal input cert1_cap;
    signal input cert1_expiry;
    signal input issued_sib1_0;
    signal input issued_sib1_1;
    signal input issued_path1_0;
    signal input issued_path1_1;
    signal input revoked_sib1_0;
    signal input revoked_sib1_1;
    signal input revoked_path1_0;
    signal input revoked_path1_1;
    signal input signer2_Ax;
    signal input signer2_Ay;
    signal input sig2_S;
    signal input sig2_R8x;
    signal input sig2_R8y;
    signal input child2_Ax;
    signal input child2_Ay;
    signal input cert2_cap;
    signal input cert2_expiry;
    signal input issued_sib2_0;
    signal input issued_sib2_1;
    signal input issued_path2_0;
    signal input issued_path2_1;
    signal input revoked_sib2_0;
    signal input revoked_sib2_1;
    signal input revoked_path2_0;
    signal input revoked_path2_1;
    signal input signer3_Ax;
    signal input signer3_Ay;
    signal input sig3_S;
    signal input sig3_R8x;
    signal input sig3_R8y;
    signal input child3_Ax;
    signal input child3_Ay;
    signal input cert3_cap;
    signal input cert3_expiry;
    signal input issued_sib3_0;
    signal input issued_sib3_1;
    signal input issued_path3_0;
    signal input issued_path3_1;
    signal input revoked_sib3_0;
    signal input revoked_sib3_1;
    signal input revoked_path3_0;
    signal input revoked_path3_1;
    signal input nullifier_secret;
    signal input eddsa_enabled_0;
    signal input eddsa_enabled_1;
    signal input eddsa_enabled_2;
    signal input eddsa_enabled_3;
    signal input merkle_enabled_0;
    signal input merkle_enabled_1;
    signal input merkle_enabled_2;
    signal input merkle_enabled_3;
    signal input rev_enabled_0;
    signal input rev_enabled_1;
    signal input rev_enabled_2;
    signal input rev_enabled_3;

    signal input issued_root;
    signal input revoked_root;
    signal input expected_nullifier;
    signal input action_hash;

    signal cert0_hash;
    signal cert1_hash;
    signal cert2_hash;
    signal cert3_hash;

    signal issued_h0_0;
    signal issued_h0_1;
    signal issued_h1_0;
    signal issued_h1_1;
    signal issued_h2_0;
    signal issued_h2_1;
    signal issued_h3_0;
    signal issued_h3_1;
    signal revoked_h0_0;
    signal revoked_h0_1;
    signal revoked_h1_0;
    signal revoked_h1_1;
    signal revoked_h2_0;
    signal revoked_h2_1;
    signal revoked_h3_0;
    signal revoked_h3_1;

    signer1_Ax === child0_Ax;
    signer1_Ay === child0_Ay;
    signer2_Ax === child1_Ax;
    signer2_Ay === child1_Ay;
    signer3_Ax === child2_Ax;
    signer3_Ay === child2_Ay;

    component cert_hash_0 = Poseidon(4);
    cert_hash_0.inputs[0] <== child0_Ax;
    cert_hash_0.inputs[1] <== child0_Ay;
    cert_hash_0.inputs[2] <== cert0_cap;
    cert_hash_0.inputs[3] <== cert0_expiry;
    cert0_hash <== cert_hash_0.out;

    component cert_hash_1 = Poseidon(4);
    cert_hash_1.inputs[0] <== child1_Ax;
    cert_hash_1.inputs[1] <== child1_Ay;
    cert_hash_1.inputs[2] <== cert1_cap;
    cert_hash_1.inputs[3] <== cert1_expiry;
    cert1_hash <== cert_hash_1.out;

    component cert_hash_2 = Poseidon(4);
    cert_hash_2.inputs[0] <== child2_Ax;
    cert_hash_2.inputs[1] <== child2_Ay;
    cert_hash_2.inputs[2] <== cert2_cap;
    cert_hash_2.inputs[3] <== cert2_expiry;
    cert2_hash <== cert_hash_2.out;

    component cert_hash_3 = Poseidon(4);
    cert_hash_3.inputs[0] <== child3_Ax;
    cert_hash_3.inputs[1] <== child3_Ay;
    cert_hash_3.inputs[2] <== cert3_cap;
    cert_hash_3.inputs[3] <== cert3_expiry;
    cert3_hash <== cert_hash_3.out;

    component eddsa_0 = EdDSAPoseidonVerifier();
    eddsa_0.enabled <== eddsa_enabled_0;
    eddsa_0.Ax <== signer0_Ax;
    eddsa_0.Ay <== signer0_Ay;
    eddsa_0.S <== sig0_S;
    eddsa_0.R8x <== sig0_R8x;
    eddsa_0.R8y <== sig0_R8y;
    eddsa_0.M <== cert0_hash;

    component eddsa_1 = EdDSAPoseidonVerifier();
    eddsa_1.enabled <== eddsa_enabled_1;
    eddsa_1.Ax <== signer1_Ax;
    eddsa_1.Ay <== signer1_Ay;
    eddsa_1.S <== sig1_S;
    eddsa_1.R8x <== sig1_R8x;
    eddsa_1.R8y <== sig1_R8y;
    eddsa_1.M <== cert1_hash;

    component eddsa_2 = EdDSAPoseidonVerifier();
    eddsa_2.enabled <== eddsa_enabled_2;
    eddsa_2.Ax <== signer2_Ax;
    eddsa_2.Ay <== signer2_Ay;
    eddsa_2.S <== sig2_S;
    eddsa_2.R8x <== sig2_R8x;
    eddsa_2.R8y <== sig2_R8y;
    eddsa_2.M <== cert2_hash;

    component eddsa_3 = EdDSAPoseidonVerifier();
    eddsa_3.enabled <== eddsa_enabled_3;
    eddsa_3.Ax <== signer3_Ax;
    eddsa_3.Ay <== signer3_Ay;
    eddsa_3.S <== sig3_S;
    eddsa_3.R8x <== sig3_R8x;
    eddsa_3.R8y <== sig3_R8y;
    eddsa_3.M <== cert3_hash;

    component issued_v0 = Merkle2Verify();
    issued_v0.leaf <== cert0_hash;
    issued_v0.sib0 <== issued_sib0_0;
    issued_v0.sib1 <== issued_sib0_1;
    issued_v0.path0 <== issued_path0_0;
    issued_v0.path1 <== issued_path0_1;
    issued_v0.merkle_enabled <== merkle_enabled_0;
    issued_v0.expected_root <== issued_root;

    component issued_v1 = Merkle2Verify();
    issued_v1.leaf <== cert1_hash;
    issued_v1.sib0 <== issued_sib1_0;
    issued_v1.sib1 <== issued_sib1_1;
    issued_v1.path0 <== issued_path1_0;
    issued_v1.path1 <== issued_path1_1;
    issued_v1.merkle_enabled <== merkle_enabled_1;
    issued_v1.expected_root <== issued_root;

    component issued_v2 = Merkle2Verify();
    issued_v2.leaf <== cert2_hash;
    issued_v2.sib0 <== issued_sib2_0;
    issued_v2.sib1 <== issued_sib2_1;
    issued_v2.path0 <== issued_path2_0;
    issued_v2.path1 <== issued_path2_1;
    issued_v2.merkle_enabled <== merkle_enabled_2;
    issued_v2.expected_root <== issued_root;

    component issued_v3 = Merkle2Verify();
    issued_v3.leaf <== cert3_hash;
    issued_v3.sib0 <== issued_sib3_0;
    issued_v3.sib1 <== issued_sib3_1;
    issued_v3.path0 <== issued_path3_0;
    issued_v3.path1 <== issued_path3_1;
    issued_v3.merkle_enabled <== merkle_enabled_3;
    issued_v3.expected_root <== issued_root;

    component revoked_v0 = RevokedVerify();
    revoked_v0.revocation_id <== cert0_hash;
    revoked_v0.sib0 <== revoked_sib0_0;
    revoked_v0.sib1 <== revoked_sib0_1;
    revoked_v0.path0 <== revoked_path0_0;
    revoked_v0.path1 <== revoked_path0_1;
    revoked_v0.rev_enabled <== rev_enabled_0;
    revoked_v0.revoked_root <== revoked_root;

    component revoked_v1 = RevokedVerify();
    revoked_v1.revocation_id <== cert1_hash;
    revoked_v1.sib0 <== revoked_sib1_0;
    revoked_v1.sib1 <== revoked_sib1_1;
    revoked_v1.path0 <== revoked_path1_0;
    revoked_v1.path1 <== revoked_path1_1;
    revoked_v1.rev_enabled <== rev_enabled_1;
    revoked_v1.revoked_root <== revoked_root;

    component revoked_v2 = RevokedVerify();
    revoked_v2.revocation_id <== cert2_hash;
    revoked_v2.sib0 <== revoked_sib2_0;
    revoked_v2.sib1 <== revoked_sib2_1;
    revoked_v2.path0 <== revoked_path2_0;
    revoked_v2.path1 <== revoked_path2_1;
    revoked_v2.rev_enabled <== rev_enabled_2;
    revoked_v2.revoked_root <== revoked_root;

    component revoked_v3 = RevokedVerify();
    revoked_v3.revocation_id <== cert3_hash;
    revoked_v3.sib0 <== revoked_sib3_0;
    revoked_v3.sib1 <== revoked_sib3_1;
    revoked_v3.path0 <== revoked_path3_0;
    revoked_v3.path1 <== revoked_path3_1;
    revoked_v3.rev_enabled <== rev_enabled_3;
    revoked_v3.revoked_root <== revoked_root;

    component atten0 = Attenuation();
    atten0.cap_parent <== cert0_cap;
    atten0.cap_child <== cert1_cap;

    component atten1 = Attenuation();
    atten1.cap_parent <== cert1_cap;
    atten1.cap_child <== cert2_cap;

    component atten2 = Attenuation();
    atten2.cap_parent <== cert2_cap;
    atten2.cap_child <== cert3_cap;

    component nullifier_h = Poseidon(2);
    nullifier_h.inputs[0] <== nullifier_secret;
    nullifier_h.inputs[1] <== 18333019769;
    expected_nullifier === nullifier_h.out;

    // Action subset check: every bit set in action_hash must be set in cert3_cap
    component action_check = Num2Bits(32);
    action_check.in <== cert3_cap;
    component action_bits_dec = Num2Bits(32);
    action_bits_dec.in <== action_hash;
    signal action_sum0;
    action_sum0 <== action_bits_dec.out[0] * (1 - action_check.out[0]);
    signal action_sum1;
    action_sum1 <== action_sum0 + action_bits_dec.out[1] * (1 - action_check.out[1]);
    signal action_sum2;
    action_sum2 <== action_sum1 + action_bits_dec.out[2] * (1 - action_check.out[2]);
    signal action_sum3;
    action_sum3 <== action_sum2 + action_bits_dec.out[3] * (1 - action_check.out[3]);
    signal action_sum4;
    action_sum4 <== action_sum3 + action_bits_dec.out[4] * (1 - action_check.out[4]);
    signal action_sum5;
    action_sum5 <== action_sum4 + action_bits_dec.out[5] * (1 - action_check.out[5]);
    signal action_sum6;
    action_sum6 <== action_sum5 + action_bits_dec.out[6] * (1 - action_check.out[6]);
    signal action_sum7;
    action_sum7 <== action_sum6 + action_bits_dec.out[7] * (1 - action_check.out[7]);
    signal action_sum8;
    action_sum8 <== action_sum7 + action_bits_dec.out[8] * (1 - action_check.out[8]);
    signal action_sum9;
    action_sum9 <== action_sum8 + action_bits_dec.out[9] * (1 - action_check.out[9]);
    signal action_sum10;
    action_sum10 <== action_sum9 + action_bits_dec.out[10] * (1 - action_check.out[10]);
    signal action_sum11;
    action_sum11 <== action_sum10 + action_bits_dec.out[11] * (1 - action_check.out[11]);
    signal action_sum12;
    action_sum12 <== action_sum11 + action_bits_dec.out[12] * (1 - action_check.out[12]);
    signal action_sum13;
    action_sum13 <== action_sum12 + action_bits_dec.out[13] * (1 - action_check.out[13]);
    signal action_sum14;
    action_sum14 <== action_sum13 + action_bits_dec.out[14] * (1 - action_check.out[14]);
    signal action_sum15;
    action_sum15 <== action_sum14 + action_bits_dec.out[15] * (1 - action_check.out[15]);
    signal action_sum16;
    action_sum16 <== action_sum15 + action_bits_dec.out[16] * (1 - action_check.out[16]);
    signal action_sum17;
    action_sum17 <== action_sum16 + action_bits_dec.out[17] * (1 - action_check.out[17]);
    signal action_sum18;
    action_sum18 <== action_sum17 + action_bits_dec.out[18] * (1 - action_check.out[18]);
    signal action_sum19;
    action_sum19 <== action_sum18 + action_bits_dec.out[19] * (1 - action_check.out[19]);
    signal action_sum20;
    action_sum20 <== action_sum19 + action_bits_dec.out[20] * (1 - action_check.out[20]);
    signal action_sum21;
    action_sum21 <== action_sum20 + action_bits_dec.out[21] * (1 - action_check.out[21]);
    signal action_sum22;
    action_sum22 <== action_sum21 + action_bits_dec.out[22] * (1 - action_check.out[22]);
    signal action_sum23;
    action_sum23 <== action_sum22 + action_bits_dec.out[23] * (1 - action_check.out[23]);
    signal action_sum24;
    action_sum24 <== action_sum23 + action_bits_dec.out[24] * (1 - action_check.out[24]);
    signal action_sum25;
    action_sum25 <== action_sum24 + action_bits_dec.out[25] * (1 - action_check.out[25]);
    signal action_sum26;
    action_sum26 <== action_sum25 + action_bits_dec.out[26] * (1 - action_check.out[26]);
    signal action_sum27;
    action_sum27 <== action_sum26 + action_bits_dec.out[27] * (1 - action_check.out[27]);
    signal action_sum28;
    action_sum28 <== action_sum27 + action_bits_dec.out[28] * (1 - action_check.out[28]);
    signal action_sum29;
    action_sum29 <== action_sum28 + action_bits_dec.out[29] * (1 - action_check.out[29]);
    signal action_sum30;
    action_sum30 <== action_sum29 + action_bits_dec.out[30] * (1 - action_check.out[30]);
    signal action_sum31;
    action_sum31 <== action_sum30 + action_bits_dec.out[31] * (1 - action_check.out[31]);
    action_sum31 === 0;

    signal accepted;
    accepted <== 1;
}

component main {public [issued_root, revoked_root, expected_nullifier, action_hash]} = Dmax4DelegationChain();

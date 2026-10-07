#!/usr/bin/env python3
"""Generate circuits/RQ108/dmax4_delegation_chain.circom from this script."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "circuits" / "RQ108" / "dmax4_delegation_chain.circom"
EDDSA_INCLUDE = str(ROOT / "runs" / "RQ104" / "artifacts" / "external_sources" / "circomlib-2.0.5" / "package" / "circuits" / "eddsaposeidon.circom")

BITIFY_INCLUDE = str(ROOT / "runs" / "RQ104" / "artifacts" / "external_sources" / "circomlib-2.0.5" / "package" / "circuits" / "bitify.circom")
POSEIDON_INCLUDE = str(ROOT / "runs" / "RQ104" / "artifacts" / "external_sources" / "circomlib-2.0.5" / "package" / "circuits" / "poseidon.circom")

# ---------------------------------------------------------------------------
# Shared templates (depth-2 Merkle membership + revoked non-membership)
# ---------------------------------------------------------------------------
MEMBERSHIP_TMPL = r'''
template Merkle2Verify() {{
    signal input leaf;
    signal input sib0; signal input sib1;
    signal input path0; signal input path1;
    signal input expected_root;
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
    expected_root === h1.out;
}}
'''

REVOKED_TMPL = r'''
template RevokedVerify() {{
    signal input revocation_id;
    signal input sib0; signal input sib1;
    signal input path0; signal input path1;
    signal input revoked_root;
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
    revoked_root === h1.out;
}}
'''

ATTENUATION_TMPL = r'''
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
'''

# ---------------------------------------------------------------------------
# Main Dmax4 template – explicit signal declarations (no loops)
# ---------------------------------------------------------------------------
lines: list[str] = []
a = lines.append

a('pragma circom 2.0.0;')
a(f'include "{EDDSA_INCLUDE}";')
a(f'include "{BITIFY_INCLUDE}";')
a(f'include "{POSEIDON_INCLUDE}";')
a('')

BITIFY_INCLUDE = str(ROOT / "runs" / "RQ104" / "artifacts" / "external_sources" / "circomlib-2.0.5" / "package" / "circuits" / "bitify.circom")
POSEIDON_INCLUDE = str(ROOT / "runs" / "RQ104" / "artifacts" / "external_sources" / "circomlib-2.0.5" / "package" / "circuits" / "poseidon.circom")
a(MEMBERSHIP_TMPL)
a(REVOKED_TMPL)
a(ATTENUATION_TMPL)
a('')
a('template Dmax4DelegationChain() {')

# ── Private inputs ─────────────────────────────────────────────────────────
for i in range(4):
    a(f'    signal input signer{i}_Ax;')
    a(f'    signal input signer{i}_Ay;')
    a(f'    signal input sig{i}_S;')
    a(f'    signal input sig{i}_R8x;')
    a(f'    signal input sig{i}_R8y;')
    a(f'    signal input child{i}_Ax;')
    a(f'    signal input child{i}_Ay;')
    a(f'    signal input cert{i}_cap;')
    a(f'    signal input cert{i}_expiry;')
    a(f'    signal input issued_sib{i}_0;')
    a(f'    signal input issued_sib{i}_1;')
    a(f'    signal input issued_path{i}_0;')
    a(f'    signal input issued_path{i}_1;')
    a(f'    signal input revoked_sib{i}_0;')
    a(f'    signal input revoked_sib{i}_1;')
    a(f'    signal input revoked_path{i}_0;')
    a(f'    signal input revoked_path{i}_1;')

a('    signal input nullifier_secret;')
a('')

# ── Public inputs ──────────────────────────────────────────────────────────
a('    signal input issued_root;')
a('    signal input revoked_root;')
a('    signal input expected_nullifier;')
a('    signal input action_hash;')
a('')

# ── Intermediates: cert hashes ─────────────────────────────────────────────
for i in range(4):
    a(f'    signal cert{i}_hash;')
a('')

# ── Intermediates: Merkle hashes ───────────────────────────────────────────
for i in range(4):
    a(f'    signal issued_h{i}_0;')
    a(f'    signal issued_h{i}_1;')
for i in range(4):
    a(f'    signal revoked_h{i}_0;')
    a(f'    signal revoked_h{i}_1;')
a('')

# ── Chain binding ──────────────────────────────────────────────────────────
for i in range(3):
    a(f'    signer{i+1}_Ax === child{i}_Ax;')
    a(f'    signer{i+1}_Ay === child{i}_Ay;')
a('')

# ── Cert hashes ────────────────────────────────────────────────────────────
for i in range(4):
    a(f'    component cert_hash_{i} = Poseidon(4);')
    a(f'    cert_hash_{i}.inputs[0] <== child{i}_Ax;')
    a(f'    cert_hash_{i}.inputs[1] <== child{i}_Ay;')
    a(f'    cert_hash_{i}.inputs[2] <== cert{i}_cap;')
    a(f'    cert_hash_{i}.inputs[3] <== cert{i}_expiry;')
    a(f'    cert{i}_hash <== cert_hash_{i}.out;')
    a('')

# ── 4 × EdDSAPoseidonVerifier ──────────────────────────────────────────────
for i in range(4):
    a(f'    component eddsa_{i} = EdDSAPoseidonVerifier();')
    a(f'    eddsa_{i}.enabled <== 1;')
    a(f'    eddsa_{i}.Ax <== signer{i}_Ax;')
    a(f'    eddsa_{i}.Ay <== signer{i}_Ay;')
    a(f'    eddsa_{i}.S <== sig{i}_S;')
    a(f'    eddsa_{i}.R8x <== sig{i}_R8x;')
    a(f'    eddsa_{i}.R8y <== sig{i}_R8y;')
    a(f'    eddsa_{i}.M <== cert{i}_hash;')
    a('')

# ── 4 × Issued membership ──────────────────────────────────────────────────
for i in range(4):
    a(f'    component issued_v{i} = Merkle2Verify();')
    a(f'    issued_v{i}.leaf <== cert{i}_hash;')
    a(f'    issued_v{i}.sib0 <== issued_sib{i}_0;')
    a(f'    issued_v{i}.sib1 <== issued_sib{i}_1;')
    a(f'    issued_v{i}.path0 <== issued_path{i}_0;')
    a(f'    issued_v{i}.path1 <== issued_path{i}_1;')
    a(f'    issued_v{i}.expected_root <== issued_root;')
    a('')

# ── Revoked non-membership ─────────────────────────────────────────────────
for i in range(4):
    a(f'    component revoked_v{i} = RevokedVerify();')
    a(f'    revoked_v{i}.revocation_id <== cert{i}_hash;')
    a(f'    revoked_v{i}.sib0 <== revoked_sib{i}_0;')
    a(f'    revoked_v{i}.sib1 <== revoked_sib{i}_1;')
    a(f'    revoked_v{i}.path0 <== revoked_path{i}_0;')
    a(f'    revoked_v{i}.path1 <== revoked_path{i}_1;')
    a(f'    revoked_v{i}.revoked_root <== revoked_root;')
    a('')

# ── Capability attenuation (hop 0→1, 1→2, 2→3) ───────────────────────────
for i in range(3):
    a(f'    component atten{i} = Attenuation();')
    a(f'    atten{i}.cap_parent <== cert{i}_cap;')
    a(f'    atten{i}.cap_child <== cert{i+1}_cap;')
    a('')

# ── Nullifier + action check ───────────────────────────────────────────────
a('    component nullifier_h = Poseidon(2);')
a('    nullifier_h.inputs[0] <== nullifier_secret;')
a('    nullifier_h.inputs[1] <== 18333019769;')  # domain separator
a('    expected_nullifier === nullifier_h.out;')
a('')
a('    // Action subset check: every bit set in action_hash must be set in cert3_cap')
a('    component action_check = Num2Bits(32);')
a('    action_check.in <== cert3_cap;')
a('    component action_bits_dec = Num2Bits(32);')
a('    action_bits_dec.in <== action_hash;')
a('    signal action_sum0;')
a('    action_sum0 <== action_bits_dec.out[0] * (1 - action_check.out[0]);')
a('    signal action_sum1;')
a('    action_sum1 <== action_sum0 + action_bits_dec.out[1] * (1 - action_check.out[1]);')
a('    signal action_sum2;')
a('    action_sum2 <== action_sum1 + action_bits_dec.out[2] * (1 - action_check.out[2]);')
a('    signal action_sum3;')
a('    action_sum3 <== action_sum2 + action_bits_dec.out[3] * (1 - action_check.out[3]);')
a('    signal action_sum4;')
a('    action_sum4 <== action_sum3 + action_bits_dec.out[4] * (1 - action_check.out[4]);')
a('    signal action_sum5;')
a('    action_sum5 <== action_sum4 + action_bits_dec.out[5] * (1 - action_check.out[5]);')
a('    signal action_sum6;')
a('    action_sum6 <== action_sum5 + action_bits_dec.out[6] * (1 - action_check.out[6]);')
a('    signal action_sum7;')
a('    action_sum7 <== action_sum6 + action_bits_dec.out[7] * (1 - action_check.out[7]);')
a('    signal action_sum8;')
a('    action_sum8 <== action_sum7 + action_bits_dec.out[8] * (1 - action_check.out[8]);')
a('    signal action_sum9;')
a('    action_sum9 <== action_sum8 + action_bits_dec.out[9] * (1 - action_check.out[9]);')
a('    signal action_sum10;')
a('    action_sum10 <== action_sum9 + action_bits_dec.out[10] * (1 - action_check.out[10]);')
a('    signal action_sum11;')
a('    action_sum11 <== action_sum10 + action_bits_dec.out[11] * (1 - action_check.out[11]);')
a('    signal action_sum12;')
a('    action_sum12 <== action_sum11 + action_bits_dec.out[12] * (1 - action_check.out[12]);')
a('    signal action_sum13;')
a('    action_sum13 <== action_sum12 + action_bits_dec.out[13] * (1 - action_check.out[13]);')
a('    signal action_sum14;')
a('    action_sum14 <== action_sum13 + action_bits_dec.out[14] * (1 - action_check.out[14]);')
a('    signal action_sum15;')
a('    action_sum15 <== action_sum14 + action_bits_dec.out[15] * (1 - action_check.out[15]);')
a('    signal action_sum16;')
a('    action_sum16 <== action_sum15 + action_bits_dec.out[16] * (1 - action_check.out[16]);')
a('    signal action_sum17;')
a('    action_sum17 <== action_sum16 + action_bits_dec.out[17] * (1 - action_check.out[17]);')
a('    signal action_sum18;')
a('    action_sum18 <== action_sum17 + action_bits_dec.out[18] * (1 - action_check.out[18]);')
a('    signal action_sum19;')
a('    action_sum19 <== action_sum18 + action_bits_dec.out[19] * (1 - action_check.out[19]);')
a('    signal action_sum20;')
a('    action_sum20 <== action_sum19 + action_bits_dec.out[20] * (1 - action_check.out[20]);')
a('    signal action_sum21;')
a('    action_sum21 <== action_sum20 + action_bits_dec.out[21] * (1 - action_check.out[21]);')
a('    signal action_sum22;')
a('    action_sum22 <== action_sum21 + action_bits_dec.out[22] * (1 - action_check.out[22]);')
a('    signal action_sum23;')
a('    action_sum23 <== action_sum22 + action_bits_dec.out[23] * (1 - action_check.out[23]);')
a('    signal action_sum24;')
a('    action_sum24 <== action_sum23 + action_bits_dec.out[24] * (1 - action_check.out[24]);')
a('    signal action_sum25;')
a('    action_sum25 <== action_sum24 + action_bits_dec.out[25] * (1 - action_check.out[25]);')
a('    signal action_sum26;')
a('    action_sum26 <== action_sum25 + action_bits_dec.out[26] * (1 - action_check.out[26]);')
a('    signal action_sum27;')
a('    action_sum27 <== action_sum26 + action_bits_dec.out[27] * (1 - action_check.out[27]);')
a('    signal action_sum28;')
a('    action_sum28 <== action_sum27 + action_bits_dec.out[28] * (1 - action_check.out[28]);')
a('    signal action_sum29;')
a('    action_sum29 <== action_sum28 + action_bits_dec.out[29] * (1 - action_check.out[29]);')
a('    signal action_sum30;')
a('    action_sum30 <== action_sum29 + action_bits_dec.out[30] * (1 - action_check.out[30]);')
a('    signal action_sum31;')
a('    action_sum31 <== action_sum30 + action_bits_dec.out[31] * (1 - action_check.out[31]);')
a('    action_sum31 === 0;')
a('')
a('    signal accepted;')
a('    accepted <== 1;')
a('}')
a('')
a('component main {public [issued_root, revoked_root, expected_nullifier, action_hash]} = Dmax4DelegationChain();')

def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'Wrote {OUTPUT}  ({len(lines)} lines)')


if __name__ == '__main__':
    main()

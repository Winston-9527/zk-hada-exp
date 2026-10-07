pragma circom 2.1.6;
// Baseline for issue #24: exactly the revocation check v3 uses per hop (circomlib SMTVerifier, fnc = 1 exclusion).
include "circomlib/circuits/smt/smtverifier.circom";
template SMTNonMember(RD) {
    signal input key; signal input root;
    signal input siblings[RD]; signal input oldKey; signal input oldValue; signal input isOld0;
    component v = SMTVerifier(RD);
    v.enabled <== 1; v.fnc <== 1; v.root <== root; v.key <== key; v.value <== 0;
    for (var i = 0; i < RD; i++) { v.siblings[i] <== siblings[i]; }
    v.oldKey <== oldKey; v.oldValue <== oldValue; v.isOld0 <== isOld0;
}

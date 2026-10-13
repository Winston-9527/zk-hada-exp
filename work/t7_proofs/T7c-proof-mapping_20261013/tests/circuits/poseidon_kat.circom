pragma circom 2.1.6;
// X2b harness: circomlib Poseidon at the arities used by v9.1 (2, 3, 7, 8).
include "circomlib/circuits/poseidon.circom";
template KAT() {
    signal input a2[2]; signal input a3[3]; signal input a7[7]; signal input a8[8];
    signal output o2; signal output o3; signal output o7; signal output o8;
    component h2 = Poseidon(2); component h3 = Poseidon(3); component h7 = Poseidon(7); component h8 = Poseidon(8);
    for (var i = 0; i < 2; i++) h2.inputs[i] <== a2[i];
    for (var i = 0; i < 3; i++) h3.inputs[i] <== a3[i];
    for (var i = 0; i < 7; i++) h7.inputs[i] <== a7[i];
    for (var i = 0; i < 8; i++) h8.inputs[i] <== a8[i];
    o2 <== h2.out; o3 <== h3.out; o7 <== h7.out; o8 <== h8.out;
}
component main = KAT();

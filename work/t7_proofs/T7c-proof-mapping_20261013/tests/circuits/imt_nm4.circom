pragma circom 2.1.6;
// X1a harness: the production IMTNonMember template (zkdac_v7/circuits/imt.circom) instantiated at depth 4 for exhaustive tests.
include "imt.circom";
component main {public [root]} = IMTNonMember(4);

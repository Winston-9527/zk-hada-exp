pragma circom 2.1.6;
include "zkdac_chain_A.circom";
component main {public [issued_root, revoked_root, action_digest, nullifier]} = ZkDacChainA(2, 16, 16);

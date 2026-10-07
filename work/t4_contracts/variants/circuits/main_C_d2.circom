pragma circom 2.1.6;
include "zkdac_chain_C.circom";
component main {public [issued_root, revoked_root, nullifier, now, ctx_hash, act_req_cap]} = ZkDacChainC(2, 16, 16);

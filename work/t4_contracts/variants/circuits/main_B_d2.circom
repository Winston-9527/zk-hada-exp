pragma circom 2.1.6;
include "zkdac_chain_B.circom";
component main {public [issued_root, revoked_root, nullifier, now, act_chain_id, act_verifier, act_method, act_params_hash, act_amount, act_req_cap, act_nonce]} = ZkDacChainB(2, 16, 16);

pragma circom 2.1.6;
include "zkdac_chain_v9_noacc.circom";
component main {public [state_root, now, ctx_hash, act_req_cap, note_root, budget_nf, cm_change, q_spent]} = ZkDacChainV9NoAcc(3, 16, 20, 20, 20);

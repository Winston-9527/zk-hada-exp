# Hermez / Polygon Powers of Tau, 2^18 (issue #28)
File `powersOfTau28_hez_final_18.ptau` (302,072,984 bytes; not committed, `*.ptau` is ignored): prepared phase-2 ptau from the Hermez ceremony
(Perpetual Powers of Tau: 54 contributions, then a random beacon), the file the snarkjs README lists for 2^18.
- Source: https://circom.info/powersOfTau28_hez_final_18.ptau — the link in the snarkjs README (iden3/snarkjs master, "Prepared (phase2) Ptau files").
  The older mirrors (hermez.s3-eu-west-1.amazonaws.com, storage.googleapis.com/zkevm/ptau) return 403 as of 2026-10-08.
- Downloaded 2026-10-08 09:30–09:31 UTC (download_started.txt).
- blake2b-512 = 7e6a9c2e…94b95b13e, **equal** to the value published in the snarkjs README (EXPECTED_BLAKE2B.txt).
- sha256 = e970efa7774da80101e0ac336d083ef3339855c98112539338d706b2b89ac694 (as listed in ../../t2_circuit_fix/zkdac_v6/zk/MANIFEST.sha256).
- `snarkjs powersoftau verify` (snarkjs 0.7.6, whole contribution chain + beacon): **"Powers of Tau Ok!"**, 1,239 s on the M5 Pro (verify_pot18.log).
Trust statement for the paper: phase 1 = public multi-party ceremony (secure if at least one of the 54 contributors was honest); phase 2 (circuit-specific)
has a single local contribution in this prototype and is therefore not a trusted setup; a production deployment needs a phase-2 ceremony.
The local dev ptau 2^17 (../pot17_final.ptau, make_pot17.sh) remains the setup of v4/v5 results.

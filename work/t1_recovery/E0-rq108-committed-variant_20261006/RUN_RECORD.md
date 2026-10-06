# Run record: E0-rq108-committed-variant (issue #3, feeds #4/#5)
- Command: `HIST=<7966d60 checkout> ./build_and_attack.sh` (after the witness run produced build/input_d4.json).
- Committed circuit with `{{`->`{` and circomlib in ./circomlib_shared: **46,593 constraints**, 4 public, 81 private. r1cs sha256 f4efb4b3...b37f. (Matches paper's C5 number.)
- Witness-level results (accepted = witness generation succeeded = the constraint system is satisfiable):
  - A valid, switches=1: ACCEPTED (expected)
  - B forged sig0_S, switches=1: rejected (expected)
  - C forged sig0_S, eddsa switches=0: **ACCEPTED**
  - D all switches=0, arbitrary issued_root/revoked_root (12345/999): **ACCEPTED**
- Meaning: the committed circuit has false accepts (signature, membership, non-revocation checks can be skipped by a prover). The paper's "32/32 forgeries rejected" never set switches to 0, so it does not cover this. This is witness satisfiability; a proof would exist for these witnesses (Groth16 is complete), not generated here.
- Claims: G-DEL / G-UNF / G-REV for this circuit variant are FAIL until T2 fixes it.

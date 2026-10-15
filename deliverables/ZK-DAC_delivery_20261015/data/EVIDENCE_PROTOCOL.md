# Evidence Protocol (T0, issue #2)

## Layout
```
work/
  EVIDENCE_PROTOCOL.md      this file
  templates/RUN_RECORD.md   copy into every new run directory
  t1_recovery/              E0: recover a trusted object from the historical workspace
  <tN_topic>/               one directory per task (t2_circuit_fix, t3_attacks, ...)
    <exp_id>_<YYYYMMDD>/    one directory per run; never overwritten
```
- New experiment or re-run => new directory. Historical evidence (`ttwang-szu/ZK-HADA @ 7966d60`) is read-only.
- Experiment id: `E<n>-<slug>` matching the proposal (E0 recover, E1 attacks, E2 scale, E3 revocation, E4 e2e, E5 baselines, E6 accountability, E7 on-chain).

## Every run records (RUN_RECORD.md)
command(s) verbatim, environment (OS, circom/snarkjs/node/forge versions), inputs + seeds, source commit (this repo) and
historical commit if used, SHA-256 of every input/output artifact, results, **failures and anomalies**.

## Hashes
`MANIFEST.sha256` in each run dir (`shasum -a 256`). Large/secret files (.zkey, .ptau, .r1cs, .pem) are not committed; only their hash.

## Claim discipline
- A paper number must map to `artifact path + sha256 + command`; otherwise it is marked UNSOURCED.
- Test pass != security proof. False accept in a differential/attack test => the related claim is FAIL.
- Attack lists are committed before they are run (pre-registration).

## Collaboration
- One issue per task (#2..#11, parent #1). Claim by comment + `agent-claimed` label; work on a branch `tN-<slug>`; open a PR that says `Refs #N`; findings go in the issue as comments.

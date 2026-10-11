#!/bin/bash
# For every pre-registration / plan file: its first commit must be an ANCESTOR of (i.e. come before) the first commit that added the results file of
# the same experiment. Prints one line per experiment: OK / VIOLATION / NO-RESULTS. usage: audit/check_prereg_order.sh  (run from the repo root)
cd "$(git rev-parse --show-toplevel)"
first() { git log --diff-filter=A --format=%H -- "$1" | tail -1; }
pair() { local pre=$1 res=$2; local a b; a=$(first "$pre"); b=$(first "$res")
  if [ -z "$b" ]; then echo "NO-RESULTS  $pre"; return; fi
  if [ "$a" = "$b" ]; then echo "VIOLATION   same commit $(git log -1 --format='%h %ci' $a)  $pre"; return; fi
  if git merge-base --is-ancestor "$a" "$b"; then echo "OK          prereg $(git log -1 --format='%h %ci' $a) < results $(git log -1 --format='%h %ci' $b)  $pre";
  else echo "VIOLATION   prereg $(git log -1 --format='%h %ci' $a) not before results $(git log -1 --format='%h %ci' $b)  $pre"; fi; }
pair work/t3_attacks/ATTACKS_PREREGISTRATION.md work/t3_attacks/RESULTS.md
for v in 3 4 5 6 7 9; do pair work/t3_attacks/v$v/ATTACKS_PREREGISTRATION_v$v.md work/t3_attacks/v$v/RESULTS_v$v.md; done
pair work/t2_circuit_fix/zkdac_v8/PREREGISTRATION.md work/t2_circuit_fix/zkdac_v8/RESULTS.md
pair work/t2_circuit_fix/zkdac_v9/PREREGISTRATION.md work/t2_circuit_fix/zkdac_v9/RESULTS.md
pair work/t2_circuit_fix/zkdac_v8/PREREGISTRATION.md work/t5_e2/E2-budget_20261009/results/e2_anvil.json
for d in work/h3_prestudy/H3-prestudy_20261009 work/t4_accountability/E6-threshold-opening_20261009 work/t4_obligations/E7-obligations_20261009 \
         work/t4_revocation/E3-revocation_20261009 work/t4_privacy/E6b-linkability-v9_20261010 work/t5_e2e/T5-e2e-scale_20261010 work/t6_baselines/T6-baselines_20261010; do
  pair $d/PREREGISTRATION.md $d/RESULTS.md; done
pair work/t7_proofs/T7-review_20261010/AUDIT_PLAN.md work/t7_proofs/T7-review_20261010/LEAN_AUDIT.md
pair work/t7_proofs/T7b-lean-statemachine_20261010/PLAN.md work/t7_proofs/T7b-lean-statemachine_20261010/RESULTS.md
pair work/t8_paper/T8-chapter_20261010/PLAN.md work/t8_paper/T8-chapter_20261010/RESULTS.md

#!/bin/bash
# For every experiment, check the pre-registration / plan file against the experiment's outputs:
#   ORDER    the commit that first added the pre-registration is an ancestor of (comes before) the EARLIEST commit that added any output
#            (raw results/ files or RESULTS*.md) of that experiment;
#   EDITED   commits that changed the pre-registration in or after that earliest output commit (amendments; each must be declared in the file).
# Prints OK / VIOLATION / NO-PREREG / NO-RESULTS per experiment, then EDITED lines if any. usage: audit/check_prereg_order.sh (from the repo root)
# Limits: commit ancestry is not push order (commit dates can be set locally); push times are only in the GitHub Events API (90 days).
# Revised 2026-10-12 after audit #59: earliest raw output instead of RESULTS.md only, missing prereg handled, duplicate E2 / v8 line merged, edits after
# results reported, post-2026-10-11 experiments added.
cd "$(git rev-parse --show-toplevel)"
first() { git log --diff-filter=A --format=%H -- "$@" | tail -1; }
pair() { local pre=$1; shift; local a b; a=$(first "$pre"); b=$(first "$@")
  if [ -z "$a" ]; then echo "NO-PREREG   $pre"; return; fi
  if [ -z "$b" ]; then echo "NO-RESULTS  $pre"; return; fi
  if [ "$a" = "$b" ]; then echo "VIOLATION   same commit $(git log -1 --format='%h %ci' $a)  $pre"; return; fi
  if git merge-base --is-ancestor "$a" "$b"; then echo "OK          prereg $(git log -1 --format='%h %ci' $a) < first output $(git log -1 --format='%h %ci' $b)  $pre";
  else echo "VIOLATION   prereg $(git log -1 --format='%h %ci' $a) not before first output $(git log -1 --format='%h %ci' $b)  $pre"; fi
  local c e=""; for c in $(git rev-list "$a"..HEAD -- "$pre"); do git merge-base --is-ancestor "$b" "$c" && e="$e$(git log -1 --format=%h $c) "; done
  [ -n "$e" ] && echo "  EDITED at/after first output: $e $pre"; return 0; }
T3=work/t3_attacks; T2=work/t2_circuit_fix
pair $T3/ATTACKS_PREREGISTRATION.md $T3/RESULTS.md $T3/results
for v in 3 4 5 6 7 9; do pair $T3/v$v/ATTACKS_PREREGISTRATION_v$v.md $T3/v$v/RESULTS_v$v.md $T3/v$v/results; done
pair $T3/v9_1/ATTACKS_PREREGISTRATION_v9_1.md $T3/v9_1/RESULTS_v9_1.md $T3/v9_1/results
pair $T2/zkdac_v8/PREREGISTRATION.md $T2/zkdac_v8/RESULTS.md $T2/zkdac_v8/results work/t5_e2/E2-budget_20261009/results   # v8 + E2 (one pre-registration)
for v in 9 9_1; do pair $T2/zkdac_v$v/PREREGISTRATION.md $T2/zkdac_v$v/RESULTS.md $T2/zkdac_v$v/results; done
for d in work/h3_prestudy/H3-prestudy_20261009 work/t4_accountability/E6-threshold-opening_20261009 work/t4_obligations/E7-obligations_20261009 \
         work/t4_revocation/E3-revocation_20261009 work/t4_privacy/E6b-linkability-v9_20261010 work/t4_privacy/E6b2-linkability-reanalysis_20261012 \
         work/t5_e2e/T5-e2e-scale_20261010 work/t5_e2e/T5b-revocation-circuit_20261012 work/t6_baselines/T6-baselines_20261010 work/t6_baselines/T6b-reanalysis_20261012; do
  pair $d/PREREGISTRATION.md $d/RESULTS.md $d/results; done
pair work/t7_proofs/T7-review_20261010/AUDIT_PLAN.md work/t7_proofs/T7-review_20261010/LEAN_AUDIT.md
pair work/t7_proofs/T7b-lean-statemachine_20261010/PLAN.md work/t7_proofs/T7b-lean-statemachine_20261010/RESULTS.md
pair work/t8_paper/T8-chapter_20261010/PLAN.md work/t8_paper/T8-chapter_20261010/RESULTS.md
echo "Not covered (no pre-registration file): T2 v2-v7, E0/T1, t4_registration, revocation_imt, contract variants (#18), T5 e4a_plan.json,"
echo "E7b v9 POLICY closure tests (post hoc, written after audit #55)."

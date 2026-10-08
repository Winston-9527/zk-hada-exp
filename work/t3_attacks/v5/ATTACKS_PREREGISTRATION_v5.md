# T3 re-run on v5 (v4 + registered-root tree, #17 option b) — mapping, committed BEFORE running (issue #5 / #17)
Classes: `../ATTACKS_PREREGISTRATION.md`; v4 mapping `../v4/ATTACKS_PREREGISTRATION_v4.md`. v5 changes only where hop 0 is checked: cert0 must be a leaf of the
registered-root LeanIMT (public root_root, maintained by the registry contract), hops >= 1 stay in the delegation (issued) tree.
Oracle `oracle_v5.mjs` = `../v3/oracle_v3.mjs` with: cert0 ∈ world.rootRegistry (registered root certificates), certs i >= 1 ∈ world.registry, and
root_root ∈ world.root_roots (current registered-root roots). All other rules unchanged.

All v4 rows (A00–A16, incl. A11a / A11-req / A12c / A14 as POLICY) are re-run unchanged on v5 instances. New rows:
| ID | Attack | Expected |
|---|---|---|
| A17a | cert0 is a valid, signed certificate present only in the delegation tree (never registered) | reject |
| A17b | cert0 presented with the membership path of another registered root certificate | reject |
| A17c | master replaced by re-registration (registry updates the leaf in place): old path vs new root_root | reject |
| A17c' | same, proof against the pre-replacement root_root | POLICY (contract root window for root_root) |
| A17d | rt_depth > RT with root_root = 0 (BinaryMerkleRoot returns 0; empty LeanIMT root is 0) | reject |
| A17e | cert0 registered under a different master key (registry holds H(0, human, M', ...)), chain uses master M | reject |
Pass criterion: zero FALSE_ACCEPT outside POLICY rows; COMPLETENESS_GAP 0. Exhaustive oracle diff (D=4) re-run.

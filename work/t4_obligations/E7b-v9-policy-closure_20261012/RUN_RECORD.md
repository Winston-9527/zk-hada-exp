# Run record: v9 POLICY closure (2026-10-12, forge 1.5.1). From work/t4_contracts/foundry:
```
forge test --match-contract V9PolicyTest -vv > ../../t4_obligations/E7b-v9-policy-closure_20261012/forge_v9policy.txt
forge test | grep -E "Suite result|Ran .* test suites|FAIL" >> ../../t4_obligations/E7b-v9-policy-closure_20261012/forge_all.txt
```
No pre-registration: the tests were written by the external audit (#55) and one by party B after it (post hoc closure evidence).

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {V92Test} from "./V92.t.sol";
import {ZkDacGateV9} from "../src/ZkDacGateV9.sol";

/// Audit follow-up F3 (work/audit_corrections/FOLLOWUPS_20261016/PREREGISTRATION.md; audit #81 F7): accept-at-boundary tests for the gate's
/// `_rootOk` windows, with the real v9.2 fixtures of V92.t.sol (every step runs at NOW, so the roots it retires are retired at NOW).
/// Inherits V92Test for setUp and helpers; forge therefore also re-runs V92Test's tests in this contract.
contract T7cWindowBoundaryTest is V92Test {
    // note root: step 5 spends on the note root that the earlier steps retired at NOW; accepted at NOW + NWIN, rejected at NOW + NWIN + 1
    function test_F3_noteRootBoundary() public {
        _run(4); uint256 snap = vm.snapshotState();
        vm.warp(NOW + NWIN); _exec(_x(5)); vm.revertToState(snap);
        vm.warp(NOW + NWIN + 1); X memory x = _x(5); vm.expectRevert(ZkDacGateV9.StaleNoteRoot.selector); _exec(x);
    }
    // issued root: the operator moves the issued root at NOW; a proof on the old issued root is accepted at NOW + 300, rejected at NOW + 301
    function test_F3_issuedRootBoundary() public {
        _run(1); vm.prank(OP); gate.updateIssuedRoot(123456789); uint256 snap = vm.snapshotState();
        vm.warp(NOW + 300); _exec(_x(2)); vm.revertToState(snap);
        vm.warp(NOW + 301); X memory x = _x(2); vm.expectRevert(ZkDacGateV9.StaleIssuedRoot.selector); _exec(x);
    }
}

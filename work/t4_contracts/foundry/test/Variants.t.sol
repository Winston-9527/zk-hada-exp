// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test, console2} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {ZkDacGateBase, ZkDacGate, ZkDacGateA, ZkDacGateB} from "../src/ZkDacGate.sol";
import {PoseidonOpt} from "../src/PoseidonOpt.sol";
import {Groth16Verifier} from "../src/Groth16Verifier.sol";
import {Groth16VerifierA} from "../src/Groth16VerifierA.sol";
import {Groth16VerifierB} from "../src/Groth16VerifierB.sol";
import {MockTarget} from "./Targets.sol";

/// Same behavioural checks + gas breakdown for the three public-input layouts (v2 / A / B), each with its own real proofs.
abstract contract VariantBase is Test {
    using stdJson for string;
    string fx; ZkDacGateBase gate; address ver; PoseidonOpt pos; MockTarget target;
    address constant OP = address(0x0FE1);
    bytes4 METHOD; bytes PARAMS; uint64 NOW;

    function variant() internal pure virtual returns (string memory);
    function _deployGate(uint256 issued, uint256 r0) internal virtual;
    function _verifyDirect(ZkDacGateBase.Proof memory p, uint256[] memory s) internal view virtual returns (bool);

    function _deployData(bytes memory runtime) internal returns (address a) {
        bytes memory init = abi.encodePacked(hex"61", uint16(runtime.length), hex"80600c6000396000f3", runtime);
        assembly { a := create(0, add(init, 0x20), mload(init)) }
        require(a != address(0), "data deploy");
    }
    function setUp() public {
        fx = vm.readFile(string.concat("test/fixtures_", variant(), ".json"));
        METHOD = bytes4(fx.readBytes(".method")); PARAMS = fx.readBytes(".params"); NOW = uint64(fx.readUint(".now"));
        if (fx.keyExists(".poseidonData.t")) {
            pos = new PoseidonOpt(fx.readUint(".poseidonData.t"), fx.readUint(".poseidonData.nrp"),
                _deployData(fx.readBytes(".poseidonData.d1")), _deployData(fx.readBytes(".poseidonData.d2")),
                fx.readUint(".poseidonData.len1"), fx.readUint(".poseidonData.len2"));
        }
        _deployGate(fx.readUint(".issuedRoot"), fx.readUint(".R0"));
        deployCodeTo("Targets.sol:MockTarget", "", fx.readAddress(".target"));
        target = MockTarget(fx.readAddress(".target"));
        vm.prank(OP); gate.setMethod(METHOD, uint32(fx.readUint(".reqCap")), true);
        vm.warp(NOW);
    }
    function _k(uint256 i, string memory f) internal pure returns (string memory) { return string.concat(".proofs[", vm.toString(i), "].", f); }
    function _proof(uint256 i) internal view returns (ZkDacGateBase.Proof memory p) {
        uint256[] memory a = fx.readUintArray(_k(i, "a")); uint256[] memory c = fx.readUintArray(_k(i, "c"));
        uint256[] memory b0 = fx.readUintArray(string.concat(_k(i, "b"), "[0]")); uint256[] memory b1 = fx.readUintArray(string.concat(_k(i, "b"), "[1]"));
        p.a = [a[0], a[1]]; p.c = [c[0], c[1]]; p.b = [[b0[0], b0[1]], [b1[0], b1[1]]];
    }
    function _pubs(uint256 i) internal view returns (uint256[] memory) { return fx.readUintArray(_k(i, "pub")); }
    function _act(uint256 i) internal view returns (ZkDacGateBase.Action memory) {
        return ZkDacGateBase.Action(address(target), METHOD, fx.readUint(_k(i, "amount")), fx.readUint(_k(i, "nonce")), PARAMS);
    }
    function _root(uint256 i) internal view returns (uint256 iR, uint256 rR) { iR = fx.readUint(".issuedRoot"); rR = i == 3 ? fx.readUint(".R1") : fx.readUint(".R0"); }
    function _call(uint256 i) internal returns (uint256 g) {
        (uint256 iR, uint256 rR) = _root(i);
        ZkDacGateBase.Proof memory p = _proof(i); ZkDacGateBase.Action memory a = _act(i);
        uint256 nf = fx.readUint(_k(i, "nullifier")); uint64 t = uint64(fx.readUint(_k(i, "now")));
        uint256 g0 = gasleft(); gate.execute(p, iR, rR, nf, t, a); g = g0 - gasleft();
    }

    function test_validExecutes() public { _call(0); assertEq(target.calls(), 1); }
    function test_replayRejected() public { _call(0); vm.expectRevert(ZkDacGateBase.NullifierSpent.selector); _call(0); }
    function test_proverChosenReqCapRejected() public { vm.expectRevert(ZkDacGateBase.InvalidProof.selector); _call(2); }
    function test_clockBinding() public { vm.warp(NOW + 61); vm.expectRevert(ZkDacGateBase.BadClock.selector); _call(0); }
    function test_wrongNowRejectedByProof() public {
        // claim a different `now` than the proof was made for (within the clock skew): must fail in every variant
        (uint256 iR, uint256 rR) = _root(0); vm.warp(NOW + 1);
        ZkDacGateBase.Proof memory p = _proof(0); ZkDacGateBase.Action memory a = _act(0); uint256 nf = fx.readUint(_k(0, "nullifier"));
        vm.expectRevert(ZkDacGateBase.InvalidProof.selector); gate.execute(p, iR, rR, nf, NOW + 1, a);
    }
    function test_gas() public {
        ZkDacGateBase.Proof memory pv = _proof(0); uint256[] memory sv = _pubs(0);   // parse outside the measured window
        uint256 g0 = gasleft(); bool ok = _verifyDirect(pv, sv); uint256 gVer = g0 - gasleft(); assertTrue(ok);
        uint256 gAll = _call(0);
        uint256 gSecond = _call(1);
        (uint256 iR, uint256 rR) = _root(0);
        bytes memory cd = abi.encodeCall(gate.execute, (_proof(0), iR, rR, fx.readUint(_k(0, "nullifier")), uint64(fx.readUint(_k(0, "now"))), _act(0)));
        uint256 z; for (uint256 j = 0; j < cd.length; j++) if (cd[j] == 0) z++;
        console2.log(string.concat("[", variant(), "] public inputs"), _pubs(0).length);
        console2.log(string.concat("[", variant(), "] verifyProof"), gVer);
        console2.log(string.concat("[", variant(), "] execute #1 (excl. intrinsic)"), gAll);
        console2.log(string.concat("[", variant(), "] execute #2 (excl. intrinsic)"), gSecond);
        console2.log(string.concat("[", variant(), "] calldata bytes"), cd.length);
        console2.log(string.concat("[", variant(), "] intrinsic+calldata (EIP-2028)"), 21000 + 4 * z + 16 * (cd.length - z));
    }
}

contract VariantV2 is VariantBase {
    using stdJson for string;
    function variant() internal pure override returns (string memory) { return "v2"; }
    function _deployGate(uint256 issued, uint256 r0) internal override {
        ver = address(new Groth16Verifier());
        deployCodeTo("ZkDacGate.sol:ZkDacGate", abi.encode(ver, address(pos), OP, issued, r0, uint64(300), uint64(300), uint64(60)), fx.readAddress(".gate"));
        gate = ZkDacGateBase(fx.readAddress(".gate"));
    }
    function _verifyDirect(ZkDacGateBase.Proof memory p, uint256[] memory s) internal view override returns (bool) {
        return Groth16Verifier(ver).verifyProof(p.a, p.b, p.c, [s[0], s[1], s[2], s[3], s[4]]);
    }
    function test_digestMatchesCircuit() public view { assertEq(ZkDacGate(address(gate)).actionDigest(_act(0)), fx.readUint(_k(0, "digest"))); }
}
contract VariantA is VariantBase {
    using stdJson for string;
    function variant() internal pure override returns (string memory) { return "A"; }
    function _deployGate(uint256 issued, uint256 r0) internal override {
        ver = address(new Groth16VerifierA());
        deployCodeTo("ZkDacGate.sol:ZkDacGateA", abi.encode(ver, address(pos), OP, issued, r0, uint64(300), uint64(300), uint64(60)), fx.readAddress(".gate"));
        gate = ZkDacGateBase(fx.readAddress(".gate"));
    }
    function _verifyDirect(ZkDacGateBase.Proof memory p, uint256[] memory s) internal view override returns (bool) {
        return Groth16VerifierA(ver).verifyProof(p.a, p.b, p.c, [s[0], s[1], s[2], s[3]]);
    }
    function test_digestMatchesCircuit() public view { assertEq(ZkDacGateA(address(gate)).actionDigest(_act(0), NOW), fx.readUint(_k(0, "digest"))); }
}
contract VariantB is VariantBase {
    using stdJson for string;
    function variant() internal pure override returns (string memory) { return "B"; }
    function _deployGate(uint256 issued, uint256 r0) internal override {
        ver = address(new Groth16VerifierB());
        deployCodeTo("ZkDacGate.sol:ZkDacGateB", abi.encode(ver, OP, issued, r0, uint64(300), uint64(300), uint64(60)), fx.readAddress(".gate"));
        gate = ZkDacGateBase(fx.readAddress(".gate"));
    }
    function _verifyDirect(ZkDacGateBase.Proof memory p, uint256[] memory s) internal view override returns (bool) {
        return Groth16VerifierB(ver).verifyProof(p.a, p.b, p.c, [s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8], s[9], s[10]]);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGroth16Verifier5 {
    function verifyProof(uint[2] calldata a, uint[2][2] calldata b, uint[2] calldata c, uint[5] calldata pub) external view returns (bool);
}
interface IPoseidon7 { function poseidon(uint256[7] calldata) external view returns (uint256); }
interface IAgentTarget { function onAuthorized(bytes4 method, uint256 amount, bytes calldata params) external; }

/// Verifier-side obligations that the ZK-DAC circuit cannot enforce on its own (issue #18):
///  (1) root freshness: issued/revoked roots must be current or superseded less than `*Window` seconds ago;
///  (2) clock: public `now` must satisfy block.timestamp - clockSkew <= now <= block.timestamp;
///  (3) replay: each nullifier is accepted once;
///  plus context binding: chain_id, verifier address and required capability are set by the contract, not the prover.
contract ZkDacGate {
    uint256 internal constant P = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    IGroth16Verifier5 public immutable verifier;
    IPoseidon7 public immutable poseidon7;
    address public immutable operator;
    uint64 public immutable issuedWindow;   // grace period for a superseded issued root
    uint64 public immutable revokedWindow;  // grace period for a superseded revoked root = max revocation lag
    uint64 public immutable clockSkew;

    uint256 public issuedRoot;
    uint256 public revokedRoot;
    mapping(uint256 => uint64) public issuedRootRetiredAt;   // 0 = never retired / unknown
    mapping(uint256 => uint64) public revokedRootRetiredAt;
    mapping(uint256 => bool) public spent;
    mapping(bytes4 => uint32) public requiredCap;          // method -> capability bits the action needs
    mapping(bytes4 => bool) public methodEnabled;

    error NotOperator();
    error StaleIssuedRoot();
    error StaleRevokedRoot();
    error BadClock();
    error NullifierSpent();
    error UnknownMethod();
    error InvalidProof();
    error BadField();

    event RootsUpdated(uint256 issuedRoot, uint256 revokedRoot);
    event Executed(uint256 indexed nullifier, address indexed target, bytes4 method, uint256 amount);

    struct Proof { uint[2] a; uint[2][2] b; uint[2] c; }
    struct Action { address target; bytes4 method; uint256 amount; uint256 nonce; bytes params; }

    constructor(address v, address p7, address op, uint256 iRoot, uint256 rRoot, uint64 iWin, uint64 rWin, uint64 skew) {
        verifier = IGroth16Verifier5(v); poseidon7 = IPoseidon7(p7); operator = op;
        issuedWindow = iWin; revokedWindow = rWin; clockSkew = skew;
        issuedRoot = iRoot; revokedRoot = rRoot;
    }

    function setMethod(bytes4 m, uint32 cap, bool on) external {
        if (msg.sender != operator) revert NotOperator();
        requiredCap[m] = cap; methodEnabled[m] = on;
    }

    /// Registry operator publishes new roots (trust assumption: roots are computed honestly off-chain).
    function updateRoots(uint256 newIssued, uint256 newRevoked) external {
        if (msg.sender != operator) revert NotOperator();
        if (newIssued != issuedRoot) { issuedRootRetiredAt[issuedRoot] = uint64(block.timestamp); issuedRootRetiredAt[newIssued] = 0; issuedRoot = newIssued; }
        if (newRevoked != revokedRoot) { revokedRootRetiredAt[revokedRoot] = uint64(block.timestamp); revokedRootRetiredAt[newRevoked] = 0; revokedRoot = newRevoked; }
        emit RootsUpdated(newIssued, newRevoked);
    }

    function _rootOk(uint256 root, uint256 current, mapping(uint256 => uint64) storage retired, uint64 window) internal view returns (bool) {
        if (root == current) return true;
        uint64 t = retired[root];
        return t != 0 && block.timestamp <= uint256(t) + window;
    }

    function actionDigest(Action calldata act) public view returns (uint256) {
        return poseidon7.poseidon([
            block.chainid, uint256(uint160(address(this))), uint256(uint32(act.method)),
            uint256(keccak256(abi.encode(act.target, act.params))) % P, act.amount, uint256(requiredCap[act.method]), act.nonce
        ]);
    }

    function execute(Proof calldata pr, uint256 iRoot, uint256 rRoot, uint256 nullifier, uint64 nowTs, Action calldata act) external {
        if (!methodEnabled[act.method]) revert UnknownMethod();
        if (act.amount >= P || act.nonce >= P || nullifier >= P) revert BadField();
        if (!_rootOk(iRoot, issuedRoot, issuedRootRetiredAt, issuedWindow)) revert StaleIssuedRoot();
        if (!_rootOk(rRoot, revokedRoot, revokedRootRetiredAt, revokedWindow)) revert StaleRevokedRoot();
        if (nowTs > block.timestamp || block.timestamp - nowTs > clockSkew) revert BadClock();
        if (spent[nullifier]) revert NullifierSpent();
        uint256 digest = actionDigest(act);
        if (!verifier.verifyProof(pr.a, pr.b, pr.c, [iRoot, rRoot, digest, nullifier, uint256(nowTs)])) revert InvalidProof();
        spent[nullifier] = true;                                   // effects before interaction (reentrancy)
        IAgentTarget(act.target).onAuthorized(act.method, act.amount, act.params); // reverts bubble up: whole tx rolls back, nullifier unspent
        emit Executed(nullifier, act.target, act.method, act.amount);
    }
}

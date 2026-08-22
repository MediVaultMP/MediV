// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title MediVaultRecordRegistry
/// @notice An integrity registry only. It never stores medical documents or medical details.
contract MediVaultRecordRegistry {
    struct Record {
        bytes32 contentHash;
        address patient;
        address registrar;
        uint256 registeredAt;
        bool exists;
    }

    address public owner;
    mapping(bytes32 => Record) private records;
    mapping(address => mapping(address => uint256)) private accessExpiries;

    error Unauthorized();
    error ZeroAddress();
    error ZeroValue();
    error RecordAlreadyRegistered(bytes32 recordId);
    error RecordNotFound(bytes32 recordId);
    error InvalidExpiry();

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RecordRegistered(
        bytes32 indexed recordId,
        bytes32 indexed contentHash,
        address indexed patient,
        address registrar,
        uint256 timestamp
    );
    event AccessGranted(address indexed patient, address indexed doctor, uint256 expiresAt, address indexed grantedBy, uint256 timestamp);
    event AccessRevoked(address indexed patient, address indexed doctor, address indexed revokedBy, uint256 timestamp);
    event AuditEvent(
        bytes32 indexed eventId,
        bytes32 indexed eventType,
        address indexed subject,
        address actor,
        uint256 expiresAt,
        uint256 timestamp
    );

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    /// @notice Registers a unique opaque record ID and its SHA-256 digest.
    /// @dev `recordId` should be an off-chain derived opaque identifier, not a patient identifier.
    function registerRecord(bytes32 recordId, bytes32 contentHash, address patient) external onlyOwner {
        if (recordId == bytes32(0) || contentHash == bytes32(0)) revert ZeroValue();
        if (patient == address(0)) revert ZeroAddress();
        if (records[recordId].exists) revert RecordAlreadyRegistered(recordId);

        records[recordId] = Record({
            contentHash: contentHash,
            patient: patient,
            registrar: msg.sender,
            registeredAt: block.timestamp,
            exists: true
        });
        emit RecordRegistered(recordId, contentHash, patient, msg.sender, block.timestamp);
    }

    /// @notice Returns true only when the supplied digest matches the registered digest.
    function verifyRecord(bytes32 recordId, bytes32 contentHash) external view returns (bool) {
        Record storage record = records[recordId];
        return record.exists && record.contentHash == contentHash;
    }

    /// @notice Returns non-sensitive integrity metadata for a registered record.
    function getRecord(bytes32 recordId) external view returns (bytes32 contentHash, address patient, address registrar, uint256 registeredAt) {
        Record storage record = records[recordId];
        if (!record.exists) revert RecordNotFound(recordId);
        return (record.contentHash, record.patient, record.registrar, record.registeredAt);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Mirrors an application-authorized patient consent. No clinical details are stored.
    function grantAccess(address patient, address doctor, uint256 expiresAt) external onlyOwner {
        if (patient == address(0) || doctor == address(0)) revert ZeroAddress();
        if (expiresAt <= block.timestamp) revert InvalidExpiry();
        accessExpiries[patient][doctor] = expiresAt;
        emit AccessGranted(patient, doctor, expiresAt, msg.sender, block.timestamp);
    }

    function revokeAccess(address patient, address doctor) external onlyOwner {
        if (patient == address(0) || doctor == address(0)) revert ZeroAddress();
        accessExpiries[patient][doctor] = 0;
        emit AccessRevoked(patient, doctor, msg.sender, block.timestamp);
    }

    function hasAccess(address patient, address doctor) external view returns (bool) {
        return accessExpiries[patient][doctor] > block.timestamp;
    }

    function accessExpiry(address patient, address doctor) external view returns (uint256) {
        return accessExpiries[patient][doctor];
    }

    /// @notice Anchors a non-sensitive audit event. Event details remain in PostgreSQL.
    function recordAuditEvent(bytes32 eventId, bytes32 eventType, address subject, address actor, uint256 expiresAt) external onlyOwner {
        if (eventId == bytes32(0) || eventType == bytes32(0) || subject == address(0) || actor == address(0)) revert ZeroValue();
        emit AuditEvent(eventId, eventType, subject, actor, expiresAt, block.timestamp);
    }
}

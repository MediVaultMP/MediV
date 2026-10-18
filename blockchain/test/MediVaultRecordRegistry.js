
const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("MediVaultRecordRegistry", function () {
  let registry;
  let owner;
  let patient;
  let doctor;
  let other;

  const makeId = (value) => ethers.id(value);

  beforeEach(async function () {
    [owner, patient, doctor, other] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory(
      "MediVaultRecordRegistry"
    );

    registry = await Registry.deploy();
    await registry.waitForDeployment();
  });

  async function latestTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }

  describe("Record registration and verification", function () {
    it("registers a record and stores its integrity metadata", async function () {
      const recordId = makeId("record-001");
      const contentHash = makeId("medical-file-content");

      await expect(
        registry.registerRecord(recordId, contentHash, patient.address)
      )
        .to.emit(registry, "RecordRegistered")
        .withArgs(
          recordId,
          contentHash,
          patient.address,
          owner.address,
          (timestamp) => timestamp > 0
        );

      const record = await registry.getRecord(recordId);

      expect(record.contentHash).to.equal(contentHash);
      expect(record.patient).to.equal(patient.address);
      expect(record.registrar).to.equal(owner.address);
      expect(record.registeredAt).to.be.greaterThan(0);

      expect(
        await registry.verifyRecord(recordId, contentHash)
      ).to.equal(true);
    });

    it("returns false for an incorrect hash or unknown record", async function () {
      const recordId = makeId("record-002");
      const contentHash = makeId("correct-content");
      const wrongHash = makeId("incorrect-content");
      const unknownId = makeId("unknown-record");

      await registry.registerRecord(
        recordId,
        contentHash,
        patient.address
      );

      expect(
        await registry.verifyRecord(recordId, wrongHash)
      ).to.equal(false);

      expect(
        await registry.verifyRecord(unknownId, contentHash)
      ).to.equal(false);
    });

    it("prevents unauthorized and duplicate registrations", async function () {
      const recordId = makeId("record-003");
      const contentHash = makeId("record-content");

      await expect(
        registry.connect(other).registerRecord(
          recordId,
          contentHash,
          patient.address
        )
      ).to.be.revertedWithCustomError(registry, "Unauthorized");

      await registry.registerRecord(
        recordId,
        contentHash,
        patient.address
      );

      await expect(
        registry.registerRecord(
          recordId,
          makeId("different-content"),
          patient.address
        )
      )
        .to.be.revertedWithCustomError(
          registry,
          "RecordAlreadyRegistered"
        )
        .withArgs(recordId);
    });

    it("rejects a zero record ID or zero content hash", async function () {
      const contentHash = makeId("valid-content");
      const recordId = makeId("valid-record");

      await expect(
        registry.registerRecord(
          ethers.ZeroHash,
          contentHash,
          patient.address
        )
      ).to.be.revertedWithCustomError(registry, "ZeroValue");

      await expect(
        registry.registerRecord(
          recordId,
          ethers.ZeroHash,
          patient.address
        )
      ).to.be.revertedWithCustomError(registry, "ZeroValue");
    });

    it("rejects registration with a zero patient address", async function () {
      await expect(
        registry.registerRecord(
          makeId("record-zero-patient"),
          makeId("record-content"),
          ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });

    it("reverts when retrieving a record that does not exist", async function () {
      const missingId = makeId("missing-record");

      await expect(
        registry.getRecord(missingId)
      )
        .to.be.revertedWithCustomError(registry, "RecordNotFound")
        .withArgs(missingId);
    });
  });

  describe("Access control", function () {
    it("grants access and allows the owner to revoke it", async function () {
      const expiry = (await latestTimestamp()) + 3600;

      await expect(
        registry.grantAccess(
          patient.address,
          doctor.address,
          expiry
        )
      ).to.emit(registry, "AccessGranted");

      expect(
        await registry.hasAccess(patient.address, doctor.address)
      ).to.equal(true);

      expect(
        await registry.accessExpiry(patient.address, doctor.address)
      ).to.equal(expiry);

      await expect(
        registry.revokeAccess(patient.address, doctor.address)
      ).to.emit(registry, "AccessRevoked");

      expect(
        await registry.hasAccess(patient.address, doctor.address)
      ).to.equal(false);

      expect(
        await registry.accessExpiry(patient.address, doctor.address)
      ).to.equal(0);
    });

    it("rejects an access grant with an expired or current expiry", async function () {
      const now = await latestTimestamp();

      await expect(
        registry.grantAccess(
          patient.address,
          doctor.address,
          now - 1
        )
      ).to.be.revertedWithCustomError(registry, "InvalidExpiry");

      await expect(
        registry.grantAccess(
          patient.address,
          doctor.address,
          now
        )
      ).to.be.revertedWithCustomError(registry, "InvalidExpiry");
    });

    it("denies access after the grant expires", async function () {
      const expiry = (await latestTimestamp()) + 10;

      await registry.grantAccess(
        patient.address,
        doctor.address,
        expiry
      );

      expect(
        await registry.hasAccess(patient.address, doctor.address)
      ).to.equal(true);

      await network.provider.send("evm_setNextBlockTimestamp", [
        expiry,
      ]);
      await network.provider.send("evm_mine");

      expect(
        await registry.hasAccess(patient.address, doctor.address)
      ).to.equal(false);
    });

    it("prevents non-owners from granting or revoking access", async function () {
      const expiry = (await latestTimestamp()) + 3600;

      await expect(
        registry.connect(other).grantAccess(
          patient.address,
          doctor.address,
          expiry
        )
      ).to.be.revertedWithCustomError(registry, "Unauthorized");

      await expect(
        registry.connect(other).revokeAccess(
          patient.address,
          doctor.address
        )
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });
  });

  describe("Ownership", function () {
    it("transfers ownership and restricts the former owner", async function () {
      await expect(
        registry.transferOwnership(other.address)
      )
        .to.emit(registry, "OwnershipTransferred")
        .withArgs(owner.address, other.address);

      expect(await registry.owner()).to.equal(other.address);

      await expect(
        registry.registerRecord(
          makeId("old-owner-record"),
          makeId("old-owner-content"),
          patient.address
        )
      ).to.be.revertedWithCustomError(registry, "Unauthorized");

      await expect(
        registry.connect(other).registerRecord(
          makeId("new-owner-record"),
          makeId("new-owner-content"),
          patient.address
        )
      ).to.emit(registry, "RecordRegistered");
    });

    it("rejects transferring ownership to the zero address", async function () {
      await expect(
        registry.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });
  });

  describe("Audit events", function () {
    it("prevents non-owners from recording audit events", async function () {
      await expect(
        registry.connect(other).recordAuditEvent(
          makeId("audit-unauthorized"),
          makeId("EMERGENCY_ACCESS"),
          patient.address,
          doctor.address,
          0
        )
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("records a non-sensitive audit event for controlled emergency access", async function () {
      const eventId = makeId("audit-emergency-001");
      const eventType = makeId("EMERGENCY_ACCESS");
      const expiresAt = 0;

      await expect(
        registry.recordAuditEvent(
          eventId,
          eventType,
          patient.address,
          doctor.address,
          expiresAt
        )
      ).to.emit(registry, "AuditEvent");
    });

    it("rejects audit events with a zero event ID or event type", async function () {
      const eventType = makeId("EMERGENCY_ACCESS");
      const eventId = makeId("audit-zero-test");

      await expect(
        registry.recordAuditEvent(
          ethers.ZeroHash,
          eventType,
          patient.address,
          doctor.address,
          0
        )
      ).to.be.revertedWithCustomError(registry, "ZeroValue");

      await expect(
        registry.recordAuditEvent(
          eventId,
          ethers.ZeroHash,
          patient.address,
          doctor.address,
          0
        )
      ).to.be.revertedWithCustomError(registry, "ZeroValue");
    });

    it("rejects audit events with a zero subject or actor address", async function () {
      const eventId = makeId("audit-zero-address");
      const eventType = makeId("EMERGENCY_ACCESS");

      await expect(
        registry.recordAuditEvent(
          eventId,
          eventType,
          ethers.ZeroAddress,
          doctor.address,
          0
        )
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");

      await expect(
        registry.recordAuditEvent(
          eventId,
          eventType,
          patient.address,
          ethers.ZeroAddress,
          0
        )
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });

    it("rejects duplicate audit event IDs", async function () {
      const eventId = makeId("audit-event-duplicate");
      const eventType = makeId("EMERGENCY_ACCESS");

      await registry.recordAuditEvent(
        eventId,
        eventType,
        patient.address,
        doctor.address,
        0
      );

      await expect(
        registry.recordAuditEvent(
          eventId,
          eventType,
          patient.address,
          doctor.address,
          0
        )
      )
        .to.be.revertedWithCustomError(
          registry,
          "AuditEventAlreadyRecorded"
        )
        .withArgs(eventId);
    });
  });
});

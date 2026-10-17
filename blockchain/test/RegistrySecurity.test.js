const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("MediVaultRecordRegistry - Additional Security Tests", function () {
  let registry;
  let owner;
  let patient;
  let doctor;
  let other;

  const makeId = (value) => ethers.id(value);

  beforeEach(async function () {
    [owner, patient, doctor, other] = await ethers.getSigners();

    registry = await ethers.deployContract("MediVaultRecordRegistry");
    await registry.waitForDeployment();
  });

  async function latestTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
  }

  describe("Record integrity", function () {
    it("emits the correct record registration details", async function () {
      const recordId = makeId("security-record-001");
      const contentHash = makeId("security-content-001");

      const tx = await registry.registerRecord(
        recordId,
        contentHash,
        patient.address
      );

      const receipt = await tx.wait();
      const event = receipt.logs
        .map((log) => {
          try {
            return registry.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed && parsed.name === "RecordRegistered");

      expect(event).to.not.equal(undefined);
      expect(event.args.recordId).to.equal(recordId);
      expect(event.args.contentHash).to.equal(contentHash);
      expect(event.args.patient).to.equal(patient.address);
      expect(event.args.registrar).to.equal(owner.address);

      const block = await ethers.provider.getBlock(receipt.blockNumber);
      expect(event.args.timestamp).to.equal(block.timestamp);
    });

    it("preserves the original record after a duplicate registration attempt", async function () {
      const recordId = makeId("security-record-002");
      const originalHash = makeId("original-content");
      const replacementHash = makeId("replacement-content");

      await registry.registerRecord(
        recordId,
        originalHash,
        patient.address
      );

      await expect(
        registry.registerRecord(
          recordId,
          replacementHash,
          doctor.address
        )
      ).to.be.revertedWithCustomError(
        registry,
        "RecordAlreadyRegistered"
      );

      const record = await registry.getRecord(recordId);

      expect(record.contentHash).to.equal(originalHash);
      expect(record.patient).to.equal(patient.address);
      expect(record.registrar).to.equal(owner.address);
      expect(await registry.verifyRecord(recordId, originalHash)).to.equal(true);
      expect(await registry.verifyRecord(recordId, replacementHash)).to.equal(false);
    });

    it("does not allow a non-owner to register a record", async function () {
      await expect(
        registry.connect(patient).registerRecord(
          makeId("security-record-003"),
          makeId("security-content-003"),
          patient.address
        )
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });
  });

  describe("Access permission edge cases", function () {
    it("rejects zero patient and doctor addresses", async function () {
      const expiry = (await latestTimestamp()) + 3600;

      await expect(
        registry.grantAccess(
          ethers.ZeroAddress,
          doctor.address,
          expiry
        )
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");

      await expect(
        registry.grantAccess(
          patient.address,
          ethers.ZeroAddress,
          expiry
        )
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");

      await expect(
        registry.revokeAccess(
          ethers.ZeroAddress,
          doctor.address
        )
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");

      await expect(
        registry.revokeAccess(
          patient.address,
          ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });

    it("updates an existing grant when the owner grants access again", async function () {
      const firstExpiry = (await latestTimestamp()) + 3600;
      const secondExpiry = firstExpiry + 3600;

      await registry.grantAccess(
        patient.address,
        doctor.address,
        firstExpiry
      );

      await registry.grantAccess(
        patient.address,
        doctor.address,
        secondExpiry
      );

      expect(
        await registry.accessExpiry(patient.address, doctor.address)
      ).to.equal(secondExpiry);

      expect(
        await registry.hasAccess(patient.address, doctor.address)
      ).to.equal(true);
    });

    it("allows access to be granted again after revocation", async function () {
      const expiry = (await latestTimestamp()) + 3600;

      await registry.grantAccess(
        patient.address,
        doctor.address,
        expiry
      );

      await registry.revokeAccess(
        patient.address,
        doctor.address
      );

      expect(
        await registry.hasAccess(patient.address, doctor.address)
      ).to.equal(false);

      const renewedExpiry = (await latestTimestamp()) + 7200;

      await registry.grantAccess(
        patient.address,
        doctor.address,
        renewedExpiry
      );

      expect(
        await registry.hasAccess(patient.address, doctor.address)
      ).to.equal(true);

      expect(
        await registry.accessExpiry(patient.address, doctor.address)
      ).to.equal(renewedExpiry);
    });

    it("keeps a grant inactive after its exact expiry timestamp", async function () {
      const expiry = (await latestTimestamp()) + 100;

      await registry.grantAccess(
        patient.address,
        doctor.address,
        expiry
      );

      await network.provider.send("evm_setNextBlockTimestamp", [expiry]);
      await network.provider.send("evm_mine");

      expect(
        await registry.hasAccess(patient.address, doctor.address)
      ).to.equal(false);

      expect(
        await registry.accessExpiry(patient.address, doctor.address)
      ).to.equal(expiry);
    });
  });

  describe("Ownership security", function () {
    it("prevents a non-owner from transferring ownership", async function () {
      await expect(
        registry.connect(other).transferOwnership(other.address)
      ).to.be.revertedWithCustomError(registry, "Unauthorized");

      expect(await registry.owner()).to.equal(owner.address);
    });
  });

  describe("Audit event validation", function () {
    it("emits the correct audit event fields", async function () {
      const eventId = makeId("security-audit-001");
      const eventType = makeId("EMERGENCY_ACCESS");
      const expiresAt = (await latestTimestamp()) + 1800;

      await expect(
        registry.recordAuditEvent(
          eventId,
          eventType,
          patient.address,
          doctor.address,
          expiresAt
        )
      )
        .to.emit(registry, "AuditEvent")
        .withArgs(
          eventId,
          eventType,
          patient.address,
          doctor.address,
          expiresAt,
          (timestamp) => timestamp > 0
        );
    });

    it("allows a valid audit event after an invalid attempt", async function () {
      const eventId = makeId("security-audit-002");
      const eventType = makeId("EMERGENCY_ACCESS");

      await expect(
        registry.recordAuditEvent(
          eventId,
          ethers.ZeroHash,
          patient.address,
          doctor.address,
          0
        )
      ).to.be.revertedWithCustomError(registry, "ZeroValue");

      await expect(
        registry.recordAuditEvent(
          eventId,
          eventType,
          patient.address,
          doctor.address,
          0
        )
      )
        .to.emit(registry, "AuditEvent")
        .withArgs(
          eventId,
          eventType,
          patient.address,
          doctor.address,
          0,
          (timestamp) => timestamp > 0
        );
    });
  });
});
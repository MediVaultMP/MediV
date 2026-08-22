const { expect } = require('chai');
const { ethers } = require('hardhat');

async function expectCustomError(promise, errorName) {
  try {
    await promise;
    expect.fail(`Expected ${errorName}`);
  } catch (error) {
    expect(error.message).to.include(errorName);
  }
}

describe('MediVaultRecordRegistry', function () {
  async function deployRegistry() {
    const [owner, patient, unauthorized] = await ethers.getSigners();
    const registry = await ethers.deployContract('MediVaultRecordRegistry');
    return { registry, owner, patient, unauthorized };
  }

  it('registers only opaque IDs, integrity hashes, and non-sensitive metadata', async function () {
    const { registry, owner, patient } = await deployRegistry();
    const recordId = ethers.id('medivault-record-opaque-1');
    const contentHash = ethers.sha256(ethers.toUtf8Bytes('sha256-digest-input'));
    const transaction = await registry.registerRecord(recordId, contentHash, patient.address);
    const receipt = await transaction.wait();
    expect(receipt.status).to.equal(1);
    expect(await registry.verifyRecord(recordId, contentHash)).to.equal(true);
    expect(await registry.verifyRecord(recordId, ethers.ZeroHash)).to.equal(false);
    const record = await registry.getRecord(recordId);
    expect(record.contentHash).to.equal(contentHash);
    expect(record.patient).to.equal(patient.address);
    expect(record.registrar).to.equal(owner.address);
    expect(Number(record.registeredAt)).to.be.greaterThan(0);
  });

  it('prevents unauthorized and duplicate registrations', async function () {
    const { registry, patient, unauthorized } = await deployRegistry();
    const recordId = ethers.id('medivault-record-opaque-2');
    const contentHash = ethers.sha256(ethers.toUtf8Bytes('digest'));
    await expectCustomError(registry.connect(unauthorized).registerRecord(recordId, contentHash, patient.address), 'Unauthorized');
    await registry.registerRecord(recordId, contentHash, patient.address);
    await expectCustomError(registry.registerRecord(recordId, contentHash, patient.address), 'RecordAlreadyRegistered');
  });

  it('grants expiring access and allows the owner to revoke it', async function () {
    const { registry, patient, unauthorized } = await deployRegistry();
    const latest = await ethers.provider.getBlock('latest');
    const expiry = BigInt(latest.timestamp + 3600);
    await registry.grantAccess(patient.address, unauthorized.address, expiry);
    expect(await registry.hasAccess(patient.address, unauthorized.address)).to.equal(true);
    expect(await registry.accessExpiry(patient.address, unauthorized.address)).to.equal(expiry);
    await registry.revokeAccess(patient.address, unauthorized.address);
    expect(await registry.hasAccess(patient.address, unauthorized.address)).to.equal(false);
  });

  it('prevents non-owners from granting access', async function () {
    const { registry, patient, unauthorized } = await deployRegistry();
    const latest = await ethers.provider.getBlock('latest');
    await expectCustomError(
      registry.connect(unauthorized).grantAccess(patient.address, unauthorized.address, BigInt(latest.timestamp + 3600)),
      'Unauthorized'
    );
  });
});

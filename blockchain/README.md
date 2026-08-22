# MediVault integrity contract

`MediVaultRecordRegistry` registers a unique opaque record identifier, the record's SHA-256 digest, a patient wallet address, registrar address, and timestamp. It stores no medical files, filenames, clinical metadata, encrypted data keys, or personal profile data.

## Commands

Run these from `blockchain/`:

```sh
npm install
npm test
npm run deploy:local
```

`deploy:local` targets Hardhat's ephemeral local network and prints a deployment manifest (address, chain ID, transaction hash, block number, owner).

## Persistent testnet deployment

1. Copy `.env.example` to `.env` inside this `blockchain/` directory.
2. Set `BLOCKCHAIN_RPC_URL` and `BLOCKCHAIN_DEPLOYER_PRIVATE_KEY` for a dedicated low-balance deployer wallet.
3. Run `npm run deploy:testnet`.

The manifest printed by the script contains the contract address required by Phase 9's backend `ethers.js` integration. Never commit the `.env` file or reuse a personal wallet key.

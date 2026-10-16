const { Wallet } = require("ethers");
const crypto = require("crypto");
const fs = require("fs");
require("dotenv").config();

async function main() {
  // Doctor's private key from .env
  const privateKey = process.env.DOCTOR_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("DOCTOR_PRIVATE_KEY is missing from .env");
  }

  // Create doctor wallet
  const wallet = new Wallet(privateKey);

  // Your existing test PDF
  const filePath = "./test-record(2).pdf";

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileBuffer = fs.readFileSync(filePath);

  // Generate SHA-256 hash
  const contentSha256 = crypto
    .createHash("sha256")
    .update(fileBuffer)
    .digest("hex");

  // Sign the RAW hash bytes
  const signature = await wallet.signMessage(Buffer.from(contentSha256, "hex"));

  console.log("\n========== MEDIVAULT SIGNATURE ==========");
  console.log("Doctor wallet:");
  console.log(wallet.address);

  console.log("\nSHA-256:");
  console.log(contentSha256);

  console.log("\nSignature:");
  console.log(signature);

  console.log("\n=========================================");
}

main().catch(console.error);

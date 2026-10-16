const { verifyMessage, getBytes } = require("ethers");

const hash = "fabdf0fb267c1ef797c5e5a540ad9da0b20ed62165672a7e5b412ee31d14b845";
const signature =
  "0xc04eb9ba6f8bdb4655c508f340a0b874a08bcd2f5bd8d3dd8e06ff48617c4db4141d86ac8a6d59ff5a6de41264da1c3a0d4c0f0bbabf48c3b131eabce4799f071c";

const recovered = verifyMessage(getBytes(`0x${hash}`), signature);

console.log("Recovered wallet:", recovered);
console.log(
  "Matches expected wallet:",
  recovered.toLowerCase() ===
    "0xdfDcf0F1b1239b9c30a5980b763d2A25754581F9".toLowerCase(),
);

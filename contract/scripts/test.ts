/*
GABBUD Yann
December 2021
*/

import { providers } from "ethers";
import { ethers } from "hardhat";

async function main() {
  const provider = ethers.getDefaultProvider();
  const signers = await ethers.getSigners();
  const tixngo = signers[0];
  const seller = signers[1];
  const buyer = signers[2];

  // console.log((await tixngo.getBalance()).toString());
  // console.log((await seller.getBalance()).toString());
  // const tx = {
  //   from: tixngo.address,
  //   to: seller.address,
  //   value: ethers.utils.parseEther("1.0"),
  // };
  // await tixngo.sendTransaction(tx);
  // console.log((await tixngo.getBalance()).toString());
  // console.log((await seller.getBalance()).toString());

  const wallet = new ethers.Wallet('0x42');
  console.log(wallet.address)
  console.log(wallet.publicKey)
  console.log(wallet.privateKey)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

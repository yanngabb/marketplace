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

  // const Users = await ethers.getContractFactory("Users");
  // const users = await Users.deploy();
  // await users.deployed();

  // const Factory = await ethers.getContractFactory("Factory");
  // const factory = await Factory.deploy(1, users.address);
  // await factory.deployed();

  // await users.register(await users.ORGANIZER_GROUP());

  console.log((await tixngo.getBalance()).toString());
  console.log((await seller.getBalance()).toString());
  const tx = {
    from: tixngo.address,
    to: seller.address,
    value: ethers.utils.parseEther("1.0"),
  };
  await tixngo.sendTransaction(tx);
  console.log((await tixngo.getBalance()).toString());
  console.log((await seller.getBalance()).toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

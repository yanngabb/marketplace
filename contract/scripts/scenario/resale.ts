/*
GABBUD Yann
December 2021
*/

import { ethers } from "hardhat";

async function main() {
  /*
  init
  */

  // get the default provider
  const provider = ethers.getDefaultProvider();

  // get first default account
  const [account] = await ethers.getSigners();

  // TODO
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

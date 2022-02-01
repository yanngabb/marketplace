/*
GABBUD Yann
December 2021
*/

import { ethers } from "hardhat";
import { PerformanceObserver, performance } from "perf_hooks";

async function main() {
  const provider = ethers.getDefaultProvider();
  const signers = await ethers.getSigners();
  const identifier = signers[0];
  const spectator = signers[1];
  const batchSize = 10000;
  
  // single hash
  let startTime = performance.now();
  for(let i = 0; i < batchSize; i++ ) {
    let hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes32"],
        [spectator.address, ethers.utils.formatBytes32String("SPECTATOR_GROUP")]
      )
    );
  }
  let endTime = performance.now();
  console.log(`Time to compute ${batchSize} hashes: ${(endTime - startTime)} milliseconds`)
  console.log(`Average time to compute a single hashe: ${(endTime - startTime) / batchSize} milliseconds`)

  // single signature
  let hash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["address", "bytes32"],
      [spectator.address, ethers.utils.formatBytes32String("SPECTATOR_GROUP")]
    )
  );
  startTime = performance.now();
  for(let i = 0; i < batchSize; i++ ) {
    let signature = await identifier.signMessage(ethers.utils.arrayify(hash));
  }
  endTime = performance.now();
  console.log(`Time to compute ${batchSize} signatures: ${(endTime - startTime)} milliseconds`)
  console.log(`Average time to compute a single signature: ${(endTime - startTime) / batchSize} milliseconds`)
  
  // single hash + signature
  startTime = performance.now();
  for(let i = 0; i < batchSize; i++ ) {
    let hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes32"],
        [spectator.address, ethers.utils.formatBytes32String("SPECTATOR_GROUP")]
      )
    );
    let signature = await identifier.signMessage(ethers.utils.arrayify(hash));
  }
  endTime = performance.now();
  console.log(`Time to compute ${batchSize} hashes + signatures: ${(endTime - startTime)} milliseconds`)
  console.log(`Average time to compute a single hash + signature: ${(endTime - startTime) / batchSize} milliseconds`)
}



main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

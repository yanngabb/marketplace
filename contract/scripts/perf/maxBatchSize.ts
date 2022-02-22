/*
GABBUD Yann
December 2021
*/

import { BigNumber, BigNumberish } from "ethers";
import { ethers } from "hardhat";
import { join } from "path/posix";
import { PerformanceObserver, performance } from "perf_hooks";

async function main() {
  const provider = ethers.getDefaultProvider();
  const signers = await ethers.getSigners();
  const tixngo = signers[0]
  const identifier = signers[1];
  const priceFeed = signers[2];
  const spectator = signers[3]

  const decimals = 18;
  
  const TIX = await ethers.getContractFactory("TIX");
  const tix = await TIX.deploy(
    "TIX token",
    "TIX",
    priceFeed.address,
    ethers.utils.parseUnits("0.00000001", decimals),
    ethers.utils.parseUnits("0.00000001", decimals)
  );
  await tix.deployed();

  const Identity = await ethers.getContractFactory("Identity");
  const identity = await Identity.deploy(identifier.address);
  await identity.deployed();

  const Ticketing = await ethers.getContractFactory("Ticketing");
  const ticketing = await Ticketing.deploy(
    identity.address,
    tix.address,
    tixngo.address
  );

  // register organizer
  let group = await identity.ORGANIZER_GROUP();
  let hash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["address", "bytes32"],
      [tixngo.address, group]
    )
  );
  let signature = await identifier.signMessage(ethers.utils.arrayify(hash));
  await identity.register(group, hash, signature);

  // register spectator
  group = await identity.SPECTATOR_GROUP();
  hash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["address", "bytes32"],
      [spectator.address, group]
    )
  );
  signature = await identifier.signMessage(ethers.utils.arrayify(hash));
  const spectatorIdentity = identity.connect(spectator);
  await spectatorIdentity.register(group, hash, signature);

  // get tix and increase allowance
  const amount = ethers.utils.parseUnits("1000", decimals);
  await tix.buy({ value: amount });
  tix.increaseAllowance(ticketing.address, amount);

  // register event
  const now = Date.now();
  const nowPlusOneYear = now + 1000000;
  const state = await ticketing.EVENT_OPEN();
  await ticketing.registerEvent(
    "test",
    "test",
    BigNumber.from(now),
    BigNumber.from(nowPlusOneYear),
    state
  );

  /*
  tests
  */
  const maxBatchSize = await ticketing.BATCH_LIMIT();
  let ticketIds: BigNumberish[];
  let owners: any[];
  
  // max mint batch
  console.log("Start searching max mint batch size");
  for(let i = 250; i < maxBatchSize; i += 10) {
    ticketIds = Array(i - 1 + 1)
      .fill(0)
      .map((_, idx) => 1 + idx);
    owners = Array(i).fill(spectator.address);
    console.log(`Try batch of size ${i}`)
    await ticketing.mintBatch(1, ticketIds, owners);
    console.log(`Mint batch size of ${i} supported`)
  }

  // max batch burn
  console.log("Start searching max burn batch size");
  let index = 0
  for(let i = 900; i < maxBatchSize; i = i + 10) {
    ticketIds = Array(i)
      .fill(0)
      .map((_, idx) => 1 + idx + index);
    index += i;
    owners = Array(i).fill(spectator.address);
    for(let j = 0; j < i; j += 300) {
      let k = 0;
      let l = 0;
      if (i - j < 300) {
        k = i;
        l = i - j;
      } else {
        k = j + 300
        l = 300
      }
      await ticketing.mintBatch(1, ticketIds.slice(j, k), owners.slice(0, l));
    }
    console.log(`Try batch of size ${i}`)
    await ticketing.burnBatch(ticketIds);
    console.log(`Burn batch size of ${i} supported`)
  }

  // max batch token update
  console.log("Start searching max update state batch size");
  let index = 0
  let states: any[];
  for(let i = 300; i < maxBatchSize; i = i + 10) {
    ticketIds = Array(i)
      .fill(0)
      .map((_, idx) => 1 + idx + index);
    index += i;
    owners = Array(i).fill(spectator.address);
    states = Array(i).fill(await ticketing.TOKEN_CLAIMED());
    for(let j = 0; j < i; j += 300) {
      let k = 0;
      let l = 0;
      if (i - j < 300) {
        k = i;
        l = i - j;
      } else {
        k = j + 300
        l = 300
      }
      await ticketing.mintBatch(1, ticketIds.slice(j, k), owners.slice(0, l));
    }
    console.log(`Try batch of size ${i}`)
    await ticketing.updateTokenStateBatch(ticketIds, states);
    console.log(`Update state batch size of ${i} supported`)
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

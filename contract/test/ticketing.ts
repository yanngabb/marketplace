/*
GABBUD Yann
November 2021
*/

import { BigNumberish } from "@ethersproject/bignumber";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { arrayify, randomBytes } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { Identity, TIX, Ticketing } from "../typechain";

describe("Ticketing", function () {
  let signers;
  let tixngo: SignerWithAddress;
  let spectator1: SignerWithAddress;
  let spectator2: SignerWithAddress;
  let organizer: SignerWithAddress;
  let identifier: SignerWithAddress;
  let approver: SignerWithAddress;
  let priceFeed: SignerWithAddress;

  let TIX;
  let tix: TIX;
  let organizerTix: TIX;
  let Identity;
  let identity: Identity;
  let Ticketing;
  let ticketing: Ticketing;
  let organizerTicketing: Ticketing;
  let spectator1Ticketing: Ticketing;

  const decimals = 18;
  const precision = ethers.utils.parseUnits("1", decimals);
  const INITIAL_TOKEN_AMOUNT = precision.mul(10000);
  const EVENT_REGISTRATION_FEE = precision.mul(1000);
  const MINTING_FEE = precision.mul(1);
  const batchSize = 100;
  let ticketIds: BigNumberish[];
  let owners: any[];

  beforeEach(async function () {
    signers = await ethers.getSigners();
    tixngo = signers[0];
    spectator1 = signers[1];
    spectator2 = signers[2];
    organizer = signers[3];
    identifier = signers[4];
    approver = signers[5];
    priceFeed = signers[6];

    TIX = await ethers.getContractFactory("TIX");
    tix = await TIX.deploy(
      "TIX token",
      "TIX",
      priceFeed.address,
      ethers.utils.parseUnits("1", decimals),
      ethers.utils.parseUnits("1", decimals)
    );
    await tix.deployed();

    Identity = await ethers.getContractFactory("Identity");
    identity = await Identity.deploy(identifier.address);
    await identity.deployed();

    Ticketing = await ethers.getContractFactory("Ticketing");
    ticketing = await Ticketing.deploy(
      identity.address,
      tix.address,
      tixngo.address
    );

    // organizer
    const organizerIdentity = identity.connect(organizer);
    let group = await organizerIdentity.ORGANIZER_GROUP();
    let hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes32"],
        [organizer.address, group]
      )
    );
    let signature = await identifier.signMessage(ethers.utils.arrayify(hash));
    await organizerIdentity.register(group, hash, signature);
    expect(await identity.isRegistered(organizer.address)).to.equal(true);

    organizerTix = tix.connect(organizer);
    await organizerTix.buy({ value: 10000 });
    expect(await tix.balanceOf(organizer.address)).to.equal(
      INITIAL_TOKEN_AMOUNT
    );

    organizerTicketing = ticketing.connect(organizer);

    // spectator1
    const spectator1Identity = identity.connect(spectator1);
    group = await organizerIdentity.SPECTATOR_GROUP();
    hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes32"],
        [spectator1.address, group]
      )
    );
    signature = await identifier.signMessage(ethers.utils.arrayify(hash));
    await spectator1Identity.register(group, hash, signature);
    expect(await identity.isRegistered(spectator1.address)).to.equal(true);

    spectator1Ticketing = ticketing.connect(spectator1);

    // spectator2
    const spectator2Identity = identity.connect(spectator2);
    group = await organizerIdentity.SPECTATOR_GROUP();
    hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes32"],
        [spectator2.address, group]
      )
    );
    signature = await identifier.signMessage(ethers.utils.arrayify(hash));
    await spectator2Identity.register(group, hash, signature);
    expect(await identity.isRegistered(spectator2.address)).to.equal(true);

    // data
    ticketIds = Array(100 - 1 + 1)
      .fill(0)
      .map((_, idx) => 1 + idx);
    owners = Array(batchSize).fill(spectator1.address);
  });

  it("Should allow an organizer to register an event", async function () {
    organizerTix.increaseAllowance(ticketing.address, EVENT_REGISTRATION_FEE);
    const now = Date.now();
    const nowPlusOneYear = now + 1000000;
    const state = await organizerTicketing.EVENT_OPEN();
    await organizerTicketing.registerEvent(
      "test",
      "test",
      BigNumber.from(now),
      BigNumber.from(nowPlusOneYear),
      state
    );
    expect(await ticketing.isExistingEvent(1)).to.equal(true);
    expect(await tix.balanceOf(organizer.address)).to.equal(
      INITIAL_TOKEN_AMOUNT.sub(EVENT_REGISTRATION_FEE)
    );
    expect(await tix.balanceOf(tixngo.address)).to.equal(
      EVENT_REGISTRATION_FEE
    );
    const event = await ticketing.getEvent(1);
    expect(event.organizer).to.equal(organizer.address);
    expect(event.name).to.equal("test");
    expect(event.place).to.equal("test");
    expect(event.openingDate).to.equal(now);
    expect(event.closingDate).to.equal(nowPlusOneYear);
    expect(event.state).to.equal(state);
  });

  it("Should prevent a user that is not an organizer to register an event", async function () {
    await expect(
      ticketing.registerEvent(
        "test",
        "test",
        1,
        1,
        await organizerTicketing.EVENT_OPEN()
      )
    ).to.be.revertedWith(
      "The user registring a new event must be an organizer"
    );
  });

  it("Should prevent an organizer to register an event with a closing date ealier than the opening date", async function () {
    await expect(
      organizerTicketing.registerEvent(
        "test",
        "test",
        2,
        1,
        await organizerTicketing.EVENT_OPEN()
      )
    ).to.be.revertedWith("The opening date cannot be after the closing date");
  });

  it("Should prevent an organizer to register an event if not enough TIX has been approved", async function () {
    await expect(
      organizerTicketing.registerEvent(
        "test",
        "test",
        1,
        2,
        await organizerTicketing.EVENT_OPEN()
      )
    ).to.be.revertedWith("Not enough funds to perfom this operation");
  });

  it("Should prevent an organizer to create an event with a not valid state", async function () {
    organizerTix.increaseAllowance(ticketing.address, EVENT_REGISTRATION_FEE);
    await expect(
      organizerTicketing.registerEvent(
        "test",
        "test",
        1,
        2,
        await organizerTicketing.EVENT_CANCELLED()
      )
    ).to.be.revertedWith("The state is not valid");
  });

  it("Should allow an organizer to update the state of an event", async function () {
    organizerTix.increaseAllowance(ticketing.address, EVENT_REGISTRATION_FEE);
    let now = Date.now();
    let nowPlusOneYear = now + 1000000;
    await organizerTicketing.registerEvent(
      "test",
      "test",
      BigNumber.from(now),
      BigNumber.from(nowPlusOneYear),
      await organizerTicketing.EVENT_PENDING()
    );
    expect((await ticketing.getEvent(1)).state).to.equal(
      await ticketing.EVENT_PENDING()
    );
    await organizerTicketing.updateEventState(
      1,
      await organizerTicketing.EVENT_OPEN()
    );
    expect((await ticketing.getEvent(1)).state).to.equal(
      await ticketing.EVENT_OPEN()
    );
  });

  it("Should prevent an organizer to update an event that does not exist", async function () {
    await expect(
      organizerTicketing.updateEventState(
        1,
        await organizerTicketing.EVENT_OPEN()
      )
    ).to.be.revertedWith("The event id does not exist");
  });

  it("Should prevent an organizer from updating an event they do not own", async function () {
    organizerTix.increaseAllowance(ticketing.address, EVENT_REGISTRATION_FEE);
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_PENDING()
    );
    await expect(
      ticketing.updateEventState(1, await ticketing.EVENT_OPEN())
    ).to.be.revertedWith(
      "Only the organizer of the event can perform this operation"
    );
  });

  it("Should prevent an organizer to update an event with a not valid state", async function () {
    organizerTix.increaseAllowance(ticketing.address, EVENT_REGISTRATION_FEE);
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_PENDING()
    );
    await expect(
      organizerTicketing.updateEventState(
        1,
        ethers.utils.formatBytes32String("WRONG_EVENT_STATE")
      )
    ).to.be.revertedWith("The state is not valid");
  });

  it("Should allow the organizer to mint a token", async function () {
    const fee = EVENT_REGISTRATION_FEE.add(MINTING_FEE);
    organizerTix.increaseAllowance(ticketing.address, fee);
    const now = Date.now();
    const nowPlusOneYear = now + 1000000;
    await organizerTicketing.registerEvent(
      "test",
      "test",
      BigNumber.from(now),
      BigNumber.from(nowPlusOneYear),
      await organizerTicketing.EVENT_OPEN()
    );
    await organizerTicketing.mint(1, 1, spectator1.address);
    expect(await ticketing.ownerOf(1)).to.equal(spectator1.address);
    expect(await tix.balanceOf(tixngo.address)).to.equal(fee);
    expect(await tix.balanceOf(organizer.address)).to.equal(
      INITIAL_TOKEN_AMOUNT.sub(fee)
    );
    const token = await ticketing.getToken(1);
    expect(token.eventId).to.equal(1);
    expect(token.ticketId).to.equal(1);
    expect(token.state).to.equal(await organizerTicketing.TOKEN_VALID());
  });

  it("Should prevent the organizer to mint a token for an event that does not exist", async function () {
    await expect(
      organizerTicketing.mint(1, 1, spectator1.address)
    ).to.be.revertedWith("The event id does not exist");
  });

  it("Should prevent an organizer to mint a token for an event they do not own", async function () {
    organizerTix.increaseAllowance(ticketing.address, EVENT_REGISTRATION_FEE);
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_OPEN()
    );
    await expect(ticketing.mint(1, 1, spectator1.address)).to.be.revertedWith(
      "Only the organizer of the event can perform this operation"
    );
  });

  it("Should prevent an organizer to mint a token for a user that is not registered as a spectator", async function () {
    organizerTix.increaseAllowance(
      ticketing.address,
      EVENT_REGISTRATION_FEE.add(MINTING_FEE)
    );
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_OPEN()
    );
    await expect(
      organizerTicketing.mint(1, 1, tixngo.address)
    ).to.be.revertedWith("The owner of the ticket must be registered");
  });

  it("Should prevent an organizer ot mint a token if they do not have enough funds to pay the fee", async function () {
    organizerTix.increaseAllowance(ticketing.address, EVENT_REGISTRATION_FEE);
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_OPEN()
    );
    await expect(
      organizerTicketing.mint(1, 1, spectator1.address)
    ).to.be.revertedWith("Not enough funds to perfom this operation");
  });

  it("Should allow an organizer to mint a batch of tokens", async function () {
    const fee = EVENT_REGISTRATION_FEE.add(MINTING_FEE.mul(batchSize));
    organizerTix.increaseAllowance(ticketing.address, fee);
    let now = Date.now();
    let nowPlusOneYear = now + 1000000;
    await organizerTicketing.registerEvent(
      "test",
      "test",
      BigNumber.from(now),
      BigNumber.from(nowPlusOneYear),
      await organizerTicketing.EVENT_OPEN()
    );
    await organizerTicketing.mintBatch(1, ticketIds, owners);
    expect(await ticketing.ownerOf(1)).to.equal(spectator1.address);
    expect(await tix.balanceOf(tixngo.address)).to.equal(fee);
    expect(await tix.balanceOf(organizer.address)).to.equal(
      INITIAL_TOKEN_AMOUNT.sub(fee)
    );
  });

  it("Should prevent an organizer to mint a batch of tokens for an event that does not exist", async function () {
    await expect(
      organizerTicketing.mintBatch(1, ticketIds, owners)
    ).to.be.revertedWith("The event id does not exist");
  });

  it("Should prevent an organizer to mint a batch of tokens for an event they do not own", async function () {
    organizerTix.increaseAllowance(ticketing.address, EVENT_REGISTRATION_FEE);
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_OPEN()
    );
    await expect(ticketing.mintBatch(1, ticketIds, owners)).to.be.revertedWith(
      "Only the organizer of the event can perform this operation"
    );
  });

  it("Should prevent an organizer to mint a batch with a size bigger than 100", async function () {
    organizerTix.increaseAllowance(ticketing.address, EVENT_REGISTRATION_FEE);
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_OPEN()
    );
    await expect(
      organizerTicketing.mintBatch(
        1,
        ticketIds.concat(100),
        owners.concat(spectator1.address)
      )
    ).to.be.revertedWith("The batch is too big. BATCH_LIMIT = 100");
  });

  it("Should prevent an organizer to mint a batch of token if the ticketIds array size is not equal to the owners array size", async function () {
    organizerTix.increaseAllowance(ticketing.address, EVENT_REGISTRATION_FEE);
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_OPEN()
    );
    await expect(
      organizerTicketing.mintBatch(1, ticketIds.slice(0, 50), owners)
    ).to.be.revertedWith(
      "The owners array and the ticketIds array do not have the same lenght"
    );
  });

  it("Should prevent an organizer to mint a batch of token if they do not have enough funds to pay the fee", async function () {
    organizerTix.increaseAllowance(ticketing.address, EVENT_REGISTRATION_FEE);
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_OPEN()
    );
    await expect(
      organizerTicketing.mintBatch(1, ticketIds, owners)
    ).to.be.revertedWith("Not enough funds to perfom this operation");
  });

  it("Should allow the organizer to burn a token", async function () {
    const fee = EVENT_REGISTRATION_FEE.add(MINTING_FEE);
    organizerTix.increaseAllowance(ticketing.address, fee);
    let now = Date.now();
    let nowPlusOneYear = now + 1000000;
    await organizerTicketing.registerEvent(
      "test",
      "test",
      BigNumber.from(now),
      BigNumber.from(nowPlusOneYear),
      await organizerTicketing.EVENT_OPEN()
    );
    await organizerTicketing.mint(1, 1, spectator1.address);
    await organizerTicketing.burn(1);
    expect(await ticketing.balanceOf(spectator1.address)).to.equal(0);
  });

  it("Should prevent an organizer to burn a token they do not have minted", async function () {
    organizerTix.increaseAllowance(ticketing.address, EVENT_REGISTRATION_FEE.add(MINTING_FEE));
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_OPEN()
    );
    await organizerTicketing.mint(1, 1, spectator1.address);
    await expect(ticketing.burn(1)).to.be.revertedWith(
      "Only the minter of the token can perform this operation"
    );
  });

  it("Should allow an organizer to burn a batch of tokens", async function () {
    const fee = EVENT_REGISTRATION_FEE.add(MINTING_FEE.mul(batchSize));
    organizerTix.increaseAllowance(ticketing.address, fee);
    let now = Date.now();
    let nowPlusOneYear = now + 1000000;
    await organizerTicketing.registerEvent(
      "test",
      "test",
      BigNumber.from(now),
      BigNumber.from(nowPlusOneYear),
      await organizerTicketing.EVENT_OPEN()
    );
    await organizerTicketing.mintBatch(1, ticketIds, owners);
    await organizerTicketing.burnBatch(ticketIds);
    expect(await ticketing.balanceOf(spectator1.address)).to.equal(0);
  });

  it("Should prevent an organizer to burn a batch of tokens they do not have minted", async function () {
    const fee = EVENT_REGISTRATION_FEE.add(MINTING_FEE.mul(batchSize));
    organizerTix.increaseAllowance(ticketing.address, fee);
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_OPEN()
    );
    await organizerTicketing.mintBatch(1, ticketIds, owners);
    await expect(ticketing.burnBatch(ticketIds)).to.be.revertedWith(
      "Only the minter of the token can perform this operation"
    );
  });

  it("Should prevent an organizer to burn a batch of token with a size bigger than 100", async function () {
    organizerTix.increaseAllowance(ticketing.address, EVENT_REGISTRATION_FEE);
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_OPEN()
    );
    await expect(
      organizerTicketing.burnBatch(ticketIds.concat(100))
    ).to.be.revertedWith("The batch is too big. BATCH_LIMIT = 100");
  });

  it("Should allow the organizer to update the state of a token", async function () {
    const fee = EVENT_REGISTRATION_FEE.add(MINTING_FEE);
    organizerTix.increaseAllowance(ticketing.address, fee);
    let now = Date.now();
    let nowPlusOneYear = now + 1000000;
    await organizerTicketing.registerEvent(
      "test",
      "test",
      BigNumber.from(now),
      BigNumber.from(nowPlusOneYear),
      await organizerTicketing.EVENT_OPEN()
    );
    await organizerTicketing.mint(1, 1, spectator1.address);
    const newState = await organizerTicketing.TOKEN_SCANNED();
    await organizerTicketing.updateTokenState(1, newState);
    expect((await ticketing.getToken(1)).state).to.equal(newState);
  });

  it("Should prevent an organizer to update the state of a token they do not have minted", async function () {
    organizerTix.increaseAllowance(ticketing.address, EVENT_REGISTRATION_FEE.add(MINTING_FEE));
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_OPEN()
    );
    await organizerTicketing.mint(1, 1, spectator1.address);
    const newState = await ticketing.TOKEN_SCANNED();
    await expect(ticketing.updateTokenState(1, newState)).to.be.revertedWith(
      "Only the minter of the token can perform this operation"
    );
  });

  it("Should prevent an organizer to update the state of a token that does not exists", async function () {
    organizerTix.increaseAllowance(ticketing.address, EVENT_REGISTRATION_FEE.add(MINTING_FEE));
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_OPEN()
    );
    const newState =  await ticketing.TOKEN_SCANNED();
    await expect(organizerTicketing.updateTokenState(1, newState)).to.be.revertedWith(
      "The token does not exists"
    );
  });

  it("Should prevent an organizer to update a token with a state that is not valid", async function () {
    organizerTix.increaseAllowance(ticketing.address, EVENT_REGISTRATION_FEE.add(MINTING_FEE));
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_OPEN()
    );
    await organizerTicketing.mint(1, 1, spectator1.address);
    const newState = ethers.utils.formatBytes32String("WRONG_TICKET_STATE")
    await expect(organizerTicketing.updateTokenState(1, newState)).to.be.revertedWith(
      "The state is not valid"
    );
  });

  it("Should allow an organizer to update the state of a batch of tokens", async function () {
    const fee = EVENT_REGISTRATION_FEE.add(MINTING_FEE.mul(batchSize));
    organizerTix.increaseAllowance(ticketing.address, fee);
    let now = Date.now();
    let nowPlusOneYear = now + 1000000;
    await organizerTicketing.registerEvent(
      "test",
      "test",
      BigNumber.from(now),
      BigNumber.from(nowPlusOneYear),
      await organizerTicketing.EVENT_OPEN()
    );
    await organizerTicketing.mintBatch(1, ticketIds, owners);
    const newState =  await ticketing.TOKEN_SCANNED();
    const states = Array(batchSize).fill(newState);
    await organizerTicketing.updateTokenStateBatch(ticketIds, states);
    expect((await ticketing.getToken(1)).state).to.equal(newState);
    expect((await ticketing.getToken(batchSize / 2)).state).to.equal(newState);
    expect((await ticketing.getToken(batchSize - 1)).state).to.equal(newState);
  });

  it("Should prevent an organizer to update a batch of tokens they do not have minted", async function () {
    const fee = EVENT_REGISTRATION_FEE.add(MINTING_FEE.mul(batchSize));
    organizerTix.increaseAllowance(ticketing.address, fee);
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_OPEN()
    );
    await organizerTicketing.mintBatch(1, ticketIds, owners);
    const newState =  await ticketing.TOKEN_SCANNED();
    const states = Array(batchSize).fill(newState);
    await expect(ticketing.updateTokenStateBatch(ticketIds, states)).to.be.revertedWith(
      "Only the minter of the token can perform this operation"
    );
  });

  it("Should prevent an organizer to update the state of a batch of token with a size bigger than 100", async function () {
    organizerTix.increaseAllowance(ticketing.address, EVENT_REGISTRATION_FEE);
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_OPEN()
    );
    const newState =  await ticketing.TOKEN_SCANNED();
    const states = Array(batchSize + 1).fill(newState);
    await expect(organizerTicketing.updateTokenStateBatch(ticketIds.concat(100), states)).to.be.revertedWith(
      "The batch is too big. BATCH_LIMIT = 100"
    );
  });

  it("Should prevent an organizer to update the state of a batch of token if the ticketIds array size is not equal to the states array size", async function () {
    organizerTix.increaseAllowance(ticketing.address, EVENT_REGISTRATION_FEE);
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_OPEN()
    );
    const newState =  await ticketing.TOKEN_SCANNED();
    const states = Array(batchSize - 1).fill(newState);
    await expect(organizerTicketing.updateTokenStateBatch(ticketIds, states)).to.be.revertedWith(
      "The tokenIds array and the states array do not have the same lenght"
    );
  });

  it("Should allow a spectator to transfer a token", async function () {
    const fee = EVENT_REGISTRATION_FEE.add(MINTING_FEE);
    organizerTix.increaseAllowance(ticketing.address, fee);
    const now = Date.now();
    const nowPlusOneYear = now + 1000000;
    await organizerTicketing.registerEvent(
      "test",
      "test",
      BigNumber.from(now),
      BigNumber.from(nowPlusOneYear),
      await organizerTicketing.EVENT_OPEN()
    );
    await organizerTicketing.mint(1, 1, spectator1.address);
    await spectator1Ticketing.transferFrom(
      spectator1.address,
      spectator2.address,
      1
    );
    expect(await ticketing.ownerOf(1)).to.equal(spectator2.address);
  });

  it("Should prevent a spectator to transfer a token to a spectator that is not registered", async function () {
    const fee = EVENT_REGISTRATION_FEE.add(MINTING_FEE);
    organizerTix.increaseAllowance(ticketing.address, fee);
    const now = Date.now();
    const nowPlusOneYear = now + 1000000;
    await organizerTicketing.registerEvent(
      "test",
      "test",
      BigNumber.from(now),
      BigNumber.from(nowPlusOneYear),
      await organizerTicketing.EVENT_OPEN()
    );
    await organizerTicketing.mint(1, 1, spectator1.address);
    await expect(
      spectator1Ticketing.transferFrom(spectator1.address, tixngo.address, 1)
    ).to.be.revertedWith(
      "You cannot transfer a ticket to an unregisterd address"
    );
  });

  it("Should prevent a spectator to transfer a token if the event is over", async function () {
    const fee = EVENT_REGISTRATION_FEE.add(MINTING_FEE);
    organizerTix.increaseAllowance(ticketing.address, fee);
    const now = Math.floor(Date.now() / 1000) - 2
    const nowPlusOneYear = now + 1;
    await organizerTicketing.registerEvent(
      "test",
      "test",
      BigNumber.from(now),
      BigNumber.from(nowPlusOneYear),
      await organizerTicketing.EVENT_OPEN()
    );
    await organizerTicketing.mint(1, 1, spectator1.address);
    await expect(
      spectator1Ticketing.transferFrom(spectator1.address, spectator2.address, 1)
    ).to.be.revertedWith(
      "Transfer impossible. The event is already started"
    );
  });

  it("Should prevent a spectator to transfer a token if the event is not yet opened or the event is cancelled", async function () {
    const fee = EVENT_REGISTRATION_FEE.add(MINTING_FEE);
    organizerTix.increaseAllowance(ticketing.address, fee);
    const now = Math.floor(Date.now() / 1000) + 1000000
    const nowPlusOneYear = now + 100000000000;
    await organizerTicketing.registerEvent(
      "test",
      "test",
      BigNumber.from(now),
      BigNumber.from(nowPlusOneYear),
      await organizerTicketing.EVENT_PENDING()
    );
    await organizerTicketing.mint(1, 1, spectator1.address);
    await expect(
      spectator1Ticketing.transferFrom(spectator1.address, spectator2.address, 1)
    ).to.be.revertedWith(
      "Transfer impossible. The event is not yet open or cancelled"
    );
  });

  it("Should prevent a spectator to transfer a token that is not in a valid state", async function () {
    const fee = EVENT_REGISTRATION_FEE.add(MINTING_FEE);
    organizerTix.increaseAllowance(ticketing.address, fee);
    const now = Math.floor(Date.now() / 1000) + 1000000
    const nowPlusOneYear = now + 100000000000;
    await organizerTicketing.registerEvent(
      "test",
      "test",
      BigNumber.from(now),
      BigNumber.from(nowPlusOneYear),
      await organizerTicketing.EVENT_OPEN()
    );
    await organizerTicketing.mint(1, 1, spectator1.address);
    await organizerTicketing.updateTokenState(1, await organizerTicketing.TOKEN_INVALID());
    await expect(
      spectator1Ticketing.transferFrom(spectator1.address, spectator2.address, 1)
    ).to.be.revertedWith(
      "Transfer impossible, the token state is not valid"
    );
  });

  it("Should allow anbody to check if an event exists", async function () {
    const fee = EVENT_REGISTRATION_FEE;
    organizerTix.increaseAllowance(ticketing.address, fee);
    await organizerTicketing.registerEvent(
      "test",
      "test",
      1,
      2,
      await organizerTicketing.EVENT_OPEN()
    );
    expect(await ticketing.isExistingEvent(1)).to.equal(true);
  });

  it("Should return false if someone is asking if an unregistered event exists", async function () {
    expect(await ticketing.isExistingEvent(1)).to.equal(false);
  });
});
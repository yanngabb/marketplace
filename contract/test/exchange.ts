/*
GABBUD Yann
November 2021
*/

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { Identity, TIX, Ticketing, Exchange } from "../typechain";

describe("Exchange", function () {
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
  let spectator1Tix: TIX;
  let spectator2Tix: TIX;
  let Identity;
  let identity: Identity;
  let Ticketing;
  let ticketing: Ticketing;
  let organizerTicketing: Ticketing;
  let spectator1Ticketing: Ticketing;
  let spectator2Ticketing: Ticketing;
  let Exchange;
  let exchange: Exchange;
  let spectator1Exchange: Exchange;
  let spectator2Exchange: Exchange;

  const decimals = 18;
  const precision = ethers.utils.parseUnits("1", decimals);
  const INITIAL_TOKEN_AMOUNT = precision.mul(10000);
  const EVENT_REGISTRATION_FEE = precision.mul(1000);
  const MINTING_FEE = precision.mul(1);
  const PRICE = 100;

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

    Exchange = await ethers.getContractFactory("Exchange");
    exchange = await Exchange.deploy(
      1,
      identity.address,
      ticketing.address,
      tix.address,
      approver.address,
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

    spectator1Exchange = exchange.connect(spectator1);

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

    spectator2Tix = tix.connect(spectator2);
    await spectator2Tix.buy({ value: 10000 });
    expect(await tix.balanceOf(spectator2.address)).to.equal(
      INITIAL_TOKEN_AMOUNT
    );

    spectator2Ticketing = ticketing.connect(spectator2);

    spectator2Exchange = exchange.connect(spectator2);
  });

  it("Should allow a spectator to put a ticket on resale", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, PRICE, spectator2.address]
      )
    );
    const signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await spectator1Exchange.createResale(
      1,
      PRICE,
      spectator2.address,
      hash,
      signature
    );
    const resale = await exchange.getResale(1);
    expect(resale.price).to.equal(PRICE);
    expect(resale.optionalBuyer).to.equal(spectator2.address);
  });

  it("Should prevent a spectator to put a token on resale if the token is already on resale", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, PRICE, ethers.constants.AddressZero]
      )
    );
    const signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await spectator1Exchange.createResale(
      1,
      PRICE,
      ethers.constants.AddressZero,
      hash,
      signature
    );
    await expect(
      spectator1Exchange.createResale(
        1,
        PRICE,
        ethers.constants.AddressZero,
        hash,
        signature
      )
    ).to.be.revertedWith("The token is already on resale");
  });

  it("Should prevent a spectator to put a token on resale if the token is already on swap", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    let hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, 1, ethers.constants.AddressZero]
      )
    );
    let signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await spectator1Exchange.createSwap(
      1,
      1,
      ethers.constants.AddressZero,
      hash,
      signature
    );
    hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, PRICE, ethers.constants.AddressZero]
      )
    );
    signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await expect(
      spectator1Exchange.createResale(
        1,
        PRICE,
        ethers.constants.AddressZero,
        hash,
        signature
      )
    ).to.be.revertedWith("The token is already on swap");
  });

  it("Should prevent a spectator to put a token on resale if they are not the owner of the token", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, PRICE, ethers.constants.AddressZero]
      )
    );
    const signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await expect(
      spectator2Exchange.createResale(
        1,
        PRICE,
        ethers.constants.AddressZero,
        hash,
        signature
      )
    ).to.be.revertedWith("The token does not exist or the sender is not the owner");
  });

  it("Should prevent a spectator to put a token on resale with a negativ price", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, 0, ethers.constants.AddressZero]
      )
    );
    const signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await expect(
      spectator1Exchange.createResale(
        1,
        0,
        ethers.constants.AddressZero,
        hash,
        signature
      )
    ).to.be.revertedWith("The price cannot be negativ");
  });

  it("Should prevent a spectator to put a token on resale with an optional buyer that is not registered", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, PRICE, tixngo.address]
      )
    );
    const signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await expect(
      spectator1Exchange.createResale(
        1,
        PRICE,
        tixngo.address,
        hash,
        signature
      )
    ).to.be.revertedWith("The optional buyer must be a registered user");
  });

  it("Should prevent a spectator to put a token on resale if the hash is incorrect", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 42, PRICE, ethers.constants.AddressZero]
      )
    );
    const signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await expect(
      spectator1Exchange.createResale(
        1,
        PRICE,
        ethers.constants.AddressZero,
        hash,
        signature
      )
    ).to.be.revertedWith("The hash is not valid");
  });

  it("Should prevent a spectator to put a token on resale if the proof has not been signed by the approver", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, PRICE, ethers.constants.AddressZero]
      )
    );
    const signature = await identifier.signMessage(ethers.utils.arrayify(hash));
    await expect(
      spectator1Exchange.createResale(
        1,
        PRICE,
        ethers.constants.AddressZero,
        hash,
        signature
      )
    ).to.be.revertedWith("The signer is invalid");
  });

  it("Should allow a spectator to remove a ticket from resale", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, PRICE, spectator2.address]
      )
    );
    const signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await spectator1Exchange.createResale(
      1,
      PRICE,
      spectator2.address,
      hash,
      signature
    );
    await spectator1Exchange.cancelResale(1);
    expect((await exchange.getResale(1)).price).to.equal(0);
  });

  it("Should prevent a spectator to remove a token from resale if they are not the owner of the token", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, PRICE, spectator2.address]
      )
    );
    const signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await spectator1Exchange.createResale(
      1,
      PRICE,
      spectator2.address,
      hash,
      signature
    );
    await expect(spectator2Exchange.cancelResale(1)).to.be.revertedWith("The token does not exist or the sender is not the owner");
  });

  it("Should prevent a spectator to remove a token from resale if the token is not on resale", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    await expect(spectator1Exchange.cancelResale(1)).to.be.revertedWith("The token is not on resale");
  });

  it("Should allow a spectator to query the required amount of TIX to purchase a token on resale", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, PRICE, spectator2.address]
      )
    );
    const signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await spectator1Exchange.createResale(
      1,
      PRICE,
      spectator2.address,
      hash,
      signature
    );
    expect(await spectator2Exchange.calcResaleTokenAmount(1)).to.equal(precision.mul(PRICE + (PRICE / 100 * 2 / 2)));
  });

  it("Should allow a spectator to accept a resale", async function () {
    organizerTix.increaseAllowance(
      ticketing.address,
      EVENT_REGISTRATION_FEE.add(MINTING_FEE)
    );
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, PRICE, spectator2.address]
      )
    );
    const signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await spectator1Ticketing.approve(spectator1Exchange.address, 1);
    await spectator1Exchange.createResale(
      1,
      PRICE,
      spectator2.address,
      hash,
      signature
    );
    const priceInTix = precision.mul(PRICE);
    const feeInTix = precision.mul(PRICE).mul(2).div(100).div(2);
    await spectator2Tix.increaseAllowance(spectator2Exchange.address, priceInTix.add(feeInTix));
    await spectator2Exchange.acceptResale(1);
    expect(await ticketing.ownerOf(1)).to.equal(spectator2.address);
    expect(await tix.balanceOf(spectator2.address)).to.equal(INITIAL_TOKEN_AMOUNT.sub(priceInTix).sub(feeInTix));
    expect(await tix.balanceOf(spectator1.address)).to.equal(priceInTix.sub(feeInTix));
    expect(await tix.balanceOf(tixngo.address)).to.equal(EVENT_REGISTRATION_FEE.add(MINTING_FEE).add(feeInTix));
    expect(await tix.balanceOf(organizer.address)).to.equal(INITIAL_TOKEN_AMOUNT.sub(EVENT_REGISTRATION_FEE).sub(MINTING_FEE).add(feeInTix));
    expect((await exchange.getResale(1)).price).to.equal(0);
  });

  it("Should prevent a spectator to pruchase a ticket that is not on resale", async function () {
    organizerTix.increaseAllowance(
      ticketing.address,
      EVENT_REGISTRATION_FEE.add(MINTING_FEE)
    );
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    await expect(spectator2Exchange.acceptResale(1)).to.be.revertedWith("The token is not on resale");
  });

  it("Should allow a spectator to accept a resale", async function () {
    organizerTix.increaseAllowance(
      ticketing.address,
      EVENT_REGISTRATION_FEE.add(MINTING_FEE)
    );
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, PRICE, spectator2.address]
      )
    );
    const signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await spectator1Exchange.createResale(
      1,
      PRICE,
      spectator2.address,
      hash,
      signature
    );
    await expect(exchange.acceptResale(1)).to.be.revertedWith("The buyer must be a registered user");
  });

  it("Should allow a spectator to accept a resale", async function () {
    organizerTix.increaseAllowance(
      ticketing.address,
      EVENT_REGISTRATION_FEE.add(MINTING_FEE)
    );
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, PRICE, spectator1.address]
      )
    );
    const signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await spectator1Ticketing.approve(spectator1Exchange.address, 1);
    await spectator1Exchange.createResale(
      1,
      PRICE,
      spectator1.address,
      hash,
      signature
    );
    await expect(spectator2Exchange.acceptResale(1)).to.be.revertedWith("The buyer is not the one chosen by the seller");
  });

  it("Should allow a spectator to accept a resale", async function () {
    organizerTix.increaseAllowance(
      ticketing.address,
      EVENT_REGISTRATION_FEE.add(MINTING_FEE)
    );
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, PRICE, spectator2.address]
      )
    );
    const signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await spectator1Ticketing.approve(spectator1Exchange.address, 1);
    await spectator1Exchange.createResale(
      1,
      PRICE,
      spectator2.address,
      hash,
      signature
    );
    await expect(spectator2Exchange.acceptResale(1)).to.be.revertedWith("Not enough TIX to process the operation");
  });

  it("Should allow a spectator to put a ticket on swap", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, 1, spectator2.address]
      )
    );
    const signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await spectator1Exchange.createSwap(
      1,
      1,
      spectator2.address,
      hash,
      signature
    );
    const resale = await exchange.getSwap(1);
    expect(resale.eventIdOfWantedToken).to.equal(1);
    expect(resale.optionalParticipant).to.equal(spectator2.address);
  });

  it("Should prevent a spectator to put a token on swap if the token is already on resale", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, PRICE, ethers.constants.AddressZero]
      )
    );
    const signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await spectator1Exchange.createResale(
      1,
      PRICE,
      ethers.constants.AddressZero,
      hash,
      signature
    );
    await expect(
      spectator1Exchange.createSwap(
        1,
        1,
        ethers.constants.AddressZero,
        hash,
        signature
      )
    ).to.be.revertedWith("The token is already on resale");
  });

  it("Should prevent a spectator to put a token on swap if the token is already on swap", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    let hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, 1, ethers.constants.AddressZero]
      )
    );
    let signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await spectator1Exchange.createSwap(
      1,
      1,
      ethers.constants.AddressZero,
      hash,
      signature
    );
    hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, PRICE, ethers.constants.AddressZero]
      )
    );
    signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await expect(
      spectator1Exchange.createSwap(
        1,
        1,
        ethers.constants.AddressZero,
        hash,
        signature
      )
    ).to.be.revertedWith("The token is already on swap");
  });

  it("Should prevent a spectator to put a token on swap if the wanted token does not exist", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    let hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, 1, ethers.constants.AddressZero]
      )
    );
    let signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await expect(
      spectator1Exchange.createSwap(
        1,
        2,
        ethers.constants.AddressZero,
        hash,
        signature
      )
    ).to.be.revertedWith("The event id of the wanted token does not exist");
  });

  it("Should prevent a spectator to put a token on swap if they are not the owner of the token", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    let hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, 1, ethers.constants.AddressZero]
      )
    );
    let signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await expect(
      spectator2Exchange.createSwap(
        1,
        1,
        ethers.constants.AddressZero,
        hash,
        signature
      )
    ).to.be.revertedWith("The token does not exist or the sender is not the owner");
  });

  it("Should prevent a spectator to put a token on swap with an optional participant that is not registered", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    let hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, 1, tixngo.address]
      )
    );
    let signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await expect(
      spectator1Exchange.createSwap(
        1,
        1,
        tixngo.address,
        hash,
        signature
      )
    ).to.be.revertedWith("The optional participant must be a registered user");
  });

  it("Should prevent a spectator to put a token on swap if the hash is incorrect", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    let hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator2.address, 1, 1, ethers.constants.AddressZero]
      )
    );
    let signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await expect(
      spectator1Exchange.createSwap(
        1,
        1,
        ethers.constants.AddressZero,
        hash,
        signature
      )
    ).to.be.revertedWith("The hash is not valid");
  });

  it("Should prevent a spectator to put a token on resale if the proof has not been signed by the approver", async function () {
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
  await organizerTicketing.mint(1, 1, spectator1.address);
  let hash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256", "uint256", "address"],
      [spectator1.address, 1, 1, ethers.constants.AddressZero]
    )
  );
  let signature = await identifier.signMessage(ethers.utils.arrayify(hash));
  await expect(
    spectator1Exchange.createSwap(
      1,
      1,
      ethers.constants.AddressZero,
      hash,
      signature
    )
  ).to.be.revertedWith("The signer is invalid");
  });

  it("Should allow a spectator to cancel a swap", async function () {
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    let hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, 1, ethers.constants.AddressZero]
      )
    );
    let signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await spectator1Exchange.createSwap(
      1,
      1,
      ethers.constants.AddressZero,
      hash,
      signature
    );
    await spectator1Exchange.cancelSwap(1);
    expect((await exchange.getSwap(1)).eventIdOfWantedToken).to.be.equal(0);
  });

  it("Should prevent a spectator to cancel a swap that does not exist", async function () {
    await expect(spectator1Exchange.cancelSwap(1)).to.be.revertedWith("The token is not on swap");
  })

  it("Should prevent a spectator to cancel a swap if they are not the owner the token", async function () {
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
  await organizerTicketing.mint(1, 1, spectator1.address);
  let hash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["address", "uint256", "uint256", "address"],
      [spectator1.address, 1, 1, ethers.constants.AddressZero]
    )
  );
  let signature = await approver.signMessage(ethers.utils.arrayify(hash));
  await spectator1Exchange.createSwap(
    1,
    1,
    ethers.constants.AddressZero,
    hash,
    signature
  );
    await expect(spectator2Exchange.cancelSwap(1)).to.be.revertedWith("The token does not exist or the sender is not the owner");
  });

  it("Should allow a spectator to accept a swap", async function () {
    organizerTix.increaseAllowance(
      ticketing.address,
      EVENT_REGISTRATION_FEE.add(MINTING_FEE.mul(2))
    );
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    let hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, 1, ethers.constants.AddressZero]
      )
    );
    let signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await spectator1Ticketing.approve(spectator1Exchange.address, 1);
    await spectator1Exchange.createSwap(
      1,
      1,
      ethers.constants.AddressZero,
      hash,
      signature
    );
    await organizerTicketing.mint(1, 2, spectator2.address);
    await spectator2Ticketing.approve(spectator2Exchange.address, 2);
    await spectator2Exchange.acceptSwap(1, 2);
    expect(await ticketing.ownerOf(1)).to.equal(spectator2.address);
    expect(await ticketing.ownerOf(2)).to.equal(spectator1.address);
    expect((await exchange.getSwap(1)).eventIdOfWantedToken).to.equal(0);
  });

  it("Should prevent a spectator to accept a swap is the token is not on swap", async function () {
    await expect(spectator1Exchange.acceptSwap(1, 2)).to.be.revertedWith(
      "The token is not on swap"
    );
  });

  it("Should prevent a spectator to accept a swap with a token they do not own", async function () {
    organizerTix.increaseAllowance(
      ticketing.address,
      EVENT_REGISTRATION_FEE.add(MINTING_FEE.mul(2))
    );
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    let hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, 1, ethers.constants.AddressZero]
      )
    );
    let signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await spectator1Ticketing.approve(spectator1Exchange.address, 1);
    await spectator1Exchange.createSwap(
      1,
      1,
      ethers.constants.AddressZero,
      hash,
      signature
    );
    await expect(spectator2Exchange.acceptSwap(1, 1)).to.be.revertedWith(
      "The token id of the acceptor does not exist or the it is not the owner of the token"
    );
  });

    it("Should prevent a spectator to accept a token if the token is not part of the wanted event id", async function () {
      organizerTix.increaseAllowance(
        ticketing.address,
        EVENT_REGISTRATION_FEE.mul(2).add(MINTING_FEE.mul(2))
      );
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
      await organizerTicketing.registerEvent(
        "test",
        "test",
        BigNumber.from(now),
        BigNumber.from(nowPlusOneYear),
        state
      );
      await organizerTicketing.mint(1, 1, spectator1.address);
      await organizerTicketing.mint(2, 1, spectator2.address);
      let hash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["address", "uint256", "uint256", "address"],
          [spectator1.address, 1, 1, ethers.constants.AddressZero]
        )
      );
      let signature = await approver.signMessage(ethers.utils.arrayify(hash));
      await spectator1Ticketing.approve(spectator1Exchange.address, 1);
      await spectator1Exchange.createSwap(
        1,
        1,
        ethers.constants.AddressZero,
        hash,
        signature
      );
      await expect(spectator2Exchange.acceptSwap(1, 2)).to.be.revertedWith(
        "The token of the acceptor is not part the correct event"
      );
    });

    it("Should prevent a spectator to accept a swap if they are not the optional participant", async function () {
      organizerTix.increaseAllowance(
        ticketing.address,
        EVENT_REGISTRATION_FEE.add(MINTING_FEE.mul(2))
      );
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
      await organizerTicketing.mint(1, 1, spectator1.address);
      await organizerTicketing.mint(1, 2, spectator2.address);
      let hash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["address", "uint256", "uint256", "address"],
          [spectator1.address, 1, 1, spectator1.address]
        )
      );
      let signature = await approver.signMessage(ethers.utils.arrayify(hash));
      await spectator1Ticketing.approve(spectator1Exchange.address, 1);
      await spectator1Exchange.createSwap(
        1,
        1,
        spectator1.address,
        hash,
        signature
      );
      await expect(spectator2Exchange.acceptSwap(1, 2)).to.be.revertedWith(
        "The acceptor is not the one chosen by the creator of the swap"
      );
    });

  it("Should allow anybody to get a resale", async function () {
    organizerTix.increaseAllowance(
      ticketing.address,
      EVENT_REGISTRATION_FEE.add(MINTING_FEE)
    );
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    let hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, PRICE, spectator2.address]
      )
    );
    let signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await spectator1Ticketing.approve(spectator1Exchange.address, 1);
    await spectator1Exchange.createResale(
      1,
      PRICE,
      spectator2.address,
      hash,
      signature
    );
    const resale = await exchange.getResale(1);
    expect(resale.price).to.equal(PRICE);
    expect(resale.optionalBuyer).to.equal(spectator2.address);
  });

  it("Should allow anybody to get a swap", async function () {
    organizerTix.increaseAllowance(
      ticketing.address,
      EVENT_REGISTRATION_FEE.add(MINTING_FEE)
    );
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
    await organizerTicketing.mint(1, 1, spectator1.address);
    let hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "uint256", "uint256", "address"],
        [spectator1.address, 1, 1, spectator2.address]
      )
    );
    let signature = await approver.signMessage(ethers.utils.arrayify(hash));
    await spectator1Ticketing.approve(spectator1Exchange.address, 1);
    await spectator1Exchange.createSwap(
      1,
      1,
      spectator2.address,
      hash,
      signature
    );
    const swap = await exchange.getSwap(1);
    expect(swap.eventIdOfWantedToken).to.equal(1);
    expect(swap.optionalParticipant).to.equal(spectator2.address);
  });
});

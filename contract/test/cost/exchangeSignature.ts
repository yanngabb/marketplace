/*
GABBUD Yann
November 2021
*/

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { Identity, TIX, Ticketing, ExchangeSignature } from "../../typechain";

describe("ExchangeSignature", function () {
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
  let exchange: ExchangeSignature;
  let spectator1Exchange: ExchangeSignature;
  let spectator2Exchange: ExchangeSignature;

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

    Exchange = await ethers.getContractFactory("ExchangeSignature");
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

  it("Should allow a spectator to put a ticket on resale with a signature", async function () {
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
    await spectator1Exchange.createResaleWithSignature(
      1,
      PRICE,
      spectator2.address,
      signature
    );
  });

  it("Should allow a spectator to put a ticket on resale without a signature", async function () {
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
    await spectator1Exchange.createResaleWithoutSignature(
      1,
      PRICE,
      spectator2.address
    );
  });
});

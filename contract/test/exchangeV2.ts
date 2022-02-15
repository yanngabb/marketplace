/*
GABBUD Yann
November 2021
*/

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import {
  Identity,
  TIX,
  Ticketing,
  ExchangeV2,
  IExchangeV2,
} from "../typechain";

describe("ExchangeV2", function () {
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
  let exchange: ExchangeV2;
  let spectator1Exchange: ExchangeV2;
  let spectator2Exchange: ExchangeV2;

  const DECIMALS = 18;
  const PRECISION = ethers.utils.parseUnits("1", DECIMALS);
  const INITIAL_TOKEN_AMOUNT = PRECISION.mul(10000);
  const EVENT_REGISTRATION_FEE = PRECISION.mul(1000);
  const MINTING_FEE = PRECISION.mul(1);
  const USD_RESALE_PRICE = 100;
  const RESALE_FEE_PERCENTAGE = 2;

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
      ethers.utils.parseUnits("1", DECIMALS),
      ethers.utils.parseUnits("1", DECIMALS)
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

    Exchange = await ethers.getContractFactory("ExchangeV2");
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

  it("Should allow a spectator to purchase a ticket on resale", async function () {
    // create event and ticket
    organizerTix.increaseAllowance(
      ticketing.address,
      EVENT_REGISTRATION_FEE.add(MINTING_FEE)
    );
    const now = Date.now() + 1000000;
    const nowPlusOneYear = now + 100000000;
    await organizerTicketing.registerEvent(
      "test",
      "test",
      BigNumber.from(now),
      BigNumber.from(nowPlusOneYear),
      await organizerTicketing.EVENT_OPEN()
    );
    await organizerTicketing.mint(1, 1, spectator1.address);

    // compute shares
    const price = PRECISION.mul(USD_RESALE_PRICE);
    const fee = price.mul(RESALE_FEE_PERCENTAGE).div(100).div(2);
    const sellerShare = price.sub(fee);
    const tixngoShare = fee;
    const organizerShare = fee;

    // resale hash + approver signature + resale offer signature
    const resaleHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        [
          "uint256",
          "address",
          "address",
          "address",
          "address",
          "uint256",
          "uint256",
          "uint256",
        ],
        [
          1,
          spectator2.address,
          spectator1.address,
          tixngo.address,
          organizer.address,
          sellerShare,
          tixngoShare,
          organizerShare,
        ]
      )
    );
    const approverSignature = await approver.signMessage(
      ethers.utils.arrayify(resaleHash)
    );
    const resaleOfferSignature = await spectator1.signMessage(
      ethers.utils.arrayify(resaleHash)
    );

    // ticket transfer hash + signature
    const ticketTransferHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256"],
        [spectator1.address, spectator2.address, 1]
      )
    );
    const ticketTransferSignature = await spectator1.signMessage(
      ethers.utils.arrayify(ticketTransferHash)
    );

    // tix transfer to seller hash + signature
    const tixTransferToSellerHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256"],
        [spectator2.address, spectator1.address, sellerShare]
      )
    );
    const tixTransferToSellerSignature = await spectator2.signMessage(
      ethers.utils.arrayify(tixTransferToSellerHash)
    );

    // tix transfer to tixngo hash + signature
    const tixTransferToTixngoHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256"],
        [spectator2.address, tixngo.address, tixngoShare]
      )
    );
    const tixTransferToTixngoSignature = await spectator2.signMessage(
      ethers.utils.arrayify(tixTransferToTixngoHash)
    );

    // tix transfer to organizer hash + signature
    const tixTransferToOrganizerHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256"],
        [spectator2.address, organizer.address, organizerShare]
      )
    );
    const tixTransferToOrganizerSignature = await spectator2.signMessage(
      ethers.utils.arrayify(tixTransferToOrganizerHash)
    );

    // resale transaction
    const data = {
      tokenId: 1,
      optionalBuyer: spectator2.address,
      seller: spectator1.address,
      sellerShare: sellerShare,
      tixngoShare: tixngoShare,
      organizerShare: organizerShare,
      approverSignature: approverSignature,
      resaleOfferSignature: resaleOfferSignature,
      ticketTransferSignature: ticketTransferSignature,
      tixTransferToSellerSignature: tixTransferToSellerSignature,
      tixTransferToTixngoSignature: tixTransferToTixngoSignature,
      tixTransferToOrganizerSignature: tixTransferToOrganizerSignature,
    }
    await spectator2Exchange.resell(data);
    expect(await ticketing.ownerOf(1)).to.equal(spectator2.address);
    expect(await tix.balanceOf(spectator1.address)).to.equal(sellerShare);
    expect(await tix.balanceOf(spectator2.address)).to.equal(INITIAL_TOKEN_AMOUNT.sub(sellerShare).sub(tixngoShare).sub(organizerShare));
    expect(await tix.balanceOf(tixngo.address)).to.equal(EVENT_REGISTRATION_FEE.add(MINTING_FEE).add(tixngoShare));
    expect(await tix.balanceOf(organizer.address)).to.equal(INITIAL_TOKEN_AMOUNT.sub(EVENT_REGISTRATION_FEE).sub(MINTING_FEE).add(organizerShare));
  });

  it("Should allow two spectators to make a swap", async function () {
    // create event and ticket
    organizerTix.increaseAllowance(
      ticketing.address,
      EVENT_REGISTRATION_FEE.add(MINTING_FEE).add(MINTING_FEE)
    );
    const now = Date.now() + 1000000;
    const nowPlusOneYear = now + 100000000;
    await organizerTicketing.registerEvent(
      "test",
      "test",
      BigNumber.from(now),
      BigNumber.from(nowPlusOneYear),
      await organizerTicketing.EVENT_OPEN()
    );
    await organizerTicketing.mint(1, 1, spectator1.address);
    await organizerTicketing.mint(1, 2, spectator2.address);

    // swap hash + approver signature + swap offer signature
    const swapHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        [
          "uint256",
          "uint256",
          "address",
          "address"
        ],
        [
          1,
          2,
          spectator1.address,
          spectator2.address
        ]
      )
    );
    const approverSignature = await approver.signMessage(
      ethers.utils.arrayify(swapHash)
    );
    const swapOfferSignature = await spectator1.signMessage(
      ethers.utils.arrayify(swapHash)
    );

    // ticket transfer hashes + signatures
    const ticketTransferHash_A = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256"],
        [spectator1.address, spectator2.address, 1]
      )
    );
    const ticketTransferSignature_A = await spectator1.signMessage(
      ethers.utils.arrayify(ticketTransferHash_A)
    );
    const ticketTransferHash_B = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint256"],
        [spectator2.address, spectator1.address, 2]
      )
    );
    const ticketTransferSignature_B = await spectator2.signMessage(
      ethers.utils.arrayify(ticketTransferHash_B)
    );

    // swap transaction
    const data = {
      tokenId_A: 1,
      tokenId_B: 2,
      user_A: spectator1.address,
      user_B: spectator2.address,
      approverSignature: approverSignature,
      swapOfferSignature: swapOfferSignature,
      ticketTransferSignature_A: ticketTransferSignature_A,
      ticketTransferSignature_B: ticketTransferSignature_B
    }
    await spectator2Exchange.swap(data);
    expect(await ticketing.ownerOf(1)).to.equal(spectator2.address);
    expect(await ticketing.ownerOf(2)).to.equal(spectator1.address);
  });
});

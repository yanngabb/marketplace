/*
GABBUD Yann
December 2021
*/

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { Identity } from "../typechain";

describe("Identity", function () {
  let tixngo: SignerWithAddress;
  let spectator: SignerWithAddress;
  let organizer: SignerWithAddress;
  let identifier: SignerWithAddress;

  let Identity;
  let identity: Identity;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    tixngo = signers[0];
    spectator = signers[1];
    organizer = signers[2];
    identifier = signers[3];

    Identity = await ethers.getContractFactory("Identity");
    identity = await Identity.deploy(identifier.address);
    await identity.deployed();
  });

  it("Should allow a spectator to register", async function () {
    let spectatorIdentity = identity.connect(spectator);
    const group = await spectatorIdentity.SPECTATOR_GROUP();
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes32"],
        [spectator.address, group]
      )
    );
    const signature = await identifier.signMessage(ethers.utils.arrayify(hash));
    await spectatorIdentity.register(group, hash, signature);
    expect(await identity.isRegistered(spectator.address)).to.equal(true);
  });

  it("Should prevent a spectator to register a second time", async function () {
    let spectatorIdentity = identity.connect(spectator);
    const group = await spectatorIdentity.SPECTATOR_GROUP();
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes32"],
        [spectator.address, group]
      )
    );
    const signature = await identifier.signMessage(ethers.utils.arrayify(hash));
    await spectatorIdentity.register(group, hash, signature);
    expect(await identity.isRegistered(spectator.address)).to.equal(true);
    await expect(
      spectatorIdentity.register(group, hash, signature)
    ).to.be.revertedWith("The user already exists");
  });

  it("Should allow a spectator to unregister", async function () {
    let spectatorIdentity = identity.connect(spectator);
    const group = await spectatorIdentity.SPECTATOR_GROUP();
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes32"],
        [spectator.address, group]
      )
    );
    const signature = await identifier.signMessage(ethers.utils.arrayify(hash));
    await spectatorIdentity.register(group, hash, signature);
    expect(await identity.isRegistered(spectator.address)).to.equal(true);
    await spectatorIdentity.unregister();
    expect(await identity.isRegistered(spectator.address)).to.equal(false);
  });

  it("Should allow to know if a registerd user is a spectator", async function () {
    let spectatorIdentity = identity.connect(spectator);
    const group = await spectatorIdentity.SPECTATOR_GROUP();
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes32"],
        [spectator.address, group]
      )
    );
    const signature = await identifier.signMessage(ethers.utils.arrayify(hash));
    await spectatorIdentity.register(group, hash, signature);
    expect(await identity.isRegistered(spectator.address)).to.equal(true);
    expect(await identity.isSpectator(spectator.address)).to.equal(true);
    expect(await identity.isOrganizer(spectator.address)).to.equal(false);
  });

  it("Should allow a organizer to register", async function () {
    let organizerIdentity = identity.connect(organizer);
    const group = await organizerIdentity.ORGANIZER_GROUP();
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes32"],
        [organizer.address, group]
      )
    );
    const signature = await identifier.signMessage(ethers.utils.arrayify(hash));
    await organizerIdentity.register(group, hash, signature);
    expect(await identity.isRegistered(organizer.address)).to.equal(true);
  });

  it("Should prevent a organizer to register a second time", async function () {
    let organizerIdentity = identity.connect(organizer);
    const group = await organizerIdentity.ORGANIZER_GROUP();
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes32"],
        [organizer.address, group]
      )
    );
    const signature = await identifier.signMessage(ethers.utils.arrayify(hash));
    await organizerIdentity.register(group, hash, signature);
    expect(await identity.isRegistered(organizer.address)).to.equal(true);
    await expect(
      organizerIdentity.register(group, hash, signature)
    ).to.be.revertedWith("The user already exists");
  });

  it("Should allow a organizer to unregister", async function () {
    let organizerIdentity = identity.connect(organizer);
    const group = await organizerIdentity.ORGANIZER_GROUP();
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes32"],
        [organizer.address, group]
      )
    );
    const signature = await identifier.signMessage(ethers.utils.arrayify(hash));
    await organizerIdentity.register(group, hash, signature);
    expect(await identity.isRegistered(organizer.address)).to.equal(true);
    await organizerIdentity.unregister();
    expect(await identity.isRegistered(organizer.address)).to.equal(false);
  });

  it("Should allow to know if a registerd user is a organizer", async function () {
    let organizerIdentity = identity.connect(organizer);
    const group = await organizerIdentity.ORGANIZER_GROUP();
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes32"],
        [organizer.address, group]
      )
    );
    const signature = await identifier.signMessage(ethers.utils.arrayify(hash));
    await organizerIdentity.register(group, hash, signature);
    expect(await identity.isRegistered(organizer.address)).to.equal(true);
    expect(await identity.isSpectator(organizer.address)).to.equal(false);
    expect(await identity.isOrganizer(organizer.address)).to.equal(true);
  });

  it("Should allow to know if an address is registerd", async function () {
    let organizerIdentity = identity.connect(organizer);
    const group = await organizerIdentity.ORGANIZER_GROUP();
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes32"],
        [organizer.address, group]
      )
    );
    const signature = await identifier.signMessage(ethers.utils.arrayify(hash));
    await organizerIdentity.register(group, hash, signature);
    expect(await identity.isRegistered(organizer.address)).to.equal(true);
  });

  it("Should allow TIXnGO to revoke a user", async function () {
    let organizerIdentity = identity.connect(organizer);
    const group = await organizerIdentity.ORGANIZER_GROUP();
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes32"],
        [organizer.address, group]
      )
    );
    const signature = await identifier.signMessage(ethers.utils.arrayify(hash));
    await organizerIdentity.register(group, hash, signature);
    expect(await identity.isRegistered(organizer.address)).to.equal(true);
    await identity.revoke(organizer.address);
    expect(await identity.isRegistered(organizer.address)).to.equal(false);
  });
});
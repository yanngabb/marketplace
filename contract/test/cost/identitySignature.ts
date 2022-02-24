/*
GABBUD Yann
December 2021
*/

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { IdentitySignature } from "../../typechain";

describe("IdentitySignature", function () {
  let tixngo: SignerWithAddress;
  let spectator: SignerWithAddress;
  let organizer: SignerWithAddress;
  let identifier: SignerWithAddress;

  let IdentitySignature;
  let identitySignature: IdentitySignature;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    tixngo = signers[0];
    spectator = signers[1];
    organizer = signers[2];
    identifier = signers[3];

    IdentitySignature = await ethers.getContractFactory("IdentitySignature");
    identitySignature = await IdentitySignature.deploy(identifier.address);
    await identitySignature.deployed();
  });

  it("Should allow a spectator to register with a proof", async function () {
    let spectatorIdentitySignature = identitySignature.connect(spectator);
    const group = await spectatorIdentitySignature.SPECTATOR_GROUP();
    const hash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "bytes32"],
        [spectator.address, group]
      )
    );
    const signature = await identifier.signMessage(ethers.utils.arrayify(hash));
    await spectatorIdentitySignature.registerWithProof(group, signature);
    expect(await identitySignature.isRegistered(spectator.address)).to.equal(true);
  });

  it("Should allow a spectator to register without a proof", async function () {
    let spectatorIdentitySignature = identitySignature.connect(spectator);
    const group = await spectatorIdentitySignature.SPECTATOR_GROUP();
    await spectatorIdentitySignature.registerWithoutProof(group);
    expect(await identitySignature.isRegistered(spectator.address)).to.equal(true);
  });
});
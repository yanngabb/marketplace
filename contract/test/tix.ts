/*
GABBUD Yann
November 2021
*/

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { TIX } from "../typechain";

describe("TIX", function () {
  let tixngo: SignerWithAddress;
  let priceFeed: SignerWithAddress;
  let TIX;
  let tix: TIX;
  const decimals = 18;
  const amount = 100;
  const initialUsdRate = ethers.utils.parseUnits("1", decimals);
  const initialEthRate = ethers.utils.parseUnits("1000", decimals);

  beforeEach(async function () {
    let signers = await ethers.getSigners();
    tixngo = signers[0];
    priceFeed = signers[1];
    TIX = await ethers.getContractFactory("TIX");
    tix = await TIX.deploy(
      "TIX token",
      "TIX",
      priceFeed.address,
      initialUsdRate,
      initialEthRate
    );
    await tix.deployed();
  });

  it("Should allow the price feed to update the rates", async function () {
    const priceFeedTix = tix.connect(priceFeed);
    expect(await tix.getUsdRate()).to.equal(initialUsdRate);
    expect(await tix.getEthRate()).to.equal(initialEthRate);
    const newUsdRate = ethers.utils.parseUnits("0.5", decimals);
    const newEthRate = ethers.utils.parseUnits("500", decimals);
    await priceFeedTix.updateRates(newUsdRate, newEthRate);
    expect(await tix.getUsdRate()).to.equal(newUsdRate);
    expect(await tix.getEthRate()).to.equal(newEthRate);
  });

  it("Should prevent someone that is not the price feed to update the rates", async function () {
    await expect(
      tix.updateRates(initialUsdRate, initialEthRate)
    ).to.be.revertedWith(
      "Only the price feed can execute this function"
    );
  });

  it("Should allow anybody to get the USD rate of the TIX", async function () {
    expect(await tix.getUsdRate()).to.equal(initialUsdRate);
  });

  it("Should allow anybody to get the price in USD of the TIX", async function () {
    expect(await tix.getUsdPrice()).to.equal(
      ethers.BigNumber.from(1).div(initialUsdRate)
    );
  });

  it("Should allow anybody to convert an amount in USD to an amount in TIX", async function () {
    expect(await tix.calcUsdTokenAmount(1)).to.equal(initialUsdRate.mul(1));
  });

  it("Should allow anybody to get the ETH rate of the TIX", async function () {
    expect(await tix.getEthRate()).to.equal(initialEthRate);
  });

  it("Should allow anybody to get the price in Eth of the TIX", async function () {
    expect(await tix.getEthPrice()).to.equal(
      ethers.BigNumber.from(1).div(initialEthRate)
    );
  });

  it("Should allow anybody to convert an amount in ETH to an amount in TIX", async function () {
    expect(await tix.calcEthTokenAmount(1)).to.equal(initialEthRate.mul(1));
  });

  it("Should allow TIXnGO to mint TIX", async function () {
    await tix.mint(tixngo.address, amount);
    expect(await tix.balanceOf(tixngo.address)).to.equal(amount);
  });

  it("Should allow TIXnGO to burn TIX", async function () {
    await tix.mint(tixngo.address, amount);
    expect(await tix.balanceOf(tixngo.address)).to.equal(amount);
    await tix.burn(tixngo.address, amount);
    expect(await tix.balanceOf(tixngo.address)).to.equal(0);
  });

  it("Should allow anybody to buy TIX", async function () {
    const options = { value: amount };
    await tix.buy(options);
    expect(await tix.balanceOf(tixngo.address)).to.equal(initialEthRate.mul(amount));
  });

  it("Should allow anybody to sell TIX", async function () {
    const options = { value: amount };
    await tix.buy(options);
    expect(await tix.balanceOf(tixngo.address)).to.equal(initialEthRate.mul(amount));
    await tix.sell(await tix.balanceOf(tixngo.address));
    expect(await tix.balanceOf(tixngo.address)).to.equal(0);
  });

  it("Should prevent a user to sell more TIX that it own", async function () {
    const options = { value: amount };
    await tix.buy(options);
    expect(await tix.balanceOf(tixngo.address)).to.equal(initialEthRate.mul(amount));
    await expect(tix.sell((await tix.balanceOf(tixngo.address)).add(1))).to.be.revertedWith(
      "ERC20: burn amount exceeds balance"
    );
  });

  it("Should allow TIXnGO to get the ETH balance of the contract", async function () {
    const options = { value: amount };
    await tix.buy(options);
    expect(await tix.getETHBalance()).to.equal(amount);
  });
});

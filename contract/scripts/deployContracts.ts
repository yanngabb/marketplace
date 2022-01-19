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

  // // create users
  // const tixngo = ethers.Wallet.createRandom();
  // const organizer = ethers.Wallet.createRandom();
  // const seller = ethers.Wallet.createRandom();
  // const buyer = ethers.Wallet.createRandom();

  // // fund users
  // console.log(await provider.getBalance(account.address));
  // console.log(await provider.getBalance(tixngo.address));

  // let tx = {
  //   to: tixngo.address,
  //   // Convert currency unit from ether to wei
  //   value: ethers.utils.parseEther('9000.0'),
  // }
  // account.sendTransaction(tx).then((txObj) => console.log('txHash:', txObj.hash))

  // // await account.sendTransaction({
  // //   to: tixngo.address,
  // //   value: ethers.utils.parseEther("1.0")
  // // });

  // // account.sendTransaction({
  // //   to: organizer.address,
  // //   value: ethers.utils.parseEther("1.0")
  // // });
  // // account.sendTransaction({
  // //   to: seller.address,
  // //   value: ethers.utils.parseEther("1.0")
  // // });
  // // account.sendTransaction({
  // //   to: buyer.address,
  // //   value: ethers.utils.parseEther("1.0")
  // // });

  // // check balances
  // console.log(await provider.getBalance(account.address));
  // console.log(await provider.getBalance(tixngo.address));
  // // expect(await provider.getBalance(tixngo.address)).equal(ethers.utils.parseEther("1.0"))

  /* 
  Deploy the TIX contract 
  */

  // Get the contract to deploy
  const TIX = await ethers.getContractFactory("TIX");
  const tixContract = await TIX.deploy("TIX token", "TIX", 1000000000);

  // Check that the contract has been correctly deployed
  await tixContract.deployed();

  // Print the address of the contract
  console.log("TIX contract deployed to:", tixContract.address);

  /*
  deploy the users contract
  */

  // Get the contract to deploy
  const Users = await ethers.getContractFactory("Users");

  // Deploy the contract
  const usersContract = await Users.deploy();

  // Check that the contract has been correctly deployed
  await usersContract.deployed();

  // Print the address of the contract
  console.log("Users contract deployed to:", usersContract.address);

  /*
  deploy the factory contract
  */

  // Get the contract to deploy
  const Factory = await ethers.getContractFactory("Factory");

  // Deploy the contract
  const factoryContract = await Factory.deploy(1, usersContract.address);

  // Check that the contract has been correctly deployed
  await factoryContract.deployed();

  // Print the address of the contract
  console.log("Factory contract deployed to:", factoryContract.address);

  /*
  deploy the exchange contract
  */

  // Get the contract to deploy
  const Exchange = await ethers.getContractFactory("Exchange");

  // Deploy the contract
  const exchangeContract = await Exchange.deploy(
    1,
    tixContract.address,
    usersContract.address,
    factoryContract.address
  );

  // Check that the contract has been correctly deployed
  await exchangeContract.deployed();

  // Print the address of the contract
  console.log("Exchange contract deployed to:", exchangeContract.address);

  /*
  deploy a ticketing contract from the factory contract
  */

  // Register the user as an organizer
  await usersContract.register(ethers.utils.id("ORGANIZER_GROUP"));

  // Deploy the contract from the factory contract
  await factoryContract.deployTicketing(0, "superUri.com/");

  // Get the contract address
  const Ticketing = await ethers.getContractFactory("Ticketing");
  const ticketingContract = Ticketing.attach(
    await factoryContract.getTicketingAddress(0)
  );

  // Check that the contract has been correctly deployed
  await ticketingContract.deployed();

  // Print the address of the contract
  console.log("Ticketing contract deployed to:", ticketingContract.address);

  /*
  mint ticket
  */

  await ticketingContract.mint(account.address, 0);
  console.log(
    "Ticket minted. Ticket balance:",
    await (await ticketingContract.balanceOf(account.address)).toNumber()
  );

  /*
  burn ticket
  */

  await ticketingContract.burn(0);
  console.log(
    "Ticket burned. Ticket balance:",
    await (await ticketingContract.balanceOf(account.address)).toNumber()
  );

  /*
  batch mint tickets
  */

  const accounts = Array(100).fill(account.address);
  const tokenIds = Array.from(Array(100).keys());
  await ticketingContract.batchMint(accounts, tokenIds);
  console.log(
    "Tickets minted. Ticket balance:",
    await (await ticketingContract.balanceOf(account.address)).toNumber()
  );

  /*
  batch burn tickets
  */

  await ticketingContract.batchBurn(tokenIds);
  console.log(
    "Tickets burned. Ticket balance:",
    await (await ticketingContract.balanceOf(account.address)).toNumber()
  );

  /*
  register a seller
  */

  /*
  transfer a ticket to the seller
  */

  /*
  register a buyer
  */

  /*
  buy TIX
  */

  /*
  sell TIX
  */

  /*
  put a ticket in resale
  */

  /*
  remove ticket from resale
  */

  /* 
  put ticket in resale
  */

  /*
  purchase a ticket from the resale
  */

  /*
  unregister the buyer
  */

  /*
  revoke the seller
  */
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/*
GABBUD Yann
November 2021
*/

// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "../token/ERC20/IERC20.sol";

interface ITIX is IERC20 {
    /*
    events
    */
    event Purchase(address user, uint256 amount);
    event Sale(address user, uint256 amount);

    /*
    functions
    */
    function updateRates(uint256 usdRate, uint256 ethRate) external;

    function getUsdRate() external view returns(uint256);

    function getUsdPrice() external view returns(uint256);

    function calcUsdTokenAmount(uint256 usdAmount) external view returns(uint256);

    function getEthRate() external view returns(uint256);

    function getEthPrice() external view returns(uint256);

    function calcEthTokenAmount(uint256 ethAmount) external view returns(uint256);

    function mint(address account, uint256 amount) external;

    function burn(address account, uint256 amount) external;

    function buy() external payable;

    function sell(uint256 amount) external;

    function getETHBalance() external view returns (uint256);
}

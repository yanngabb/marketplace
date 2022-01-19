/*
GABBUD Yann
November 2021
*/

// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "../utils/Context.sol";
import "../access/Ownable.sol";
import "../token/ERC20/ERC20.sol";
import "./ITIX.sol";

contract TIX is Context, Ownable, ERC20, ITIX {
    // price feed address
    address private immutable _priceFeedAddress;

    // USD -> TIX (USD/TIX)
    // Remark1: due to precision, the value is 18 decimals bigger
    // Remark2: multiply an USD amount by the rate to get the amount of TIX
    uint256 private _usdRate;

    // ETH -> TIX (ETH/TIX)
    uint256 private _ethRate;

    /*
    constructor
    */
    constructor(
        string memory name,
        string memory symbol,
        address priceFeedAddress,
        uint256 initialUsdRate,
        uint256 initialEthRate
    ) ERC20(name, symbol) {
        _priceFeedAddress = priceFeedAddress;
        _usdRate = initialUsdRate;
        _ethRate = initialEthRate;
    }

    /*
    functions
    */
    function updateRates(uint256 usdRate, uint256 ethRate) external override {
        require(
            _msgSender() == _priceFeedAddress, 
            "Only the price feed can execute this function"
        );
        _usdRate = usdRate;
        _ethRate = ethRate;
    }

    function getUsdRate() public view override returns(uint256) {
        return _usdRate;
    }

    function getUsdPrice() public view override returns(uint256) {
        return 1 / _usdRate;
    }

    function calcUsdTokenAmount(uint256 usdAmount) external view override returns(uint256) {
        return usdAmount * _usdRate;
    }

    function getEthRate() public view override returns(uint256) {
        return _ethRate;
    }

    function getEthPrice() public view override returns(uint256) {
        return 1 / _ethRate;
    }

    function calcEthTokenAmount(uint256 ethAmount) external view override returns(uint256) {
        return ethAmount * _ethRate;
    }

    function mint(address account, uint256 amount) external override onlyOwner {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external override onlyOwner {
        _burn(account, amount);
    }

    //TODO: replace the three following functions by an AMM
    function buy() external payable override {
        _mint(_msgSender(), msg.value * _ethRate);
    }

    function sell(uint256 amount) external override {
        _burn(_msgSender(), amount);
        (bool success, ) = _msgSender().call{value: amount / _ethRate}("");
        require(success, "Failed to send Ether");
    }

    function getETHBalance()
        external
        view
        override
        onlyOwner
        returns (uint256)
    {
        return address(this).balance;
    }
}

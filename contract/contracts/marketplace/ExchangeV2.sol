/*
GABBUD Yann
November 2021
*/

// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "../utils/Context.sol";
import "../utils/cryptography/ECDSA.sol";
import "../access/Ownable.sol";
import "../token/ERC721/IERC721.sol";
import "../token/ERC20/ERC20.sol";
import "./IIdentity.sol";
import "./ITicketing.sol";
import "./ITIX.sol";
import "./IExchangeV2.sol";

contract ExchangeV2 is Context, Ownable, IExchangeV2 {
    // exchange version
    uint8 public immutable version;

    // contracts
    IIdentity private immutable _identityContract;
    ITicketing private immutable _ticketingContract;
    ITIX private immutable _tixContract;

    // approver address
    address private immutable _approverAddress;
    // tixngo address
    address private immutable _tixngoAddress;

    /*
    constructor
    */
    constructor(
        uint8 contractVersion,
        address identityAddress,
        address ticketingAddress,
        address tixAddress,
        address approverAddress,
        address tixngoAddress
    ) {
        version = contractVersion;
        _identityContract = IIdentity(identityAddress);
        _ticketingContract = ITicketing(ticketingAddress);
        _tixContract = ITIX(tixAddress);
        _approverAddress = approverAddress;
        _tixngoAddress = tixngoAddress;
    }

    /*
    functions
    */
    function resell(ResaleStruct memory data) external override {
        // check requirements
        if (data.optionalBuyer != address(0x0)) {
            require(
                data.optionalBuyer == _msgSender(),
                "The optional buyer address is different from the sender address"
            );
        }
        require(
            data.sellerShare > uint256(0x0) &&
                data.tixngoShare > uint256(0x0) &&
                data.organizerShare > uint256(0x0),
            "The share cannot be negativ"
        );

        // compute hash
        address organizerAddress = _ticketingContract
            .getEvent(_ticketingContract.getToken(data.tokenId).eventId)
            .organizer;
        bytes32 hash = keccak256(
            abi.encode(
                data.tokenId,
                data.optionalBuyer,
                data.seller,
                _tixngoAddress,
                organizerAddress,
                data.sellerShare,
                data.tixngoShare,
                data.organizerShare
            )
        );

        // check approver signature
        (address recovered, ECDSA.RecoverError error) = ECDSA.tryRecover(
            ECDSA.toEthSignedMessageHash(hash),
            data.approverSignature
        );
        require(
            error == ECDSA.RecoverError.NoError,
            "Error while recovering signer address"
        );
        require(recovered == _approverAddress, "The signer is invalid");

        // check resale offer signature
        (recovered, error) = ECDSA.tryRecover(
            ECDSA.toEthSignedMessageHash(hash),
            data.resaleOfferSignature
        );
        require(
            error == ECDSA.RecoverError.NoError,
            "Error while recovering signer address"
        );
        require(recovered == data.seller, "The signer is invalid");

        // transfer token
        _ticketingContract.externallyApprovedTransfer(
            data.seller,
            _msgSender(),
            data.tokenId,
            data.ticketTransferSignature
        );

        // transfer Funds
        _tixContract.externallyApprovedTransfer(
            _msgSender(),
            data.seller,
            data.sellerShare,
            data.tixTransferToSellerSignature
        );
        _tixContract.externallyApprovedTransfer(
            _msgSender(),
            _tixngoAddress,
            data.tixngoShare,
            data.tixTransferToTixngoSignature
        );
        _tixContract.externallyApprovedTransfer(
            _msgSender(),
            organizerAddress,
            data.organizerShare,
            data.tixTransferToOrganizerSignature
        );

        emit Resale(
            data.tokenId,
            _msgSender(),
            data.seller,
            _tixngoAddress,
            organizerAddress,
            data.sellerShare,
            data.tixngoShare,
            data.organizerShare
        );
    }

    function swap(SwapStruct memory data) external override {
        // compute hash
        bytes32 hash = keccak256(
            abi.encode(
                data.tokenId_A,
                data.tokenId_B,
                data.user_A,
                data.user_B
            )
        );

        // check approver signature
        (address recovered, ECDSA.RecoverError error) = ECDSA.tryRecover(
            ECDSA.toEthSignedMessageHash(hash),
            data.approverSignature
        );
        require(
            error == ECDSA.RecoverError.NoError,
            "Error while recovering signer address"
        );
        require(recovered == _approverAddress, "The signer is invalid");

        // check swap offer signature
        (recovered, error) = ECDSA.tryRecover(
            ECDSA.toEthSignedMessageHash(hash),
            data.swapOfferSignature
        );
        require(
            error == ECDSA.RecoverError.NoError,
            "Error while recovering signer address"
        );
        require(recovered == data.user_A, "The signer is invalid");

        // transfer tokens
        _ticketingContract.externallyApprovedTransfer(
            data.user_A,
            data.user_B,
            data.tokenId_A,
            data.ticketTransferSignature_A
        );
        _ticketingContract.externallyApprovedTransfer(
            data.user_B,
            data.user_A,
            data.tokenId_B,
            data.ticketTransferSignature_B
        );
    }
}

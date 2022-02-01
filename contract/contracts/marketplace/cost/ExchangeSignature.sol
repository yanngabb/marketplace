/*
GABBUD Yann
November 2021
*/

// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "../../utils/Context.sol";
import "../../utils/cryptography/ECDSA.sol";
import "../../access/Ownable.sol";
import "../../token/ERC721/IERC721.sol";
import "../../token/ERC20/ERC20.sol";
import "../IIdentity.sol";
import "../ITicketing.sol";
import "../ITIX.sol";

contract ExchangeSignature is Context, Ownable {
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

    // map tokenId -> price in USD
    mapping(uint256 => Resale) private _resales;
    // map offered tokenId -> swap struct
    mapping(uint256 => Swap) private _swaps;

    // fees
    uint256 public constant RESALE_FEE_PERCENTAGE = 2;

    /*
    struct
    */
    struct Resale {
        uint256 price;
        address optionalBuyer;
    }
    struct Swap {
        uint256 eventIdOfWantedToken;
        address optionalParticipant;
    }

    /*
    events
    */
    event CreateResale(
        uint256 indexed tokenId,
        uint256 price,
        address indexed optionalBuyer
    );

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
    function createResaleWithSignature(
        uint256 tokenId,
        uint256 price,
        address optionalBuyer,
        bytes32 hash,
        bytes memory signature
    ) external {
        // check input
        require(
            _resales[tokenId].price == uint256(0x0),
            "The token is already on resale"
        );
        require(
            _swaps[tokenId].eventIdOfWantedToken == uint256(0x0),
            "The token is already on swap"
        );
        require(
            _ticketingContract.ownerOf(tokenId) == _msgSender(),
            "The token does not exist or the sender is not the owner"
        );
        require(price > uint256(0x0), "The price cannot be negativ");
        if (optionalBuyer != address(0x0)) {
            require(
                _identityContract.isSpectator(optionalBuyer),
                "The optional buyer must be a registered user"
            );
        }

        // check hash
        require(
            hash == keccak256(abi.encode(_msgSender(), tokenId, price, optionalBuyer)),
            "The hash is not valid"
        );

        // check signature
        (address recovered, ECDSA.RecoverError error) = ECDSA.tryRecover(
            ECDSA.toEthSignedMessageHash(hash),
            signature
        );
        require(
            error == ECDSA.RecoverError.NoError,
            "Error while recovering signer address"
        );
        require(recovered == _approverAddress, "The signer is invalid");

        // create resale
        _resales[tokenId] = Resale(price, optionalBuyer);
        emit CreateResale(tokenId, price, optionalBuyer);
    }

    function createResaleWithoutSignature(
        uint256 tokenId,
        uint256 price,
        address optionalBuyer
    ) external {
        // check input
        require(
            _resales[tokenId].price == uint256(0x0),
            "The token is already on resale"
        );
        require(
            _swaps[tokenId].eventIdOfWantedToken == uint256(0x0),
            "The token is already on swap"
        );
        require(
            _ticketingContract.ownerOf(tokenId) == _msgSender(),
            "The token does not exist or the sender is not the owner"
        );
        require(price > uint256(0x0), "The price cannot be negativ");
        if (optionalBuyer != address(0x0)) {
            require(
                _identityContract.isSpectator(optionalBuyer),
                "The optional buyer must be a registered user"
            );
        }

        // create resale
        _resales[tokenId] = Resale(price, optionalBuyer);
        emit CreateResale(tokenId, price, optionalBuyer);
    }
}
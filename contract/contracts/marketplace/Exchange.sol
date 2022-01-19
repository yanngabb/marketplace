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
import "./IExchange.sol";

contract Exchange is Context, Ownable, IExchange {
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
    // put a ticket on resale
    function createResale(
        uint256 tokenId,
        uint256 price,
        address optionalBuyer,
        bytes32 hash,
        bytes memory signature
    ) external override {
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

    // remove a ticket from resale
    function cancelResale(uint256 tokenId) external override {
        require(
            _ticketingContract.ownerOf(tokenId) == _msgSender(),
            "The token does not exist or the sender is not the owner"
        );
        require(_resales[tokenId].price != uint256(0x0), "The token is not on resale");

        // remove resale
        delete _resales[tokenId];
        emit CancelResale(tokenId);
    }

    function calcResaleTokenAmount(uint256 tokenId) external view override returns(uint256) {
        uint256 price = _resales[tokenId].price * _tixContract.getUsdRate();
        // divided by two because the seller pays half of the fee and the buyer pays half of the fee
        uint256 fee = price * RESALE_FEE_PERCENTAGE / 100 / 2;
        return price + fee;
    }

    // purchase a ticket on resale
    function acceptResale(uint256 tokenId) external override {
        Resale memory resale = _resales[tokenId];

        // check input
        require(resale.price != uint256(0x0), "The token is not on resale");
        require(
            _identityContract.isSpectator(_msgSender()),
            "The buyer must be a registered user"
        );
        if (resale.optionalBuyer != address(0x0)) {
            require(
                _msgSender() == resale.optionalBuyer,
                "The buyer is not the one chosen by the seller"
            );
        }

        // split amount
        uint256 price = resale.price * _tixContract.getUsdRate();
        uint256 fee = price * RESALE_FEE_PERCENTAGE / 100 / 2;
        require(
            _tixContract.allowance(_msgSender(), address(this)) >= price + fee,
            "Not enough TIX to process the operation"
        );

        // transfer funds
        address owner = _ticketingContract.ownerOf(tokenId);
        _tixContract.transferFrom(_msgSender(), owner,  price - fee);
        _tixContract.transferFrom(_msgSender(), _tixngoAddress, fee);
        _tixContract.transferFrom(
            _msgSender(),
            _ticketingContract.getEvent(
                _ticketingContract.getToken(tokenId).eventId
            ).organizer,
            fee
        );

        // transfer token
        _ticketingContract.transferFrom(owner, _msgSender(), tokenId);

        // remove resale
        delete _resales[tokenId];
        emit AcceptResale(owner, _msgSender(), tokenId, price);
    }

    // swap a ticket on resale
    // if the participant field is the zero address anyone can accept the swap
    function createSwap(
        uint256 tokenId,
        uint256 eventIdOfWantedToken,
        address optionalParticipant,
        bytes32 hash,
        bytes memory signature
    ) external override {
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
            _ticketingContract.isExistingEvent(eventIdOfWantedToken),
            "The event id of the wanted token does not exist"
        );
        require(
            _ticketingContract.ownerOf(tokenId) == _msgSender(),
            "The token does not exist or the sender is not the owner"
        );
        if (optionalParticipant != address(0x0)) {
            require(
                _identityContract.isSpectator(optionalParticipant),
                "The optional participant must be a registered user"
            );
        }

        // check hash
        require(
            hash ==
                keccak256(
                    abi.encode(
                        _msgSender(),
                        tokenId,
                        eventIdOfWantedToken,
                        optionalParticipant
                    )
                ),
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

        // create swap
        _swaps[tokenId] = Swap(eventIdOfWantedToken, optionalParticipant);
        emit CreateSwap(tokenId, eventIdOfWantedToken, optionalParticipant);
    }

    function cancelSwap(uint256 tokenId) external override {
        require(
            _swaps[tokenId].eventIdOfWantedToken != uint256(0x0),
            "The token is not on swap"
        );
        require(
            _ticketingContract.ownerOf(tokenId) == _msgSender(),
            "The token does not exist or the sender is not the owner"
        );

        // remove swap
        delete _swaps[tokenId];
        emit CancelSwap(tokenId);
    }

    function acceptSwap(uint256 creatorTokenId, uint256 acceptorTokenId)
        external
        override
    {
        Swap memory swap = _swaps[creatorTokenId];

        // check input
        require(swap.eventIdOfWantedToken != uint256(0x0), "The token is not on swap");
        require(
            _ticketingContract.ownerOf(acceptorTokenId) == _msgSender(),
            "The token id of the acceptor does not exist or the it is not the owner of the token"
        );
        require(
            _ticketingContract.getToken(acceptorTokenId).eventId ==
                swap.eventIdOfWantedToken,
            "The token of the acceptor is not part the correct event"
        );
        if (swap.optionalParticipant != address(0x0)) {
            require(
                _msgSender() == swap.optionalParticipant,
                "The acceptor is not the one chosen by the creator of the swap"
            );
        }

        // transfer token
        address creator = _ticketingContract.ownerOf(creatorTokenId);
        address acceptor = _msgSender();
        _ticketingContract.transferFrom(creator, acceptor, creatorTokenId);
        _ticketingContract.transferFrom(acceptor, creator, acceptorTokenId);

        // remove swap
        delete _swaps[creatorTokenId];
        emit AcceptSwap(creator, acceptor, creatorTokenId, acceptorTokenId);
    }

    function getResale(uint256 tokenId) external override view returns(Resale memory) {
        return _resales[tokenId];
    }

    function getSwap(uint256 tokenId) external override view returns(Swap memory) {
        return _swaps[tokenId];
    }
}
/*
GABBUD Yann
November 2021
*/

// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

interface IExchangeV1 {
    /*
    structures
    */
    struct ResaleStruc {
        uint256 price;
        address optionalBuyer;
    }
    struct SwapStruc {
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
    event CancelResale(uint256 indexed tokenId);
    event AcceptResale(
        address indexed seller,
        address indexed buyer,
        uint256 indexed tokenId,
        uint256 price
    );
    event CreateSwap(
        uint256 indexed tokenId,
        uint256 indexed eventIdOfWantedToken,
        address optionalParticipant
    );
    event CancelSwap(uint256 indexed tokenId);
    event AcceptSwap(
        address creator,
        address indexed acceptor,
        uint256 indexed creatorTokenId,
        uint256 indexed acceptorTokenId
    );
    event Resale(
        uint256 tokenId,
        address buyer,
        address seller,
        address tixngo,
        address organizer,
        uint256 sellerShare,
        uint256 tixngoShare,
        uint256 organizerShare
    );

    /*
    functions
    */
    function createResale(
        uint256 tokenId,
        uint256 price,
        address optionalBuyer,
        bytes32 hash,
        bytes memory signature
    ) external;

    function cancelResale(uint256 tokenId) external;

    function calcResaleTokenAmount(uint256 tokenId)
        external
        view
        returns (uint256);

    function acceptResale(uint256 tokenId) external;

    function createSwap(
        uint256 tokenId,
        uint256 eventIdOfWantedToken,
        address optionalParticipant,
        bytes32 hash,
        bytes memory signature
    ) external;

    function cancelSwap(uint256 tokenId) external;

    function acceptSwap(uint256 creatorTokenId, uint256 acceptorTokenId)
        external;

    function getResale(uint256 tokenId) external view returns (ResaleStruc memory);

    function getSwap(uint256 tokenId) external view returns (SwapStruc memory);
}

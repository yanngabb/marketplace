/*
GABBUD Yann
November 2021
*/

// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "../token/ERC721/IERC721.sol";

interface ITicketing is IERC721 {
    //structs
    struct _Event {
        address organizer;
        string name;
        string place;
        uint256 openingDate;
        uint256 closingDate;
        bytes32 state;
    }
    struct _Token {
        uint256 eventId;
        uint256 ticketId;
        bytes32 state;
    }

    /*
    events
    */
    event EventRegistration(uint256 eventId, address indexed owner);
    event Minting(
        uint256 indexed tokenId,
        uint256 indexed ticketId,
        address indexed owner
    );
    event Burning(uint256 indexed tokenId, uint256 indexed ticketId);
    event StateUpdate(uint256 indexed tokenId, bytes32 indexed state);

    /*
    functions
    */
    function registerEvent(
        string memory name,
        string memory place,
        uint256 openingDate,
        uint256 closingDate,
        bytes32 state
    ) external;

    function updateEventState(uint256 eventId, bytes32 state) external;

    function mint(
        uint256 eventId,
        uint256 ticketId,
        address owner
    ) external;

    function mintBatch(
        uint256 eventId,
        uint256[] calldata ticketIds,
        address[] calldata owners
    ) external;

    function burn(uint256 tokenId) external;

    function burnBatch(uint256[] calldata tokenIds) external;

    function updateTokenState(
        uint256 tokenId,
        bytes32 state
    ) external;

    function updateTokenStateBatch(
        uint256[] calldata tokenIds,
        bytes32[] calldata states
    ) external;

    function isExistingEvent(uint256 eventId) external view returns (bool);

    function getEvent(uint256 eventId) external view returns (_Event memory);

    function getToken(uint256 tokenId) external view returns (_Token memory);
}

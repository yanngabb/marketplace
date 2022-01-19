/*
GABBUD Yann
November 2021
*/

// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "../utils/Context.sol";
import "../utils/Counters.sol";
import "../access/Ownable.sol";
import "../token/ERC721/ERC721.sol";
import "./IIdentity.sol";
import "./ITIX.sol";
import "./ITicketing.sol";

contract Ticketing is Context, Ownable, ERC721, ITicketing {
    // contract
    IIdentity private immutable _identityContract;
    ITIX private immutable _tixContract;

    // tixngo address
    address private immutable _tixngoAddress;

    // counters
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdTracker;
    Counters.Counter private _eventIdTracker;

    // batch maximum size
    uint8 public constant BATCH_LIMIT = 100;

    // event states
    bytes32 public constant EVENT_PENDING = keccak256("EVENT_PENDING");
    bytes32 public constant EVENT_OPEN = keccak256("EVENT_OPEN");
    bytes32 public constant EVENT_CANCELLED = keccak256("EVENT_CANCELLED");

    // token states
    bytes32 public constant TOKEN_VALID = keccak256("TOKEN_VALID");
    bytes32 public constant TOKEN_INVALID = keccak256("TOKEN_INVALID");
    bytes32 public constant TOKEN_SCANNED = keccak256("TOKEN_SCANNED");
    bytes32 public constant TOKEN_CLAIMED = keccak256("TOKEN_CLAIMED");

    // eventId -> event struct
    mapping(uint256 => _Event) private _events;
    // tokenId -> token struct
    mapping(uint256 => _Token) private _tokens;

    // registration fee in USD
    uint256 public constant EVENT_REGISTRATION_FEE = 1000;
    // minting fee in USD
    uint256 public constant MINTING_FEE = 1;

    /*
    constructor
    */
    constructor(
        address identityAddress,
        address tixAddress,
        address tixngoAddress
    ) ERC721("Ticketing", "TICKET") {
        _identityContract = IIdentity(identityAddress);
        _tixContract = ITIX(tixAddress);
        _tixngoAddress = tixngoAddress;
        _eventIdTracker.increment();
        _tokenIdTracker.increment();
    }

    /*
    modifiers
    */
    modifier onlyExistingEvent(uint256 eventId) {
        require(
            _events[eventId].organizer != address(0x0),
            "The event id does not exist"
        );
        _;
    }

    modifier onlyOrganizerOfTheEvent(uint256 eventId, address operator) {
        require(
            _events[eventId].organizer == operator,
            "Only the organizer of the event can perform this operation"
        );
        _;
    }

    /*
    functions
    */
    function registerEvent(
        string memory name,
        string memory place,
        uint256 openingDate,
        uint256 closingDate,
        bytes32 state
    ) external override {
        require(
            _identityContract.isOrganizer(_msgSender()),
            "The user registring a new event must be an organizer"
        );
        require(
            openingDate < closingDate,
            "The opening date cannot be after the closing date"
        );
        uint256 fee = EVENT_REGISTRATION_FEE * _tixContract.getUsdRate();
        require(
            _tixContract.allowance(_msgSender(), address(this)) >= fee,
            "Not enough funds to perfom this operation"
        );
        require(
            state == EVENT_PENDING || state == EVENT_OPEN,
            "The state is not valid"
        );

        // transfer fee
        _tixContract.transferFrom(_msgSender(), _tixngoAddress, fee);

        // create event
        uint256 eventId = _eventIdTracker.current();
        _events[eventId] = _Event(
            _msgSender(),
            name,
            place,
            openingDate,
            closingDate,
            state
        );
        emit EventRegistration(eventId, _msgSender());

        _eventIdTracker.increment();
    }

    function updateEventState(uint256 eventId, bytes32 state)
        external
        override
        onlyExistingEvent(eventId)
        onlyOrganizerOfTheEvent(eventId, _msgSender())
    {
        require(
            state == EVENT_PENDING ||
                state == EVENT_OPEN ||
                state == EVENT_CANCELLED,
            "The state is not valid"
        );
        _events[eventId].state = state;
    }

    function mint(
        uint256 eventId,
        uint256 ticketId,
        address owner
    )
        public
        override
        onlyExistingEvent(eventId)
        onlyOrganizerOfTheEvent(eventId, _msgSender())
    {
        require(
            _identityContract.isSpectator(owner),
            "The owner of the ticket must be registered"
        );
        uint256 fee = MINTING_FEE * _tixContract.getUsdRate();
        require(
            _tixContract.allowance(_msgSender(), address(this)) >= fee,
            "Not enough funds to perfom this operation"
        );

        // transfer fee
        _tixContract.transferFrom(_msgSender(), _tixngoAddress, fee);

        // mint token
        uint256 tokenId = _tokenIdTracker.current();
        _mint(owner, tokenId);
        _tokens[tokenId] = _Token(eventId, ticketId, TOKEN_VALID);
        emit Minting(tokenId, ticketId, owner);

        _tokenIdTracker.increment();
    }

    function mintBatch(
        uint256 eventId,
        uint256[] calldata ticketIds,
        address[] calldata owners
    )
        public
        override
        onlyExistingEvent(eventId)
        onlyOrganizerOfTheEvent(eventId, _msgSender())
    {
        require(
            owners.length <= BATCH_LIMIT && ticketIds.length <= BATCH_LIMIT,
            "The batch is too big. BATCH_LIMIT = 100"
        );
        require(
            owners.length == ticketIds.length,
            "The owners array and the ticketIds array do not have the same lenght"
        );
        uint256 fee = MINTING_FEE *
            _tixContract.getUsdRate() *
            ticketIds.length;
        require(
            _tixContract.allowance(_msgSender(), address(this)) >= fee,
            "Not enough funds to perfom this operation"
        );

        // transfer fee
        _tixContract.transferFrom(_msgSender(), _tixngoAddress, fee);

        // mint token
        for (uint256 i = 0; i < owners.length; i = i + 1) {
            require(
                _identityContract.isSpectator(owners[i]),
                "The owner of the ticket must be registered"
            );
            uint256 tokenId = _tokenIdTracker.current();
            _mint(owners[i], tokenId);
            _tokens[tokenId] = _Token(eventId, ticketIds[i], TOKEN_VALID);
            emit Minting(tokenId, ticketIds[i], owners[i]);

            _tokenIdTracker.increment();
        }
    }

    function burn(uint256 tokenId)
        public
        override
    {
        require(_exists(tokenId), "The token does not exists");
        require(
            _events[_tokens[tokenId].eventId].organizer == _msgSender(),
            "Only the minter of the token can perform this operation"
        );
        uint256 ticketId = _tokens[tokenId].ticketId;

        _burn(tokenId);
        delete _tokens[tokenId];

        emit Burning(tokenId, ticketId);
    }

    function burnBatch(uint256[] calldata tokenIds) public override {
        require(
            tokenIds.length <= BATCH_LIMIT,
            "The batch is too big. BATCH_LIMIT = 100"
        );
        for (uint256 i = 0; i < tokenIds.length; i = i + 1) {
            require(_exists(tokenIds[i]), "The token does not exists");
            require(
                _events[_tokens[tokenIds[i]].eventId].organizer == _msgSender(),
                "Only the minter of the token can perform this operation"
            );
            uint256 ticketId = _tokens[tokenIds[i]].ticketId;

            _burn(tokenIds[i]);
            delete _tokens[tokenIds[i]];

            emit Burning(tokenIds[i], ticketId);
        }
    }

    function updateTokenState(uint256 tokenId, bytes32 state)
        public
        override
    {
        require(_exists(tokenId), "The token does not exists");
        require(
            _events[_tokens[tokenId].eventId].organizer == _msgSender(),
            "Only the minter of the token can perform this operation"
        );
        require(
            state == TOKEN_VALID ||
                state == TOKEN_INVALID ||
                state == TOKEN_SCANNED ||
                state == TOKEN_CLAIMED,
            "The state is not valid"
        );
        _tokens[tokenId].state = state;

        emit StateUpdate(tokenId, state);
    }

    function updateTokenStateBatch(
        uint256[] calldata tokenIds,
        bytes32[] calldata states
    ) public override {
        require(
            tokenIds.length <= BATCH_LIMIT && states.length <= BATCH_LIMIT,
            "The batch is too big. BATCH_LIMIT = 100"
        );
        require(
            tokenIds.length == states.length,
            "The tokenIds array and the states array do not have the same lenght"
        );
        for (uint256 i = 0; i < tokenIds.length; i = i + 1) {
            require(_exists(tokenIds[i]), "The token does not exists");
            require(
                _events[_tokens[tokenIds[i]].eventId].organizer == _msgSender(),
                "Only the minter of the token can perform this operation"
            );
            require(
                states[i] == TOKEN_VALID ||
                    states[i] == TOKEN_INVALID ||
                    states[i] == TOKEN_SCANNED ||
                    states[i] == TOKEN_CLAIMED,
                "The state is not valid"
            );
            _tokens[tokenIds[i]].state = states[i];

            emit StateUpdate(tokenIds[i], states[i]);
        }
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override(ERC721, IERC721) {
        require(
            _identityContract.isSpectator(to),
            "You cannot transfer a ticket to an unregisterd address"
        );
        require(
            block.timestamp < _events[_tokens[tokenId].eventId].closingDate,
            "Transfer impossible. The event is over"
        );
        require(
            _events[_tokens[tokenId].eventId].state == EVENT_OPEN,
            "Transfer impossible. The event is not yet open or cancelled"
        );
        require(
            _tokens[tokenId].state == TOKEN_VALID,
            "Transfer impossible, the token state is not valid"
        );
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: transfer caller is not owner nor approved");

        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override(ERC721, IERC721) {
        require(
            _identityContract.isSpectator(to),
            "You cannot transfer a ticket to an unregisterd address"
        );
        require(
            block.timestamp < _events[_tokens[tokenId].eventId].closingDate,
            "Transfer impossible. The event is over"
        );
        require(
            _events[_tokens[tokenId].eventId].state == EVENT_OPEN,
            "Transfer impossible. The event is not yet open or cancelled"
        );
        require(
            _tokens[tokenId].state == TOKEN_VALID,
            "Transfer impossible, the token state is not valid"
        );
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory _data
    ) public override(ERC721, IERC721) {
        require(
            _identityContract.isSpectator(to),
            "You cannot transfer a ticket to an unregisterd address"
        );
        require(
            block.timestamp < _events[_tokens[tokenId].eventId].closingDate,
            "Transfer impossible. The event is over"
        );
        require(
            _events[_tokens[tokenId].eventId].state == EVENT_OPEN,
            "Transfer impossible. The event is not yet open or cancelled"
        );
        require(
            _tokens[tokenId].state == TOKEN_VALID,
            "Transfer impossible, the token state is not valid"
        );
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: transfer caller is not owner nor approved");
        _safeTransfer(from, to, tokenId, _data);
    }

    function isExistingEvent(uint256 eventId)
        public
        view
        override
        returns (bool)
    {
        return _events[eventId].organizer != address(0x0);
    }

    function getEvent(uint256 eventId)
        public
        view
        override
        returns (_Event memory)
    {
        return _events[eventId];
    }

    function getToken(uint256 tokenId)
        public
        view
        override
        returns (_Token memory)
    {
        return _tokens[tokenId];
    }

    /*
    overidden functions
    */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override(ERC721) {
        super._beforeTokenTransfer(from, to, tokenId);
    }
}

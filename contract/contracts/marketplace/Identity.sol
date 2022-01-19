/*
GABBUD Yann
November 2021
*/

// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "../utils/Context.sol";
import "../utils/cryptography/ECDSA.sol";
import "../access/Ownable.sol";
import "./IIdentity.sol";

contract Identity is Context, Ownable, IIdentity {
    // groups
    bytes32 public constant SPECTATOR_GROUP = keccak256("SPECTATOR_GROUP");
    bytes32 public constant ORGANIZER_GROUP = keccak256("ORGANIZER_GROUP");
    bytes32 public constant UNREGISTERED_GROUP =
        keccak256("UNREGISTERED_GROUP");
    bytes32 public constant REVOKED_GROUP = keccak256("REVOKED_GROUP");

    // oracle address
    address private immutable _identifierAddress;

    // map address -> group (null entry == not registered user (!= unregistered))
    mapping(address => bytes32) private _users;

    /*
    constructor
    */
    constructor(address identifierAddress) {
        _identifierAddress = identifierAddress; 
    }

    /*
    functions
    */
    function register(
        bytes32 group, 
        bytes32 hash,
        bytes memory signature
    ) external override {
        require(!isRegistered(_msgSender()), "The user already exists");
        require(_isValidGroup(group), "The group is not valid");

        // check hash
        require(hash == keccak256(abi.encode(_msgSender(), group)), "The hash is not valid");

        // check signature
        (address recovered, ECDSA.RecoverError error) = ECDSA.tryRecover(ECDSA.toEthSignedMessageHash(hash), signature);
        require(error == ECDSA.RecoverError.NoError, "Error while recovering signer address");
        require(recovered == _identifierAddress, "The signer is invalid");

        _users[_msgSender()] = group;
        emit Registation(_msgSender(), group, hash, signature);
    }

    function unregister() external override {
        require(isRegistered(_msgSender()), "The user does not exist");
        _users[_msgSender()] = UNREGISTERED_GROUP;
        emit Unregistration(_msgSender());
    }

    function revoke(address account) external override onlyOwner {
        require(isRegistered(account), "The user does not exist");
        _users[account] = REVOKED_GROUP;
        emit Revocation(account);
    }

    function isSpectator(address account)
        public
        view
        override
        returns (bool)
    {
        return _users[account] == SPECTATOR_GROUP;
    }

    function isOrganizer(address account)
        public
        view
        override
        returns (bool)
    {
        return _users[account] == ORGANIZER_GROUP;
    }

    function isRegistered(address account) public view returns (bool) {
        return
            _users[account] == SPECTATOR_GROUP ||
            _users[account] == ORGANIZER_GROUP;
    }

    function _isValidGroup(bytes32 group) internal pure returns (bool) {
        return
            group == SPECTATOR_GROUP ||
            group == ORGANIZER_GROUP ||
            group == UNREGISTERED_GROUP ||
            group == REVOKED_GROUP;
    }
}
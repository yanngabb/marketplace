/*
GABBUD Yann
November 2021
*/

// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

interface IIdentity {
    // events
    event Registation(
        address indexed user,
        bytes32 indexed class,
        bytes32 hash,
        bytes signature
    );
    event Unregistration(address indexed user);
    event Revocation(address indexed user);

    /*
    functions
    */
    function register(
        bytes32 group,
        bytes32 hash,
        bytes memory signature
    ) external;

    function unregister() external;

    function revoke(address user) external;

    function isSpectator(address account) external view returns (bool);

    function isOrganizer(address account) external view returns (bool);
}

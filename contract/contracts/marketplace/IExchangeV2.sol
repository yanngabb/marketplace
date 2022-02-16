/*
GABBUD Yann
November 2021
*/

// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

interface IExchangeV2 {
    /*
    struct
    */
    struct ResaleStruct {
        uint256 tokenId;
        address optionalBuyer;
        address seller;
        uint256 sellerShare;
        uint256 tixngoShare;
        uint256 organizerShare;
        bytes approverSignature;
        bytes resaleOfferSignature;
        bytes ticketTransferSignature;
        bytes tixTransferToSellerSignature;
        bytes tixTransferToTixngoSignature;
        bytes tixTransferToOrganizerSignature;
    }

    struct SwapStruct {
        uint256 tokenId_A;
        uint256 tokenId_B;
        address user_A;
        address user_B;
        bytes approverSignature;
        bytes swapAcceptSignature_A;
        bytes swapAcceptSignature_B;
        bytes ticketTransferSignature_A;
        bytes ticketTransferSignature_B;
    }

    /*
    events
    */
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

    event Swap(
        uint256 tokenId_A,
        uint256 tokenId_B,
        address user_A,
        address user_B
    );

    /*
    functions
    */
    function resell(ResaleStruct memory data) external;
    function swap(SwapStruct memory data) external;
}

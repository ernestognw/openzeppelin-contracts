// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0-rc.1) (interfaces/IERC2309.sol)

pragma solidity ^0.8.0;

/**
 * @dev ERC-2309: ERC-721 Consecutive Transfer Extension.
 *
 * _Available since v4.8._
 */
interface IERC2309 {
    /**
     * @dev Emitted when the tokens from `fromTokenId` to `toTokenId` are transferred from `fromAddress` to `toAddress`.
     */
    event ConsecutiveTransfer(
        uint256 indexed fromTokenId,
        uint256 toTokenId,
        address indexed fromAddress,
        address indexed toAddress
    );
}

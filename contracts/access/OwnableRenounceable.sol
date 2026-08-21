// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {Context} from "../utils/Context.sol";
import {Ownable} from "./Ownable.sol";

/**
 * @dev Variant of {Ownable} that restores the {renounceOwnership} function and
 * restricts {transferOwnership} to non-zero addresses, matching the pre-v5.X
 * behavior of {Ownable}.
 *
 * NOTE: This contract is provided for backwards compatibility and for use cases
 * that require the ability to renounce ownership. New contracts should prefer
 * {Ownable} unless renouncement is an intended feature.
 */
abstract contract OwnableRenounceable is Context, Ownable {
    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual override {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        super.transferOwnership(newOwner);
    }
}

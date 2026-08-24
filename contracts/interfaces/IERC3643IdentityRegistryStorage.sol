// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IIdentity} from "./IERC3643Identity.sol";

/**
 * @title IIdentityRegistryStorage
 * @dev Interface for the Identity Registry Storage contract in the ERC-3643 ecosystem.
 *
 * The Identity Registry Storage is a specialized storage contract that maintains the identity
 * addresses of all authorized investors for security tokens linked to the storage contract.
 * It serves as a shared storage layer that can be bound to one or several Identity Registry
 * contracts, enabling efficient data sharing and separation of concerns.
 *
 * Key responsibilities:
 *
 * * Store identity addresses for authorized investors
 * * Maintain investor country codes (ISO-3166 standard)
 * * Manage binding relationships with Identity Registry contracts
 * * Provide shared storage for multiple token ecosystems
 * * Enable separation of registry logic from storage implementation
 *
 * Architecture benefits:
 *
 * * Shared Whitelist: Multiple tokens can use the same investor whitelist
 * * Modular Design: Registry logic separated from storage implementation
 * * Scalability: One storage contract can serve multiple registries
 * * Upgradability: Registry contracts can be updated while preserving data
 * * Access Control: Only bound registries can modify stored data
 */
interface IIdentityRegistryStorage {
    /**
     * @dev Emitted when an investor identity is stored in the storage contract.
     *
     * @param investorAddress The wallet address of the investor
     * @param identity The address of the investor's Identity contract
     */
    event IdentityStored(address indexed investorAddress, IIdentity indexed identity);

    /**
     * @dev Emitted when an investor identity is removed from the storage contract.
     *
     * @param investorAddress The wallet address of the investor
     * @param identity The address of the investor's Identity contract that was removed
     */
    event IdentityUnstored(address indexed investorAddress, IIdentity indexed identity);

    /**
     * @dev Emitted when an investor's identity contract is modified in storage.
     *
     * @param oldIdentity The address of the previous Identity contract
     * @param newIdentity The address of the new Identity contract
     */
    event IdentityModified(IIdentity indexed oldIdentity, IIdentity indexed newIdentity);

    /**
     * @dev Emitted when an investor's country code is modified in storage.
     *
     * @param investorAddress The wallet address of the investor
     * @param country The new country code (ISO-3166 standard)
     */
    event CountryModified(address indexed investorAddress, uint16 indexed country);

    /**
     * @dev Emitted when an Identity Registry contract is bound to this storage.
     *
     * @param identityRegistry The address of the Identity Registry contract that was bound
     */
    event IdentityRegistryBound(address indexed identityRegistry);

    /**
     * @dev Emitted when an Identity Registry contract is unbound from this storage.
     *
     * @param identityRegistry The address of the Identity Registry contract that was unbound
     */
    event IdentityRegistryUnbound(address indexed identityRegistry);

    /**
     * @dev Returns the Identity contract stored for a given wallet address.
     *
     * @param _userAddress The wallet address to query
     * @return The Identity contract interface, or zero address if not stored
     */
    function storedIdentity(address _userAddress) external view returns (IIdentity);

    /**
     * @dev Returns the country code stored for a given investor.
     *
     * @param _userAddress The wallet address to query
     * @return The country code (ISO-3166 standard), or 0 if not stored
     */
    function storedInvestorCountry(address _userAddress) external view returns (uint16);

    /**
     * @dev Adds an investor identity to storage.
     *
     * @param _userAddress The wallet address of the investor
     * @param _identity The address of the investor's Identity contract
     * @param _country The country code of the investor (ISO-3166 standard)
     *
     * Requirements:
     *
     * * Only bound Identity Registry contracts can call this function
     * * `_userAddress` must not already be stored
     * * `_identity` must be a valid Identity contract address
     * * `_country` must be a valid ISO-3166 country code
     *
     * Emits an {IdentityStored} event.
     */
    function addIdentityToStorage(address _userAddress, IIdentity _identity, uint16 _country) external;

    /**
     * @dev Removes an investor identity from storage.
     *
     * @param _userAddress The wallet address of the investor to remove
     *
     * Requirements:
     *
     * * Only bound Identity Registry contracts can call this function
     * * `_userAddress` must be currently stored
     *
     * Emits an {IdentityUnstored} event.
     */
    function removeIdentityFromStorage(address _userAddress) external;

    /**
     * @dev Modifies the country code for a stored investor.
     *
     * @param _userAddress The wallet address of the investor
     * @param _country The new country code (ISO-3166 standard)
     *
     * Requirements:
     *
     * * Only bound Identity Registry contracts can call this function
     * * `_userAddress` must be currently stored
     * * `_country` must be a valid ISO-3166 country code
     *
     * Emits a {CountryModified} event.
     */
    function modifyStoredInvestorCountry(address _userAddress, uint16 _country) external;

    /**
     * @dev Modifies the Identity contract for a stored investor.
     *
     * @param _userAddress The wallet address of the investor
     * @param _identity The address of the new Identity contract
     *
     * Requirements:
     *
     * * Only bound Identity Registry contracts can call this function
     * * `_userAddress` must be currently stored
     * * `_identity` must be a valid Identity contract address
     *
     * Emits an {IdentityModified} event.
     */
    function modifyStoredIdentity(address _userAddress, IIdentity _identity) external;

    /**
     * @dev Binds an Identity Registry contract to this storage, granting it write access.
     *
     * @param _identityRegistry The address of the Identity Registry contract to bind
     *
     * Requirements:
     *
     * * Only the owner can call this function
     * * `_identityRegistry` must be a valid contract address
     * * `_identityRegistry` must not already be bound
     *
     * Emits an {IdentityRegistryBound} event.
     */
    function bindIdentityRegistry(address _identityRegistry) external;

    /**
     * @dev Unbinds an Identity Registry contract from this storage, revoking its write access.
     *
     * @param _identityRegistry The address of the Identity Registry contract to unbind
     *
     * Requirements:
     *
     * * Only the owner can call this function
     * * `_identityRegistry` must be currently bound
     *
     * Emits an {IdentityRegistryUnbound} event.
     */
    function unbindIdentityRegistry(address _identityRegistry) external;

    /**
     * @dev Returns an array of all Identity Registry contracts bound to this storage.
     *
     * @return Array of addresses of bound Identity Registry contracts
     */
    function linkedIdentityRegistries() external view returns (address[] memory);
}

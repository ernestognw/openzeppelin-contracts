// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IIdentity} from "./IERC3643Identity.sol";
import {IIdentityRegistryStorage} from "./IERC3643IdentityRegistryStorage.sol";
import {ITrustedIssuersRegistry} from "./IERC3643TrustedIssuersRegistry.sol";
import {IClaimTopicsRegistry} from "./IERC3643ClaimTopicsRegistry.sol";

/**
 * @title IIdentityRegistry
 * @dev Interface for the Identity Registry contract in the ERC-3643 ecosystem.
 *
 * The Identity Registry is a crucial component that maintains a dynamic whitelist of verified
 * identities for security token holders. It establishes the link between wallet addresses,
 * Identity smart contracts, and country codes corresponding to investors' countries of residence.
 *
 * Key responsibilities:
 *
 * * Manage investor identity verification and registration
 * * Link wallet addresses to onchain Identity contracts
 * * Store investor country codes (ISO-3166 standard)
 * * Integrate with Trusted Issuers Registry and Claim Topics Registry
 * * Provide verification status for token transfer eligibility
 *
 * The registry works in conjunction with:
 *
 * * Identity Registry Storage: For storing identity data
 * * Trusted Issuers Registry: For managing authorized claim issuers
 * * Claim Topics Registry: For defining required claim topics
 * * Individual Identity contracts: For storing investor claims and credentials
 */
interface IIdentityRegistry {
    /**
     * @dev Emitted when the Claim Topics Registry is set for the Identity Registry.
     *
     * @param claimTopicsRegistry The address of the Claim Topics Registry contract
     */
    event ClaimTopicsRegistrySet(address indexed claimTopicsRegistry);

    /**
     * @dev Emitted when the Identity Registry Storage is set for the Identity Registry.
     *
     * @param identityStorage The address of the Identity Registry Storage contract
     */
    event IdentityStorageSet(address indexed identityStorage);

    /**
     * @dev Emitted when the Trusted Issuers Registry is set for the Identity Registry.
     *
     * @param trustedIssuersRegistry The address of the Trusted Issuers Registry contract
     */
    event TrustedIssuersRegistrySet(address indexed trustedIssuersRegistry);

    /**
     * @dev Emitted when a new investor identity is registered.
     *
     * @param investorAddress The wallet address of the investor
     * @param identity The address of the investor's Identity contract
     */
    event IdentityRegistered(address indexed investorAddress, IIdentity indexed identity);

    /**
     * @dev Emitted when an investor identity is removed from the registry.
     *
     * @param investorAddress The wallet address of the investor
     * @param identity The address of the investor's Identity contract that was removed
     */
    event IdentityRemoved(address indexed investorAddress, IIdentity indexed identity);

    /**
     * @dev Emitted when an investor's identity contract is updated.
     *
     * @param oldIdentity The address of the previous Identity contract
     * @param newIdentity The address of the new Identity contract
     */
    event IdentityUpdated(IIdentity indexed oldIdentity, IIdentity indexed newIdentity);

    /**
     * @dev Emitted when an investor's country code is updated.
     *
     * @param investorAddress The wallet address of the investor
     * @param country The new country code (ISO-3166 standard)
     */
    event CountryUpdated(address indexed investorAddress, uint16 indexed country);

    /**
     * @dev Returns the Identity Registry Storage contract.
     *
     * @return The Identity Registry Storage contract interface
     */
    function identityStorage() external view returns (IIdentityRegistryStorage);

    /**
     * @dev Returns the Trusted Issuers Registry contract.
     *
     * @return The Trusted Issuers Registry contract interface
     */
    function issuersRegistry() external view returns (ITrustedIssuersRegistry);

    /**
     * @dev Returns the Claim Topics Registry contract.
     *
     * @return The Claim Topics Registry contract interface
     */
    function topicsRegistry() external view returns (IClaimTopicsRegistry);

    /**
     * @dev Sets the Identity Registry Storage contract address.
     *
     * @param _identityRegistryStorage The address of the new Identity Registry Storage contract
     *
     * Requirements:
     *
     * * Only the owner can call this function
     * * `_identityRegistryStorage` must be a valid contract address
     *
     * Emits an {IdentityStorageSet} event.
     */
    function setIdentityRegistryStorage(address _identityRegistryStorage) external;

    /**
     * @dev Sets the Claim Topics Registry contract address.
     *
     * @param _claimTopicsRegistry The address of the new Claim Topics Registry contract
     *
     * Requirements:
     *
     * * Only the owner can call this function
     * * `_claimTopicsRegistry` must be a valid contract address
     *
     * Emits a {ClaimTopicsRegistrySet} event.
     */
    function setClaimTopicsRegistry(address _claimTopicsRegistry) external;

    /**
     * @dev Sets the Trusted Issuers Registry contract address.
     *
     * @param _trustedIssuersRegistry The address of the new Trusted Issuers Registry contract
     *
     * Requirements:
     *
     * * Only the owner can call this function
     * * `_trustedIssuersRegistry` must be a valid contract address
     *
     * Emits a {TrustedIssuersRegistrySet} event.
     */
    function setTrustedIssuersRegistry(address _trustedIssuersRegistry) external;

    /**
     * @dev Registers a new investor identity in the registry.
     *
     * @param _userAddress The wallet address of the investor
     * @param _identity The address of the investor's Identity contract
     * @param _country The country code of the investor (ISO-3166 standard)
     *
     * Requirements:
     *
     * * Only authorized agents can call this function
     * * `_userAddress` must not already be registered
     * * `_identity` must be a valid Identity contract
     * * `_country` must be a valid ISO-3166 country code
     *
     * Emits an {IdentityRegistered} event.
     */
    function registerIdentity(address _userAddress, IIdentity _identity, uint16 _country) external;

    /**
     * @dev Removes an investor identity from the registry.
     *
     * @param _userAddress The wallet address of the investor to remove
     *
     * Requirements:
     *
     * * Only authorized agents can call this function
     * * `_userAddress` must be currently registered
     *
     * Emits an {IdentityRemoved} event.
     */
    function deleteIdentity(address _userAddress) external;

    /**
     * @dev Updates the country code for a registered investor.
     *
     * @param _userAddress The wallet address of the investor
     * @param _country The new country code (ISO-3166 standard)
     *
     * Requirements:
     *
     * * Only authorized agents can call this function
     * * `_userAddress` must be currently registered
     * * `_country` must be a valid ISO-3166 country code
     *
     * Emits a {CountryUpdated} event.
     */
    function updateCountry(address _userAddress, uint16 _country) external;

    /**
     * @dev Updates the Identity contract for a registered investor.
     *
     * @param _userAddress The wallet address of the investor
     * @param _identity The address of the new Identity contract
     *
     * Requirements:
     *
     * * Only authorized agents can call this function
     * * `_userAddress` must be currently registered
     * * `_identity` must be a valid Identity contract
     *
     * Emits an {IdentityUpdated} event.
     */
    function updateIdentity(address _userAddress, IIdentity _identity) external;

    /**
     * @dev Registers multiple investor identities in a single transaction.
     *
     * @param _userAddresses Array of wallet addresses of the investors
     * @param _identities Array of Identity contract addresses
     * @param _countries Array of country codes (ISO-3166 standard)
     *
     * Requirements:
     *
     * * Only authorized agents can call this function
     * * All arrays must have the same length
     * * No `_userAddresses` should already be registered
     * * All `_identities` must be valid Identity contracts
     * * All `_countries` must be valid ISO-3166 country codes
     *
     * Emits multiple {IdentityRegistered} events.
     */
    function batchRegisterIdentity(
        address[] calldata _userAddresses,
        IIdentity[] calldata _identities,
        uint16[] calldata _countries
    ) external;

    /**
     * @dev Checks if a wallet address is registered in the identity registry.
     *
     * @param _userAddress The wallet address to check
     * @return True if the address is registered, false otherwise
     */
    function contains(address _userAddress) external view returns (bool);

    /**
     * @dev Checks if a wallet address is verified and eligible for token operations.
     *
     * This function performs comprehensive verification including:
     *
     * * Address is registered in the identity registry
     * * Associated Identity contract contains required claims
     * * Claims are signed by trusted issuers
     * * All claim topics required by the registry are present
     *
     * @param _userAddress The wallet address to verify
     * @return True if the address is fully verified and eligible, false otherwise
     */
    function isVerified(address _userAddress) external view returns (bool);

    /**
     * @dev Returns the Identity contract associated with a wallet address.
     *
     * @param _userAddress The wallet address to query
     * @return The Identity contract interface, or zero address if not registered
     */
    function identity(address _userAddress) external view returns (IIdentity);

    /**
     * @dev Returns the country code for a registered investor.
     *
     * @param _userAddress The wallet address to query
     * @return The country code (ISO-3166 standard), or 0 if not registered
     */
    function investorCountry(address _userAddress) external view returns (uint16);
}

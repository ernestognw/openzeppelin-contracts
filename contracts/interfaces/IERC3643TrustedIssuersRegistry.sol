// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IClaimIssuer} from "./IERC3643Identity.sol";

/**
 * @title ITrustedIssuersRegistry
 * @dev Interface for the Trusted Issuers Registry contract in the ERC-3643 ecosystem.
 *
 * The Trusted Issuers Registry manages a whitelist of authorized claim issuers that are
 * trusted to provide valid claims for identity verification. It defines which claim issuers
 * are authorized and what types of claims (topics) each issuer is allowed to emit.
 *
 * Key responsibilities:
 *
 * * Maintain a registry of trusted claim issuer contracts
 * * Define claim topics that each issuer is authorized to emit
 * * Provide validation for claim issuer authorization
 * * Enable efficient lookup of issuers by claim topic
 *
 * Claim topics are numeric identifiers representing different types of claims:
 *
 * * Example: KYC = 1, AML = 2, Accreditation = 3, etc.
 *
 * The registry works in conjunction with:
 *
 * * Identity Registry: For identity verification processes
 * * Identity contracts: For claim validation
 * * Compliance contracts: For regulatory requirement enforcement
 * * Claim Topics Registry: For defining required claim types
 */
interface ITrustedIssuersRegistry {
    /**
     * @dev Emitted when a trusted issuer is added to the registry.
     *
     * @param trustedIssuer The address of the claim issuer contract that was added
     * @param claimTopics Array of claim topic IDs that the issuer is authorized to emit
     */
    event TrustedIssuerAdded(IClaimIssuer indexed trustedIssuer, uint256[] claimTopics);

    /**
     * @dev Emitted when a trusted issuer is removed from the registry.
     *
     * @param trustedIssuer The address of the claim issuer contract that was removed
     */
    event TrustedIssuerRemoved(IClaimIssuer indexed trustedIssuer);

    /**
     * @dev Emitted when the authorized claim topics for a trusted issuer are updated.
     *
     * @param trustedIssuer The address of the claim issuer contract that was updated
     * @param claimTopics Array of new claim topic IDs that the issuer is authorized to emit
     */
    event ClaimTopicsUpdated(IClaimIssuer indexed trustedIssuer, uint256[] claimTopics);

    /**
     * @dev Adds a claim issuer to the trusted registry with authorized claim topics.
     *
     * @param _trustedIssuer The address of the claim issuer contract to add
     * @param _claimTopics Array of claim topic IDs that the issuer is authorized to emit
     *
     * Requirements:
     *
     * * Only the owner can call this function
     * * `_trustedIssuer` must be a valid claim issuer contract
     * * `_trustedIssuer` must not already be registered
     * * `_claimTopics` array must not be empty
     * * `_claimTopics` array must not exceed 15 topics (gas optimization)
     * * Registry must not exceed 50 trusted issuers (gas optimization)
     *
     * Emits a {TrustedIssuerAdded} event.
     */
    function addTrustedIssuer(IClaimIssuer _trustedIssuer, uint256[] calldata _claimTopics) external;

    /**
     * @dev Removes a claim issuer from the trusted registry.
     *
     * @param _trustedIssuer The address of the claim issuer contract to remove
     *
     * Requirements:
     *
     * * Only the owner can call this function
     * * `_trustedIssuer` must be currently registered as a trusted issuer
     *
     * Emits a {TrustedIssuerRemoved} event.
     */
    function removeTrustedIssuer(IClaimIssuer _trustedIssuer) external;

    /**
     * @dev Updates the authorized claim topics for an existing trusted issuer.
     *
     * @param _trustedIssuer The address of the claim issuer contract to update
     * @param _claimTopics Array of new claim topic IDs that the issuer is authorized to emit
     *
     * Requirements:
     *
     * * Only the owner can call this function
     * * `_trustedIssuer` must be currently registered as a trusted issuer
     * * `_claimTopics` array must not be empty
     * * `_claimTopics` array must not exceed 15 topics (gas optimization)
     *
     * Emits a {ClaimTopicsUpdated} event.
     */
    function updateIssuerClaimTopics(IClaimIssuer _trustedIssuer, uint256[] calldata _claimTopics) external;

    /**
     * @dev Returns an array of all registered trusted claim issuers.
     *
     * @return Array of trusted claim issuer contract addresses
     */
    function getTrustedIssuers() external view returns (IClaimIssuer[] memory);

    /**
     * @dev Checks if a given address is registered as a trusted claim issuer.
     *
     * @param _issuer The address to check
     * @return True if the address is a registered trusted issuer, false otherwise
     */
    function isTrustedIssuer(address _issuer) external view returns (bool);

    /**
     * @dev Returns the claim topics that a trusted issuer is authorized to emit.
     *
     * @param _trustedIssuer The address of the trusted claim issuer
     * @return Array of claim topic IDs that the issuer is authorized to emit
     *
     * Requirements:
     *
     * * `_trustedIssuer` must be registered as a trusted issuer
     */
    function getTrustedIssuerClaimTopics(IClaimIssuer _trustedIssuer) external view returns (uint256[] memory);

    /**
     * @dev Returns all trusted issuers that are authorized to emit a specific claim topic.
     * @param claimTopic The claim topic ID to query
     * @return Array of trusted claim issuer addresses authorized for the given topic
     */
    function getTrustedIssuersForClaimTopic(uint256 claimTopic) external view returns (IClaimIssuer[] memory);

    /**
     * @dev Checks if a trusted issuer is authorized to emit a specific claim topic.
     *
     * @param _issuer The address of the claim issuer to check
     * @param _claimTopic The claim topic ID to check authorization for
     * @return True if the issuer is authorized for the claim topic, false otherwise
     */
    function hasClaimTopic(address _issuer, uint256 _claimTopic) external view returns (bool);
}

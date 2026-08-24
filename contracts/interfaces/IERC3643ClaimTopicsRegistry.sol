// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

/**
 * @title IClaimTopicsRegistry
 * @dev Interface for the Claim Topics Registry contract in the ERC-3643 ecosystem.
 *
 * The Claim Topics Registry defines the types of claims that are required for identity
 * verification in the security token ecosystem. It maintains a registry of trusted claim
 * topics that investors must possess to be eligible for token operations.
 *
 * Key responsibilities:
 *
 * * Define required claim topic IDs for token eligibility
 * * Manage the list of accepted claim types
 * * Provide claim topic validation for identity verification
 * * Enable flexible claim requirement configuration
 *
 * Claim topics are numeric identifiers representing different verification requirements:
 *
 * * Example: KYC = 1, AML = 2, Accreditation = 3, Residency = 4, etc.
 *
 * Architecture considerations:
 *
 * * Maximum 15 topics per token (gas optimization)
 * * Topics are defined at the token ecosystem level
 * * Claims must be issued by trusted issuers for these topics
 * * Claims are validated during identity verification processes
 *
 * The registry works in conjunction with:
 *
 * * Identity Registry: For comprehensive identity verification
 * * Trusted Issuers Registry: For validating claim issuers
 * * Identity contracts: For storing and retrieving claims
 * * Compliance contracts: For enforcing claim requirements
 */
interface IClaimTopicsRegistry {
    /**
     * @dev Emitted when a claim topic is added to the registry.
     *
     * @param claimTopic The numeric ID of the claim topic that was added
     */
    event ClaimTopicAdded(uint256 indexed claimTopic);

    /**
     * @dev Emitted when a claim topic is removed from the registry.
     *
     * @param claimTopic The numeric ID of the claim topic that was removed
     */
    event ClaimTopicRemoved(uint256 indexed claimTopic);

    /**
     * @dev Adds a new claim topic to the registry.
     *
     * Claim topics represent different types of verification requirements
     * that investors must meet. Each topic corresponds to a specific type
     * of claim that must be present in an investor's identity contract.
     *
     * @param _claimTopic The numeric identifier for the claim topic
     *
     * Requirements:
     *
     * * Only the owner can call this function
     * * `_claimTopic` must not already be registered
     * * Registry must not exceed 15 topics (gas optimization)
     * * `_claimTopic` must not be zero
     *
     * Emits a {ClaimTopicAdded} event.
     */
    function addClaimTopic(uint256 _claimTopic) external;

    /**
     * @dev Removes a claim topic from the registry.
     *
     * After removal, claims of this topic will no longer be required
     * for identity verification in this token ecosystem.
     *
     * @param _claimTopic The numeric identifier for the claim topic to remove
     *
     * Requirements:
     *
     * * Only the owner can call this function
     * * `_claimTopic` must be currently registered
     *
     * Emits a {ClaimTopicRemoved} event.
     */
    function removeClaimTopic(uint256 _claimTopic) external;

    /**
     * @dev Returns all registered claim topics for this token ecosystem.
     *
     * This function provides the complete list of claim types that investors
     * must possess to be eligible for token operations.
     *
     * @return Array of claim topic IDs currently registered
     */
    function getClaimTopics() external view returns (uint256[] memory);
}

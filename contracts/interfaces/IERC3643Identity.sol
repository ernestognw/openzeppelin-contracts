// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

/**
 * @title IIdentity
 * @dev Minimal interface representing an identity contract address.
 *
 * This interface serves as a type-safe wrapper for identity contract addresses
 * in the ERC-3643 ecosystem. The actual identity functionality is implementation-
 * specific and not defined by ERC-3643.
 *
 * Implementers are free to use any identity system that provides:
 *
 * * Onchain identity verification
 * * Claim management capabilities
 * * Integration with trusted claim issuers
 *
 * NOTE: Not formally defined in ERC-3643. Provided for convenience.
 */
interface IIdentity {
    enum KeyPurpose {
        Management,
        Execution
    }

    /**
     * @dev Checks if a key has a specific purpose.
     */
    function keyHasPurpose(bytes32 key, KeyPurpose purpose) external view returns (bool);
}

/**
 * @title IClaimIssuer
 * @dev Minimal interface representing a claim issuer contract address.
 *
 * This interface serves as a type-safe wrapper for claim issuer contract addresses.
 * Claim issuers are trusted entities that can issue verifiable claims about identities.
 */
// Empty interface serves as a type marker for claim issuer contracts since it's not defined by ERC-3643
interface IClaimIssuer {}

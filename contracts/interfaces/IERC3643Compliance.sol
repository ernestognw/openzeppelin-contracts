// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

/**
 * @title ICompliance
 * @dev Interface for the Compliance contract in the ERC-3643 ecosystem.
 *
 * The Compliance contract is responsible for enforcing the rules and regulations
 * of the security token offering. It ensures that all token transfers and operations
 * comply with the legal requirements set by the token issuer and regulatory authorities.
 *
 * Key responsibilities:
 *
 * * Define and enforce compliance rules for token transfers
 * * Validate transfer eligibility based on offering regulations
 * * Maintain state for compliance-related data (e.g., investor limits, country restrictions)
 * * Provide hooks for compliance state updates during token operations
 * * Enable modular compliance through rule composition
 *
 * Compliance types typically enforced:
 *
 * * Maximum number of token holders (globally or per country)
 * * Maximum token amount per investor
 * * Minimum holding periods and lock-up rules
 * * Geographic restrictions and country-based limits
 * * Investor accreditation requirements
 * * Transfer timing restrictions
 *
 * The compliance contract works in conjunction with:
 *
 * * Token contracts: For transfer validation and state updates
 * * Identity Registry: For investor verification and country data
 * * Trusted Issuers Registry: For claim validation
 * * Compliance modules: For modular rule composition (when using modular design)
 */
interface ICompliance {
    /**
     * @dev Emitted when a token contract is bound to this compliance contract.
     *
     * @param _token The address of the token contract that was bound
     */
    event TokenBound(address _token);

    /**
     * @dev Emitted when a token contract is unbound from this compliance contract.
     *
     * @param _token The address of the token contract that was unbound
     */
    event TokenUnbound(address _token);

    /**
     * @dev Binds a token contract to this compliance contract, enabling compliance enforcement.
     *
     * @param _token The address of the token contract to bind
     *
     * Requirements:
     *
     * * Only the owner can call this function
     * * `_token` must be a valid ERC-3643 token contract
     * * `_token` must not already be bound to another compliance contract
     *
     * Emits a {TokenBound} event.
     */
    function bindToken(address _token) external;

    /**
     * @dev Unbinds a token contract from this compliance contract, disabling compliance enforcement.
     *
     * @param _token The address of the token contract to unbind
     *
     * Requirements:
     *
     * * Only the owner can call this function
     * * `_token` must be currently bound to this compliance contract
     *
     * Emits a {TokenUnbound} event.
     */
    function unbindToken(address _token) external;

    /**
     * @dev Checks if a specific token contract is bound to this compliance contract.
     *
     * @param _token The address of the token contract to check
     * @return True if the token is bound to this compliance contract, false otherwise
     */
    function isTokenBound(address _token) external view returns (bool);

    /**
     * @dev Returns the address of the token contract bound to this compliance contract.
     *
     * @return The address of the bound token contract, or zero address if none is bound
     *
     * NOTE: This function assumes a single token binding. For multi-token compliance contracts,
     * use {isTokenBound} instead.
     */
    function getTokenBound() external view returns (address);

    /**
     * @dev Checks if a transfer is compliant with the rules defined in this compliance contract.
     *
     * This function performs comprehensive compliance validation including:
     * * Investor limits (maximum number of token holders)
     * * Amount restrictions (maximum tokens per investor)
     * * Country-based restrictions and limits
     * * Lock-up periods and transfer timing rules
     * * Any other custom compliance rules implemented
     *
     * @param _from The address sending the tokens (use zero address for minting)
     * @param _to The address receiving the tokens (use zero address for burning)
     * @param _amount The amount of tokens being transferred
     * @return True if the transfer is compliant and allowed, false otherwise
     *
     * NOTE: This function should be called before executing any transfer to ensure compliance.
     * It does not modify state and can be used for pre-validation.
     */
    function canTransfer(address _from, address _to, uint256 _amount) external view returns (bool);

    /**
     * @dev Updates compliance state after a successful transfer.
     *
     * This function is called by the token contract after a transfer has been executed
     * to update any compliance-related state that depends on transfer activity.
     *
     * @param _from The address that sent the tokens (zero address for minting)
     * @param _to The address that received the tokens (zero address for burning)
     * @param _amount The amount of tokens that were transferred
     *
     * Requirements:
     *
     * * Only bound token contracts can call this function
     * * Should only be called after a successful transfer
     *
     * NOTE: This function is for state updates only and should not perform validation.
     */
    function transferred(address _from, address _to, uint256 _amount) external;

    /**
     * @dev Updates compliance state after tokens are created (minted).
     *
     * This function is called by the token contract after tokens have been minted
     * to update compliance state related to token creation.
     *
     * @param _to The address that received the newly created tokens
     * @param _amount The amount of tokens that were created
     *
     * Requirements:
     *
     * * Only bound token contracts can call this function
     * * Should only be called after successful token creation
     */
    function created(address _to, uint256 _amount) external;

    /**
     * @dev Updates compliance state after tokens are destroyed (burned).
     *
     * This function is called by the token contract after tokens have been burned
     * to update compliance state related to token destruction.
     *
     * @param _from The address from which tokens were destroyed
     * @param _amount The amount of tokens that were destroyed
     *
     * Requirements:
     *
     * * Only bound token contracts can call this function
     * * Should only be called after successful token destruction
     */
    function destroyed(address _from, uint256 _amount) external;
}

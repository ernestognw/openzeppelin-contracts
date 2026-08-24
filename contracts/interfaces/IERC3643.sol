// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IERC20} from "./IERC20.sol";
import {IPausable} from "../utils/Pausable.sol";
import {IIdentityRegistry} from "./IERC3643IdentityRegistry.sol";
import {ICompliance} from "./IERC3643Compliance.sol";

/**
 * @title IAgentRole
 * @dev Interface for managing agent roles in the ERC-3643 ecosystem.
 *
 * The Agent Role interface provides a standardized access control mechanism for
 * ERC-3643 contracts. Agents are authorized addresses that can perform operational
 * functions on behalf of the contract owner, enabling delegation of administrative
 * tasks while maintaining security.
 *
 * Key concepts:
 *
 * * Owner: The contract owner who can add/remove agents (typically ERC-173 owner)
 * * Agent: Authorized addresses that can perform specific operational functions
 * * Delegation: Agents can perform actions without requiring owner intervention
 *
 * Common agent responsibilities in ERC-3643:
 *
 * * Token minting and burning operations
 * * Address and token freezing/unfreezing
 * * Forced transfers for compliance or recovery
 * * Identity registry management
 * * Compliance rule enforcement
 *
 * Security model:
 *
 * * Only the owner can manage the agent list
 * * Agents have limited, function-specific permissions
 * * Agent permissions are defined by the implementing contract
 * * Multi-agent support enables operational scalability
 *
 * Integration:
 * Any contract in the ERC-3643 ecosystem that requires agent-based access control
 * must implement this interface to ensure consistent authorization patterns.
 */
interface IAgentRole {
    /**
     * @dev Emitted when a new agent is added to the contract.
     *
     * @param _agent The address of the agent that was added
     */
    event AgentAdded(address indexed _agent);

    /**
     * @dev Emitted when an agent is removed from the contract.
     *
     * @param _agent The address of the agent that was removed
     */
    event AgentRemoved(address indexed _agent);

    /**
     * @dev Adds a new agent to the contract.
     *
     * Agents are authorized addresses that can perform specific operational
     * functions defined by the implementing contract. The exact permissions
     * granted to agents depend on the contract's implementation.
     *
     * @param _agent The address to be granted agent role
     *
     * Requirements:
     *
     * * Only the contract owner can call this function
     * * `_agent` must not be the zero address
     * * `_agent` must not already be an agent
     *
     * Emits an {AgentAdded} event.
     */
    function addAgent(address _agent) external;

    /**
     * @dev Removes an existing agent from the contract.
     *
     * After removal, the address will no longer have agent permissions
     * and cannot perform agent-restricted functions.
     *
     * @param _agent The address to have its agent role revoked
     *
     * Requirements:
     *
     * * Only the contract owner can call this function
     * * `_agent` must currently be an agent
     *
     * Emits an {AgentRemoved} event.
     */
    function removeAgent(address _agent) external;

    /**
     * @dev Checks if an address has agent role.
     *
     * This function is used by other contract functions to verify
     * whether an address is authorized to perform agent-restricted operations.
     *
     * @param _agent The address to check for agent role
     * @return True if the address is an agent, false otherwise
     */
    function isAgent(address _agent) external view returns (bool);
}

/**
 * @title IERC3643
 * @dev Interface of ERC-3643.
 *
 * The T-REX token is an institutional grade security token standard that provides
 * a comprehensive framework for managing compliant transfer of security tokens using
 * an automated onchain validator system leveraging onchain identities for eligibility checks.
 *
 * This interface extends ERC-20 with additional functionality for:
 *
 * * Identity-based compliance checking
 * * Token and address freezing capabilities
 * * Batch operations for gas efficiency
 * * Recovery mechanisms for lost private keys
 * * Administrative controls for token management
 *
 * See https://eips.ethereum.org/EIPS/eip-3643
 */
interface IERC3643 is IERC20, IPausable {
    /**
     * @dev Emitted when token information is updated.
     *
     * @param _newName The new name of the token
     * @param _newSymbol The new symbol of the token
     * @param _newDecimals The new number of decimals for the token
     * @param _newVersion The new version string of the token
     * @param _newOnchainID The new address of the onchain identity contract
     */
    event UpdatedTokenInformation(
        string indexed _newName,
        string indexed _newSymbol,
        uint8 _newDecimals,
        string _newVersion,
        address indexed _newOnchainID
    );

    /**
     * @dev Emitted when a new identity registry is set for the token.
     *
     * @param _identityRegistry The address of the new identity registry contract
     */
    event IdentityRegistryAdded(IIdentityRegistry indexed _identityRegistry);

    /**
     * @dev Emitted when a new compliance contract is set for the token.
     *
     * @param _compliance The address of the new compliance contract
     */
    event ComplianceAdded(ICompliance indexed _compliance);

    /**
     * @dev Emitted when a successful wallet recovery is performed.
     *
     * @param _lostWallet The address of the wallet that was lost/compromised
     * @param _newWallet The address of the new wallet receiving the tokens
     * @param _investorOnchainID The address of the investor's onchain identity contract
     */
    event RecoverySuccess(address indexed _lostWallet, address indexed _newWallet, address indexed _investorOnchainID);

    /**
     * @dev Emitted when an address is frozen or unfrozen.
     *
     * @param _userAddress The address that was frozen/unfrozen
     * @param _isFrozen True if the address was frozen, false if unfrozen
     * @param _owner The address of the owner/agent who performed the action
     */
    event AddressFrozen(address indexed _userAddress, bool indexed _isFrozen, address indexed _owner);

    /**
     * @dev Emitted when a partial amount of tokens is frozen for a specific address.
     *
     * @param _userAddress The address whose tokens were frozen
     * @param _amount The amount of tokens that were frozen
     */
    event TokensFrozen(address indexed _userAddress, uint256 _amount);

    /**
     * @dev Emitted when a partial amount of tokens is unfrozen for a specific address.
     *
     * @param _userAddress The address whose tokens were unfrozen
     * @param _amount The amount of tokens that were unfrozen
     */
    event TokensUnfrozen(address indexed _userAddress, uint256 _amount);

    /**
     * @dev Returns the address of the onchain identity contract.
     *
     * @return The address of the onchain identity contract
     */
    function onchainID() external view returns (address);

    /**
     * @dev Returns the version string of the token implementation.
     *
     * @return The version string
     */
    function version() external view returns (string memory);

    /**
     * @dev Returns the identity registry contract associated with this token.
     *
     * @return The identity registry contract interface
     */
    function identityRegistry() external view returns (IIdentityRegistry);

    /**
     * @dev Returns the compliance contract associated with this token.
     *
     * @return The compliance contract interface
     */
    function compliance() external view returns (ICompliance);

    /**
     * @dev Returns whether a specific address is frozen.
     *
     * @param _userAddress The address to check
     * @return True if the address is frozen, false otherwise
     */
    function isFrozen(address _userAddress) external view returns (bool);

    /**
     * @dev Returns the amount of frozen tokens for a specific address.
     *
     * @param _userAddress The address to check
     * @return The amount of frozen tokens
     */
    function getFrozenTokens(address _userAddress) external view returns (uint256);

    /**
     * @dev Sets the name of the token.
     *
     * @param _name The new name to be set
     *
     * Requirements:
     *
     * * Only the owner or authorized agents can call this function
     */
    function setName(string calldata _name) external;

    /**
     * @dev Sets the symbol of the token.
     *
     * @param _symbol The new symbol to be set
     *
     * Requirements:
     *
     * * Only the owner or authorized agents can call this function
     */
    function setSymbol(string calldata _symbol) external;

    /**
     * @dev Sets the onchain identity contract address for the token.
     *
     * @param _onchainID The address of the new onchain identity contract
     *
     * Requirements:
     *
     * * Only the owner or authorized agents can call this function
     * * `_onchainID` must be a valid contract address
     */
    function setOnchainID(address _onchainID) external;

    /**
     * @dev Pauses all token transfers and operations.
     *
     * Requirements:
     *
     * * Only the owner or authorized agents can call this function
     * * The contract must not already be paused
     *
     * Emits a {Paused} event.
     */
    function pause() external;

    /**
     * @dev Unpauses all token transfers and operations.
     *
     * Requirements:
     *
     * * Only the owner or authorized agents can call this function
     * * The contract must be paused
     *
     * Emits an {Unpaused} event.
     */
    function unpause() external;

    /**
     * @dev Freezes or unfreezes a specific address, preventing or allowing all token operations.
     *
     * @param _userAddress The address to freeze or unfreeze
     * @param _freeze True to freeze the address, false to unfreeze
     *
     * Requirements:
     *
     * * Only the owner or authorized agents can call this function
     *
     * Emits an {AddressFrozen} event.
     */
    function setAddressFrozen(address _userAddress, bool _freeze) external;

    /**
     * @dev Freezes a partial amount of tokens for a specific address.
     *
     * @param _userAddress The address whose tokens will be frozen
     * @param _amount The amount of tokens to freeze
     *
     * Requirements:
     *
     * * Only the owner or authorized agents can call this function
     * * `_userAddress` must have sufficient unfrozen token balance
     *
     * Emits a {TokensFrozen} event.
     */
    function freezePartialTokens(address _userAddress, uint256 _amount) external;

    /**
     * @dev Unfreezes a partial amount of tokens for a specific address.
     *
     * @param _userAddress The address whose tokens will be unfrozen
     * @param _amount The amount of tokens to unfreeze
     *
     * Requirements:
     *
     * * Only the owner or authorized agents can call this function
     * * `_userAddress` must have sufficient frozen tokens to unfreeze
     *
     * Emits a {TokensUnfrozen} event.
     */
    function unfreezePartialTokens(address _userAddress, uint256 _amount) external;

    /**
     * @dev Sets the identity registry contract for the token.
     *
     * @param _identityRegistry The address of the new identity registry contract
     *
     * Requirements:
     *
     * * Only the owner can call this function
     *
     * Emits an {IdentityRegistryAdded} event.
     */
    function setIdentityRegistry(IIdentityRegistry _identityRegistry) external;

    /**
     * @dev Sets the compliance contract for the token.
     *
     * @param _compliance The address of the new compliance contract
     *
     * Requirements:
     *
     * * Only the owner can call this function
     *
     * Emits a {ComplianceAdded} event.
     */
    function setCompliance(ICompliance _compliance) external;

    /**
     * @dev Forces a transfer between two addresses, bypassing compliance checks.
     *
     * @param _from The address to transfer tokens from
     * @param _to The address to transfer tokens to
     * @param _amount The amount of tokens to transfer
     * @return success True if the transfer was successful
     *
     * Requirements:
     *
     * * Only the owner or authorized agents can call this function
     * * The contract must not be paused
     * * `_from` and `_to` addresses must not be frozen
     * * `_from` must have sufficient unfrozen balance
     * * `_to` must be verified in the identity registry
     *
     * NOTE: This function bypasses compliance rules but still requires identity verification.
     */
    function forcedTransfer(address _from, address _to, uint256 _amount) external returns (bool);

    /**
     * @dev Mints new tokens to a specified address.
     *
     * @param _to The address to mint tokens to
     * @param _amount The amount of tokens to mint
     *
     * Requirements:
     *
     * * Only the owner or authorized agents can call this function
     * * The contract must not be paused
     * * `_to` must be verified in the identity registry
     * * `_to` address must not be frozen
     */
    function mint(address _to, uint256 _amount) external;

    /**
     * @dev Burns tokens from a specified address.
     *
     * @param _userAddress The address to burn tokens from
     * @param _amount The amount of tokens to burn
     *
     * Requirements:
     *
     * * Only the owner or authorized agents can call this function
     * * `_userAddress` must have sufficient total balance (including frozen tokens)
     *
     * NOTE: This function can burn both frozen and unfrozen tokens.
     */
    function burn(address _userAddress, uint256 _amount) external;

    /**
     * @dev Recovers tokens from a lost wallet to a new wallet address.
     *
     * @param _lostWallet The address of the lost/compromised wallet
     * @param _newWallet The address of the new wallet to receive the tokens
     * @param _investorOnchainID The address of the investor's onchain identity contract
     * @return success True if the recovery was successful
     *
     * Requirements:
     *
     * * Only the owner or authorized agents can call this function
     * * `_lostWallet` must be registered in the identity registry
     * * `_newWallet` must be verified in the identity registry
     * * `_investorOnchainID` must match the identity associated with both wallets
     *
     * Emits a {RecoverySuccess} event.
     */
    function recoveryAddress(
        address _lostWallet,
        address _newWallet,
        address _investorOnchainID
    ) external returns (bool);

    /**
     * @dev Performs batch transfers to multiple addresses.
     *
     * @param _toList Array of recipient addresses
     * @param _amounts Array of amounts to transfer to each recipient
     *
     * Requirements:
     *
     * * Only verified addresses can call this function (standard transfer rules apply)
     * * Arrays must have the same length
     * * Each individual transfer must meet all compliance requirements
     * * Sender must have sufficient unfrozen balance for the total amount
     */
    function batchTransfer(address[] calldata _toList, uint256[] calldata _amounts) external;

    /**
     * @dev Performs batch forced transfers from multiple addresses to multiple addresses.
     *
     * @param _fromList Array of sender addresses
     * @param _toList Array of recipient addresses
     * @param _amounts Array of amounts to transfer
     *
     * Requirements:
     *
     * * Only the owner or authorized agents can call this function
     * * All arrays must have the same length
     * * Each recipient must be verified in the identity registry
     * * Each sender must have sufficient unfrozen balance
     */
    function batchForcedTransfer(
        address[] calldata _fromList,
        address[] calldata _toList,
        uint256[] calldata _amounts
    ) external;

    /**
     * @dev Mints tokens to multiple addresses in a single transaction.
     *
     * @param _toList Array of recipient addresses
     * @param _amounts Array of amounts to mint to each recipient
     *
     * Requirements:
     *
     * * Only the owner or authorized agents can call this function
     * * Arrays must have the same length
     * * Each recipient must be verified in the identity registry
     * * Each recipient address must not be frozen
     */
    function batchMint(address[] calldata _toList, uint256[] calldata _amounts) external;

    /**
     * @dev Burns tokens from multiple addresses in a single transaction.
     *
     * @param _userAddresses Array of addresses to burn tokens from
     * @param _amounts Array of amounts to burn from each address
     *
     * Requirements:
     *
     * * Only the owner or authorized agents can call this function
     * * Arrays must have the same length
     * * Each address must have sufficient total balance
     */
    function batchBurn(address[] calldata _userAddresses, uint256[] calldata _amounts) external;

    /**
     * @dev Freezes or unfreezes multiple addresses in a single transaction.
     *
     * @param _userAddresses Array of addresses to freeze or unfreeze
     * @param _freeze Array of boolean values indicating freeze (true) or unfreeze (false)
     *
     * Requirements:
     *
     * * Only the owner or authorized agents can call this function
     * * Arrays must have the same length
     */
    function batchSetAddressFrozen(address[] calldata _userAddresses, bool[] calldata _freeze) external;

    /**
     * @dev Freezes partial token amounts for multiple addresses in a single transaction.
     *
     * @param _userAddresses Array of addresses whose tokens will be frozen
     * @param _amounts Array of amounts to freeze for each address
     *
     * Requirements:
     *
     * * Only the owner or authorized agents can call this function
     * * Arrays must have the same length
     * * Each address must have sufficient unfrozen balance
     */
    function batchFreezePartialTokens(address[] calldata _userAddresses, uint256[] calldata _amounts) external;

    /**
     * @dev Unfreezes partial token amounts for multiple addresses in a single transaction.
     *
     * @param _userAddresses Array of addresses whose tokens will be unfrozen
     * @param _amounts Array of amounts to unfreeze for each address
     *
     * Requirements:
     *
     * * Only the owner or authorized agents can call this function
     * * Arrays must have the same length
     * * Each address must have sufficient frozen tokens
     */
    function batchUnfreezePartialTokens(address[] calldata _userAddresses, uint256[] calldata _amounts) external;
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import {IERC1271} from "../../interfaces/IERC1271.sol";
import {PackedUserOperation} from "../../interfaces/IERC4337.sol";
import {IERC7579Validator, IERC7579Module, MODULE_TYPE_VALIDATOR} from "../../interfaces/IERC7579Module.sol";
import {EnumerableSet} from "../../utils/structs/EnumerableSet.sol";
import {SignatureChecker} from "../../utils/cryptography/SignatureChecker.sol";
import {ERC4337Utils} from "../utils/ERC4337Utils.sol";

abstract contract MultisigValidator is IERC7579Validator, IERC1271 {
    using EnumerableSet for EnumerableSet.AddressSet;
    using SignatureChecker for address;

    event ValidatorsAdded(address indexed account, address[] indexed signers);
    event ValidatorsRemoved(address indexed account, address[] indexed signers);
    event ThresholdChanged(address indexed account, uint256 threshold);

    error MultisigSignerAlreadyExists(address account, address signer);
    error MultisigSignerDoesNotExist(address account, address signer);
    error MultisigUnreachableThreshold(address account, uint256 signers, uint256 threshold);
    error MultisigRemainingSigners(address account, uint256 remaining);
    error MultisigMismatchedSignaturesLength(address account, uint256 signersLength, uint256 signaturesLength);
    error MultisigUnorderedSigners(address account, address prev, address current);

    error MultisigUnauthorizedExecution(address account, address sender);

    mapping(address => EnumerableSet.AddressSet) private _associatedSigners;
    mapping(address => uint256) private _associatedThreshold;

    /// @inheritdoc IERC7579Module
    function isModuleType(uint256 moduleTypeId) public pure virtual returns (bool) {
        return moduleTypeId == MODULE_TYPE_VALIDATOR;
    }

    function threshold(address account) public view virtual returns (uint256) {
        return _associatedThreshold[account];
    }

    function isSigner(address account, address signer) public view virtual returns (bool) {
        return _associatedSigners[account].contains(signer);
    }

    function addSigners(address[] memory signers) public virtual {
        address account = msg.sender;
        _addValidators(account, signers);
        _validateThreshold(account);
    }

    function removeSigners(address[] memory signers) public virtual {
        address account = msg.sender;
        _removeSigners(account, signers);
        _validateThreshold(account);
    }

    function setThreshold(uint256 threshold_) public virtual {
        address account = msg.sender;
        _setThreshold(account, threshold_);
        _validateThreshold(account);
    }

    /// @inheritdoc IERC7579Module
    function onInstall(bytes memory data) public virtual {
        address account = msg.sender;
        (address[] memory signers, uint256 threshold_) = abi.decode(data, (address[], uint256));
        _associatedThreshold[account] = threshold_;
        _addValidators(account, signers);
        _validateThreshold(account);
    }

    /// @inheritdoc IERC7579Module
    function onUninstall(bytes memory data) public virtual {
        address account = msg.sender;
        address[] memory signers = abi.decode(data, (address[]));
        _associatedThreshold[account] = 0;
        _removeSigners(account, signers);
        uint256 remaining = _associatedSigners[account].length();
        if (remaining != 0) revert MultisigRemainingSigners(account, remaining);
    }

    /// @inheritdoc IERC7579Validator
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) public view virtual returns (uint256) {
        return
            _isValidSignature(msg.sender, userOpHash, userOp.signature)
                ? ERC4337Utils.SIG_VALIDATION_SUCCESS
                : ERC4337Utils.SIG_VALIDATION_FAILED;
    }

    /// @inheritdoc IERC1271
    function isValidSignature(bytes32 hash, bytes calldata signature) public view virtual returns (bytes4) {
        address account = abi.decode(signature[0:20], (address));
        bytes calldata sig = signature[20:];
        return _isValidSignature(account, hash, sig) ? IERC1271.isValidSignature.selector : bytes4(0xffffffff);
    }

    /// @inheritdoc IERC7579Validator
    function isValidSignatureWithSender(
        address,
        bytes32 hash,
        bytes calldata signature
    ) public view virtual returns (bytes4) {
        return _isValidSignature(msg.sender, hash, signature) ? IERC1271.isValidSignature.selector : bytes4(0xffffffff);
    }

    function _addValidators(address account, address[] memory signers) internal virtual {
        for (uint256 i = 0; i < signers.length; i++) {
            if (!_associatedSigners[account].add(signers[i])) revert MultisigSignerAlreadyExists(account, signers[i]);
        }
        emit ValidatorsAdded(account, signers);
    }

    function _removeSigners(address account, address[] memory signers) internal virtual {
        for (uint256 i = 0; i < signers.length; i++) {
            if (!_associatedSigners[account].remove(signers[i])) revert MultisigSignerDoesNotExist(account, signers[i]);
        }
        emit ValidatorsRemoved(account, signers);
    }

    function _setThreshold(address account, uint256 threshold_) internal virtual {
        _associatedThreshold[account] = threshold_;
        emit ThresholdChanged(msg.sender, threshold_);
    }

    function _validateThreshold(address account) internal view virtual {
        uint256 signers = _associatedSigners[account].length();
        uint256 _threshold = _associatedThreshold[account];
        if (signers < _threshold) revert MultisigUnreachableThreshold(account, signers, _threshold);
    }

    function _isValidSignature(
        address account,
        bytes32 hash,
        bytes calldata signature
    ) internal view virtual returns (bool) {
        (address[] calldata signers, bytes[] calldata signatures) = _decodePackedSignatures(signature);
        if (signers.length != signatures.length) return false;
        return _validateNSignatures(account, hash, signers, signatures);
    }

    function _validateNSignatures(
        address account,
        bytes32 hash,
        address[] calldata signers,
        bytes[] calldata signatures
    ) private view returns (bool) {
        address currentSigner = address(0);

        uint256 signersLength = signers.length;
        for (uint256 i = 0; i < signersLength; i++) {
            // Signers must be in order to ensure no duplicates
            address signer = signers[i];
            if (currentSigner >= signer) return false;
            currentSigner = signer;

            if (!_associatedSigners[account].contains(signer) || !signer.isValidSignatureNow(hash, signatures[i]))
                return false;
        }

        return signersLength >= _associatedThreshold[account];
    }

    function _decodePackedSignatures(
        bytes calldata signature
    ) internal pure returns (address[] calldata signers, bytes[] calldata signatures) {
        assembly ("memory-safe") {
            let ptr := add(signature.offset, calldataload(signature.offset))

            let signersPtr := add(ptr, 0x20)
            signers.offset := add(signersPtr, 0x20)
            signers.length := calldataload(signersPtr)

            let signaturesPtr := add(signersPtr, signers.length)
            signatures.offset := add(signaturesPtr, 0x20)
            signatures.length := calldataload(signaturesPtr)
        }
    }
}

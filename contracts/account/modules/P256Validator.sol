// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import {IERC1271} from "../../interfaces/IERC1271.sol";
import {PackedUserOperation} from "../../interfaces/IERC4337.sol";
import {P256} from "../../utils/cryptography/P256.sol";
import {IERC7579Validator, MODULE_TYPE_VALIDATOR} from "../../interfaces/IERC7579Module.sol";
import {EIP712ReadableSigner} from "../EIP712ReadableSigner.sol";
import {ERC4337Utils} from "../utils/ERC4337Utils.sol";

abstract contract P256Validator is IERC7579Validator, EIP712ReadableSigner {
    mapping(address => bytes32) private _associatedQx;
    mapping(address => bytes32) private _associatedQy;

    /// @inheritdoc IERC7579Validator
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) public view virtual returns (uint256) {
        return
            _validateSignature(userOpHash, userOp.signature)
                ? ERC4337Utils.SIG_VALIDATION_SUCCESS
                : ERC4337Utils.SIG_VALIDATION_FAILED;
    }

    /// @inheritdoc IERC7579Validator
    function isValidSignatureWithSender(
        address,
        bytes32 hash,
        bytes calldata signature
    ) public view virtual returns (bytes4) {
        return _validateSignature(hash, signature) ? IERC1271.isValidSignature.selector : bytes4(0xffffffff);
    }

    function signer(address account) public view virtual returns (bytes32 qx, bytes32 qy) {
        return (_associatedQx[account], _associatedQy[account]);
    }

    function _validateSignature(bytes32 hash, bytes calldata signature) internal view override returns (bool) {
        if (signature.length < 0x40) return false;

        // parse signature
        bytes32 r = bytes32(signature[0x00:0x20]);
        bytes32 s = bytes32(signature[0x20:0x40]);

        // fetch and decode immutable public key for the clone
        (bytes32 qx, bytes32 qy) = signer(msg.sender);
        return P256.verify(hash, r, s, qx, qy);
    }

    function onInstall(bytes calldata data) external {
        (address account, bytes32 qx, bytes32 qy) = abi.decode(data, (address, bytes32, bytes32));
        _associatedQx[account] = qx;
        _associatedQy[account] = qy;
    }

    function onUninstall(bytes calldata data) external {
        address account = abi.decode(data, (address));
        delete _associatedQx[account];
        delete _associatedQy[account];
    }

    function isModuleType(uint256 moduleTypeId) external pure returns (bool) {
        return moduleTypeId == MODULE_TYPE_VALIDATOR;
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {P256} from "../../utils/cryptography/P256.sol";
import {SignatureValidator} from "./SignatureValidator.sol";

abstract contract P256Validator is SignatureValidator {
    mapping(address sender => bytes32) private _associatedQx;
    mapping(address sender => bytes32) private _associatedQy;

    event P256SignerAssociated(address indexed account, bytes32 qx, bytes32 qy);
    event P256SignerDisassociated(address indexed account);

    function signer(address account) public view virtual returns (bytes32, bytes32) {
        return (_associatedQx[account], _associatedQy[account]);
    }

    function onInstall(bytes calldata data) public virtual {
        (bytes32 qx, bytes32 qy) = abi.decode(data, (bytes32, bytes32));
        _onInstall(msg.sender, qx, qy);
    }

    function onUninstall(bytes calldata) public virtual {
        _onUninstall(msg.sender);
    }

    function _onInstall(address account, bytes32 qx, bytes32 qy) internal virtual {
        _associatedQx[account] = qx;
        _associatedQy[account] = qy;
        emit P256SignerAssociated(account, qx, qy);
    }

    function _onUninstall(address account) internal virtual {
        delete _associatedQx[account];
        delete _associatedQy[account];
        emit P256SignerDisassociated(account);
    }

    function _validateSignatureWithSender(
        address sender,
        bytes32 envelopeHash,
        bytes calldata signature
    ) internal view virtual override returns (bool) {
        if (signature.length < 0x40) return false;

        // parse signature
        bytes32 r = bytes32(signature[0x00:0x20]);
        bytes32 s = bytes32(signature[0x20:0x40]);

        // fetch and decode immutable public key for the clone
        (bytes32 qx, bytes32 qy) = signer(sender);
        return P256.verify(envelopeHash, r, s, qx, qy);
    }
}

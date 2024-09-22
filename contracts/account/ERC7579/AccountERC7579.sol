// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {IERC1271} from "../../interfaces/IERC1271.sol";
import {AccountBase} from "../AccountBase.sol";
import {PackedUserOperation} from "../../interfaces/IERC4337.sol";
import {Address} from "../../utils/Address.sol";
import {IERC7579AccountConfig, IERC7579Execution, IERC7579ModuleConfig} from "../../interfaces/IERC7579Account.sol";
import {IERC7579Validator, MODULE_TYPE_VALIDATOR, MODULE_TYPE_EXECUTOR, MODULE_TYPE_FALLBACK, MODULE_TYPE_HOOK} from "../../interfaces/IERC7579Module.sol";
import {ERC7579Utils, Mode, CallType, ExecType} from "./utils/ERC7579Utils.sol";
import {ERC7579ModuleConfig} from "./ERC7579ModuleConfig.sol";
import {ERC4337Utils} from "../utils/ERC4337Utils.sol";

abstract contract AccountERC7579 is
    AccountBase,
    ERC7579ModuleConfig,
    IERC7579Execution,
    IERC7579AccountConfig,
    IERC1271
{
    using ERC7579Utils for *;

    /// @inheritdoc IERC1271
    function isValidSignature(bytes32 hash, bytes calldata signature) public view virtual override returns (bytes4) {
        address module = address(bytes20(signature[0:20]));
        return IERC7579Validator(module).isValidSignatureWithSender(msg.sender, hash, signature);
    }

    function _validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal virtual override returns (address signer, uint256 validationData) {
        PackedUserOperation memory userOpCopy = userOp;
        address module = address(bytes20(userOp.signature[0:20]));
        userOpCopy.signature = userOp.signature[20:];
        return
            isModuleInstalled(MODULE_TYPE_EXECUTOR, module, userOp.signature[0:0])
                ? (module, IERC7579Validator(module).validateUserOp(userOpCopy, userOpHash))
                : (address(0), ERC4337Utils.SIG_VALIDATION_FAILED);
    }

    /// @inheritdoc IERC7579AccountConfig
    function accountId() public view virtual returns (string memory) {
        //vendorname.accountname.semver
        return "@openzeppelin/contracts.erc7579account.v0-beta";
    }

    /// @inheritdoc IERC7579AccountConfig
    function supportsExecutionMode(bytes32 encodedMode) public view virtual returns (bool) {
        return _supportsExecutionMode(encodedMode);
    }

    /// @inheritdoc IERC7579AccountConfig
    function supportsModule(uint256 moduleTypeId) public view virtual returns (bool) {
        return _supportsModule(moduleTypeId);
    }

    /// @inheritdoc IERC7579Execution
    function execute(bytes32 mode, bytes calldata executionCalldata) public virtual onlyEntryPointOrSelf {
        _execute(Mode.wrap(mode), executionCalldata);
    }

    /// @inheritdoc IERC7579Execution
    function executeFromExecutor(
        bytes32 mode,
        bytes calldata executionCalldata
    ) public virtual onlyModule(MODULE_TYPE_EXECUTOR) returns (bytes[] memory) {
        return _execute(Mode.wrap(mode), executionCalldata);
    }

    function _supportsExecutionMode(bytes32 encodedMode) internal pure returns (bool) {
        (CallType callType, , , ) = Mode.wrap(encodedMode).decodeMode();
        return
            callType == ERC7579Utils.CALLTYPE_SINGLE ||
            callType == ERC7579Utils.CALLTYPE_BATCH ||
            callType == ERC7579Utils.CALLTYPE_DELEGATECALL;
    }

    function _execute(Mode mode, bytes calldata executionCalldata) internal returns (bytes[] memory returnData) {
        // TODO: ModeSelector? ModePayload?
        (CallType callType, ExecType execType, , ) = mode.decodeMode();

        if (callType == ERC7579Utils.CALLTYPE_SINGLE) return ERC7579Utils.execSingle(execType, executionCalldata);
        if (callType == ERC7579Utils.CALLTYPE_BATCH) return ERC7579Utils.execBatch(execType, executionCalldata);
        if (callType == ERC7579Utils.CALLTYPE_DELEGATECALL)
            return ERC7579Utils.execDelegateCall(execType, executionCalldata);
        revert ERC7579Utils.ERC7579UnsupportedCallType(callType);
    }

    /// @inheritdoc IERC7579ModuleConfig
    function installModule(
        uint256 moduleTypeId,
        address module,
        bytes calldata initData
    ) public virtual onlyEntryPointOrSelf {
        _installModule(moduleTypeId, module, initData);
    }

    /// @inheritdoc IERC7579ModuleConfig
    function uninstallModule(
        uint256 moduleTypeId,
        address module,
        bytes calldata deInitData
    ) public virtual onlyEntryPointOrSelf {
        _uninstallModule(moduleTypeId, module, deInitData);
    }

    fallback() external payable {
        address handler = _fallbackHandler(msg.sig);
        if (handler == address(0)) revert ERC7579UninstalledModule(MODULE_TYPE_FALLBACK, address(0));

        // From https://eips.ethereum.org/EIPS/eip-7579#fallback[ERC-7579 specifications]:
        // - MUST utilize ERC-2771 to add the original msg.sender to the calldata sent to the fallback handler
        // - MUST use call to invoke the fallback handler
        (bool success, bytes memory returndata) = handler.call{value: msg.value}(
            abi.encodePacked(msg.data, msg.sender)
        );
        assembly ("memory-safe") {
            switch success
            case 0 {
                revert(add(returndata, 0x20), mload(returndata))
            }
            default {
                return(add(returndata, 0x20), mload(returndata))
            }
        }
    }
}

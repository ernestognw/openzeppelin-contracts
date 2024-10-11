// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {AccountECDSA} from "./draft-AccountECDSA.sol";
import {EIP712} from "../utils/cryptography/EIP712.sol";

contract AccountEIP7702 is AccountECDSA {
    constructor(string memory name, string memory version) AccountECDSA(address(this)) EIP712(name, version) {}
}

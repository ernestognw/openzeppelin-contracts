---
'openzeppelin-solidity': minor
---

`AccountERC7579`, `AccountERC7579Hooked`: Call `IERC7579Module.onUninstall` before clearing module state so modules observe themselves as installed during uninstallation, mirroring `onInstall`. Reordering also ensures gas estimators fund the inner call via EIP-150's 63/64 rule.

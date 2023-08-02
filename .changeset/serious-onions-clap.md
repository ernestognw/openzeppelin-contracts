---
'openzeppelin-solidity': minor
---

`VestingWallet`: Added an `onlyReleaser` modifier to the release functions. The modifier makes use of a new `releaser()` getter that returns the beneficiary address by default.

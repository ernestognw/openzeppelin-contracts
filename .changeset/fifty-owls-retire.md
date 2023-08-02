---
'openzeppelin-solidity': major
---

`Address`: Removed the functions overloaded with a customized error message in favor of a custom error indicating the call has failed. This only applies if the underlying revert reason cannot be bubbled up.

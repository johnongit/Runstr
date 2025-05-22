## [1.0.1](https://github.com/HealthNoteLabs/Runstr/compare/v1.0.0...v1.0.1) (2025-05-22)

### Bug Fixes

* **feed:** unify wallet context and enhance LNURL discovery for zaps\n\n- Feed now uses WalletContext wallet ensuring connection consistency\n- handleZap derives LNURL from lud16/lud06 or nip05 fallback\n- Added creation/signing of zap request event\n- build workflow already watches bug-fixes branch ([767a22b](https://github.com/HealthNoteLabs/Runstr/commit/767a22b7d1de8664174b33cad328f8371106f2b2))
* **runclub:** restore missing useRunFeed import causing feed screen crash ([a5ff20b](https://github.com/HealthNoteLabs/Runstr/commit/a5ff20b3e5b72a37fd2f1f6d8293e84ec0e6384b))
* update package-lock.json to sync with package.json ([f31166f](https://github.com/HealthNoteLabs/Runstr/commit/f31166f117ce8b990c52891568729290e5530aef))

# Release vv0.4.0

Manual release created on Tue May 20 22:51:26 UTC 2025

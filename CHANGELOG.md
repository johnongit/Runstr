# RUNSTR  v0.2.9.9 Alpha Release Notes

## 🚀 RUNSTR Feed
- Simplified implementation to enhance load time

## ⚡ Zaps
- Migrated from Bitcoin Connect to NWC for improved performance
- Added support for Wavlake Zaps

## 📊 Splits
- Fixed splits UI issues on dashboard
- Added splits metrics to run history statistics

## 👥 Teams
- Implemented more direct NIP29 approach for team management
- Introduced featured NIP29 Run Clubs

## 🎵 Music Players
- Complete UI overhaul for better user experience
- Added zap button for content creators
- Implemented replay functionality when pressing back button
- Mini music player now displays song length

## 🩺 NIP101h Health Integration
Introducing the ability to save basic health information to nostr through specific metric kinds:

| Metric | Kind | Description |
|--------|------|-------------|
| Weight | 1351 | Track your weight measurements |
| Height | 1352 | Record your height data |
| Age | 1353 | Store your age information |
| Gender | 1354 | Save your gender details |
| Fitness Level | 1355 | Monitor your overall fitness level |

*Note: This is an alpha release. Please report any bugs or issues you encounter.* 

## 1.0.0 (2025-04-26)

### Features

* implemented RunTracker service and refactored RunTracker component ([84479bb](https://github.com/HealthNoteLabs/Runstr/commit/84479bb76fa597e7ef0959d64d954a173829ff19))
* implemented wavlake integration ([997a908](https://github.com/HealthNoteLabs/Runstr/commit/997a908b6e6673de7409e5a3de1685779af40019))
* setup capacitorjs with background geolocation api ([7df0dfe](https://github.com/HealthNoteLabs/Runstr/commit/7df0dfe4735e874ec3a939a214028726db2db527))

### Bug Fixes

* convert GeolocationPosition object to json before using it with spread operator ([ebfff61](https://github.com/HealthNoteLabs/Runstr/commit/ebfff6138791fd91cba1cc2189e8c3ba95d6ba2a))
* Update package-lock.json to align with package.json dependencies ([4701f85](https://github.com/HealthNoteLabs/Runstr/commit/4701f85b131db6ee547d39d42dc2ef188e83134c))

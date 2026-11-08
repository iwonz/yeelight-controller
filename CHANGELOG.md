# Changelog

## 2.0.0 - 2026-11-08

### Breaking changes

- `connect()` now returns a promise that resolves only after initial properties are loaded and rejects if setup fails.
- `getProps()` now returns a property map. Use `getPropValues()` when the raw ordered value array is required.
- Invalid or fractional protocol parameters now throw `YeelightValidationError` instead of being silently accepted.
- `YeelightSceneClass.AUTO_DELAY_OFF` now serializes the protocol value `auto_delay_off` instead of the misspelled value from 1.x.
- Discovery keeps device instances available for refresh and reconnect; await `deactivate()` for complete cleanup.

### Added

- Reliable CRLF-framed TCP message parsing, command timeouts, protocol errors, duplicate-ID protection, and deterministic connection cleanup.
- Typed command results, device and discovery event maps, connection states, property snapshots, and exported error classes.
- `YeelightDevice` as the full controller, with `YeelightDeviceController` preserved as a compatibility alias.
- Configurable Yeelight command quota enforcement with music-mode bypass.
- `device.background` facade for background-light commands while preserving the older positional `isBg` arguments.
- Discovery message validation, device refresh, reconnect support, and explicit `rescan()`.
- Runtime parameter validation for documented protocol command inputs.

### Tooling

- Added runtime, type-level, lifecycle, discovery, validation, and public API tests.
- Replaced ESLint and Prettier with Biome, added Knip, upgraded TypeScript, and removed vulnerable release/documentation dependencies.

## 1.0.1 - 2021-12-19

- Initial public release.

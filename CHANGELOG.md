# Changelog

All notable changes to the ABAPer VS Code extension will be documented in this file.

## [1.1.5](https://github.com/bluefunda/abaper-vscode/compare/v1.1.4...v1.1.5) (2026-04-06)


### Bug Fixes

* use correct gateway path for telemetry endpoint ([#14](https://github.com/bluefunda/abaper-vscode/issues/14)) ([66e8574](https://github.com/bluefunda/abaper-vscode/commit/66e857432cd63f77a344f2ecea888c5a2b0afd09))

## [1.1.4](https://github.com/bluefunda/abaper-vscode/compare/v1.1.3...v1.1.4) (2026-04-02)


### Bug Fixes

* open Keycloak verification URL directly for login ([#12](https://github.com/bluefunda/abaper-vscode/issues/12)) ([eacd09b](https://github.com/bluefunda/abaper-vscode/commit/eacd09bf2a34efd223de78849f5bbf8a4e073557))

## [1.1.3](https://github.com/bluefunda/abaper-vscode/compare/v1.1.2...v1.1.3) (2026-04-02)


### Bug Fixes

* add VS Code launch config for F5 debugging ([#9](https://github.com/bluefunda/abaper-vscode/issues/9)) ([f157350](https://github.com/bluefunda/abaper-vscode/commit/f15735082ce2937ff3ea79aa5bf613295da8fb01))
* use URL API to build login URL, prevent double-encoding ([#10](https://github.com/bluefunda/abaper-vscode/issues/10)) ([9312b07](https://github.com/bluefunda/abaper-vscode/commit/9312b07123d4213941ac147b472b7b7bca745807))

## [1.1.2](https://github.com/bluefunda/abaper-vscode/compare/v1.1.1...v1.1.2) (2026-04-02)


### Bug Fixes

* prevent double-encoding of redirect_uri in login URL ([#7](https://github.com/bluefunda/abaper-vscode/issues/7)) ([2c4f147](https://github.com/bluefunda/abaper-vscode/commit/2c4f1479b84ee91b7f384f28846ff056daf5a1f3))

## [1.1.1](https://github.com/bluefunda/abaper-vscode/compare/v1.1.0...v1.1.1) (2026-04-02)


### Bug Fixes

* revert auth host to auth.bluefunda.com ([#5](https://github.com/bluefunda/abaper-vscode/issues/5)) ([ed0719b](https://github.com/bluefunda/abaper-vscode/commit/ed0719bd26357f3168957fcf853601ae3de266f7))

## [1.1.0](https://github.com/bluefunda/abaper-vscode/compare/v1.0.0...v1.1.0) (2026-04-02)


### Features

* route login through bluefunda.com, add signup command, add telemetry ([#3](https://github.com/bluefunda/abaper-vscode/issues/3)) ([bb87508](https://github.com/bluefunda/abaper-vscode/commit/bb8750858d2102f0e5cd57128decfa07f1464180))

## 1.0.0 (2026-03-09)


### Features

* initial release of ABAPer VS Code extension ([774b6ef](https://github.com/bluefunda/abaper-vscode/commit/774b6ef2ba0a20263278759574a9370c6a3adf1e))


### Bug Fixes

* add eslint config and fix release workflow ([cb7b588](https://github.com/bluefunda/abaper-vscode/commit/cb7b58869f74c40cac9de4ba72289fbf0e4c0680))

## [0.3.0] - 2026-02-28

### Added

- AI chat panel with streaming responses and real-time markdown rendering
- Device authorization flow (OAuth2) via BlueFunda
- Chat commands: `/explain`, `/generate`, `/performance`, `/table`
- Editor context capture (selected code, open file, cursor position)
- Keyboard shortcut: `Cmd+Shift+A` / `Ctrl+Shift+A` to open chat
- Copy and Insert at Cursor actions on AI responses
- Full GFM markdown support (tables, code blocks, lists, blockquotes)
- Thinking/analyzing spinner during response generation
- Auto-refresh of authentication tokens

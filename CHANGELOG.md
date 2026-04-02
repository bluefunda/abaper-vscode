# Changelog

All notable changes to the ABAPer VS Code extension will be documented in this file.

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

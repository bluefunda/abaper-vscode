# CLAUDE.md — abaper-vscode

## What is this?

VS Code extension for ABAPer. AI-powered ABAP development assistant with chat panel, streaming responses, and editor context awareness.

## Key Features

- AI chat panel with streaming markdown responses
- Chat commands: `/explain`, `/generate`, `/performance`, `/table`
- VS Code commands: Open Chat, Login, Logout
- Keyboard shortcut: `Cmd+Shift+A` / `Ctrl+Shift+A` to open chat

## Auth

OAuth2 device authorization flow via Keycloak. Tokens stored in VS Code SecretStorage API, auto-refreshed.

## Configuration

- `abaper.apiBaseUrl` — default: `https://api.bluefunda.com`
- Requires VS Code 1.85.0+

## Conventions

- Commits: conventional format (`feat:`, `fix:`, `chore:`)
- Branches: `<type>/<short-description>`
- PRs: conventional commit title, target `main`, squash-merged

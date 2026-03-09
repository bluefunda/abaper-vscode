# ABAPer for Visual Studio Code

AI-powered ABAP development assistant by [BlueFunda](https://bluefunda.com).

## Features

### AI Chat Panel

Open a chat panel alongside your editor to ask questions, get explanations, and generate ABAP code. The chat panel captures your editor context automatically — selected code, open file, cursor position — so responses are always relevant to what you're working on.

- **Streaming responses** with real-time markdown rendering
- **Full markdown support** including tables, code blocks, lists, and syntax formatting
- **Context-aware** — automatically includes your open file or selected code

### Chat Commands

Type these directly in the chat input:

| Command | Description |
|---------|-------------|
| `/explain` | Explain the selected code or open file |
| `/generate [prompt]` | Generate ABAP code from a description |
| `/performance` | Analyze performance and suggest optimizations |
| `/table [name]` | Look up SAP table definitions |

You can also type free-form questions — the AI will use your editor context automatically.

### VS Code Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description |
|---------|-------------|
| `ABAPer: Open Chat` | Open the AI chat panel |
| `ABAPer: Login` | Authenticate with BlueFunda |
| `ABAPer: Logout` | Clear stored credentials |

### Keyboard Shortcut

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+A` (Mac) / `Ctrl+Shift+A` (Windows/Linux) | Open Chat |

## Getting Started

1. Install the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=bluefunda.abaper)
2. Run **ABAPer: Login** from the Command Palette
3. A device code will be shown — open the provided URL in your browser and enter the code to authenticate
4. Once authenticated, open any file and press `Cmd+Shift+A` to start chatting

## Authentication

ABAPer uses the OAuth2 Device Authorization flow. When you run **ABAPer: Login**:

1. A one-time device code is displayed in VS Code
2. Your browser opens the authentication page
3. Enter the device code and sign in with your BlueFunda account
4. VS Code automatically detects the login and securely stores your credentials using VS Code's built-in SecretStorage API

Tokens are refreshed automatically — you only need to log in once.

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `abaper.apiBaseUrl` | `https://api.bluefunda.com` | BlueFunda API base URL |

## Requirements

- VS Code 1.85.0 or later
- A [BlueFunda](https://bluefunda.com) account

## Privacy

All AI processing runs on BlueFunda's backend. No code is stored permanently — it is sent only for the duration of the request. No API keys or LLM credentials are embedded in the extension.

## License

[MIT](LICENSE)

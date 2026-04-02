import * as vscode from 'vscode';

const ACCESS_TOKEN_KEY = 'abaper.accessToken';
const REFRESH_TOKEN_KEY = 'abaper.refreshToken';
const TOKEN_EXPIRY_KEY = 'abaper.tokenExpiry';

const CLIENT_ID = 'cai-cli';
const DEFAULT_REALM = 'individual';

interface DeviceAuthResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface ErrorResponse {
  error: string;
  error_description?: string;
}

export class AuthManager {
  private secretStorage: vscode.SecretStorage;
  private statusBarItem: vscode.StatusBarItem;

  constructor(context: vscode.ExtensionContext) {
    this.secretStorage = context.secrets;
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'abaper.login';
    context.subscriptions.push(this.statusBarItem);

    this.updateStatusBar();

    context.secrets.onDidChange((e) => {
      if (e.key === ACCESS_TOKEN_KEY) {
        this.updateStatusBar();
      }
    });
  }

  private getAuthBaseUrl(): string {
    const realm = DEFAULT_REALM;
    return `https://ai.bluefunda.com/realms/${realm}/protocol/openid-connect`;
  }

  async login(): Promise<void> {
    const authBase = this.getAuthBaseUrl();

    // Step 1: Request device code
    const deviceResp = await fetch(`${authBase}/auth/device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        scope: 'openid',
      }),
    });

    if (!deviceResp.ok) {
      const text = await deviceResp.text();
      vscode.window.showErrorMessage(`ABAPer: Failed to start login (${deviceResp.status}): ${text}`);
      return;
    }

    const deviceData = (await deviceResp.json()) as DeviceAuthResponse;

    // Step 2: Show user code and open browser via bluefunda.com/login
    const verificationUrl = deviceData.verification_uri_complete || deviceData.verification_uri;
    const loginUrl = `https://bluefunda.com/login?redirect_uri=${encodeURIComponent(verificationUrl)}&utm_source=vscode-extension&utm_medium=command&utm_campaign=login`;
    await vscode.env.openExternal(vscode.Uri.parse(loginUrl));

    vscode.window.showInformationMessage(
      `ABAPer: Enter code ${deviceData.user_code} in the browser to log in.`
    );

    // Step 3: Poll for token
    const pollInterval = Math.max(deviceData.interval, 5) * 1000;
    const deadline = Date.now() + deviceData.expires_in * 1000;

    const token = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `ABAPer: Waiting for login... (code: ${deviceData.user_code})`,
        cancellable: true,
      },
      async (_progress, cancellation) => {
        while (Date.now() < deadline) {
          if (cancellation.isCancellationRequested) {
            return undefined;
          }

          await sleep(pollInterval);

          const result = await this.pollToken(authBase, deviceData.device_code);
          if (result === 'pending') {
            continue;
          }
          if (result === 'expired') {
            vscode.window.showErrorMessage('ABAPer: Device code expired. Please run login again.');
            return undefined;
          }
          if (result === 'denied') {
            vscode.window.showErrorMessage('ABAPer: Login denied by user.');
            return undefined;
          }
          if (typeof result === 'object') {
            return result;
          }
        }
        vscode.window.showErrorMessage('ABAPer: Login timed out. Please try again.');
        return undefined;
      }
    );

    if (token) {
      await this.saveTokens(token);
      vscode.window.showInformationMessage('ABAPer: Successfully logged in!');
    }
  }

  private async pollToken(
    authBase: string,
    deviceCode: string
  ): Promise<TokenResponse | 'pending' | 'expired' | 'denied'> {
    const resp = await fetch(`${authBase}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: CLIENT_ID,
        device_code: deviceCode,
      }),
    });

    if (resp.ok) {
      return (await resp.json()) as TokenResponse;
    }

    const errorData = (await resp.json()) as ErrorResponse;
    if (errorData.error === 'authorization_pending' || errorData.error === 'slow_down') {
      return 'pending';
    }
    if (errorData.error === 'expired_token') {
      return 'expired';
    }
    if (errorData.error === 'access_denied') {
      return 'denied';
    }

    throw new Error(`Auth failed: ${errorData.error_description || errorData.error}`);
  }

  private async refreshAccessToken(): Promise<TokenResponse | undefined> {
    const refreshToken = await this.secretStorage.get(REFRESH_TOKEN_KEY);
    if (!refreshToken) return undefined;

    const authBase = this.getAuthBaseUrl();
    const resp = await fetch(`${authBase}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        refresh_token: refreshToken,
      }),
    });

    if (!resp.ok) return undefined;
    return (await resp.json()) as TokenResponse;
  }

  private async saveTokens(token: TokenResponse): Promise<void> {
    const expiry = Date.now() + token.expires_in * 1000;
    await Promise.all([
      this.secretStorage.store(ACCESS_TOKEN_KEY, token.access_token),
      this.secretStorage.store(REFRESH_TOKEN_KEY, token.refresh_token),
      this.secretStorage.store(TOKEN_EXPIRY_KEY, expiry.toString()),
    ]);
  }

  async getToken(): Promise<string | undefined> {
    const accessToken = await this.secretStorage.get(ACCESS_TOKEN_KEY);
    if (!accessToken) return undefined;

    // Check expiry
    const expiryStr = await this.secretStorage.get(TOKEN_EXPIRY_KEY);
    const expiry = expiryStr ? parseInt(expiryStr, 10) : 0;

    if (Date.now() < expiry) {
      return accessToken;
    }

    // Token expired — try refresh
    const refreshed = await this.refreshAccessToken();
    if (refreshed) {
      await this.saveTokens(refreshed);
      return refreshed.access_token;
    }

    return undefined;
  }

  async clearToken(): Promise<void> {
    await Promise.all([
      this.secretStorage.delete(ACCESS_TOKEN_KEY),
      this.secretStorage.delete(REFRESH_TOKEN_KEY),
      this.secretStorage.delete(TOKEN_EXPIRY_KEY),
    ]);
  }

  async logout(): Promise<void> {
    await this.clearToken();
    vscode.window.showInformationMessage('ABAPer: Logged out.');
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }

  private async updateStatusBar(): Promise<void> {
    const authenticated = await this.isAuthenticated();
    if (authenticated) {
      this.statusBarItem.text = '$(check) ABAPer';
      this.statusBarItem.tooltip = 'ABAPer: Logged in (click to manage)';
    } else {
      this.statusBarItem.text = '$(key) ABAPer: Login';
      this.statusBarItem.tooltip = 'Click to login to ABAPer';
    }
    this.statusBarItem.show();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

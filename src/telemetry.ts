import * as vscode from 'vscode';
import { AuthManager } from './auth';

interface TelemetryEvent {
  event: string;
  properties?: Record<string, string | number | boolean>;
}

export class TelemetryClient {
  private authManager: AuthManager;
  private extensionVersion: string;

  constructor(authManager: AuthManager, extensionVersion: string) {
    this.authManager = authManager;
    this.extensionVersion = extensionVersion;
  }

  private getBaseUrl(): string {
    return vscode.workspace
      .getConfiguration('abaper')
      .get<string>('apiBaseUrl', 'https://api.bluefunda.com');
  }

  async track(event: string, properties?: Record<string, string | number | boolean>): Promise<void> {
    try {
      const token = await this.authManager.getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const body: TelemetryEvent = {
        event,
        properties: {
          ...properties,
          client: 'vscode',
          extension_version: this.extensionVersion,
          vscode_version: vscode.version,
          platform: process.platform,
          locale: vscode.env.language,
        },
      };

      await fetch(`${this.getBaseUrl()}/abaper/telemetry`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch {
      // Telemetry should never break the extension
    }
  }
}

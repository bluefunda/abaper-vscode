import * as vscode from 'vscode';
import { AuthManager } from './auth';
import { ChatClient } from './chat-client';
import { ChatPanel } from './chat-panel';
import { TelemetryClient } from './telemetry';

export function activate(context: vscode.ExtensionContext): void {
  const authManager = new AuthManager(context);
  const chatClient = new ChatClient(authManager);
  const extensionVersion = vscode.extensions.getExtension('bluefunda.abaper')?.packageJSON.version ?? 'unknown';
  const telemetry = new TelemetryClient(authManager, extensionVersion);

  telemetry.track('extension_activated');

  context.subscriptions.push(
    vscode.commands.registerCommand('abaper.login', async () => {
      telemetry.track('login_started');
      await authManager.login();
      const isAuth = await authManager.isAuthenticated();
      telemetry.track('login_completed', { success: isAuth });
    }),
    vscode.commands.registerCommand('abaper.logout', async () => {
      await authManager.logout();
      telemetry.track('logout');
    }),
    vscode.commands.registerCommand('abaper.signup', () => {
      const signupUrl = 'https://bluefunda.com/signup?utm_source=vscode-extension&utm_medium=command&utm_campaign=signup';
      vscode.env.openExternal(vscode.Uri.parse(signupUrl));
      telemetry.track('signup_opened');
    }),
    vscode.commands.registerCommand('abaper.openChat', () => {
      ChatPanel.createOrShow(context.extensionUri, chatClient);
      telemetry.track('chat_opened');
    })
  );

  console.log('ABAPer extension activated');
}

export function deactivate(): void {}

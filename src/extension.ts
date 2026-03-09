import * as vscode from 'vscode';
import { AuthManager } from './auth';
import { ChatClient } from './chat-client';
import { ChatPanel } from './chat-panel';

export function activate(context: vscode.ExtensionContext): void {
  const authManager = new AuthManager(context);
  const chatClient = new ChatClient(authManager);

  context.subscriptions.push(
    vscode.commands.registerCommand('abaper.login', () => authManager.login()),
    vscode.commands.registerCommand('abaper.logout', () => authManager.logout()),
    vscode.commands.registerCommand('abaper.openChat', () => {
      ChatPanel.createOrShow(context.extensionUri, chatClient);
    })
  );

  console.log('ABAPer extension activated');
}

export function deactivate(): void {}

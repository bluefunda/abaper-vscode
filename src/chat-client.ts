import * as vscode from 'vscode';
import { AuthManager } from './auth';

export interface ChatEvent {
  type: string;
  content?: string;
  full_content?: string;
  error?: string;
  message?: string;
  session_id?: string;
  tool_name?: string;
  status?: string;
  duration_ms?: number;
  result_summary?: string;
  artifact_name?: string;
  artifact_type?: string;
  action?: string;
  success?: boolean;
}

export class ChatClient {
  private authManager: AuthManager;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
  }

  private getBaseUrl(): string {
    return vscode.workspace
      .getConfiguration('abaper')
      .get<string>('apiBaseUrl', 'https://api.bluefunda.com');
  }

  async generateTitle(chatId: string, prompt: string): Promise<string> {
    const token = await this.authManager.getToken();
    if (!token) { return 'New Chat'; }

    try {
      const url = `${this.getBaseUrl()}/abaper/ai/chats/${chatId}/title`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt }),
      });

      if (!resp.ok) { return 'New Chat'; }
      const data = await resp.json() as { generatedTitle?: string; title?: string };
      return data.generatedTitle || data.title || 'New Chat';
    } catch {
      return 'New Chat';
    }
  }

  async streamChat(
    chatId: string,
    prompt: string,
    isNewChat: boolean,
    onEvent: (event: ChatEvent) => void
  ): Promise<void> {
    const token = await this.authManager.getToken();
    if (!token) {
      throw new Error('Not authenticated. Please login first using "ABAPer: Login".');
    }

    const url = `${this.getBaseUrl()}/abaper/ai/chats/${chatId}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    };

    const body = JSON.stringify({
      prompt,
      model: 'groq',
      agentName: 'abaper',
      isNewChat,
    });

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    if (resp.status === 401) {
      await this.authManager.clearToken();
      throw new Error('Session expired. Please login again.');
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`API error (${resp.status}): ${text || resp.statusText}`);
    }

    if (!resp.body) {
      throw new Error('No response body — SSE streaming unavailable');
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          let jsonStr = line;
          if (line.startsWith('data: ')) {
            jsonStr = line.substring(6);
          } else if (line.startsWith('data:')) {
            jsonStr = line.substring(5);
          }

          if (!jsonStr.trim()) continue;
          if (jsonStr.startsWith(':')) continue;
          // Skip SSE event type lines
          if (jsonStr.startsWith('event:') || line.startsWith('event:')) continue;

          try {
            const parsed: ChatEvent = JSON.parse(jsonStr);
            onEvent(parsed);
          } catch {
            // Non-JSON line — skip
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        let jsonStr = buffer;
        if (buffer.startsWith('data: ')) jsonStr = buffer.substring(6);
        else if (buffer.startsWith('data:')) jsonStr = buffer.substring(5);
        if (jsonStr.trim() && !jsonStr.startsWith(':')) {
          try {
            const parsed: ChatEvent = JSON.parse(jsonStr);
            onEvent(parsed);
          } catch {
            // ignore
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

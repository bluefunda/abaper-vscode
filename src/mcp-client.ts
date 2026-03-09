import * as vscode from 'vscode';
import { AuthManager } from './auth';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number;
  result?: {
    content?: Array<{ type: string; text: string }>;
    tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
    protocolVersion?: string;
    capabilities?: Record<string, unknown>;
    serverInfo?: { name: string; version: string };
    isError?: boolean;
  };
  error?: {
    code: number;
    message: string;
  };
}

export class McpClient {
  private authManager: AuthManager;
  private requestId = 0;
  private sessionId: string | undefined;
  private initialized = false;

  constructor(authManager: AuthManager) {
    this.authManager = authManager;
  }

  private getBaseUrl(): string {
    return vscode.workspace
      .getConfiguration('abaper')
      .get<string>('apiBaseUrl', 'https://api.bluefunda.com');
  }

  private getEndpoint(): string {
    return `${this.getBaseUrl()}/abaper/ai/agent`;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.authManager.getToken();
    if (!token) {
      throw new Error('Not authenticated. Please login first using "ABAPer: Login".');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${token}`,
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    return headers;
  }

  private nextId(): number {
    return ++this.requestId;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const response = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'abaper-vscode', version: '0.3.0' },
      },
    });

    if (response.error) {
      throw new Error(`MCP init failed: ${response.error.message}`);
    }

    // Send initialized notification
    await this.sendNotification({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });

    this.initialized = true;
  }

  async callTool(
    toolName: string,
    args: Record<string, unknown>,
    onChunk?: (text: string) => void
  ): Promise<string> {
    await this.initialize();

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    };

    if (onChunk) {
      return this.sendStreamingRequest(request, onChunk);
    }

    const response = await this.sendRequest(request);

    if (response.error) {
      throw new Error(response.error.message);
    }

    const textContent = response.result?.content
      ?.filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n');

    return textContent || '';
  }

  /**
   * Parse a raw SSE response body and extract the last JSON-RPC response.
   * SSE format:
   *   event: message
   *   data: {"jsonrpc":"2.0", ...}
   */
  private parseSseBody(body: string): JsonRpcResponse {
    const lines = body.split('\n');
    let lastData: string | undefined;

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        lastData = line.slice(6).trim();
      }
    }

    if (lastData) {
      return JSON.parse(lastData) as JsonRpcResponse;
    }

    // If no SSE data lines found, try parsing the whole body
    return JSON.parse(body) as JsonRpcResponse;
  }

  private async sendRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const headers = await this.getHeaders();
    const url = this.getEndpoint();

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    const sid = resp.headers.get('mcp-session-id');
    if (sid) {
      this.sessionId = sid;
    }

    if (resp.status === 401) {
      this.initialized = false;
      await this.authManager.clearToken();
      throw new Error('Session expired. Please login again.');
    }

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`API error (${resp.status}): ${text}`);
    }

    const contentType = resp.headers.get('content-type') || '';
    const body = await resp.text();

    if (contentType.includes('text/event-stream')) {
      return this.parseSseBody(body);
    }

    return JSON.parse(body) as JsonRpcResponse;
  }

  private async sendNotification(request: JsonRpcRequest): Promise<void> {
    const headers = await this.getHeaders();
    const url = this.getEndpoint();

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    const sid = resp.headers.get('mcp-session-id');
    if (sid) {
      this.sessionId = sid;
    }

    if (resp.status === 401) {
      this.initialized = false;
      await this.authManager.clearToken();
      throw new Error('Session expired. Please login again.');
    }

    // Consume the body (may be SSE or empty)
    await resp.text();
  }

  private async sendStreamingRequest(
    request: JsonRpcRequest,
    onChunk: (text: string) => void
  ): Promise<string> {
    const headers = await this.getHeaders();
    const url = this.getEndpoint();

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });

    const sid = resp.headers.get('mcp-session-id');
    if (sid) {
      this.sessionId = sid;
    }

    if (resp.status === 401) {
      this.initialized = false;
      await this.authManager.clearToken();
      throw new Error('Session expired. Please login again.');
    }

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`API error (${resp.status}): ${text}`);
    }

    const contentType = resp.headers.get('content-type') || '';

    // Handle SSE streaming
    if (contentType.includes('text/event-stream') && resp.body) {
      let fullText = '';
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data) as JsonRpcResponse;

            if (parsed.error) {
              throw new Error(parsed.error.message);
            }

            if (parsed.result?.content) {
              for (const c of parsed.result.content) {
                if (c.type === 'text') {
                  fullText += c.text;
                  onChunk(c.text);
                }
              }
            }
          } catch (e) {
            if (e instanceof SyntaxError) {
              // Raw text chunk
              fullText += data;
              onChunk(data);
            } else {
              throw e;
            }
          }
        }
      }

      return fullText;
    }

    // Non-streaming JSON response
    const body = await resp.text();
    let response: JsonRpcResponse;
    try {
      response = JSON.parse(body) as JsonRpcResponse;
    } catch {
      // Might be SSE even without proper content-type
      response = this.parseSseBody(body);
    }

    if (response.error) {
      throw new Error(response.error.message);
    }

    const text = response.result?.content
      ?.filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('\n') || '';

    onChunk(text);
    return text;
  }

  resetSession(): void {
    this.sessionId = undefined;
    this.initialized = false;
    this.requestId = 0;
  }
}

import * as vscode from 'vscode';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { ChatClient, ChatEvent } from './chat-client';

export class ChatPanel {
  public static readonly viewType = 'abaper.chatPanel';
  private static instance: ChatPanel | undefined;
  private panel: vscode.WebviewPanel;
  private chatClient: ChatClient;
  private extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private chatId: string;
  private isNewChat = true;
  private lastEditor: vscode.TextEditor | undefined;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    chatClient: ChatClient
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.chatClient = chatClient;
    this.chatId = randomUUID();

    // Capture current editor before panel takes focus
    this.lastEditor = vscode.window.activeTextEditor;

    // Track the last real text editor (not the webview)
    vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        if (editor) {
          this.lastEditor = editor;
        }
      },
      null,
      this.disposables
    );

    this.panel.webview.html = this.getHtml();

    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  static createOrShow(extensionUri: vscode.Uri, chatClient: ChatClient): void {
    const column = vscode.ViewColumn.Beside;

    if (ChatPanel.instance) {
      ChatPanel.instance.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      ChatPanel.viewType,
      'ABAPer Chat',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    ChatPanel.instance = new ChatPanel(panel, extensionUri, chatClient);
  }

  private dispose(): void {
    ChatPanel.instance = undefined;
    this.panel.dispose();
    this.disposables.forEach((d) => d.dispose());
  }

  private getEditorContext(): { language: string; fileName: string; cursorLine: number; selectedCode: string; fullContext: string } {
    const editor = this.lastEditor;
    if (!editor || editor.document.isClosed) {
      return { language: 'abap', fileName: '', cursorLine: 0, selectedCode: '', fullContext: '' };
    }
    const doc = editor.document;
    const sel = editor.selection;
    return {
      language: doc.languageId || 'abap',
      fileName: path.basename(doc.fileName),
      cursorLine: sel.active.line + 1,
      selectedCode: doc.getText(sel),
      fullContext: doc.getText(),
    };
  }

  private buildPrompt(userText: string): string {
    const ctx = this.getEditorContext();
    const hasCode = ctx.selectedCode || ctx.fullContext;

    // If user typed a slash command, build context-aware prompt
    const lower = userText.trim().toLowerCase();

    if (lower.startsWith('/explain') && hasCode) {
      const code = ctx.selectedCode || ctx.fullContext;
      return `Explain the following ${ctx.language.toUpperCase()} code from ${ctx.fileName}:\n\n\`\`\`${ctx.language}\n${code}\n\`\`\``;
    }

    if (lower.startsWith('/generate')) {
      const prompt = userText.replace(/^\/generate\s*/i, '');
      return `Generate ${ctx.language.toUpperCase()} code: ${prompt}`;
    }

    if (lower.startsWith('/performance') && hasCode) {
      const code = ctx.selectedCode || ctx.fullContext;
      return `Analyze the performance of this ${ctx.language.toUpperCase()} code and suggest optimizations:\n\n\`\`\`${ctx.language}\n${code}\n\`\`\``;
    }

    if (lower.startsWith('/table')) {
      const query = userText.replace(/^\/table\s*/i, '');
      return `SAP Table Lookup: ${query}`;
    }

    // Free-form: attach selected code or full file as context
    if (ctx.selectedCode) {
      return `${userText}\n\nContext — selected code from ${ctx.fileName} (line ${ctx.cursorLine}):\n\`\`\`${ctx.language}\n${ctx.selectedCode}\n\`\`\``;
    }

    if (ctx.fullContext && ctx.fileName) {
      // Send up to ~200 lines to avoid huge prompts
      const lines = ctx.fullContext.split('\n');
      const truncated = lines.length > 200 ? lines.slice(0, 200).join('\n') + '\n// ... truncated' : ctx.fullContext;
      return `${userText}\n\nContext — open file ${ctx.fileName}:\n\`\`\`${ctx.language}\n${truncated}\n\`\`\``;
    }

    return userText;
  }

  private async handleMessage(msg: { type: string; text?: string; code?: string }): Promise<void> {
    switch (msg.type) {
      case 'send': {
        const userText = msg.text || '';
        const prompt = this.buildPrompt(userText);

        this.panel.webview.postMessage({ type: 'stream-start' });

        try {
          await this.chatClient.streamChat(
            this.chatId,
            prompt,
            this.isNewChat,
            (event: ChatEvent) => {
              switch (event.type) {
                case 'stream_chunk':
                  if (event.content) {
                    this.panel.webview.postMessage({ type: 'stream-chunk', chunk: event.content });
                  }
                  break;
                case 'stream_end':
                  this.panel.webview.postMessage({ type: 'stream-end' });
                  break;
                case 'stream_error':
                case 'error':
                  this.panel.webview.postMessage({
                    type: 'error',
                    message: event.error || event.message || 'Unknown error',
                  });
                  break;
                case 'stream_tool_execution':
                  if (event.tool_name) {
                    this.panel.webview.postMessage({
                      type: 'stream-chunk',
                      chunk: `\n> Tool: **${event.tool_name}** (${event.status || 'running'})\n`,
                    });
                  }
                  break;
                case 'stream_progress': {
                  const toolsStr = (event as any).tools?.join(', ') || 'tools';
                  const step = (event as any).iteration ? ` (step ${(event as any).iteration})` : '';
                  this.panel.webview.postMessage({ type: 'stream-progress', text: `Running ${toolsStr}${step}...` });
                  break;
                }
              }
            }
          );

          // Ensure stream-end is sent even if server doesn't send one
          this.panel.webview.postMessage({ type: 'stream-end' });

          // Generate chat title for new chats (fire and forget)
          if (this.isNewChat) {
            this.chatClient.generateTitle(this.chatId, userText).catch(() => {});
          }
          this.isNewChat = false;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          this.panel.webview.postMessage({ type: 'error', message });
        }
        break;
      }
      case 'copy':
        if (msg.text) {
          vscode.env.clipboard.writeText(msg.text);
          vscode.window.showInformationMessage('Copied to clipboard');
        }
        break;
      case 'insert':
        if (msg.code) {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            editor.edit((eb) => eb.insert(editor.selection.active, msg.code!));
          }
        }
        break;
    }
  }

  private getHtml(): string {
    const webview = this.panel.webview;
    const nonce = getNonce();

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'chat.js')
    );
    const markedUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'marked.min.js')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>ABAPer Chat</title>
  <style nonce="${nonce}">
    :root {
      --user-bg: var(--vscode-button-background);
      --user-fg: var(--vscode-button-foreground);
      --bot-bg: var(--vscode-editor-background);
      --bot-fg: var(--vscode-editor-foreground);
      --border: var(--vscode-panel-border);
      --input-bg: var(--vscode-input-background);
      --input-fg: var(--vscode-input-foreground);
      --input-border: var(--vscode-input-border);
      --btn-bg: var(--vscode-button-background);
      --btn-fg: var(--vscode-button-foreground);
      --btn-hover: var(--vscode-button-hoverBackground);
      --muted: var(--vscode-descriptionForeground);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      display: flex;
      flex-direction: column;
    }
    .header {
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .header h3 { font-size: 13px; font-weight: 600; }
    .header .hint { font-size: 11px; color: var(--muted); margin-left: auto; }
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .msg {
      max-width: 100%;
      padding: 10px 14px;
      border-radius: 12px;
      line-height: 1.5;
      font-size: 13px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    .msg.user {
      align-self: flex-end;
      max-width: 85%;
      background: var(--user-bg);
      color: var(--user-fg);
      border-bottom-right-radius: 4px;
    }
    .msg.bot {
      align-self: flex-start;
      background: var(--bot-bg);
      color: var(--bot-fg);
      border: 1px solid var(--border);
      border-bottom-left-radius: 4px;
    }

    /* Markdown: headings */
    .msg.bot h1 { font-size: 1.3em; font-weight: 700; margin: 12px 0 6px; }
    .msg.bot h2 { font-size: 1.15em; font-weight: 700; margin: 10px 0 4px; }
    .msg.bot h3 { font-size: 1.05em; font-weight: 600; margin: 8px 0 4px; }
    .msg.bot h4, .msg.bot h5, .msg.bot h6 { font-size: 1em; font-weight: 600; margin: 6px 0 2px; }

    /* Markdown: paragraphs */
    .msg.bot p { margin: 4px 0; line-height: 1.6; }

    /* Markdown: lists */
    .msg.bot ul, .msg.bot ol { margin: 4px 0 4px 20px; padding: 0; }
    .msg.bot li { margin: 2px 0; line-height: 1.6; }
    .msg.bot li > p { margin: 2px 0; }

    /* Markdown: blockquotes */
    .msg.bot blockquote {
      border-left: 3px solid var(--vscode-button-background);
      margin: 6px 0;
      padding: 4px 12px;
      color: var(--muted);
      font-style: italic;
    }

    /* Markdown: horizontal rule */
    .msg.bot hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 10px 0;
    }

    /* Markdown: code blocks */
    .msg.bot pre {
      background: var(--vscode-textCodeBlock-background);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px 12px;
      margin: 8px 0;
      overflow-x: auto;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      line-height: 1.4;
      white-space: pre;
    }
    .msg.bot code {
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      background: var(--vscode-textCodeBlock-background);
      padding: 1px 4px;
      border-radius: 3px;
    }
    .msg.bot pre code { background: none; padding: 0; }

    /* Markdown: tables */
    .msg.bot table {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: 12px;
      display: table;
    }
    .msg.bot thead { background: var(--vscode-textCodeBlock-background); }
    .msg.bot th {
      text-align: left;
      font-weight: 600;
      padding: 6px 10px;
      border: 1px solid var(--border);
      white-space: nowrap;
    }
    .msg.bot td {
      padding: 5px 10px;
      border: 1px solid var(--border);
      vertical-align: top;
    }
    .msg.bot tr:nth-child(even) { background: rgba(128,128,128,0.05); }
    .msg.bot .table-wrap {
      overflow-x: auto;
      margin: 8px 0;
      -webkit-overflow-scrolling: touch;
    }

    /* Markdown: strong, em, del */
    .msg.bot strong { font-weight: 600; }
    .msg.bot em { font-style: italic; }
    .msg.bot del { text-decoration: line-through; opacity: 0.7; }

    /* Markdown: links */
    .msg.bot a {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
    }
    .msg.bot a:hover { text-decoration: underline; }

    /* Markdown: images */
    .msg.bot img { max-width: 100%; border-radius: 4px; margin: 4px 0; }

    .msg.error {
      align-self: flex-start;
      background: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      color: var(--vscode-errorForeground);
      border-radius: 8px;
    }
    .msg-actions {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }
    .msg-actions button {
      background: none;
      border: 1px solid var(--border);
      color: var(--muted);
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      cursor: pointer;
    }
    .msg-actions button:hover {
      color: var(--vscode-foreground);
      border-color: var(--vscode-foreground);
    }
    .typing { display: none; align-self: flex-start; padding: 8px 16px; color: var(--muted); font-size: 12px; }
    .typing.active { display: flex; align-items: center; gap: 6px; }
    .dot-pulse { display: flex; gap: 3px; }
    .dot-pulse span {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--muted);
      animation: pulse 1.2s ease-in-out infinite;
    }
    .dot-pulse span:nth-child(2) { animation-delay: 0.2s; }
    .dot-pulse span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes pulse {
      0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1); }
    }
    .welcome {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--muted);
      text-align: center;
      padding: 32px;
      gap: 12px;
    }
    .welcome h2 { font-size: 18px; color: var(--vscode-foreground); }
    .welcome .cmds { text-align: left; font-size: 12px; line-height: 2; }
    .welcome .cmds code {
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
    }
    .input-area {
      padding: 12px 16px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }
    .input-area textarea {
      flex: 1;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      border-radius: 8px;
      padding: 8px 12px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      resize: none;
      line-height: 1.4;
      max-height: 120px;
      outline: none;
    }
    .input-area textarea:focus { border-color: var(--vscode-focusBorder); }
    .input-area textarea::placeholder { color: var(--muted); }
    .send-btn {
      background: var(--btn-bg);
      color: var(--btn-fg);
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      align-self: flex-end;
    }
    .send-btn:hover { background: var(--btn-hover); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
</head>
<body>
  <div class="header">
    <h3>ABAPer</h3>
    <span class="hint">AI-powered ABAP assistant</span>
  </div>
  <div class="messages" id="messages">
    <div class="welcome" id="welcome">
      <h2>ABAPer Chat</h2>
      <p>Ask anything about ABAP, or use commands:</p>
      <div class="cmds">
        <code>/explain</code> &mdash; Explain selected code<br>
        <code>/generate [prompt]</code> &mdash; Generate ABAP code<br>
        <code>/performance</code> &mdash; Analyze performance<br>
        <code>/table [name]</code> &mdash; SAP table lookup
      </div>
      <p style="margin-top:8px; font-size:11px;">Select code in the editor for context-aware responses.</p>
    </div>
  </div>
  <div class="typing" id="typing">
    <div class="dot-pulse"><span></span><span></span><span></span></div>
    <span id="typing-text">Thinking...</span>
  </div>
  <div class="input-area">
    <textarea id="input" rows="1" placeholder="Ask ABAPer anything... (Enter to send)"></textarea>
    <button class="send-btn" id="sendBtn">Send</button>
  </div>
  <script nonce="${nonce}" src="${markedUri}"></script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

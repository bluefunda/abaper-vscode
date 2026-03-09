(function () {
  var vscode = acquireVsCodeApi();
  var messagesEl = document.getElementById('messages');
  var welcomeEl = document.getElementById('welcome');
  var typingEl = document.getElementById('typing');
  var typingText = document.getElementById('typing-text');
  var inputEl = document.getElementById('input');
  var sendBtn = document.getElementById('sendBtn');

  var streaming = false;
  var currentBotMsg = null;
  var currentBotText = '';
  var firstChunkReceived = false;

  // Configure marked for GFM (tables, strikethrough, task lists)
  marked.use({ gfm: true, breaks: true });

  function renderMarkdown(text) {
    var html = marked.parse(text);
    // Wrap <table> elements in scrollable container
    html = html.replace(/<table>/g, '<div class="table-wrap"><table>');
    html = html.replace(/<\/table>/g, '</table></div>');
    return html;
  }

  function showThinking(text) {
    typingText.textContent = text || 'Thinking...';
    typingEl.classList.add('active');
    scrollToBottom();
  }

  function hideThinking() {
    typingEl.classList.remove('active');
  }

  function addUserMsg(text) {
    welcomeEl.style.display = 'none';
    var div = document.createElement('div');
    div.className = 'msg user';
    div.textContent = text;
    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function startBotMsg() {
    currentBotText = '';
    var div = document.createElement('div');
    div.className = 'msg bot';
    div.innerHTML = '';
    messagesEl.appendChild(div);
    currentBotMsg = div;
    scrollToBottom();
  }

  function appendBotChunk(chunk) {
    if (!firstChunkReceived) {
      firstChunkReceived = true;
      hideThinking();
      startBotMsg();
    }
    if (!currentBotMsg) { startBotMsg(); }
    currentBotText += chunk;
    currentBotMsg.innerHTML = renderMarkdown(currentBotText);
    scrollToBottom();
  }

  function finalizeBotMsg() {
    hideThinking();
    if (currentBotMsg && currentBotText) {
      var actions = document.createElement('div');
      actions.className = 'msg-actions';

      var copyBtn = document.createElement('button');
      copyBtn.textContent = 'Copy';
      copyBtn.onclick = function () {
        vscode.postMessage({ type: 'copy', text: currentBotText });
      };

      var insertBtn = document.createElement('button');
      insertBtn.textContent = 'Insert at Cursor';
      insertBtn.onclick = function () {
        vscode.postMessage({ type: 'insert', code: currentBotText });
      };

      actions.appendChild(copyBtn);
      actions.appendChild(insertBtn);
      currentBotMsg.appendChild(actions);
    }
    currentBotMsg = null;
    currentBotText = '';
    scrollToBottom();
  }

  function addErrorMsg(message) {
    hideThinking();
    var div = document.createElement('div');
    div.className = 'msg error';
    div.textContent = message;
    messagesEl.appendChild(div);
    scrollToBottom();
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setStreaming(val) {
    streaming = val;
    sendBtn.disabled = val;
    inputEl.disabled = val;
    if (!val) {
      inputEl.focus();
    }
  }

  function send() {
    var text = inputEl.value.trim();
    if (!text || streaming) { return; }

    addUserMsg(text);
    inputEl.value = '';
    inputEl.style.height = 'auto';
    firstChunkReceived = false;
    setStreaming(true);
    showThinking('Thinking...');

    vscode.postMessage({ type: 'send', text: text });
  }

  sendBtn.addEventListener('click', send);

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  inputEl.addEventListener('input', function () {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });

  window.addEventListener('message', function (event) {
    var msg = event.data;
    switch (msg.type) {
      case 'stream-start':
        // Keep spinner visible until first chunk
        break;
      case 'stream-progress':
        showThinking(msg.text || 'Analyzing...');
        break;
      case 'stream-chunk':
        appendBotChunk(msg.chunk);
        break;
      case 'stream-end':
        finalizeBotMsg();
        setStreaming(false);
        break;
      case 'error':
        finalizeBotMsg();
        addErrorMsg(msg.message);
        setStreaming(false);
        break;
    }
  });

  inputEl.focus();
})();

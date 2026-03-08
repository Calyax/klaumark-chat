/**
 * Klaudio Chat Widget — Klaumark Smart Home AI Assistant
 * Self-contained IIFE, Shadow DOM, no framework dependencies.
 * Served at: https://chat.klaumark.com/widget.js
 * Embed in app.blade.php: <script src="https://chat.klaumark.com/widget.js" defer></script>
 */
(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Guard — prevent double-init; reset on Livewire SPA navigation
  // wire:navigate causes script re-execution without a full page reload,
  // so we reset the flag before navigation so the widget reinitialises with
  // the new page's language.
  // ─────────────────────────────────────────────────────────────────────────────
  document.addEventListener('livewire:navigate', function () {
    window.__klaudioLoaded = false;
  }, { once: false });

  if (window.__klaudioLoaded) return;
  window.__klaudioLoaded = true;

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Constants
  // ─────────────────────────────────────────────────────────────────────────────
  var API_URL = 'https://chat.klaumark.com/api/chat';
  var BRAND_BLUE = '#0052E4';
  var DISMISSED_KEY = 'klaudio_dismissed';
  var AUTO_OPEN_DELAY = 30000;
  var TTS_URL = 'https://chat.klaumark.com/api/tts';

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Shadow DOM setup
  // ─────────────────────────────────────────────────────────────────────────────
  var host = document.createElement('div');
  host.id = 'klaudio-host';
  document.body.appendChild(host);
  var shadow = host.attachShadow({ mode: 'open' });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. CSS (scoped inside Shadow DOM — zero host-page leakage)
  // ─────────────────────────────────────────────────────────────────────────────
  var CSS = [
    ':host { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }',
    '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }',

    /* Launcher button */
    '#klaudio-launcher {',
    '  position: fixed; bottom: 24px; right: 24px; z-index: 9998;',
    '  width: 56px; height: 56px; border-radius: 50%;',
    '  background: ' + BRAND_BLUE + '; border: none; cursor: pointer;',
    '  display: flex; align-items: center; justify-content: center;',
    '  box-shadow: 0 4px 16px rgba(0,82,228,0.45);',
    '  transition: transform 0.18s ease, box-shadow 0.18s ease;',
    '}',
    '#klaudio-launcher:hover { transform: scale(1.08); box-shadow: 0 6px 22px rgba(0,82,228,0.55); }',
    '#klaudio-launcher svg { width: 30px; height: 30px; }',
    '@keyframes klaudio-ring { 0% { transform:scale(1); opacity:0.6; } 100% { transform:scale(1.65); opacity:0; } }',
    '#klaudio-launcher::after {',
    '  content:""; position:absolute; inset:0; border-radius:50%;',
    '  border: 2px solid ' + BRAND_BLUE + ';',
    '  animation: klaudio-ring 2s ease-out infinite;',
    '}',
    '@keyframes klaudio-wifi { 0%,100% { opacity:1; } 50% { opacity:0.35; } }',
    '#klaudio-launcher .w1 { animation: klaudio-wifi 2s ease-in-out infinite; }',
    '#klaudio-launcher .w2 { animation: klaudio-wifi 2s ease-in-out infinite 0.3s; }',
    '#klaudio-launcher .w3 { animation: klaudio-wifi 2s ease-in-out infinite 0.6s; }',

    /* Chat panel */
    '#klaudio-panel {',
    '  position: fixed; bottom: 90px; right: 24px; z-index: 9999;',
    '  width: 360px; max-height: 520px;',
    '  background: #fff; border-radius: 12px;',
    '  box-shadow: 0 8px 32px rgba(0,0,0,0.18);',
    '  display: flex; flex-direction: column; overflow: hidden;',
    '  transform: translateY(16px) scale(0.97); opacity: 0;',
    '  transition: transform 0.2s ease, opacity 0.2s ease;',
    '  pointer-events: none;',
    '}',
    '#klaudio-panel.open {',
    '  transform: translateY(0) scale(1); opacity: 1;',
    '  pointer-events: auto;',
    '}',

    /* Panel header */
    '#klaudio-header {',
    '  background: ' + BRAND_BLUE + '; color: #fff;',
    '  padding: 12px 16px; display: flex; align-items: center; gap: 10px;',
    '  border-radius: 12px 12px 0 0;',
    '}',
    '#klaudio-header .avatar {',
    '  width: 32px; height: 32px; border-radius: 50%;',
    '  background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center;',
    '  font-size: 15px; font-weight: 700; color: #fff; flex-shrink: 0;',
    '}',
    '#klaudio-header .title { flex: 1; }',
    '#klaudio-header .title strong { display: block; font-size: 14px; }',
    '#klaudio-header .title span { font-size: 11px; opacity: 0.8; }',
    '#klaudio-close {',
    '  background: none; border: none; cursor: pointer;',
    '  color: #fff; font-size: 20px; line-height: 1; padding: 2px 4px;',
    '  opacity: 0.8; transition: opacity 0.15s;',
    '}',
    '#klaudio-close:hover { opacity: 1; }',

    /* Messages area */
    '#klaudio-messages {',
    '  flex: 1; overflow-y: auto; padding: 12px;',
    '  display: flex; flex-direction: column; gap: 8px;',
    '  scroll-behavior: smooth;',
    '}',

    /* Message bubbles */
    '.msg { max-width: 82%; font-size: 13px; line-height: 1.45; word-break: break-word; }',
    '.msg-user {',
    '  align-self: flex-end;',
    '  background: ' + BRAND_BLUE + '; color: #fff;',
    '  padding: 8px 12px; border-radius: 14px 14px 3px 14px;',
    '}',
    '.msg-bot {',
    '  align-self: flex-start;',
    '  background: #F0F4FF; color: #1a1a2e;',
    '  padding: 8px 12px; border-radius: 14px 14px 14px 3px;',
    '}',
    '.msg-bot a { color: ' + BRAND_BLUE + '; }',
    '.msg-bot ul { padding-left: 16px; margin: 4px 0; }',
    '.msg-bot li { margin: 2px 0; }',

    /* Typing indicator */
    '#klaudio-typing {',
    '  align-self: flex-start;',
    '  background: #F0F4FF; padding: 10px 14px;',
    '  border-radius: 14px 14px 14px 3px;',
    '  display: none; gap: 4px; align-items: center;',
    '}',
    '#klaudio-typing.visible { display: flex; }',
    '#klaudio-typing span {',
    '  width: 6px; height: 6px; border-radius: 50%;',
    '  background: ' + BRAND_BLUE + '; opacity: 0.4;',
    '  animation: klaudio-pulse 1.2s ease-in-out infinite;',
    '}',
    '#klaudio-typing span:nth-child(2) { animation-delay: 0.2s; }',
    '#klaudio-typing span:nth-child(3) { animation-delay: 0.4s; }',
    '@keyframes klaudio-pulse {',
    '  0%, 80%, 100% { transform: scale(0.7); opacity: 0.3; }',
    '  40% { transform: scale(1); opacity: 1; }',
    '}',

    /* Quick replies */
    '#klaudio-quick-replies {',
    '  display: flex; flex-wrap: wrap; gap: 6px;',
    '  padding: 6px 12px 8px; align-self: flex-start;',
    '}',
    '#klaudio-quick-replies.hidden { display: none; }',
    '.quick-reply {',
    '  background: #fff; border: 1.5px solid ' + BRAND_BLUE + ';',
    '  color: ' + BRAND_BLUE + '; border-radius: 20px;',
    '  padding: 5px 12px; font-size: 12px; cursor: pointer;',
    '  white-space: nowrap; transition: background 0.15s, color 0.15s;',
    '}',
    '.quick-reply:hover { background: ' + BRAND_BLUE + '; color: #fff; }',

    /* Input area */
    '#klaudio-input-area {',
    '  border-top: 1px solid #e8ecf4;',
    '  padding: 10px 12px; display: flex; gap: 8px; align-items: center;',
    '}',
    '#klaudio-input {',
    '  flex: 1; border: 1.5px solid #dde3f0; border-radius: 20px;',
    '  padding: 8px 14px; font-size: 13px; outline: none;',
    '  transition: border-color 0.15s; background: #fafbff;',
    '}',
    '#klaudio-input:focus { border-color: ' + BRAND_BLUE + '; }',
    '#klaudio-send {',
    '  width: 36px; height: 36px; border-radius: 50%;',
    '  background: ' + BRAND_BLUE + '; border: none; cursor: pointer;',
    '  display: flex; align-items: center; justify-content: center;',
    '  transition: opacity 0.15s, transform 0.15s; flex-shrink: 0;',
    '}',
    '#klaudio-send:disabled { opacity: 0.35; cursor: default; transform: none; }',
    '#klaudio-send:not(:disabled):hover { transform: scale(1.08); }',
    '#klaudio-send svg { width: 16px; height: 16px; }',

    /* Mic button */
    '#klaudio-mic {',
    '  width: 36px; height: 36px; border-radius: 50%;',
    '  background: transparent; border: 1.5px solid #dde3f0; cursor: pointer;',
    '  display: flex; align-items: center; justify-content: center;',
    '  transition: border-color 0.15s, background 0.15s; flex-shrink: 0;',
    '}',
    '#klaudio-mic:hover { border-color: ' + BRAND_BLUE + '; }',
    '#klaudio-mic.listening {',
    '  border-color: #e53e3e; background: #fff5f5;',
    '  animation: klaudio-mic-pulse 1.2s ease-in-out infinite;',
    '}',
    '@keyframes klaudio-mic-pulse {',
    '  0%, 100% { box-shadow: 0 0 0 0 rgba(229,62,62,0.35); }',
    '  50% { box-shadow: 0 0 0 6px rgba(229,62,62,0); }',
    '}',
    '#klaudio-mic:disabled { opacity: 0.35; cursor: default; }',
    '#klaudio-mic svg { width: 16px; height: 16px; }',

    /* Responsive — keep widget visible on small screens */
    '@media (max-width: 400px) {',
    '  #klaudio-panel { width: calc(100vw - 24px); right: 12px; bottom: 80px; }',
    '  #klaudio-launcher { right: 12px; bottom: 12px; }',
    '}',
  ].join('\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. HTML template
  // ─────────────────────────────────────────────────────────────────────────────
  var HTML = [
    '<div id="klaudio">',

    /* Launcher — smart home house + animated wifi arcs */
    '  <button id="klaudio-launcher" aria-label="Open Klaudio chat">',
    '    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
    '      <!-- House body -->',
    '      <path d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z" fill="white" opacity="0.95"/>',
    '      <!-- Door -->',
    '      <rect x="9" y="14" width="6" height="8" rx="1" fill="#0052E4"/>',
    '      <!-- Wifi arcs inside house roof area -->',
    '      <circle class="w1" cx="12" cy="11" r="1" fill="#0052E4"/>',
    '      <path class="w2" d="M9.5 9.5a3.5 3.5 0 015 0" stroke="#0052E4" stroke-width="1.2" stroke-linecap="round" fill="none"/>',
    '      <path class="w3" d="M7.5 7.8a6 6 0 019 0" stroke="#0052E4" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.6"/>',
    '    </svg>',
    '  </button>',

    /* Chat panel */
    '  <div id="klaudio-panel" role="dialog" aria-label="Klaudio chat">',

    '    <div id="klaudio-header">',
    '      <div class="avatar">K</div>',
    '      <div class="title">',
    '        <strong>Klaudio</strong>',
    '        <span>Klaumark AI Assistant</span>',
    '      </div>',
    '      <button id="klaudio-close" aria-label="Close chat">&times;</button>',
    '    </div>',

    '    <div id="klaudio-messages">',
    '      <div id="klaudio-typing">',
    '        <span></span><span></span><span></span>',
    '      </div>',
    '    </div>',

    '    <div id="klaudio-quick-replies" class="hidden"></div>',

    '    <div id="klaudio-input-area">',
    '      <input id="klaudio-input" type="text" autocomplete="off" />',
    '      <button id="klaudio-mic" aria-label="Voice input">',
    '        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">',
    '          <rect x="9" y="2" width="6" height="12" rx="3" fill="' + BRAND_BLUE + '"/>',
    '          <path d="M5 11a7 7 0 0014 0" stroke="' + BRAND_BLUE + '" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
    '          <line x1="12" y1="18" x2="12" y2="22" stroke="' + BRAND_BLUE + '" stroke-width="1.5" stroke-linecap="round"/>',
    '          <line x1="9" y1="22" x2="15" y2="22" stroke="' + BRAND_BLUE + '" stroke-width="1.5" stroke-linecap="round"/>',
    '        </svg>',
    '      </button>',
    '      <button id="klaudio-send" disabled aria-label="Send message">',
    '        <svg viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">',
    '          <path d="M2 21L23 12 2 3v7l15 2-15 2z"/>',
    '        </svg>',
    '      </button>',
    '    </div>',

    '  </div>',
    '</div>',
  ].join('\n');

  shadow.innerHTML = '<style>' + CSS + '</style>' + HTML;

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. State
  // ─────────────────────────────────────────────────────────────────────────────
  var messages = [];         // { role: 'user'|'assistant', content: string }
  // Init lang from <html lang> — updates on first user message too
  var detectedLang = (document.documentElement.lang || 'pl').startsWith('en') ? 'en' : 'pl';
  var isOpen = false;
  var isStreaming = false;
  var firstMessageSent = false;

  // Web Speech API compatibility (Chrome/Edge: yes; Firefox: no; Safari 16.4+: partial)
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var hasMicSupport = !!SpeechRecognition;

  // Mic unsupported fallback messages
  var MIC_UNSUPPORTED = {
    pl: 'Mikrofon działa w Chrome i Edge. W tej przeglądarce napisz wiadomość ręcznie.',
    en: 'Microphone works in Chrome and Edge. Please type your message in this browser.',
  };

  // Lead capture state machine
  var leadCaptureState = null; // null | 'collecting_name' | 'collecting_email'
  var leadData = { name: '', email: '', topic: 'quote' };

  // Quick reply suggestions
  var INITIAL_REPLIES = {
    pl: ['Od czego zacząć ze smart home?', 'Co mogę zautomatyzować w domu?', 'Ile można oszczędzić na energii?'],
    en: ['Where do I start with smart home?', 'What can I automate at home?', 'How much can I save on energy?'],
  };

  // Greeting messages
  var GREETINGS = {
    pl: 'Hej! Jestem Klaudio. Myślisz o smart home, ale nie wiesz od czego zacząć? Chętnie pomogę! 🏠',
    en: "Hi! I'm Klaudio. Thinking about smart home but not sure where to start? I'm here to help! 🏠",
  };

  // Error messages
  var ERROR_MSGS = {
    pl: {
      api: 'Mam teraz problem z połączeniem. Możesz skontaktować się z Klaumark bezpośrednio przez <a href="#contact">formularz kontaktowy</a>.',
      rate: 'Klaudio jest teraz zajęty, spróbuj ponownie za chwilę.',
      cutoff: ' (wiadomość przerwana — spróbuj ponownie)',
    },
    en: {
      api: "I'm having trouble connecting right now. You can reach the Klaumark team via the <a href=\"#contact\">contact form</a>.",
      rate: 'Klaudio is busy right now, please try again in a moment.',
      cutoff: ' (message cut off — please try again)',
    },
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. DOM refs (after shadow.innerHTML is set)
  // ─────────────────────────────────────────────────────────────────────────────
  var launcher = shadow.getElementById('klaudio-launcher');
  var panel = shadow.getElementById('klaudio-panel');
  var closeBtn = shadow.getElementById('klaudio-close');
  var messagesEl = shadow.getElementById('klaudio-messages');
  var typingEl = shadow.getElementById('klaudio-typing');
  var quickRepliesEl = shadow.getElementById('klaudio-quick-replies');
  var inputEl = shadow.getElementById('klaudio-input');
  var sendBtn = shadow.getElementById('klaudio-send');
  var micBtn = shadow.getElementById('klaudio-mic');

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Language detection (from user's first message only)
  // ─────────────────────────────────────────────────────────────────────────────
  function detectLang(text) {
    var polishPattern = /[ąćęłńóśźż]|(\b(jest|jak|czy|dla|tego|nie|ale|lub|oraz|ze|to|na|po|za|przy|przez|przed|pod|nad|bez|od|do|we|się|mam|chcę|chce|ile|czy|jakie|jaki)\b)/i;
    return polishPattern.test(text) ? 'pl' : 'en';
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. Markdown rendering (no external deps — widget is served as-is from public/)
  // ─────────────────────────────────────────────────────────────────────────────
  function renderMarkdown(text) {
    // Sanitise HTML entities first
    var safe = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Inline formatting
    safe = safe
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

    // List items — convert bare "- item" lines to <li>
    safe = safe.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
    safe = safe.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, function (match) {
      return '<ul>' + match + '</ul>';
    });

    // Line breaks
    safe = safe.replace(/\n/g, '<br>');

    return safe;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. Render helpers
  // ─────────────────────────────────────────────────────────────────────────────
  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendUserMessage(text) {
    var div = document.createElement('div');
    div.className = 'msg msg-user';
    div.textContent = text;
    messagesEl.insertBefore(div, typingEl);
    scrollToBottom();
    return div;
  }

  function appendBotMessageEl(html, isRaw) {
    var div = document.createElement('div');
    div.className = 'msg msg-bot';
    if (isRaw) {
      div.innerHTML = html;
    } else {
      div.innerHTML = renderMarkdown(html);
    }
    messagesEl.insertBefore(div, typingEl);
    scrollToBottom();
    return div;
  }

  function showTypingIndicator() {
    typingEl.classList.add('visible');
    scrollToBottom();
  }

  function hideTypingIndicator() {
    typingEl.classList.remove('visible');
  }

  function renderQuickReplies(replies) {
    quickRepliesEl.innerHTML = '';
    if (!replies || !replies.length) {
      quickRepliesEl.classList.add('hidden');
      return;
    }
    quickRepliesEl.classList.remove('hidden');
    replies.forEach(function (text) {
      var btn = document.createElement('button');
      btn.className = 'quick-reply';
      btn.textContent = text;
      btn.addEventListener('click', function () {
        quickRepliesEl.classList.add('hidden');
        handleUserInput(text);
      });
      quickRepliesEl.appendChild(btn);
    });
    scrollToBottom();
  }

  function setInputPlaceholder() {
    var placeholders = {
      pl: 'Napisz wiadomość…',
      en: 'Type a message…',
    };
    inputEl.placeholder = placeholders[detectedLang] || placeholders.pl;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. GA4 tracking
  // ─────────────────────────────────────────────────────────────────────────────
  function trackEvent(name, params) {
    try {
      if (window.gtag) window.gtag('event', name, params || {});
    } catch (e) { /* silent fail */ }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 12. Streaming fetch — parse plain text SSE (toTextStreamResponse format)
  //     AI SDK v6 toTextStreamResponse sends: "data: <text chunk>\n\n"
  //     Each data line contains the raw text delta (NOT JSON)
  // ─────────────────────────────────────────────────────────────────────────────
  function sendMessage(userContent) {
    if (isStreaming) return;
    isStreaming = true;
    if (micBtn) micBtn.disabled = true;

    // Hide quick replies while streaming
    quickRepliesEl.classList.add('hidden');

    appendUserMessage(userContent);
    showTypingIndicator();

    var botContent = '';
    var botMsgEl = null;

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages, lang: detectedLang }),
    })
    .then(function (resp) {
      if (!resp.ok) {
        return Promise.reject(new Error('HTTP ' + resp.status));
      }

      hideTypingIndicator();
      botMsgEl = appendBotMessageEl('');

      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      function pump() {
        return reader.read().then(function (result) {
          if (result.done) return;

          // toTextStreamResponse (AI SDK v6) streams plain text — no SSE prefix
          var chunk = decoder.decode(result.value, { stream: true });
          if (chunk) {
            botContent += chunk;
            botMsgEl.innerHTML = renderMarkdown(botContent);
            scrollToBottom();
          }

          return pump();
        });
      }

      return pump();
    })
    .catch(function (err) {
      hideTypingIndicator();
      var lang = detectedLang;
      var msgs = ERROR_MSGS[lang] || ERROR_MSGS.pl;
      var isRateLimit = err && err.message && err.message.indexOf('429') !== -1;

      if (botMsgEl && botContent) {
        // Partial content received — append cut-off notice
        botContent += msgs.cutoff;
        botMsgEl.innerHTML = renderMarkdown(botContent);
      } else {
        // No content at all — show full error
        appendBotMessageEl(isRateLimit ? msgs.rate : msgs.api, true);
        botContent = '';
      }

      trackEvent('chat_error', { error_type: isRateLimit ? 'rate_limit' : 'api_error' });
    })
    .finally(function () {
      if (botContent) {
        messages.push({ role: 'assistant', content: botContent });
      }
      isStreaming = false;
      if (micBtn) micBtn.disabled = false;

      // Check for lead capture intent
      checkLeadIntent(userContent, botContent);

      // Show quick replies after bot response (unless lead capture is active)
      if (!leadCaptureState) {
        showQuickReplies();
      }

      scrollToBottom();
      if (botContent) { speakText(botContent); }  // Play TTS for bot response (non-blocking)
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 13. Quick replies — show after each bot response
  // ─────────────────────────────────────────────────────────────────────────────
  function showQuickReplies() {
    var replies = INITIAL_REPLIES[detectedLang] || INITIAL_REPLIES.pl;
    renderQuickReplies(replies);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 14. Lead capture state machine
  // ─────────────────────────────────────────────────────────────────────────────
  var INTENT_PATTERN = /quote|wycena|price|cena|cost|koszt|install|instalacja|get started|jak zaczą|how much|ile kosztuje/i;

  function checkLeadIntent(userContent) {
    if (leadCaptureState) return; // already in flow
    if (INTENT_PATTERN.test(userContent)) {
      startLeadCapture();
    }
  }

  function startLeadCapture() {
    leadCaptureState = 'collecting_name';
    var ask = detectedLang === 'pl'
      ? 'Świetnie! Żeby umówić się z naszym zespołem, mogę pomóc wypełnić formularz kontaktowy. Jak masz na imię?'
      : "Great! To connect you with our team, I can help pre-fill the contact form. What's your name?";
    appendBotMessageEl(ask);
    messages.push({ role: 'assistant', content: ask });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 15. Livewire dispatch helper
  // ─────────────────────────────────────────────────────────────────────────────
  function safeDispatch(event, data) {
    function doDispatch() {
      Livewire.dispatch(event, data);
    }
    if (window.Livewire) {
      doDispatch();
    } else {
      document.addEventListener('livewire:init', doDispatch, { once: true });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 16. Lead capture completion — Livewire dispatch + scroll + confirm
  // ─────────────────────────────────────────────────────────────────────────────
  function handleLeadCapture(name, email, topic) {
    var subjectMap = {
      quote: 'quote', wycena: 'quote',
      question: 'question', pytanie: 'question',
      presentation: 'presentation', prezentacja: 'presentation',
    };
    var subject = subjectMap[topic ? topic.toLowerCase() : ''] || 'quote';

    // Dispatch Livewire event to pre-fill contact form
    safeDispatch('subject-change', {
      subject: subject,
      page: window.location.hostname,
      section: 'chatbot',
      element: 'klaudio',
      language: detectedLang,
    });

    // Smooth scroll to contact section
    var contactSection = document.getElementById('contact')
      || document.querySelector('[data-section="contact"]')
      || document.querySelector('section[id*="contact"]');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Confirmation message
    var msg = detectedLang === 'pl'
      ? 'Gotowe! Formularz kontaktowy został wypełniony. Do zobaczenia, ' + name + '!'
      : "Done! I've pre-filled the contact form for you. Talk soon, " + name + '!';
    appendBotMessageEl(msg);

    trackEvent('chat_lead_captured', { method: 'klaudio' });

    leadCaptureState = null;

    // Close widget after a short delay
    setTimeout(function () { closeWidget(); }, 2000);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 17. User input routing — lead capture intercepts before API
  // ─────────────────────────────────────────────────────────────────────────────
  function handleUserInput(text) {
    text = text.trim();
    if (!text) return;

    // Lead capture: collecting name
    if (leadCaptureState === 'collecting_name') {
      leadData.name = text;
      leadCaptureState = 'collecting_email';
      appendUserMessage(text);
      var ask = detectedLang === 'pl'
        ? 'Dziękuję, ' + text + '! Jaki jest Twój adres e-mail?'
        : 'Thanks, ' + text + "! What's your email address?";
      appendBotMessageEl(ask);
      messages.push({ role: 'assistant', content: ask });
      return;
    }

    // Lead capture: collecting email
    if (leadCaptureState === 'collecting_email') {
      leadData.email = text;
      leadData.topic = 'quote'; // default topic
      appendUserMessage(text);
      handleLeadCapture(leadData.name, leadData.email, leadData.topic);
      return;
    }

    // Normal message — detect language on first send only
    if (!firstMessageSent) {
      detectedLang = detectLang(text);
      firstMessageSent = true;
      setInputPlaceholder();
    }

    messages.push({ role: 'user', content: text });
    sendMessage(text);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 18. Widget open / close
  // ─────────────────────────────────────────────────────────────────────────────
  function openWidget() {
    if (isOpen) return;
    isOpen = true;
    panel.classList.add('open');
    inputEl.focus();
    trackEvent('chat_opened', {});

    // Show greeting on first open
    if (!messages.length) {
      var greeting = GREETINGS[detectedLang] || GREETINGS.pl;
      appendBotMessageEl(greeting);
      messages.push({ role: 'assistant', content: greeting });
      renderQuickReplies(INITIAL_REPLIES[detectedLang] || INITIAL_REPLIES.pl);
    }
  }

  function closeWidget() {
    if (!isOpen) return;
    isOpen = false;
    panel.classList.remove('open');
    // Record dismissal — suppresses auto-open for rest of session
    try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch (e) { /* private mode */ }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 22. Mic state — 'idle' | 'listening'
  // ─────────────────────────────────────────────────────────────────────────────
  function setMicState(state) {
    if (!micBtn) return;
    if (state === 'listening') {
      micBtn.classList.add('listening');
      micBtn.setAttribute('aria-label', detectedLang === 'pl' ? 'Słucham…' : 'Listening…');
    } else {
      micBtn.classList.remove('listening');
      micBtn.setAttribute('aria-label', detectedLang === 'pl' ? 'Wpisz głosowo' : 'Voice input');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 23. Voice input — Web Speech API (Chrome/Edge) with Firefox/Safari fallback
  // ─────────────────────────────────────────────────────────────────────────────
  function startVoiceInput() {
    // VOICE-05: Browser fallback for Firefox / older Safari
    if (!hasMicSupport) {
      appendBotMessageEl(MIC_UNSUPPORTED[detectedLang] || MIC_UNSUPPORTED.pl);
      return;
    }

    // Prevent concurrent listening
    if (isStreaming) return;

    var recognition = new SpeechRecognition();
    recognition.lang = detectedLang === 'pl' ? 'pl-PL' : 'en-US';
    recognition.interimResults = false; // final transcript only — walkie-talkie UX
    recognition.continuous = false;     // single utterance per button press

    recognition.onresult = function (event) {
      var transcript = event.results[0][0].transcript;
      setMicState('idle');
      if (transcript) {
        // Route transcript through same pipeline as typed text
        handleUserInput(transcript);
      }
    };

    recognition.onerror = function (event) {
      // Errors: no-speech, audio-capture, not-allowed, network, aborted
      console.warn('SpeechRecognition error:', event.error);
      setMicState('idle');
      if (event.error === 'not-allowed') {
        appendBotMessageEl(
          detectedLang === 'pl'
            ? 'Brak dostępu do mikrofonu. Sprawdź uprawnienia przeglądarki.'
            : 'Microphone access denied. Check browser permissions.'
        );
      }
    };

    recognition.onend = function () {
      setMicState('idle');
    };

    recognition.start();
    setMicState('listening');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 24. TTS playback — fetch /api/tts proxy, decode MP3 with AudioContext
  //     AudioContext created inside user-gesture flow (mic button or send button)
  //     to satisfy iOS/Safari autoplay policy.
  // ─────────────────────────────────────────────────────────────────────────────
  function speakText(text) {
    if (!text || !text.trim()) return;

    fetch(TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, lang: detectedLang }),
    })
    .then(function (resp) {
      if (!resp.ok) throw new Error('TTS HTTP ' + resp.status);
      return resp.arrayBuffer();
    })
    .then(function (arrayBuffer) {
      // AudioContext must be created here (inside async resolution of a user gesture)
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return; // Safari < 14.1 — silent fail, text still visible
      var audioCtx = new AudioCtx();
      return audioCtx.decodeAudioData(arrayBuffer).then(function (decoded) {
        var source = audioCtx.createBufferSource();
        source.buffer = decoded;
        source.connect(audioCtx.destination);
        source.start(0);
      });
    })
    .catch(function (err) {
      // TTS failure is non-critical — text response is always visible
      console.warn('TTS playback failed:', err);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 19. Event listeners
  // ─────────────────────────────────────────────────────────────────────────────
  launcher.addEventListener('click', function () {
    if (isOpen) { closeWidget(); } else { openWidget(); }
  });

  closeBtn.addEventListener('click', function () {
    closeWidget();
  });

  sendBtn.addEventListener('click', function () {
    var text = inputEl.value.trim();
    if (!text || isStreaming) return;
    inputEl.value = '';
    sendBtn.disabled = true;
    handleUserInput(text);
  });

  inputEl.addEventListener('input', function () {
    sendBtn.disabled = inputEl.value.trim() === '';
  });

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      var text = inputEl.value.trim();
      if (!text || isStreaming) return;
      inputEl.value = '';
      sendBtn.disabled = true;
      handleUserInput(text);
    }
  });

  // Mic button — start voice input (toggle: click to listen, auto-stops on speech end)
  if (micBtn) {
    micBtn.addEventListener('click', function () {
      startVoiceInput();
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 20. Auto-open after 30s (suppressed if already dismissed this session)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    if (!sessionStorage.getItem(DISMISSED_KEY)) {
      setTimeout(function () {
        if (!isOpen) openWidget();
      }, AUTO_OPEN_DELAY);
    }
  } catch (e) { /* sessionStorage may be unavailable in private mode */ }

  // ─────────────────────────────────────────────────────────────────────────────
  // 21. Initial placeholder
  // ─────────────────────────────────────────────────────────────────────────────
  setInputPlaceholder();

  // Note: Livewire SPA navigation is handled by resetting __klaudioLoaded
  // on 'livewire:navigate' (see guard at top), which causes full reinit.

})();

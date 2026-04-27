(function () {
  if (window.__gujHelperLoaded) return;
  window.__gujHelperLoaded = true;

  // ---------- Build floating button ----------
  const btn = document.createElement('div');
  btn.id = 'guj-helper-btn';
  btn.textContent = '📖';
  btn.title = 'Multilingual Helper (Ctrl+Shift+D to open, Ctrl+Shift+L for Live Check)';
  document.documentElement.appendChild(btn);

  // ---------- Build main panel ----------
  const panel = document.createElement('div');
  panel.id = 'guj-helper-panel';
  panel.style.display = 'none';
  panel.innerHTML = `
    <div class="guj-header">
      <div class="guj-title">📖 Helper</div>
      <button class="guj-close" title="Close">×</button>
    </div>
    <div class="guj-tabs">
      <button class="guj-tab active" data-tab="dict">Dictionary</button>
      <button class="guj-tab" data-tab="write">Writing Fix</button>
      <button class="guj-tab" data-tab="live">Live Check</button>
    </div>
    <div class="guj-body">
      <div class="guj-pane active" data-pane="dict">
        <div class="guj-lang-row">
          <label class="guj-lang-label">Translate to:</label>
          <select class="guj-lang-select">
            <option value="gu">ગુજરાતી (Gujarati)</option>
            <option value="hi">हिन्दी (Hindi)</option>
            <option value="de">Deutsch (German)</option>
          </select>
        </div>
        <div class="guj-row">
          <input type="text" class="guj-word-input" placeholder="Type an English word..." />
          <button class="guj-search-btn">Search</button>
        </div>
        <div class="guj-result"></div>
        <div class="guj-recent">
          <div class="guj-label">Recent</div>
          <div class="guj-recent-list"></div>
        </div>
      </div>
      <div class="guj-pane" data-pane="write">
        <textarea class="guj-text-input" placeholder="Paste your Slack/email message here..."></textarea>
        <div class="guj-write-buttons">
          <button class="guj-action-btn" data-action="default">Fix Grammar & Spelling</button>
          <button class="guj-action-btn" data-action="picky">Improve Style</button>
        </div>
        <div class="guj-write-result"></div>
      </div>
      <div class="guj-pane" data-pane="live">
        <div class="guj-section">
          <div class="guj-label">Live Mode</div>
          <div class="guj-meaning">When ON, this watches whatever you type in any input on this page (Slack, Gmail, comment box, etc.) and shows mistakes in a floating panel. Click any suggestion to auto-fix it.</div>
          <button class="guj-live-toggle">Turn Live Mode ON</button>
          <div class="guj-meaning" style="margin-top:10px;font-size:12px;color:#6b7280;">⌨️ Shortcuts:<br><b>Ctrl+Shift+L</b> — toggle live mode<br><b>Ctrl+Shift+D</b> — open/close this panel<br><i>(Same keys on Mac, Windows, Linux)</i></div>
        </div>
      </div>
    </div>
  `;
  document.documentElement.appendChild(panel);

  // ---------- Build live-mistakes popup (separate floating panel) ----------
  const livePanel = document.createElement('div');
  livePanel.id = 'guj-live-panel';
  livePanel.style.display = 'none';
  document.documentElement.appendChild(livePanel);

  // ---------- Build live-mode badge ----------
  const liveBadge = document.createElement('div');
  liveBadge.id = 'guj-live-badge';
  liveBadge.style.display = 'none';
  liveBadge.innerHTML = '⚡ Live Check ON <span style="opacity:0.7;font-size:10px;">(Ctrl+Shift+L to turn off)</span>';
  document.documentElement.appendChild(liveBadge);

  // ---------- Toast for notifications ----------
  function showToast(msg, ms = 2000) {
    const t = document.createElement('div');
    t.className = 'guj-toast';
    t.textContent = msg;
    document.documentElement.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ---------- Toggle main panel ----------
  btn.addEventListener('click', () => {
    const open = panel.style.display === 'flex';
    panel.style.display = open ? 'none' : 'flex';
    if (!open) loadRecent();
  });
  panel.querySelector('.guj-close').addEventListener('click', () => {
    panel.style.display = 'none';
  });

  // ---------- Tabs ----------
  panel.querySelectorAll('.guj-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      panel.querySelectorAll('.guj-tab').forEach(t => t.classList.remove('active'));
      panel.querySelectorAll('.guj-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      panel.querySelector(`.guj-pane[data-pane="${tab.dataset.tab}"]`).classList.add('active');
    });
  });

  // ====================================================================
  // DICTIONARY
  // ====================================================================
  const wordInput = panel.querySelector('.guj-word-input');
  const searchBtn = panel.querySelector('.guj-search-btn');
  const resultDiv = panel.querySelector('.guj-result');
  const langSelect = panel.querySelector('.guj-lang-select');

  // Language config
  const LANG_INFO = {
    gu: { name: 'ગુજરાતી (Gujarati)', code: 'gu' },
    hi: { name: 'हिन्दी (Hindi)', code: 'hi' },
    de: { name: 'Deutsch (German)', code: 'de' }
  };

  // Restore last selected language
  chrome.storage.local.get(['selectedLang'], data => {
    if (data.selectedLang && LANG_INFO[data.selectedLang]) {
      langSelect.value = data.selectedLang;
    }
  });
  langSelect.addEventListener('change', () => {
    chrome.storage.local.set({ selectedLang: langSelect.value });
  });

  async function searchWord() {
    const word = wordInput.value.trim();
    if (!word) return;
    const targetLang = langSelect.value || 'gu';
    const langName = LANG_INFO[targetLang].name;

    resultDiv.innerHTML = '<div class="guj-loading">Looking up...</div>';

    const enPromise = fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
      .then(r => r.ok ? r.json() : null).catch(() => null);
    const trPromise = translateText(word, targetLang);

    const [enRes, trText] = await Promise.all([enPromise, trPromise]);

    let html = `<div class="guj-word-display">${escapeHtml(word)}</div>`;

    if (trText) {
      html += `<div class="guj-section"><div class="guj-label">${escapeHtml(langName)}</div>
        <div class="guj-gujarati">${escapeHtml(trText)}</div></div>`;
    } else {
      html += `<div class="guj-section"><div class="guj-label">${escapeHtml(langName)}</div>
        <div class="guj-meaning" style="color:#dc2626;">Translation services are temporarily unavailable. Try again in a moment.</div></div>`;
    }

    if (Array.isArray(enRes) && enRes[0]) {
      const meanings = enRes[0].meanings || [];
      if (meanings.length) {
        html += '<div class="guj-section"><div class="guj-label">Simple Meaning</div>';
        meanings.slice(0, 2).forEach(m => {
          const def = m.definitions && m.definitions[0];
          if (def) {
            html += `<div class="guj-meaning"><span class="guj-pos">${escapeHtml(m.partOfSpeech)}</span> ${escapeHtml(def.definition)}`;
            if (def.example) html += `<div class="guj-example">"${escapeHtml(def.example)}"</div>`;
            html += `</div>`;
          }
        });
        html += '</div>';
      }
    } else if (trText) {
      html += `<div class="guj-section"><div class="guj-meaning">English definition not found, but translation is shown above.</div></div>`;
    }

    resultDiv.innerHTML = html;
    saveRecent(word, targetLang);
  }

  // Translate via Lingva (Google Translate proxy) with multiple instance fallback,
  // and finally MyMemory as a last resort.
  async function translateText(text, targetLang) {
    const lingvaInstances = [
      'https://lingva.ml',
      'https://lingva.lunar.icu',
      'https://translate.plausibility.cloud'
    ];
    for (const base of lingvaInstances) {
      try {
        const url = `${base}/api/v1/en/${targetLang}/${encodeURIComponent(text)}`;
        const res = await fetch(url, { method: 'GET' });
        if (!res.ok) continue;
        const data = await res.json();
        if (data && data.translation) return data.translation;
      } catch (err) {
        // try next instance
      }
    }
    // Final fallback: MyMemory
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`);
      const data = await res.json();
      if (data && data.responseData && data.responseData.translatedText) {
        return data.responseData.translatedText;
      }
    } catch (err) {}
    return null;
  }
  searchBtn.addEventListener('click', searchWord);
  wordInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchWord(); });

  function saveRecent(word, lang) {
    chrome.storage.local.get(['recent'], data => {
      let recent = data.recent || [];
      // Remove same word+lang combo if exists
      recent = recent.filter(r => {
        const w = typeof r === 'string' ? r : r.word;
        const l = typeof r === 'string' ? 'gu' : r.lang;
        return !(w.toLowerCase() === word.toLowerCase() && l === lang);
      });
      recent.unshift({ word, lang });
      recent = recent.slice(0, 12);
      chrome.storage.local.set({ recent }, loadRecent);
    });
  }
  function loadRecent() {
    const list = panel.querySelector('.guj-recent-list');
    chrome.storage.local.get(['recent'], data => {
      const recent = data.recent || [];
      if (!recent.length) {
        list.innerHTML = '<div class="guj-empty">No recent searches yet.</div>';
        return;
      }
      const langTag = { gu: 'GU', hi: 'HI', de: 'DE' };
      list.innerHTML = recent.map(r => {
        const w = typeof r === 'string' ? r : r.word;
        const l = typeof r === 'string' ? 'gu' : r.lang;
        return `<button class="guj-recent-item" data-word="${escapeHtml(w)}" data-lang="${l}"><span class="guj-recent-flag">${langTag[l] || 'GU'}</span> ${escapeHtml(w)}</button>`;
      }).join('');
      list.querySelectorAll('.guj-recent-item').forEach(b => {
        b.addEventListener('click', () => {
          wordInput.value = b.dataset.word;
          langSelect.value = b.dataset.lang;
          searchWord();
        });
      });
    });
  }

  // ====================================================================
  // WRITING FIX (paste-and-fix)
  // ====================================================================
  const textInput = panel.querySelector('.guj-text-input');
  const writeResult = panel.querySelector('.guj-write-result');
  panel.querySelectorAll('.guj-action-btn').forEach(b => {
    b.addEventListener('click', () => fixText(b.dataset.action));
  });

  async function fixText(mode) {
    const text = textInput.value.trim();
    if (!text) return;
    writeResult.innerHTML = '<div class="guj-loading">Checking your text...</div>';
    try {
      const params = new URLSearchParams();
      params.append('text', text);
      params.append('language', 'en-US');
      if (mode === 'picky') params.append('level', 'picky');
      const res = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
      const data = await res.json();
      let corrected = text;
      const matches = (data.matches || []).slice().sort((a, b) => b.offset - a.offset);
      matches.forEach(m => {
        if (m.replacements && m.replacements[0]) {
          corrected = corrected.slice(0, m.offset) + m.replacements[0].value + corrected.slice(m.offset + m.length);
        }
      });
      let html = '';
      if (!data.matches || !data.matches.length) {
        html += `<div class="guj-section"><div class="guj-label">✓ All Good</div>
          <div class="guj-meaning">No issues found in your text.</div></div>`;
      }
      html += `<div class="guj-section">
        <div class="guj-label">Corrected Version</div>
        <div class="guj-corrected">${escapeHtml(corrected)}</div>
        <button class="guj-copy-btn">📋 Copy</button>
      </div>`;
      if (data.matches && data.matches.length) {
        html += `<div class="guj-section"><div class="guj-label">Issues Found (${data.matches.length})</div>`;
        data.matches.slice(0, 6).forEach(m => {
          const cat = (m.rule && m.rule.category && m.rule.category.name) || 'Suggestion';
          html += `<div class="guj-suggestion"><b>${escapeHtml(cat)}:</b> ${escapeHtml(m.message)}</div>`;
        });
        html += `</div>`;
      }
      writeResult.innerHTML = html;
      const copyBtn = writeResult.querySelector('.guj-copy-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(corrected).then(() => {
            copyBtn.textContent = '✓ Copied!';
            setTimeout(() => copyBtn.textContent = '📋 Copy', 1800);
          });
        });
      }
    } catch (e) {
      writeResult.innerHTML = `<div class="guj-error">Error: ${escapeHtml(e.message)}</div>`;
    }
  }

  // ====================================================================
  // LIVE MODE — watches your typing in any input on the page
  // ====================================================================
  let liveMode = false;
  let currentEditable = null;
  let checkTimeout = null;
  let lastCheckedText = '';
  const liveToggleBtn = panel.querySelector('.guj-live-toggle');

  function isEditable(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT' && /^(text|email|search|url|tel|)$/i.test(el.type || '')) return true;
    if (el.isContentEditable) return true;
    return false;
  }
  function getEditableText(el) {
    if (!el) return '';
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el.value || '';
    return el.innerText || el.textContent || '';
  }

  function setLiveMode(on) {
    liveMode = !!on;
    liveBadge.style.display = liveMode ? 'block' : 'none';
    liveToggleBtn.textContent = liveMode ? 'Turn Live Mode OFF' : 'Turn Live Mode ON';
    liveToggleBtn.classList.toggle('on', liveMode);
    if (!liveMode) {
      livePanel.style.display = 'none';
      lastCheckedText = '';
    } else {
      showToast('⚡ Live Check ON — start typing anywhere');
    }
  }
  liveToggleBtn.addEventListener('click', () => setLiveMode(!liveMode));

  // Keyboard shortcuts: Ctrl+Shift+L (live mode), Ctrl+Shift+D (toggle panel)
  // Works on Mac (Ctrl key, NOT Cmd), Windows, Linux — avoids OS-reserved combos
  document.addEventListener('keydown', e => {
    // Ctrl+Shift+L → toggle live mode
    if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && (e.key === 'L' || e.key === 'l')) {
      e.preventDefault();
      e.stopPropagation();
      setLiveMode(!liveMode);
      return;
    }
    // Ctrl+Shift+D → toggle main panel
    if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      e.stopPropagation();
      const open = panel.style.display === 'flex';
      panel.style.display = open ? 'none' : 'flex';
      if (!open) loadRecent();
      return;
    }
  }, true);

  // Re-inject button if a site removes it (some SPAs like Slack rebuild the DOM)
  setInterval(() => {
    if (!document.documentElement.contains(btn)) {
      document.documentElement.appendChild(btn);
    }
    if (!document.documentElement.contains(panel)) {
      document.documentElement.appendChild(panel);
    }
  }, 3000);

  // Track focus on editable elements
  document.addEventListener('focusin', e => {
    if (isEditable(e.target)) currentEditable = e.target;
  }, true);

  // Listen for typing
  document.addEventListener('input', e => {
    if (!liveMode) return;
    if (!isEditable(e.target)) return;
    currentEditable = e.target;
    clearTimeout(checkTimeout);
    checkTimeout = setTimeout(doLiveCheck, 1000);
  }, true);

  async function doLiveCheck() {
    if (!liveMode || !currentEditable) return;
    const fullText = getEditableText(currentEditable);
    if (!fullText || fullText.trim().length < 3) {
      livePanel.style.display = 'none';
      return;
    }
    if (fullText === lastCheckedText) return;
    lastCheckedText = fullText;

    // Limit to last 1500 chars to keep API fast
    const sliceStart = Math.max(0, fullText.length - 1500);
    const checkText = fullText.slice(sliceStart);

    try {
      const params = new URLSearchParams();
      params.append('text', checkText);
      params.append('language', 'en-US');
      const res = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
      const data = await res.json();
      showLiveMistakes(data.matches || [], checkText, sliceStart);
    } catch (err) {
      // silent fail — don't disrupt typing
    }
  }

  function showLiveMistakes(matches, checkedText, sliceStart) {
    if (!matches.length) {
      livePanel.style.display = 'none';
      return;
    }
    let html = `<div class="guj-live-header">
      <span>✏️ ${matches.length} ${matches.length === 1 ? 'issue' : 'issues'} found</span>
      <button class="guj-live-close" title="Hide">×</button>
    </div><div class="guj-live-list">`;

    matches.slice(0, 10).forEach((m, i) => {
      const wrong = checkedText.slice(m.offset, m.offset + m.length);
      const suggestions = (m.replacements || []).slice(0, 3);
      html += `<div class="guj-live-item">
        <div class="guj-live-wrong">"${escapeHtml(wrong)}"</div>
        <div class="guj-live-msg">${escapeHtml(m.shortMessage || m.message)}</div>
        <div class="guj-live-suggestions">`;
      if (suggestions.length) {
        suggestions.forEach(s => {
          html += `<button class="guj-live-suggest" data-idx="${i}" data-replace="${escapeHtml(s.value)}">→ ${escapeHtml(s.value)}</button>`;
        });
      } else {
        html += `<span class="guj-live-nofix">(no auto-fix available)</span>`;
      }
      html += `</div></div>`;
    });
    html += `</div>`;
    livePanel.innerHTML = html;
    livePanel.style.display = 'block';

    livePanel.querySelector('.guj-live-close').addEventListener('click', () => {
      livePanel.style.display = 'none';
    });

    livePanel.querySelectorAll('.guj-live-suggest').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const m = matches[idx];
        const replacement = btn.dataset.replace;
        applyReplacement(m, replacement, sliceStart);
      });
    });
  }

  function applyReplacement(match, replacement, sliceStart) {
    if (!currentEditable) return;
    const el = currentEditable;
    const absoluteOffset = sliceStart + match.offset;
    const length = match.length;

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const fullText = el.value;
      if (absoluteOffset + length <= fullText.length) {
        el.focus();
        el.setSelectionRange(absoluteOffset, absoluteOffset + length);
        // Use execCommand for compatibility with React-controlled inputs
        const inserted = document.execCommand('insertText', false, replacement);
        if (!inserted) {
          // Fallback: direct set
          el.value = fullText.slice(0, absoluteOffset) + replacement + fullText.slice(absoluteOffset + length);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    } else if (el.isContentEditable) {
      // Walk text nodes to find absolute offset
      const range = document.createRange();
      let charIdx = 0;
      let startNode = null, startOffset = 0, endNode = null, endOffset = 0;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const len = node.textContent.length;
        if (!startNode && charIdx + len > absoluteOffset) {
          startNode = node;
          startOffset = absoluteOffset - charIdx;
        }
        if (startNode && charIdx + len >= absoluteOffset + length) {
          endNode = node;
          endOffset = absoluteOffset + length - charIdx;
          break;
        }
        charIdx += len;
      }
      if (startNode && endNode) {
        try {
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          el.focus();
          const ok = document.execCommand('insertText', false, replacement);
          if (!ok) {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(replacement);
            showToast(`Couldn't auto-fix — "${replacement}" copied to clipboard`);
          }
        } catch (err) {
          navigator.clipboard.writeText(replacement);
          showToast(`Copied "${replacement}" — paste to replace`);
        }
      } else {
        navigator.clipboard.writeText(replacement);
        showToast(`Copied "${replacement}" — paste to replace`);
      }
    }
    // Re-check after a short delay
    lastCheckedText = '';
    setTimeout(doLiveCheck, 600);
  }
})();
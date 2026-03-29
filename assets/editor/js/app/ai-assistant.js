(function () {
  'use strict';

  const runtime = window.PG3DEditorPage || null;
  if (!runtime) return;

  const panel = document.getElementById('aiAssistantPanel');
  const promptInput = document.getElementById('aiAssistantPrompt');
  const statusEl = document.getElementById('aiAssistantStatus');
  const outputEl = document.getElementById('aiAssistantOutput');
  const titleEl = document.getElementById('aiAssistantResultTitle');
  const summaryEl = document.getElementById('aiAssistantSummary');
  const listEl = document.getElementById('aiAssistantList');
  const grammarEl = document.getElementById('aiAssistantGrammar');
  const applyBtn = document.getElementById('aiApplyGrammarBtn');
  const explainSelectionBtn = document.getElementById('aiExplainSelectionBtn');

  if (!panel || !promptInput || !statusEl || !outputEl || !titleEl || !summaryEl || !listEl || !grammarEl || !applyBtn || !explainSelectionBtn) {
    return;
  }

  const HISTORY_KEY = 'p3d_ai_assistant_history_v1';
  let lastResult = null;

  function setAssistantStatus(message) {
    statusEl.textContent = message;
  }

  function readHistory() {
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data.filter((item) => typeof item === 'string' && item.trim() !== '').slice(-8) : [];
    } catch (error) {
      return [];
    }
  }

  function writeHistory(items) {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(-8)));
    } catch (error) {}
  }

  function pushHistory(line) {
    const text = String(line || '').trim();
    if (!text) return;
    const next = readHistory();
    next.push(text);
    writeHistory(next);
  }

  async function aiApi(mode, payload) {
    const headers = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
    const firebase = window.P3DFirebase;
    if (firebase && firebase.ensureInitialized && firebase.ensureInitialized()) {
      const authUser = firebase.currentUser();
      if (authUser) {
        try {
          headers.Authorization = 'Bearer ' + await authUser.getIdToken();
        } catch (error) {}
      }
    }
    if (!headers.Authorization && runtime.csrfToken) {
      headers['X-CSRF-Token'] = runtime.csrfToken;
    }

    const response = await fetch(new URL('api/ai.php', window.location.href).toString(), {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: Object.assign(headers, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(Object.assign({ mode }, payload || {})),
    });

    const raw = await response.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch (error) {
      throw new Error(raw || 'AI request failed');
    }
    if (!response.ok || !data || !data.ok) {
      throw new Error((data && data.error) || 'AI request failed');
    }
    return data;
  }

  function collectPayload(questionText) {
    return {
      prompt: questionText || '',
      question: questionText || '',
      title: runtime.getTitle(),
      grammar: runtime.getEditorText(),
      selection: runtime.getEditorSelectionText(),
      parserError: runtime.latestConsoleErrorText(),
      history: readHistory(),
    };
  }

  function renderList(items) {
    const values = Array.isArray(items) ? items.filter(Boolean) : [];
    listEl.innerHTML = '';
    if (!values.length) {
      listEl.hidden = true;
      return;
    }

    values.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = String(item);
      listEl.appendChild(li);
    });
    listEl.hidden = false;
  }

  function renderResult(mode, result) {
    outputEl.hidden = false;
    lastResult = result || null;
    titleEl.textContent = result.title || (mode === 'draft_grammar' ? 'Draft grammar' : 'AI result');

    const summaryParts = [];
    if (result.summary) summaryParts.push(result.summary);
    if (result.answer) summaryParts.push(result.answer);
    if (result.repair_summary) summaryParts.push(result.repair_summary);
    if (result.lesson) summaryParts.push(result.lesson);
    if (result.diagnosis) summaryParts.push('Diagnosis: ' + result.diagnosis);
    summaryEl.textContent = summaryParts.join('\n\n').trim();

    renderList(
      result.next_steps ||
      result.changes ||
      result.observations ||
      result.suggested_edits ||
      result.actions ||
      result.warnings ||
      result.motifs ||
      []
    );

    if (result.grammar) {
      grammarEl.hidden = false;
      grammarEl.textContent = String(result.grammar).trim();
      applyBtn.disabled = false;
    } else {
      grammarEl.hidden = true;
      grammarEl.textContent = '';
      applyBtn.disabled = true;
    }
  }

  async function runMode(mode, promptText) {
    const requestText = String(promptText || promptInput.value || '').trim();
    if (mode === 'draft_grammar' && !requestText) {
      setAssistantStatus('Add a request before generating a draft.');
      return;
    }

    setAssistantStatus('Running ' + mode.replace(/_/g, ' ') + '…');
    runtime.setStatus('AI request in progress…');

    try {
      const data = await aiApi(mode, collectPayload(requestText));
      renderResult(mode, data.result || {});
      if (requestText) {
        pushHistory('user: ' + requestText);
      }
      if (data.result && data.result.summary) {
        pushHistory('assistant: ' + data.result.summary);
      } else if (data.result && data.result.answer) {
        pushHistory('assistant: ' + data.result.answer);
      } else if (data.result && data.result.lesson) {
        pushHistory('assistant: ' + data.result.lesson);
      }
      setAssistantStatus('Completed ' + mode.replace(/_/g, ' ') + '.');
      runtime.setStatus('AI response ready.');
    } catch (error) {
      setAssistantStatus(error.message || 'AI request failed.');
      runtime.setStatus(error.message || 'AI request failed.');
    }
  }

  panel.querySelectorAll('[data-ai-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      runMode(String(button.getAttribute('data-ai-mode') || 'active_helper_chat'), promptInput.value);
    });
  });

  explainSelectionBtn.addEventListener('click', () => {
    const selected = runtime.getEditorSelectionText().trim();
    const text = selected
      ? 'Explain this selected grammar and what it is doing.'
      : 'Explain the current grammar and the main structural issues or opportunities.';
    runMode('explain_grammar', text);
  });

  applyBtn.addEventListener('click', () => {
    const grammar = lastResult && typeof lastResult.grammar === 'string' ? lastResult.grammar.trim() : '';
    if (!grammar) {
      setAssistantStatus('No grammar result is available to apply.');
      return;
    }
    runtime.setEditorText(grammar, false);
    runtime.runGrammar();
    runtime.setStatus('Applied AI grammar to the editor.');
    setAssistantStatus('Applied the latest AI grammar result to the editor.');
  });
})();

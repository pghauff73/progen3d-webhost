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
  const creditsAvailableEl = document.getElementById('aiCreditsAvailable');
  const creditsReservedEl = document.getElementById('aiCreditsReserved');
  const creditsEstimateEl = document.getElementById('aiCreditsEstimate');
  const creditsLastCostEl = document.getElementById('aiCreditsLastCost');

  if (!panel || !promptInput || !statusEl || !outputEl || !titleEl || !summaryEl || !listEl || !grammarEl || !applyBtn || !explainSelectionBtn || !creditsAvailableEl || !creditsReservedEl || !creditsEstimateEl || !creditsLastCostEl) {
    return;
  }

  const HISTORY_KEY = 'p3d_ai_assistant_history_v1';
  const MODE_BASE_CREDITS = {
    active_helper_chat: 1,
    draft_grammar: 4,
    repair_grammar: 3,
    explain_grammar: 2,
    tutor_next_step: 2
  };
  let lastResult = null;
  let lastMode = '';

  function setAssistantStatus(message) {
    statusEl.textContent = message;
  }

  function estimateCredits(mode, payload) {
    const pricingTable = window.P3D_AI_PRICING && typeof window.P3D_AI_PRICING === 'object' ? window.P3D_AI_PRICING : {};
    const modelId = String(window.P3D_AI_MODEL || 'gpt-5.4');
    const pricing = pricingTable[modelId] || null;
    const prompt = String((payload && payload.prompt) || '');
    const grammar = String((payload && payload.grammar) || '');
    const selection = String((payload && payload.selection) || '');
    const parserError = String((payload && payload.parserError) || '');
    const chars = prompt.length + grammar.length + selection.length + parserError.length;
    const estimatedPromptTokens = Math.ceil(chars / 4) + 1200;
    const estimatedCompletionTokens = mode === 'draft_grammar'
      ? 1800
      : (mode === 'repair_grammar' ? 1000 : (mode === 'explain_grammar' || mode === 'tutor_next_step' ? 700 : 600));
    if (!pricing) {
      const base = MODE_BASE_CREDITS[mode] || 1;
      return Math.max(1, base + Math.ceil((estimatedPromptTokens + estimatedCompletionTokens) / 1000));
    }
    const inputCost = (estimatedPromptTokens / 1000000) * Number(pricing.input_per_million_usd || 0);
    const outputCost = (estimatedCompletionTokens / 1000000) * Number(pricing.output_per_million_usd || 0);
    return Math.max(1, Math.ceil((inputCost + outputCost) / 0.01));
  }

  function renderCreditPanel(credits, usage, mode) {
    const nextCredits = credits || (window.P3DCredits && typeof window.P3DCredits.get === 'function' ? window.P3DCredits.get() : null);
    if (nextCredits) {
      creditsAvailableEl.textContent = String(nextCredits.available);
      creditsReservedEl.textContent = String(nextCredits.reserved);
    }

    if (usage && Number.isFinite(Number(usage.final_credits))) {
      creditsLastCostEl.textContent = String(Number(usage.final_credits)) + ' credits';
    } else if (usage && Number.isFinite(Number(usage.estimated_credits))) {
      creditsLastCostEl.textContent = 'Estimated hold ' + String(Number(usage.estimated_credits));
    } else if (creditsLastCostEl.textContent.trim() === '') {
      creditsLastCostEl.textContent = 'No requests yet';
    }

    const payload = collectPayload(promptInput.value);
    const estimateMode = mode || lastMode;
    if (estimateMode) {
      creditsEstimateEl.textContent = '~' + estimateCredits(estimateMode, payload) + ' credits';
    } else {
      creditsEstimateEl.textContent = 'Select an AI action';
    }
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
    lastMode = mode;
    if (mode === 'draft_grammar' && !requestText) {
      setAssistantStatus('Add a request before generating a draft.');
      renderCreditPanel(null, null, mode);
      return;
    }

    renderCreditPanel(null, null, mode);
    setAssistantStatus('Running ' + mode.replace(/_/g, ' ') + '…');
    runtime.setStatus('AI request in progress…');

    try {
      const data = await aiApi(mode, collectPayload(requestText));
      if (window.P3DCredits && typeof window.P3DCredits.set === 'function' && data.credits) {
        window.P3DCredits.set(data.credits);
      }
      renderCreditPanel(data.credits || null, data.usage || null, mode);
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
      if (window.P3DCredits && typeof window.P3DCredits.refresh === 'function') {
        window.P3DCredits.refresh().then(function (credits) {
          renderCreditPanel(credits, null, mode);
        }).catch(function () {
          renderCreditPanel(null, null, mode);
        });
      } else {
        renderCreditPanel(null, null, mode);
      }
      setAssistantStatus(error.message || 'AI request failed.');
      runtime.setStatus(error.message || 'AI request failed.');
    }
  }

  promptInput.addEventListener('input', function () {
    renderCreditPanel(null, null, lastMode);
  });

  window.addEventListener('p3d:creditschange', function (event) {
    renderCreditPanel(event.detail && event.detail.credits ? event.detail.credits : null, null, lastMode);
  });

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

  renderCreditPanel(null, null, '');
})();

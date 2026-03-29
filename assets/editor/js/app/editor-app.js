(function () {
  'use strict';

  const getRequiredElement = (id) => {
    const element = document.getElementById(id);
    if (!element) console.warn(`[UI] Missing element #${id}`);
    return element;
  };
  const getOptionalElement = (id) => document.getElementById(id);

  const sourceInput          = getRequiredElement('editorSourceInput');
  const highlightLayer       = getRequiredElement('editorHighlightLayer');
  const codePane             = getRequiredElement('editorCodePane');
  const wordWrapButton       = getRequiredElement('editorWordWrapBtn');
  const consoleOutput        = getRequiredElement('editorConsoleOutput');
  const runButton            = getRequiredElement('editorRunBtn');
  const clearButton          = getRequiredElement('editorClearBtn');
  const debugToggle          = getOptionalElement('debugToggle');
  const statusBadge          = getRequiredElement('status');
  const autoRunBadge         = getRequiredElement('autoRunState');
  const orbitToggleButton    = getOptionalElement('editorOrbitToggleBtn');
  const exportStlButton      = getOptionalElement('editorExportStlBtn');
  const referenceDock        = getOptionalElement('refDock');
  const referenceHeader      = getOptionalElement('refHead');
  const referenceToggleLabel = getOptionalElement('refToggleLabel');

  if (!sourceInput || !highlightLayer || !runButton || !clearButton) return;

  function hasSmartEditor() {
    return !!(window.SmartEditor && typeof window.SmartEditor.refresh === 'function');
  }

  function setStatus(message, tone = 'ready') {
    if (!statusBadge) return;
    statusBadge.textContent = message;
    statusBadge.className = `pill pill-status ${tone}`;
  }

  function setAutoRunState(message, tone = 'idle') {
    if (!autoRunBadge) return;
    autoRunBadge.textContent = message;
    autoRunBadge.className = `pill pill-auto ${tone}`;
  }

  function renderConsoleLine(kind, text) {
    if (!consoleOutput) return;
    window.PG3DConsole = window.PG3DConsole || {};
    if (!Array.isArray(window.PG3DConsole.recentErrors)) {
      window.PG3DConsole.recentErrors = [];
    }
    const lineElement = document.createElement('div');
    lineElement.className = `console-line console-${kind}`;

    const timeElement = document.createElement('span');
    timeElement.className = 'console-time';
    timeElement.textContent = `[${new Date().toLocaleTimeString()}]`;

    const messageElement = document.createElement('span');
    messageElement.className = 'console-msg';
    messageElement.textContent = String(text);

    lineElement.appendChild(timeElement);
    lineElement.appendChild(messageElement);
    consoleOutput.appendChild(lineElement);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;

    if (kind === 'error') {
      window.PG3DConsole.recentErrors.push(String(text));
      if (window.PG3DConsole.recentErrors.length > 3) {
        window.PG3DConsole.recentErrors = window.PG3DConsole.recentErrors.slice(-3);
      }
    }
  }

  /* PG3D_CONSOLE_BRIDGE_V1
     Register canonical styled console writer for core modules.
     Core modules call window.PG3D_LOG(kind, message, meta).
  */
  (function () {
    try {
      if (typeof window === 'undefined') return;
      window.PG3DConsole = window.PG3DConsole || {};
      if (!Array.isArray(window.PG3DConsole.recentErrors)) {
        window.PG3DConsole.recentErrors = [];
      }
      window.PG3DConsole.getRecentErrors = function () {
        return Array.isArray(window.PG3DConsole.recentErrors)
          ? window.PG3DConsole.recentErrors.slice()
          : [];
      };
      window.PG3DConsole.renderLine = function (kind, message, meta) {
        renderConsoleLine(kind, message);
      };
      if (typeof window.PG3D_LOG !== 'function') {
        window.PG3D_LOG = function (kind, message, meta) {
          const k = (kind === 'warn' || kind === 'error' || kind === 'debug' || kind === 'info') ? kind : 'info';
          if (k === 'debug') {
            try {
              const enabled = (window.PG3D_DEBUG === true)
                || (window.localStorage && (window.localStorage.getItem('pg3d_debug') === '1' || window.localStorage.getItem('PG3D_DEBUG') === '1'))
                || (window.location && /(?:\?|&)debug=1(?:&|$)/.test(String(window.location.search || '')));
              if (!enabled) return;
            } catch (e) {}
          }
          window.PG3DConsole.renderLine(k, String(message), meta);
        };
      }
    } catch (e) {}
  })();

  const logInfo  = (text) => renderConsoleLine('info', text);
  const logWarn  = (text) => renderConsoleLine('warn', text);
  const logError = (text) => renderConsoleLine('error', text);

  function setButtonLabel(button, label, title = label) {
    if (!button) return;
    const labelEl = button.querySelector('.btn-label');
    if (labelEl) labelEl.textContent = label;
    else button.textContent = label;
    button.setAttribute('aria-label', title);
    button.title = title;
  }

  function isDebugEnabled() {
    try {
      return (window.PG3D_DEBUG === true)
        || (window.localStorage && (window.localStorage.getItem('pg3d_debug') === '1' || window.localStorage.getItem('PG3D_DEBUG') === '1'))
        || (window.location && /(?:\?|&)debug=1(?:&|$)/.test(String(window.location.search || '')));
    } catch (err) {
      return false;
    }
  }

  function setDebugEnabled(enabled) {
    const on = !!enabled;
    try {
      window.PG3D_DEBUG = on;
      if (window.localStorage) {
        window.localStorage.setItem('pg3d_debug', on ? '1' : '0');
        window.localStorage.setItem('PG3D_DEBUG', on ? '1' : '0');
      }
    } catch (err) {}
    if (debugToggle) debugToggle.checked = on;
    logInfo(`Debug logging ${on ? 'enabled' : 'disabled'}.`);
  }

  let scene;
  let renderer;
  try {
    if (typeof Scene !== 'function' || typeof WebGLSceneRenderer !== 'function') {
      throw new Error('Scene or WebGLSceneRenderer is not loaded globally.');
    }
    scene = new Scene();
    renderer = new WebGLSceneRenderer('#glcanvas', { wireframe: false });
    renderer.setScene(scene);
    logInfo('Renderer initialised with SVEC orbit camera, fit/reset controls, XZ grid, and orientation axis widget.');
  } catch (err) {
    setStatus('Renderer failed to initialise.', 'error');
    logError(`[Renderer] ${err?.message || err}`);
    return;
  }

  if (exportStlButton) {
    exportStlButton.addEventListener('click', () => {
      try {
        renderer.exportSTL('scene.stl');
        logInfo('Exported STL from current scene.');
      } catch (err) {
        logError(`STL export failed: ${err?.message || err}`);
      }
    });
  }

  function ensureViewerButton(id, glyph, title = '') {
    const toolbar = document.querySelector('.editor-viewer-toolbar');
    if (!toolbar) return null;
    let btn = document.getElementById(id);
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = id;
    btn.className = 'btn ghost viewer-icon-btn';
    btn.type = 'button';
    btn.innerHTML = `<span class="viewer-icon-btn__glyph" aria-hidden="true">${glyph}</span>`;
    if (title) {
      btn.title = title;
      btn.setAttribute('aria-label', title);
    }
    toolbar.appendChild(btn);
    return btn;
  }

  function setIconButtonGlyph(button, glyph, title) {
    if (!button) return;
    const glyphEl = button.querySelector('.viewer-icon-btn__glyph');
    if (glyphEl) glyphEl.textContent = glyph;
    else button.textContent = glyph;
    if (title) {
      button.title = title;
      button.setAttribute('aria-label', title);
    }
  }

  const fitViewBtn = ensureViewerButton('editorFitViewBtn', '⌗', 'Fit the current scene into view');
  const resetViewBtn = ensureViewerButton('editorResetViewBtn', '↺', 'Reset to the home camera direction');

  fitViewBtn?.addEventListener('click', () => {
    try {
      renderer.fitScene?.(true);
      logInfo('Viewer fit to current scene bounds.');
    } catch (err) {
      logError(`Fit view failed: ${err?.message || err}`);
    }
  });

  resetViewBtn?.addEventListener('click', () => {
    try {
      renderer.resetView?.();
      logInfo('Viewer reset to the home camera direction.');
    } catch (err) {
      logError(`Reset view failed: ${err?.message || err}`);
    }
  });

  let isWordWrapEnabled = false;
  function updateWordWrapButton() {
    if (!wordWrapButton) return;
    setButtonLabel(wordWrapButton, `Wrap: ${isWordWrapEnabled ? 'On' : 'Off'}`, `Toggle word wrap (${isWordWrapEnabled ? 'on' : 'off'})`);
  }
  function setWordWrapEnabled(enabled) {
    isWordWrapEnabled = !!enabled;
    document.body.classList.toggle('wrap-on', isWordWrapEnabled);
    updateWordWrapButton();
    if (hasSmartEditor() && typeof window.SmartEditor.setWrap === 'function') {
      window.SmartEditor.setWrap(isWordWrapEnabled);
      return;
    }
    updateHighlight();
  }
  wordWrapButton?.addEventListener('click', () => setWordWrapEnabled(!isWordWrapEnabled));
  updateWordWrapButton();
  if (debugToggle) {
    debugToggle.checked = isDebugEnabled();
    debugToggle.addEventListener('change', () => {
      setDebugEnabled(debugToggle.checked);
    });
  }

  function nameHue(name) {
    let h = 0;
    for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return h % 360;
  }
  const ruleContextStyle = (name, alpha = 0.18) => `style="background:hsla(${nameHue(name)},70%,20%,${alpha});"`;
  const escapeHtml = (value) => value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const TOK_RE = /(\bDSX\b|\bDSY\b|\bDSZ\b|\bDTX\b|\bDTY\b|\bDTZ\b|\bsin\b|\bcos\b|\bA\b|\bS\b|\bT\b|\bI\b|\?|\:|\,|->|\[|\]|\{|\}|\||\(|\)|-?\d+(?:\.\d+)?|[A-Za-z_]\w*|\s+|.)/g;

  function collectSymbols(text) {
    const varNames = new Set();
    const ruleNames = new Set();
    const reRule = /^([A-Za-z_]\w*)\s*(?:\(\s*([A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*\))?.*?->/gm;
    let m;
    while ((m = reRule.exec(text))) {
      ruleNames.add(m[1]);
      if (m[2]) {
        m[2].split(/\s*,\s*/).filter(Boolean).forEach((name) => varNames.add(name));
      }
    }
    return { varNames, ruleNames };
  }

  function highlightToHTML(text) {
    const { varNames, ruleNames } = collectSymbols(text || '');
    let html = '';
    let m;
    TOK_RE.lastIndex = 0;
    while ((m = TOK_RE.exec(text || ''))) {
      const tok = m[0];
      if (/^\s+$/.test(tok)) {
        html += tok.replace(/ /g, '&nbsp;').replace(/\n/g, '<br>');
      } else if (/^(A|S|T|DSX|DSY|DSZ|DTX|DTY|DTZ|I|sin|cos)$/.test(tok)) {
        html += `<span class="tok-kw">${tok}</span>`;
      } else if (tok === '->' || tok === '|' || tok === '?' || tok === ':' || tok === ',') {
        html += `<span class="tok-op">${tok}</span>`;
      } else if (tok === '(' || tok === ')') {
        html += `<span class="tok-paren">${tok}</span>`;
      } else if (tok === '[' || tok === ']' || tok === '{' || tok === '}') {
        html += `<span class="tok-brack">${tok}</span>`;
      } else if (/^-?\d+(?:\.\d+)?$/.test(tok)) {
        html += `<span class="tok-num">${tok}</span>`;
      } else if (/^[A-Za-z_]\w*$/.test(tok)) {
        if (varNames.has(tok)) html += `<span class="ctx tok-var" ${ruleContextStyle(tok, 0.18)}>${tok}</span>`;
        else if (ruleNames.has(tok)) html += `<span class="ctx tok-rule" ${ruleContextStyle(tok, 0.14)}>${tok}</span>`;
        else html += escapeHtml(tok);
      } else {
        html += escapeHtml(tok);
      }
    }
    return html;
  }

  let highlightRAF = null;
  function updateHighlight() {
    if (hasSmartEditor()) {
      window.SmartEditor.refresh();
      return;
    }
    if (highlightRAF) cancelAnimationFrame(highlightRAF);
    highlightRAF = requestAnimationFrame(() => {
      highlightLayer.innerHTML = highlightToHTML(sourceInput.value || '');
      highlightRAF = null;
    });
  }

  sourceInput.addEventListener('scroll', () => {
    if (hasSmartEditor()) return;
    highlightLayer.scrollTop = sourceInput.scrollTop;
    highlightLayer.scrollLeft = sourceInput.scrollLeft;
  });

  referenceHeader?.addEventListener('click', () => {
    if (!referenceDock) return;
    referenceDock.classList.toggle('min');
    const isOpen = !referenceDock.classList.contains('min');
    if (referenceToggleLabel) referenceToggleLabel.textContent = isOpen ? 'Hide ▲' : 'Show ▼';
  });

  let orbitOn = false;
  let orbitHandle = null;
  let orbitResumeTimer = null;
  let orbitSuspendedForDrag = false;
  const ORBIT_RESUME_DELAY_MS = 900;

  function stopOrbitLoop() {
    if (orbitHandle) {
      cancelAnimationFrame(orbitHandle);
      orbitHandle = null;
    }
  }

  function clearOrbitResumeTimer() {
    if (orbitResumeTimer) {
      clearTimeout(orbitResumeTimer);
      orbitResumeTimer = null;
    }
  }

  function startOrbitLoop() {
    if (!orbitOn || !renderer || orbitSuspendedForDrag || orbitHandle) return;
    orbitHandle = requestAnimationFrame(orbitLoop);
  }

  function scheduleOrbitResume(delay = ORBIT_RESUME_DELAY_MS) {
    clearOrbitResumeTimer();
    if (!orbitOn) return;
    orbitResumeTimer = setTimeout(() => {
      orbitResumeTimer = null;
      orbitSuspendedForDrag = false;
      startOrbitLoop();
    }, delay);
  }

  function orbitLoop() {
    orbitHandle = null;
    if (!orbitOn || !renderer || orbitSuspendedForDrag) return;
    if (typeof renderer.stepAutoOrbitXZ === 'function') renderer.stepAutoOrbitXZ(0.0022);
    else if (typeof renderer.stepAutoOrbit === 'function') renderer.stepAutoOrbit(0.0022);
    else {
      renderer.theta = (renderer.theta || 0) + 0.0022;
      renderer.invalidate();
    }
    orbitHandle = requestAnimationFrame(orbitLoop);
  }

  const orbitCanvas = renderer?.canvas || document.getElementById('glcanvas');
  orbitCanvas?.addEventListener('progen3d:viewdragstart', () => {
    if (!orbitOn) return;
    orbitSuspendedForDrag = true;
    clearOrbitResumeTimer();
    stopOrbitLoop();
  });
  orbitCanvas?.addEventListener('progen3d:viewdragend', () => {
    if (!orbitOn) return;
    scheduleOrbitResume();
  });

  setIconButtonGlyph(orbitToggleButton, '◎', 'Start slow auto orbit');
  orbitToggleButton?.classList.add('is-off');
  orbitToggleButton?.addEventListener('click', () => {
    orbitOn = !orbitOn;
    setIconButtonGlyph(
      orbitToggleButton,
      orbitOn ? '◉' : '◎',
      `${orbitOn ? 'Pause' : 'Start'} slow auto orbit`
    );
    orbitToggleButton.classList.toggle('is-off', !orbitOn);
    clearOrbitResumeTimer();
    if (orbitOn) {
      orbitSuspendedForDrag = false;
      startOrbitLoop();
    } else {
      orbitSuspendedForDrag = false;
      stopOrbitLoop();
    }
  });

  function __pg3d_normalizeText(input) {
    let s = String(input || '');
    s = s.replace(/\r\n?/g, '\n');
    s = s.replace(/^\uFEFF/, '');
    s = s.replace(/–|→|⇒|⟶|⟾/g, '->');
    return s.trim();
  }

  function normalizeHeaderArrow(line) {
    return String(line || '').replace(/\s*(?:->|–>|→|⇒|⟶|⟾)\s*/, ' -> ');
  }

  function isRuleHeaderLine(line) {
    return /^\s*[A-Za-z_][A-Za-z0-9_]*\s*(?:\([^)]*\))?(?:\s+[^-\r\n][^\r\n]*)?\s*(?:->|–>|→|⇒|⟶|⟾)/.test(String(line || ''));
  }

  function countDelimiters(line) {
    let opens = 0;
    let closes = 0;
    const text = String(line || '');
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === '[' || ch === '{') opens += 1;
      else if (ch === ']' || ch === '}') closes += 1;
    }
    return { opens, closes };
  }

  function lineStartsWithCloser(line) {
    return /^[\]\}]/.test(String(line || '').trim());
  }

  function formatBodyLine(line, indentLevel) {
    const trimmed = String(line || '').trim();
    if (!trimmed) return '';
    const effectiveIndent = Math.max(1, indentLevel - (lineStartsWithCloser(trimmed) ? 1 : 0));
    return `${'  '.repeat(effectiveIndent)}${trimmed}`;
  }

  function assessGrammarFormatting(input) {
    const normalized = String(input || '').replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
    const lines = normalized.split('\n');
    const issues = [];
    let missingRuleSpacing = 0;
    let headerSpacingIssues = 0;
    let indentationIssues = 0;
    let trailingWhitespaceIssues = 0;
    let repeatedBlankLines = 0;
    let tabIndentationIssues = 0;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const trimmed = line.trim();
      const prevTrimmed = i > 0 ? lines[i - 1].trim() : '';
      if (/\s+$/.test(line) && trimmed) trailingWhitespaceIssues += 1;
      if (/^\t+/.test(line)) tabIndentationIssues += 1;
      if (/^\s+/.test(line) && trimmed && !/^ {2,}/.test(line)) indentationIssues += 1;
      if (!trimmed && i > 0 && !lines[i - 1].trim()) repeatedBlankLines += 1;
      if (isRuleHeaderLine(line) && normalizeHeaderArrow(trimmed) !== trimmed) {
        headerSpacingIssues += 1;
      }
      if (isRuleHeaderLine(line) && i > 0 && prevTrimmed && !isRuleHeaderLine(lines[i - 1])) {
        // Body lines are allowed directly above, so ignore.
      } else if (isRuleHeaderLine(line) && i > 0 && prevTrimmed && isRuleHeaderLine(lines[i - 1])) {
        missingRuleSpacing += 1;
      } else if (isRuleHeaderLine(line) && i > 0 && prevTrimmed && lines[i - 1] !== '') {
        const previousNonEmptyIndex = i - 1;
        if (previousNonEmptyIndex >= 0 && lines[previousNonEmptyIndex].trim() && !isRuleHeaderLine(lines[previousNonEmptyIndex])) {
          const blankLineBefore = i > 0 && lines[i - 1] === '';
          if (!blankLineBefore) missingRuleSpacing += 1;
        }
      }
    }

    if (headerSpacingIssues) issues.push(`${headerSpacingIssues} rule header arrow spacing issue${headerSpacingIssues === 1 ? '' : 's'}`);
    if (missingRuleSpacing) issues.push(`${missingRuleSpacing} missing blank line${missingRuleSpacing === 1 ? '' : 's'} between rule blocks`);
    if (indentationIssues) issues.push(`${indentationIssues} line${indentationIssues === 1 ? '' : 's'} with indentation outside the house style`);
    if (trailingWhitespaceIssues) issues.push(`${trailingWhitespaceIssues} line${trailingWhitespaceIssues === 1 ? '' : 's'} with trailing whitespace`);
    if (repeatedBlankLines) issues.push(`${repeatedBlankLines} repeated blank line group${repeatedBlankLines === 1 ? '' : 's'}`);
    if (tabIndentationIssues) issues.push(`${tabIndentationIssues} tab-indented line${tabIndentationIssues === 1 ? '' : 's'}`);
    if (normalized !== normalized.trim()) issues.push('leading or trailing blank lines');

    const formattedText = formatGrammarText(normalized);
    const changed = formattedText !== __pg3d_normalizeText(normalized);
    const severity = issues.length >= 4 ? 'high' : (issues.length >= 2 ? 'medium' : (issues.length ? 'low' : 'none'));

    return {
      issues,
      severity,
      changed,
      formattedText,
      shouldAutoFormat: changed,
    };
  }

  function formatGrammarText(input) {
    const normalized = String(input || '').replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
    const rawLines = normalized.split('\n').map((line) => line.replace(/[ \t]+$/g, ''));
    const result = [];
    let pendingBlankLine = false;
    let indentLevel = 1;
    let insideRuleBody = false;

    for (let i = 0; i < rawLines.length; i += 1) {
      const line = rawLines[i];
      const trimmed = line.trim();
      if (!trimmed) {
        pendingBlankLine = result.length > 0;
        continue;
      }

      const isHeader = isRuleHeaderLine(trimmed);
      if (isHeader && result.length > 0 && result[result.length - 1] !== '') {
        result.push('');
      } else if (pendingBlankLine && result.length > 0 && result[result.length - 1] !== '') {
        result.push('');
      }
      pendingBlankLine = false;

      if (isHeader) {
        result.push(normalizeHeaderArrow(trimmed));
        indentLevel = 1;
        insideRuleBody = true;
      } else {
        const bodyLine = insideRuleBody ? formatBodyLine(trimmed, indentLevel) : trimmed;
        result.push(bodyLine);
        const { opens, closes } = countDelimiters(trimmed);
        indentLevel = Math.max(1, indentLevel + opens - closes);
      }
    }

    return result.join('\n').trim();
  }

  function applySourceText(nextText) {
    sourceInput.value = String(nextText || '');
    updateHighlight();
    try {
      if (typeof window.SmartEditor?.refresh === 'function') {
        window.SmartEditor.refresh();
      }
    } catch (err) {}
  }

  function __pg3d_setActiveGrammar(g) {
    try {
      if (typeof window !== 'undefined') {
        window.__PG3D_ACTIVE_GRAMMAR__ = g;
      }
      if (typeof globalThis !== 'undefined') {
        globalThis.__PG3D_ACTIVE_GRAMMAR__ = g;
      }
    } catch (e) {}
    return g;
  }

  function __pg3d_getPrepare() {
    try {
      if (typeof prepare === 'function') return prepare;
    } catch (e) {}
    try {
      if (typeof window !== 'undefined' && typeof window.prepare === 'function') return window.prepare;
    } catch (e) {}
    try {
      if (typeof globalThis !== 'undefined' && typeof globalThis.prepare === 'function') return globalThis.prepare;
    } catch (e) {}
    return null;
  }

  const AUTO_FORMAT_MAX_PASSES = 2;
  let lastExecutedText = null;
  async function runGrammarPipeline(text, reason = 'manual', options = {}) {
    const autoFormatPass = Number.isFinite(options.autoFormatPass) ? options.autoFormatPass : 0;
    const previousErrorFreeText = typeof options.previousErrorFreeText === 'string' ? options.previousErrorFreeText : null;
    const skipAutoFormat = options.skipAutoFormat === true;
    const trimmed = String(text || '').trim();

    if (!trimmed) {
      setStatus('Nothing to run.', 'ready');
      setAutoRunState('Auto-run idle', 'idle');
      logWarn('Nothing to run — the editor is empty.');
      scene.clear?.();
      renderer.setScene?.(scene);
      renderer.invalidate?.();
      return;
    }

    try {
      setStatus(reason === 'auto' ? 'Auto-running grammar…' : 'Running grammar…', 'processing');
      scene.clear?.();

      if (typeof Grammar !== 'function') {
        throw new Error('Grammar not available globally.');
      }

      const builtinAugment = window.PG3DBuiltinRules && typeof window.PG3DBuiltinRules.augmentGrammar === 'function'
        ? await window.PG3DBuiltinRules.augmentGrammar(trimmed)
        : { source: trimmed, effectiveText: trimmed, includedRuleNames: [] };
      const effectiveText = __pg3d_normalizeText(builtinAugment.effectiveText || trimmed);
      const g = new Grammar(effectiveText, { debug: true });
      __pg3d_setActiveGrammar(g);
      const visualTokens = g.visualTokens;

      logInfo(`${reason === 'auto' ? 'Auto-run' : 'Manual run'}: tokenising ${visualTokens?.length ?? 'unknown'} tokens.`);
      if (Array.isArray(builtinAugment.includedRuleNames) && builtinAugment.includedRuleNames.length) {
        logInfo(`Builtin rules injected: ${builtinAugment.includedRuleNames.join(', ')}`);
      }

      const prepareFn = __pg3d_getPrepare();
      if (typeof prepareFn !== 'function') {
        throw new Error('prepare(tokens, scene) is not available globally.');
      }

      prepareFn(visualTokens, scene);

      renderer.setScene?.(scene);
      renderer.invalidate?.();

      const formatting = skipAutoFormat ? {
        issues: [],
        severity: 'none',
        changed: false,
        formattedText: trimmed,
        shouldAutoFormat: false,
      } : assessGrammarFormatting(trimmed);

      if (!skipAutoFormat && formatting.shouldAutoFormat && autoFormatPass < AUTO_FORMAT_MAX_PASSES) {
        const formattedText = formatting.formattedText;
        if (formattedText && formattedText !== trimmed) {
          applySourceText(formattedText);
          logInfo(`Formatting assessment: ${formatting.issues.join(' · ')}`);
          logInfo(`Auto-formatter run: pass ${autoFormatPass + 1}/${AUTO_FORMAT_MAX_PASSES}.`);
          logInfo(`Auto-format applied on valid grammar. Re-validating pass ${autoFormatPass + 1}/${AUTO_FORMAT_MAX_PASSES}.`);
          setStatus('Auto-format applied. Re-validating grammar…', 'processing');
          setAutoRunState('Auto-format re-check running', 'running');
          return runGrammarPipeline(formattedText, 'auto-format', {
            autoFormatPass: autoFormatPass + 1,
            previousErrorFreeText: trimmed,
          });
        }
      }

      lastExecutedText = trimmed;

      if (typeof g.getDebugInfo === 'function') {
        try {
          const dbg = g.getDebugInfo();
          logInfo(`Grammar debug: ui=${dbg.uiTokenCount ?? 'n/a'} parse=${dbg.parseTokenCount ?? 'n/a'} ws=${dbg.whitespaceTokenCount ?? 'n/a'} nl=${dbg.newlineTokenCount ?? 'n/a'} rules=${dbg.ruleCount ?? 'n/a'}`);
          if (Array.isArray(g.order) && g.order.length) {
            logInfo(`Grammar entry: ${g.entry || g.order[0]} · rules: ${g.order.join(', ')}`);
          }
          const parserEvents = Array.isArray(dbg?.parser?.parserEvents) ? dbg.parser.parserEvents : [];
          if (parserEvents.length) {
            const tail = parserEvents.slice(-4).map((evt) => {
              if (evt.type === 'rule') return `rule:${evt.name}`;
              if (evt.type === 'parse_done') return `done:${evt.ruleCount}`;
              if (evt.type === 'parse_start') return `start:${evt.parseTokens}`;
              return evt.type;
            }).join(' · ');
            logInfo(`Parse trace: ${tail}`);
          }
        } catch (e) {}
      }

      if (!skipAutoFormat && formatting.issues.length) {
        logInfo(`Formatting assessment: ${formatting.issues.join(' · ')}`);
      }
      setStatus(
        formatting.changed || formatting.issues.length
          ? `Valid grammar. Format: ${formatting.issues.length ? formatting.severity : 'clean'}. Scene items: ${scene.getAll?.().length ?? 'n/a'}`
          : `Done. Scene items: ${scene.getAll?.().length ?? 'n/a'}`,
        'ready'
      );
      setAutoRunState(
        reason === 'auto' || reason === 'auto-format' ? 'Auto-run complete' : 'Auto-run armed',
        reason === 'auto' || reason === 'auto-format' ? 'running' : 'idle'
      );
      logInfo(`Build complete. Scene items: ${scene.getAll?.().length ?? 'n/a'}`);
    } catch (err) {
      if (previousErrorFreeText && previousErrorFreeText !== trimmed) {
        logWarn('Auto-format introduced an error. Restoring the last error-free grammar.');
        applySourceText(previousErrorFreeText);
        return runGrammarPipeline(previousErrorFreeText, 'auto-format-rollback', {
          autoFormatPass: AUTO_FORMAT_MAX_PASSES,
          skipAutoFormat: true,
        });
      }
      setStatus('Grammar error.', 'error');
      setAutoRunState('Auto-run blocked by error', 'error');
      logError(`Grammar error: ${err?.message || err}`);
      if (Number.isFinite(err?.line) || /@\d+:\d+/.test(String(err?.message || ''))) {
        const match = Number.isFinite(err?.line) && Number.isFinite(err?.col)
          ? { line: err.line, col: err.col }
          : ((String(err?.message || '').match(/@(\d+):(\d+)/)) || null);
        const line = match ? Number(match.line || match[1]) : null;
        const col = match ? Number(match.col || match[2]) : null;
        const lines = String(trimmed || '').split(/\r\n|\r|\n/);
        const snippet = Number.isFinite(line) ? (lines[Math.max(0, line - 1)] || '') : '';
        if (Number.isFinite(line) && Number.isFinite(col)) {
          logError(`Parse location: line ${line}, col ${col}`);
        }
        if (snippet) {
          logError(`Parse line ${line}: ${snippet}`);
        }
      }
      try {
        console.error('[PG3D runGrammarPipeline]', err);
      } catch (e) {}
    }
  }

  const AUTO_RUN_DELAY_MS = 4000;
  let autoRunTimer = null;
  let autoRunCountdown = null;
  let autoRunDueAt = 0;

  function clearAutoRunCountdown() {
    if (autoRunCountdown) {
      clearInterval(autoRunCountdown);
      autoRunCountdown = null;
    }
  }

  function cancelAutoRun(resetMessage = true) {
    if (autoRunTimer) {
      clearTimeout(autoRunTimer);
      autoRunTimer = null;
    }
    autoRunDueAt = 0;
    clearAutoRunCountdown();
    if (resetMessage) setAutoRunState('Auto-run idle', 'idle');
  }

  function startAutoRunCountdown() {
    clearAutoRunCountdown();
    const tick = () => {
      if (!autoRunDueAt) return;
      const remaining = Math.max(0, autoRunDueAt - Date.now());
      if (remaining <= 0) {
        setAutoRunState('Auto-run executing…', 'running');
        clearAutoRunCountdown();
        return;
      }
      setAutoRunState(`Auto-run in ${(remaining / 1000).toFixed(1)}s`, 'waiting');
    };
    tick();
    autoRunCountdown = setInterval(tick, 100);
  }

  function scheduleAutoRun() {
    const current = String(sourceInput.value || '');
    if (!current.trim()) {
      cancelAutoRun(true);
      return;
    }
    if (current.trim() === lastExecutedText) {
      setAutoRunState('Auto-run idle', 'idle');
      return;
    }
    if (autoRunTimer) clearTimeout(autoRunTimer);
    autoRunDueAt = Date.now() + AUTO_RUN_DELAY_MS;
    startAutoRunCountdown();
    autoRunTimer = setTimeout(() => {
      autoRunTimer = null;
      clearAutoRunCountdown();
      runGrammarPipeline(current, 'auto');
    }, AUTO_RUN_DELAY_MS);
  }

  sourceInput.addEventListener('input', () => {
    updateHighlight();
    scheduleAutoRun();
  });

  runButton.addEventListener('click', () => {
    cancelAutoRun(false);
    setAutoRunState('Auto-run idle', 'idle');
    runGrammarPipeline(sourceInput.value || '', 'manual');
  });

  clearButton.addEventListener('click', () => {
    cancelAutoRun(true);
    sourceInput.value = '';
    updateHighlight();
    scene.clear?.();
    renderer.setScene?.(scene);
    renderer.invalidate?.();
    setStatus('Editor cleared.', 'ready');
    logInfo('Editor cleared and scene reset.');
    sourceInput.focus();
  });

  const TUTORIAL_SNIPPETS = [
    'Start -> Trunk( 2.4 0.28 )\n',
    'Trunk( h bark ) -> S ( 0.55 h 0.55 ) I ( CubeY oakPlanks bark ) [ T ( 0 h 0 ) Crown( h bark ) ]\n',
    'Crown( h bark ) -> ?( h > 2 ) TallCrown( bark h ) : ShortCrown( bark h )\n',
    'TallCrown( bark h ) -> DSX ( 1.18 1 1 ) DTX ( 0.08 0 0 ) DSY ( 1 0.92 1 ) DTY ( 0 0.12 0 ) DSZ ( 1 1 1.14 ) DTZ ( 0 0 0.1 ) I ( CubeZ freshGrass bark + 0.14 )\n',
    'ShortCrown( bark h ) -> S ( cos ( 0 ) 1 sin ( 0 ) + 1 ) I ( Cube freshGrass bark + 0.07 )'
  ];

  function initTutorial() {
    const overlay = document.getElementById('tut');
    if (!overlay) {
      logInfo('[Tutorial] Overlay UI not present; loading demo grammar into editor.');
      sourceInput.value = TUTORIAL_SNIPPETS.join('');
      updateHighlight();
      scheduleAutoRun();
    }
  }

  updateHighlight();
  setStatus('Ready. Edit grammar to trigger auto-run after 4 seconds.', 'ready');
  setAutoRunState('Auto-run idle', 'idle');
  if (debugToggle) debugToggle.checked = isDebugEnabled();
  runGrammarPipeline(sourceInput.value || '', 'manual');
})();

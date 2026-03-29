(function () {
  'use strict';

  const sourceInput = document.getElementById('editorSourceInput');
  const codePane = document.getElementById('editorCodePane');
  const tooltip = document.getElementById('editorTooltip');
  const lineGutter = document.getElementById('editorLineGutter');
  const statusBadge = document.getElementById('status');
  if (!sourceInput || !codePane) return;

  const TOOLTIPS = {
    A: {
      label: 'Rotate operator',
      badge: 'Transform',
      syntax: 'A ( degrees axis )',
      desc: 'Rotate subsequent geometry by degrees around axis 0=X, 1=Y, 2=Z.',
      detail: 'Example: A ( 90 1 ) rotates 90 degrees around the Y axis.'
    },
    T: {
      label: 'Translate operator',
      badge: 'Transform',
      syntax: 'T ( x y z )',
      desc: 'Move subsequent geometry in world or local grammar space.',
      detail: 'Example: T ( 0 1.5 0 ) lifts the next instance upward.'
    },
    S: {
      label: 'Scale operator',
      badge: 'Transform',
      syntax: 'S ( sx sy sz )',
      desc: 'Scale following geometry uniformly or per axis.',
      detail: 'Example: S ( 1 3 1 ) creates a tall stretched volume.'
    },
    DSX: {
      label: 'Axis deform scale X',
      badge: 'Axis deform',
      syntax: 'DSX ( number number number )',
      desc: 'Applies the X-stage deformation tuple in the current BNF.',
      detail: 'Defaults to 1 1 1 when omitted from the current branch state.'
    },
    DSY: {
      label: 'Axis deform scale Y',
      badge: 'Axis deform',
      syntax: 'DSY ( number number number )',
      desc: 'Applies the Y-stage deformation tuple in the current BNF.',
      detail: 'Defaults to 1 1 1 when omitted from the current branch state.'
    },
    DSZ: {
      label: 'Axis deform scale Z',
      badge: 'Axis deform',
      syntax: 'DSZ ( number number number )',
      desc: 'Applies the Z-stage deformation tuple in the current BNF.',
      detail: 'Defaults to 1 1 1 when omitted from the current branch state.'
    },
    DTX: {
      label: 'Axis delta translate X',
      badge: 'Axis deform',
      syntax: 'DTX ( number number number )',
      desc: 'Applies the X-stage offset tuple in the current BNF.',
      detail: 'Defaults to 0 0 0 when omitted from the current branch state.'
    },
    DTY: {
      label: 'Axis delta translate Y',
      badge: 'Axis deform',
      syntax: 'DTY ( number number number )',
      desc: 'Applies the Y-stage offset tuple in the current BNF.',
      detail: 'Defaults to 0 0 0 when omitted from the current branch state.'
    },
    DTZ: {
      label: 'Axis delta translate Z',
      badge: 'Axis deform',
      syntax: 'DTZ ( number number number )',
      desc: 'Applies the Z-stage offset tuple in the current BNF.',
      detail: 'Defaults to 0 0 0 when omitted from the current branch state.'
    },
    I: {
      label: 'Instantiate primitive',
      badge: 'Geometry',
      syntax: 'I ( Cube | CubeX | CubeY | CubeZ texture scale )',
      desc: 'Creates a primitive using the active transform stack.',
      detail: 'CubeX, CubeY, and CubeZ also advance the local transform by one unit along their local axis after instancing.'
    },
    sin: {
      label: 'Sine function',
      badge: 'Function',
      syntax: 'sin ( expression )',
      desc: 'Evaluates the sine of an expression in the BNF expression grammar.',
      detail: 'Functions are valid inside transforms, calls, conditionals, and variables.'
    },
    cos: {
      label: 'Cosine function',
      badge: 'Function',
      syntax: 'cos ( expression )',
      desc: 'Evaluates the cosine of an expression in the BNF expression grammar.',
      detail: 'Functions are valid inside transforms, calls, conditionals, and variables.'
    }
  };

  const overlay = document.createElement('div');
  overlay.id = 'editorDiagnosticLayer';
  const readout = document.createElement('div');
  readout.className = 'editor-caret-readout';
  readout.innerHTML = '<strong>Ln 1, Col 1</strong><span>No issues</span>';
  codePane.appendChild(overlay);
  codePane.appendChild(readout);

  const buttonTips = {
    editorRunBtn: 'Run the current grammar immediately and rebuild the scene.',
    editorClearBtn: 'Clear the editor and reset the scene.',
    editorWordWrapBtn: 'Toggle line wrapping in the grammar editor.',
    editorExportStlBtn: 'Export the current scene as STL.',
    editorOrbitToggleBtn: 'Start or stop slow automatic orbit in the scene viewer.',
    editorOpenJsonBtn: 'Load a saved local JSON grammar bundle.',
    editorExportJsonBtn: 'Export the current local save library to JSON.',
    editorLocalSaveBtn: 'Save the current BNF grammar into local browser storage.'
  };

  Object.keys(buttonTips).forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.title = buttonTips[id];
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', buttonTips[id]);
  });

  let currentDiagnostics = [];
  let validateTimer = null;
  let measureCache = null;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  function splitEditorLines(text) {
    return String(text || '').split(/\r\n|\r|\n/);
  }

  function lineStarts(text) {
    const safeText = String(text || '');
    const starts = [0];
    for (let i = 0; i < safeText.length; i += 1) {
      const ch = safeText.charCodeAt(i);
      if (ch === 13) {
        if (safeText.charCodeAt(i + 1) === 10) i += 1;
        starts.push(i + 1);
      } else if (ch === 10) {
        starts.push(i + 1);
      }
    }
    return starts;
  }

  function lineColFromOffset(text, offset) {
    const safeText = String(text || '');
    const safeOffset = Math.max(0, Math.min(Number(offset) || 0, safeText.length));
    const starts = lineStarts(safeText);
    let line = 1;
    for (let i = 1; i < starts.length; i += 1) {
      if (starts[i] > safeOffset) break;
      line = i + 1;
    }
    return { line, col: safeOffset - starts[line - 1] + 1 };
  }

  function offsetFromLineCol(text, line, col) {
    const safeText = String(text || '');
    const targetLine = Math.max(1, Number(line) || 1);
    const targetCol = Math.max(1, Number(col) || 1);
    const starts = lineStarts(safeText);
    const lineIndex = Math.min(targetLine, starts.length) - 1;
    const offset = starts[lineIndex] || 0;
    return Math.min(safeText.length, offset + targetCol - 1);
  }

  function getLineText(text, line) {
    const lines = splitEditorLines(text);
    return lines[Math.max(0, line - 1)] || '';
  }

  function getMetrics() {
    if (measureCache) return measureCache;
    const cs = window.getComputedStyle(sourceInput);
    const probe = document.createElement('span');
    probe.textContent = '0000000000';
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.whiteSpace = 'pre';
    probe.style.fontFamily = cs.fontFamily;
    probe.style.fontSize = cs.fontSize;
    probe.style.fontWeight = cs.fontWeight;
    probe.style.letterSpacing = cs.letterSpacing;
    probe.style.lineHeight = cs.lineHeight;
    document.body.appendChild(probe);
    const charWidth = probe.getBoundingClientRect().width / 10 || 8;
    probe.remove();

    measureCache = {
      lineHeight: parseFloat(cs.lineHeight) || 22,
      paddingTop: parseFloat(cs.paddingTop) || 0,
      paddingLeft: parseFloat(cs.paddingLeft) || 0,
      paddingRight: parseFloat(cs.paddingRight) || 0,
      charWidth,
    };
    return measureCache;
  }

  function invalidateMetrics() {
    measureCache = null;
  }

  function normalizeSeverity(value) {
    return value === 'error' ? 'error' : 'warning';
  }

  function dedupeDiagnostics(list) {
    const seen = new Set();
    return list.filter((item) => {
      const key = [item.line, item.col, item.message, item.severity].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function smartEditorDiagnostics(text) {
    if (!window.SmartEditor || typeof window.SmartEditor.analyze !== 'function') return [];
    try {
      const analysis = window.SmartEditor.analyze();
      const tokens = Array.isArray(analysis.tokens) ? analysis.tokens : [];
      return (analysis.errors || []).map((entry) => {
        const token = tokens[entry.i] || tokens[Math.max(0, Math.min(tokens.length - 1, entry.i || 0))];
        const lc = lineColFromOffset(text, token?.start || 0);
        return {
          line: lc.line,
          col: lc.col,
          message: entry.msg || 'Grammar issue',
          severity: 'warning',
          source: 'editor',
          snippet: getLineText(text, lc.line)
        };
      });
    } catch (err) {
      return [];
    }
  }

  function parseDiagnostic(text) {
    const trimmed = String(text || '');
    if (!trimmed.trim()) return null;
    if (typeof window.Grammar !== 'function') return null;
    try {
      new window.Grammar(trimmed);
      return null;
    } catch (err) {
      if (!err) return null;
      const rawLine = Number.isFinite(err.line) && err.line > 0 ? err.line : 1;
      const rawCol = Number.isFinite(err.col) ? err.col : 0;
      return {
        line: Math.max(1, rawLine),
        col: Math.max(1, rawCol + 1),
        message: err.message || 'Grammar parse error',
        severity: 'error',
        source: err.name || 'ParseError',
        snippet: err.snippet || getLineText(trimmed, Math.max(1, rawLine))
      };
    }
  }

  function collectDiagnostics() {
    const text = sourceInput.value || '';
    const friendly = smartEditorDiagnostics(text);
    const parsed = parseDiagnostic(text);
    const merged = parsed ? [parsed].concat(friendly) : friendly;
    return dedupeDiagnostics(merged).sort((a, b) => {
      const sa = a.severity === 'error' ? 0 : 1;
      const sb = b.severity === 'error' ? 0 : 1;
      if (sa !== sb) return sa - sb;
      if (a.line !== b.line) return a.line - b.line;
      return a.col - b.col;
    });
  }

  function applyGutterState() {
    const gutterElement = document.getElementById('editorLineGutter');
    if (!gutterElement) return;
    const spans = Array.from(gutterElement.querySelectorAll('span'));
    spans.forEach((span) => {
      span.classList.remove('is-active', 'has-error', 'has-warning');
      span.removeAttribute('title');
    });
    const activeLine = lineColFromOffset(sourceInput.value || '', sourceInput.selectionStart || 0).line;
    const lineMap = new Map();
    currentDiagnostics.forEach((diag) => {
      const existing = lineMap.get(diag.line) || [];
      existing.push(diag);
      lineMap.set(diag.line, existing);
    });
    spans.forEach((span, index) => {
      const lineNo = index + 1;
      const lineDiags = lineMap.get(lineNo) || [];
      if (lineNo === activeLine) span.classList.add('is-active');
      if (lineDiags.some((entry) => entry.severity === 'error')) span.classList.add('has-error');
      else if (lineDiags.length) span.classList.add('has-warning');
      if (lineDiags.length) {
        span.title = lineDiags.map((entry) => `${entry.severity.toUpperCase()}: ${entry.message}`).join('\n');
      }
    });
  }

  function renderDiagnosticLayer() {
    overlay.innerHTML = '';
    const metrics = getMetrics();
    const highestByLine = new Map();
    currentDiagnostics.forEach((diag) => {
      const existing = highestByLine.get(diag.line);
      if (!existing || (existing.severity !== 'error' && diag.severity === 'error')) {
        highestByLine.set(diag.line, diag);
      }
    });

    highestByLine.forEach((diag, line) => {
      const lineEl = document.createElement('div');
      lineEl.className = `editor-diagnostic-line is-${normalizeSeverity(diag.severity)}`;
      lineEl.style.top = `${metrics.paddingTop + ((line - 1) * metrics.lineHeight) - sourceInput.scrollTop}px`;
      lineEl.style.left = `${metrics.paddingLeft - sourceInput.scrollLeft}px`;
      lineEl.style.width = `${Math.max(sourceInput.scrollWidth, sourceInput.clientWidth) - metrics.paddingLeft - metrics.paddingRight}px`;
      lineEl.style.height = `${metrics.lineHeight}px`;
      overlay.appendChild(lineEl);
    });

    currentDiagnostics.slice(0, 30).forEach((diag) => {
      const caret = document.createElement('div');
      caret.className = `editor-diagnostic-caret is-${normalizeSeverity(diag.severity)}`;
      caret.style.top = `${metrics.paddingTop + ((diag.line - 1) * metrics.lineHeight) - sourceInput.scrollTop + 3}px`;
      caret.style.left = `${metrics.paddingLeft + ((Math.max(1, diag.col) - 1) * metrics.charWidth) - sourceInput.scrollLeft}px`;
      caret.style.height = `${Math.max(12, metrics.lineHeight - 6)}px`;
      overlay.appendChild(caret);
    });

    sourceInput.dataset.errorLines = currentDiagnostics.filter((diag) => diag.severity === 'error').map((diag) => diag.line).join(',');
    sourceInput.dataset.warningLines = currentDiagnostics.filter((diag) => diag.severity !== 'error').map((diag) => diag.line).join(',');
    applyGutterState();
  }

  function updateReadout() {
    const lc = lineColFromOffset(sourceInput.value || '', sourceInput.selectionStart || 0);
    const errorCount = currentDiagnostics.filter((diag) => diag.severity === 'error').length;
    const warningCount = currentDiagnostics.filter((diag) => diag.severity !== 'error').length;
    const summary = errorCount ? `${errorCount} error${errorCount === 1 ? '' : 's'}` : warningCount ? `${warningCount} warning${warningCount === 1 ? '' : 's'}` : 'No issues';
    readout.innerHTML = `<strong>Ln ${lc.line}, Col ${lc.col}</strong><span>${summary}</span>`;
    if (statusBadge && !statusBadge.classList.contains('processing')) {
      const base = errorCount ? `Issues: ${errorCount}${warningCount ? ` + ${warningCount} warnings` : ''}` : warningCount ? `Warnings: ${warningCount}` : 'Ready';
      statusBadge.textContent = `${base} · Ln ${lc.line}, Col ${lc.col}`;
      if (errorCount) statusBadge.className = 'pill pill-status error';
      else if (warningCount) statusBadge.className = 'pill pill-status processing';
      else statusBadge.className = 'pill pill-status ready';
    }
  }

  function validateNow() {
    currentDiagnostics = collectDiagnostics();
    renderDiagnosticLayer();
    updateReadout();
    sourceInput.dispatchEvent(new CustomEvent('pg3d-diagnostics-change', { bubbles: true, detail: { diagnostics: currentDiagnostics } }));
  }

  function scheduleValidate() {
    if (validateTimer) clearTimeout(validateTimer);
    validateTimer = setTimeout(validateNow, 120);
  }

  function installRichTooltip() {
    if (!tooltip) return;
    const keywordFromRaw = (raw) => TOOLTIPS[raw] || null;
    const findNearbyDiagnostic = (line, col) => currentDiagnostics.find((diag) => diag.line === line && Math.abs(diag.col - col) <= 2) || currentDiagnostics.find((diag) => diag.line === line);

    codePane.addEventListener('mousemove', (event) => {
      const span = event.target && event.target.closest ? event.target.closest('#editorHitLayerContent span') : null;
      if (!span || tooltip.style.display === 'none') return;

      const raw = span.textContent || '';
      const start = Number(span.dataset.s || 0);
      const lc = lineColFromOffset(sourceInput.value || '', start);
      const diag = span.dataset.err ? {
        message: span.dataset.err,
        severity: 'error',
        line: lc.line,
        col: lc.col,
        snippet: getLineText(sourceInput.value || '', lc.line)
      } : findNearbyDiagnostic(lc.line, lc.col);

      let model = null;
      const kind = span.dataset.type || 'token';
      if (diag) {
        model = {
          label: diag.severity === 'error' ? 'Grammar error' : 'Grammar warning',
          badge: diag.severity === 'error' ? 'Error' : 'Warning',
          syntax: diag.snippet ? `${diag.snippet}\n${' '.repeat(Math.max(0, diag.col - 1))}^` : `Line ${diag.line}, column ${diag.col}`,
          desc: diag.message,
          detail: `Line ${diag.line}, column ${diag.col}${diag.source ? ` · ${diag.source}` : ''}`,
          state: diag.severity
        };
      } else if (keywordFromRaw(raw)) {
        model = keywordFromRaw(raw);
      } else {
        const baseMeta = `Line ${lc.line}, column ${lc.col}`;
        if (kind === 'num') {
          model = { label: 'Numeric literal', badge: 'Value', syntax: raw, desc: 'Literal number used directly in the grammar.', detail: baseMeta };
        } else if (kind === 'id') {
          const role = span.classList.contains('se-rule-def') ? 'Rule definition' : span.classList.contains('se-rule-ref') ? 'Rule reference' : 'Identifier';
          model = { label: role, badge: 'Symbol', syntax: raw, desc: span.classList.contains('se-unreach') ? 'This rule is currently not reachable from the active start rule.' : 'Identifier or rule symbol in the current grammar.', detail: baseMeta };
        } else if (kind === 'op') {
          model = { label: 'Grammar operator', badge: 'Syntax', syntax: raw, desc: 'Structural token used to separate rule headers, alternates, or blocks.', detail: baseMeta };
        } else if (kind === 'par' || kind === 'br') {
          model = { label: 'Grouping token', badge: 'Syntax', syntax: raw, desc: 'Controls grouped arguments or nested grammar blocks.', detail: baseMeta };
        }
      }

      if (!model) return;
      tooltip.classList.toggle('is-error', model.state === 'error');
      tooltip.classList.toggle('is-warning', model.state === 'warning');
      tooltip.innerHTML = `
        <div class="se-tip">
          <div class="se-tip__head">
            <div class="se-tip__title">
              <div class="se-tip__label">${escapeHtml(model.label || raw)}</div>
              <div class="se-tip__meta">${escapeHtml((model.detail || `Line ${lc.line}, column ${lc.col}`).trim())}</div>
            </div>
            <span class="se-tip__badge">${escapeHtml(model.badge || 'Info')}</span>
          </div>
          <div class="se-tip__body">
            <div class="se-tip__desc">${escapeHtml(model.desc || raw)}</div>
            <div class="se-tip__syntax">${escapeHtml(model.syntax || raw)}</div>
            ${model.detail && model.detail !== `Line ${lc.line}, column ${lc.col}` ? `<div class="se-tip__detail">${escapeHtml(model.detail)}</div>` : ''}
          </div>
        </div>`;
    });
  }

  sourceInput.addEventListener('input', scheduleValidate);
  sourceInput.addEventListener('scroll', renderDiagnosticLayer, { passive: true });
  sourceInput.addEventListener('click', () => { applyGutterState(); updateReadout(); });
  sourceInput.addEventListener('keyup', () => { applyGutterState(); updateReadout(); });
  sourceInput.addEventListener('mouseup', () => { applyGutterState(); updateReadout(); });
  sourceInput.addEventListener('select', () => { applyGutterState(); updateReadout(); });
  sourceInput.addEventListener('pg3d-diagnostics-change', applyGutterState);
  sourceInput.addEventListener('pg3d-diagnostics-change', updateReadout);
  sourceInput.addEventListener('input', () => {
    if (statusBadge && statusBadge.classList.contains('error')) {
      statusBadge.className = 'pill pill-status processing';
      statusBadge.textContent = 'Rechecking grammar…';
    }
  });

  const runButton = document.getElementById('editorRunBtn');
  if (runButton) runButton.addEventListener('click', validateNow, true);

  window.addEventListener('resize', () => {
    invalidateMetrics();
    renderDiagnosticLayer();
    updateReadout();
  });

  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      invalidateMetrics();
      renderDiagnosticLayer();
      updateReadout();
    }).observe(sourceInput);
  }

  installRichTooltip();
  validateNow();
})();

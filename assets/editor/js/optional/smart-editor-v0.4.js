// Extracted from original file lines 5303-5837
            /* Smart Editor v0.4 — syntax errors + active/reachable rule highlighting */
(() => {
  'use strict';

const GRAMMAR_TOOLTIPS = {
  A:   "Rotate → A (angle, axis)\nAngle in degrees; axis 0=x, 1=y, 2=z",
  T:   "Translate → T (x, y, z)\nMove along X, Y, Z",
  S:   "Scale → S (x, y, z)\nScale factors on X, Y, Z",
  DSX: "Axis Deform Scale X → DSX (x, y, z)\nNested X-axis deformation scale",
  DSY: "Axis Deform Scale Y → DSY (x, y, z)\nNested Y-axis deformation scale",
  DSZ: "Axis Deform Scale Z → DSZ (x, y, z)\nNested Z-axis deformation scale",
  DTX: "Axis Delta Translate X → DTX (x, y, z)\nNested X-axis deformation translation",
  DTY: "Axis Delta Translate Y → DTY (x, y, z)\nNested Y-axis deformation translation",
  DTZ: "Axis Delta Translate Z → DTZ (x, y, z)\nNested Z-axis deformation translation",
  I:   "Instantiate → I (primitive, texture, number)\nTypes: Cube, CubeX, CubeY, CubeZ",
  sin: "Function → sin ( expression )\nAvailable in the BNF expression grammar",
  cos: "Function → cos ( expression )\nAvailable in the BNF expression grammar"
};
  const SMART_EDITOR_KEYWORDS = new Set(['A', 'T', 'S', 'DSX', 'DSY', 'DSZ', 'DTX', 'DTY', 'DTZ', 'I', 'sin', 'cos']);
  // ----- one-time guard -----
  const codePane = document.getElementById('editorCodePane');
  if (!codePane || codePane.dataset.seInit === '1') return;
  codePane.dataset.seInit = '1';

  // ----- UI -----
  const getElement = (id) => document.getElementById(id);
  const ui = {
    sourceInput: getElement('editorSourceInput'),
    highlightLayer: getElement('editorHighlightLayer'),
    hitLayer: getElement('editorHitLayer'),
    hitContent: getElement('editorHitLayerContent'),
    tooltip: getElement('editorTooltip'),
    wordWrapButton: getElement('editorWordWrapBtn'),
    consoleOutput: getElement('editorConsoleOutput'),
  };
  if (!ui.sourceInput || !ui.highlightLayer || !ui.hitLayer || !ui.hitContent || !ui.tooltip) {
    console.error('[SmartEditor] Missing #editorSourceInput/#editorHighlightLayer/#editorHitLayer/#editorHitLayerContent/#editorTooltip');
    return;
  }

  // ----- utils -----
  const escapeHtml = (s) => s.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
  const logToConsole = (m) => { if (ui.consoleOutput) { ui.consoleOutput.textContent += `\n${m}`; ui.consoleOutput.scrollTop = ui.consoleOutput.scrollHeight; } };
  const LINE_GUTTER_MIN_WIDTH = 64;

  function ensureLineGutter() {
    let lineGutter = document.getElementById('editorLineGutter');
    if (!lineGutter) {
      lineGutter = document.createElement('pre');
      lineGutter.id = 'editorLineGutter';
      lineGutter.className = 'editor-line-gutter';
      lineGutter.setAttribute('aria-hidden', 'true');
      codePane.appendChild(lineGutter);
    }
    ui.lineGutter = lineGutter;
  }

  ensureLineGutter();

  function splitEditorLines(text) {
    return String(text || '').split(/\r\n|\r|\n/);
  }

  function syncLineGutterWidth(lineCount) {
    const digits = String(Math.max(1, lineCount)).length;
    const width = Math.max(LINE_GUTTER_MIN_WIDTH, 26 + (digits * 9));
    const px = width + 'px';
    codePane.style.setProperty('--line-gutter-width', px);
    codePane.style.setProperty('--match-gutter-width', px);
    if (ui.lineGutter) ui.lineGutter.style.width = px;
  }

  // ----- metrics cloning (both layers) -----
  const METRIC_PROPS = [
    'font-family','font-size','font-weight','font-style','line-height','letter-spacing',
    'tab-size','text-rendering','-webkit-font-smoothing','font-variant-ligatures','font-kerning',
    'font-feature-settings','font-synthesis-weight','font-synthesis-style',
    'padding-top','padding-right','padding-bottom','padding-left',
    'border-top-width','border-right-width','border-bottom-width','border-left-width',
    'box-sizing','white-space','overflow-wrap','word-break'
  ];
  const GUTTER_METRIC_PROPS = [
    'font-family','font-size','font-weight','font-style','line-height','letter-spacing',
    'tab-size','text-rendering','-webkit-font-smoothing','font-variant-ligatures','font-kerning',
    'font-feature-settings','font-synthesis-weight','font-synthesis-style','box-sizing'
  ];
  function cloneMetrics() {
    const cs = getComputedStyle(ui.sourceInput);
    for (const p of METRIC_PROPS) {
      const v = cs.getPropertyValue(p);
      ui.highlightLayer.style.setProperty(p, v);
      ui.hitContent.style.setProperty(p, v);
    }
    if (ui.lineGutter) {
      for (const p of GUTTER_METRIC_PROPS) {
        ui.lineGutter.style.setProperty(p, cs.getPropertyValue(p));
      }
    }
    const w = ui.sourceInput.clientWidth, h = ui.sourceInput.clientHeight;
    ui.highlightLayer.style.width = w + 'px';  ui.highlightLayer.style.height = h + 'px';
    ui.hitContent.style.width = w + 'px'; ui.hitContent.style.height = h + 'px';
    if (ui.lineGutter) ui.lineGutter.style.height = h + 'px';
  }

  function renderLineNumbers() {
    if (!ui.lineGutter) return;
    const lineCount = Math.max(1, splitEditorLines(ui.sourceInput.value || '').length);
    syncLineGutterWidth(lineCount);
    const lines = [];
    for (let n = 1; n <= lineCount; n++) lines.push(String(n));
    ui.lineGutter.textContent = lines.join('\n') + '\n';
  }

  // ----- tokenizer / symbol collection -----
  function tokenize(text) {
    const out = [];
    let i = 0;
    let pos = 0;

    const push = (type, raw) => {
      out.push({ i: out.length, type, raw, start: pos, end: pos + raw.length });
      pos += raw.length;
    };

    while (i < text.length) {
      const ch = text[i];
      const next = text[i + 1] || '';

      if (ch === '/' && next === '/') {
        let j = i + 2;
        while (j < text.length && text[j] !== '\n') j++;
        push('cmt', text.slice(i, j));
        i = j;
        continue;
      }

      if (ch === '/' && next === '*') {
        let j = i + 2;
        while (j < text.length && !(text[j] === '*' && text[j + 1] === '/')) j++;
        j = Math.min(text.length, j + 2);
        push('cmt', text.slice(i, j));
        i = j;
        continue;
      }

      if (/\s/.test(ch)) {
        let j = i + 1;
        while (j < text.length && /\s/.test(text[j])) j++;
        push('ws', text.slice(i, j));
        i = j;
        continue;
      }

      if (text.slice(i, i + 2) === '->') {
        push('op', '->');
        i += 2;
        continue;
      }

      if ('|?:,'.includes(ch)) {
        push('op', ch);
        i += 1;
        continue;
      }

      if ('()'.includes(ch)) {
        push('par', ch);
        i += 1;
        continue;
      }

      if ('{}[]'.includes(ch)) {
        push('br', ch);
        i += 1;
        continue;
      }

      const numMatch = text.slice(i).match(/^-?\d+(?:\.\d+)?/);
      if (numMatch) {
        push('num', numMatch[0]);
        i += numMatch[0].length;
        continue;
      }

      const idMatch = text.slice(i).match(/^[A-Za-z_]\w*/);
      if (idMatch) {
        const raw = idMatch[0];
        push(SMART_EDITOR_KEYWORDS.has(raw) ? 'kw' : 'id', raw);
        i += raw.length;
        continue;
      }

      push('sym', ch);
      i += 1;
    }
    return out;
  }

  function collectSymbols(text) {
    const stripped = String(text || '')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ');
    const vars = new Set(), rules = new Set(); let m;
    const reRule = /(^|\n)\s*([A-Za-z_]\w*)\s*(?:\(\s*([A-Za-z_]\w*(?:[\s,]+[A-Za-z_]\w*)*)\s*\))?.*?->/g;
    while ((m = reRule.exec(stripped))) {
      rules.add(m[2]);
      if (m[3]) m[3].trim().split(/[\s,]+/).filter(Boolean).forEach((name) => vars.add(name));
    }
    return { vars, rules };
  }

  // ----- rule indexing + graph (defs, refs, active, reachable) -----
  function buildRuleIndex(text, tokens, ruleNames) {
    // Find each rule head token (id whose line contains '->' before newline)
    const heads = [];
    for (let k = 0; k < tokens.length; k++) {
      const t = tokens[k];
      if (t.type !== 'id' || !ruleNames.has(t.raw)) continue;

      const lineEnd = text.indexOf('\n', t.end);
      const arrowPos = text.indexOf('->', t.end);
      if (arrowPos !== -1 && (lineEnd === -1 || arrowPos < lineEnd)) {
        heads.push({ name: t.raw, k, arrowPos });
      }
    }
    // Determine body ranges and map name -> rule info
    const rules = [];
    for (let idx = 0; idx < heads.length; idx++) {
      const head = heads[idx];
      const nextHeadTok = heads[idx + 1]?.k;
      // body starts after '->' (allow newline directly after)
      let bodyStart = head.arrowPos + 2;
      if (text[bodyStart] === '\n') bodyStart++;
      let bodyEnd = text.length;
      if (nextHeadTok != null) {
        bodyEnd = tokens[nextHeadTok].start; // start of next head id
      }
      rules.push({
        name: head.name,
        defIndex: head.k,         // token index of definition id
        bodyStart,
        bodyEnd,
        refs: new Set(),
      });
    }
    const byName = new Map(rules.map(r => [r.name, r]));
    // Collect references inside bodies
    for (const r of rules) {
      for (const t of tokens) {
        if (t.start < r.bodyStart || t.start >= r.bodyEnd) continue;
        if (t.type === 'id' && ruleNames.has(t.raw) && t.i !== byName.get(t.raw)?.defIndex) {
          r.refs.add(t.raw);
        }
      }
    }
    return { list: rules, byName };
  }

  function caretActiveRule(text, tokens, ruleIdx, caret) {
    for (const r of ruleIdx.list) {
      const headStart = tokens[r.defIndex].start;
      const headEnd   = text.indexOf('\n', headStart) === -1 ? text.length : text.indexOf('\n', headStart);
      const inHead = caret >= headStart && caret <= headEnd;
      const inBody = caret >= r.bodyStart && caret < r.bodyEnd;
      if (inHead || inBody) return r.name;
    }
    // fallback to first defined rule
    return ruleIdx.list[0]?.name ?? null;
  }

  function reachableFrom(ruleIdx, startName) {
    const reach = new Set();
    if (!startName || !ruleIdx.byName.has(startName)) return reach;
    const q = [startName];
    while (q.length) {
      const n = q.shift();
      if (reach.has(n)) continue;
      reach.add(n);
      const r = ruleIdx.byName.get(n);
      if (!r) continue;
      for (const to of r.refs) if (!reach.has(to)) q.push(to);
    }
    return reach;
  }

  // ----- diagnostics (syntax-ish + spacing) -----
  function diagnosticsPlus(text, tokens) {
    const errors = [];
    const errIdx = new Set();
    const pushErr = (i, msg) => { if (!errIdx.has(i)) errors.push({ i, msg }); errIdx.add(i); };

    // A) Pair matching
    const stack = [];
    for (const t of tokens) {
      if (t.type === 'par' || t.type === 'br') {
        if (t.raw === '(' || t.raw === '[' || t.raw === '{') {
          stack.push(t);
        } else {
          const o = stack.pop();
          const ok =
            (o && o.raw === '(' && t.raw === ')') ||
            (o && o.raw === '[' && t.raw === ']') ||
            (o && o.raw === '{' && t.raw === '}');
          if (!ok) { pushErr(t.i, `Mismatched "${t.raw}"`); if (o) pushErr(o.i, `Mismatched "${o.raw}"`); }
        }
      }
    }
    for (const u of stack) pushErr(u.i, `Unclosed "${u.raw}"`);

    // B) Rule head must have '->' on same line (best-effort)
    const firstNonWSOnLine = (idx) => {
      // walk back to start of line
      let p = idx;
      while (p > 0 && text[p - 1] !== '\n') p--;
      // find first non-ws token at/after p
      for (const t of tokens) {
        if (t.end <= p) continue;
        if (t.start < p && t.end > p && t.type !== 'ws') return t; // spanning token (rare)
        if (t.start >= p && t.type !== 'ws') return t;
      }
      return null;
    };
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]; if (t.type !== 'id') continue;
      const first = firstNonWSOnLine(t.start);
      if (first && first.i === t.i) {
        let lineStart = t.start;
        while (lineStart > 0 && text[lineStart - 1] !== '\n') lineStart--;
        if (t.start !== lineStart) continue;
        const lineEnd = text.indexOf('\n', t.end);
        const arrowPos = text.indexOf('->', t.end);
        const hasArrow = (arrowPos !== -1 && (lineEnd === -1 || arrowPos < lineEnd));
        if (!hasArrow) pushErr(t.i, `Missing "->" after rule head "${t.raw}"`);
      }
    }

    return { errors, errIdx };
  }



// ==== NL diagnostics (robust, no-throw) ====
function grammarNLDiagnostics(text, visibleTokens /* SmartEditor tokens */){
  // If no lexer, or no text, bail safely
  if (typeof GrammarLexer !== 'function' || !text) return { errors: [] };

  // Get a token list from the lexer in a tolerant way
  let toks = [];
  try {
    const L = new GrammarLexer(text);
    if (Array.isArray(L.tokens)) {
      toks = L.tokens;
    } else if (typeof L.nextTok === 'function') {
      // Pull tokens until exhausted
      let t;
      while ((t = L.nextTok())) toks.push(t);
    } else {
      return { errors: [] };
    }
  } catch (_e) {
    return { errors: [] }; // never break the editor
  }

  // Normalize token shape: ensure .type, .value, .start
  for (const t of toks) {
    if (t && typeof t.start !== 'number') {
      // Try common alternates; else approximate with 0 (won't crash)
      t.start = (typeof t.pos === 'number') ? t.pos :
                (typeof t.s   === 'number') ? t.s   : 0;
    }
  }

  const errors = [];
  let depth = 0;

  const isIgn = t => t && (t.type === 'WS' || t.type === 'CMT' || t.type === 'NL');

  const prevSig = (k) => {
    for (let p = k - 1; p >= 0; p--) if (!isIgn(toks[p])) return toks[p];
    return null;
  };
  const nextSig = (k) => {
    for (let n = k + 1; n < toks.length; n++) if (!isIgn(toks[n])) return toks[n];
    return null;
  };

  // Helpers to map NL.start → nearest visible token index
  function previousVisibleOnOrBefore(vis, start){
    if (!Array.isArray(vis) || !vis.length) return -1;
    // binary search guard: ensure vis is monotonic by start
    // (tokenize() already produces monotonic start, so typical case is fine)
    let lo = 0, hi = vis.length - 1, ans = -1;
    while (lo <= hi){
      const mid = (lo + hi) >> 1;
      if (vis[mid].start <= start){ ans = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    return ans;
  }
  function nearestVisibleTokenIndex(vis, start){
    if (!Array.isArray(vis) || !vis.length) return -1;
    let lo = 0, hi = vis.length - 1, ans = -1;
    while (lo <= hi){
      const mid = (lo + hi) >> 1;
      if (vis[mid].start >= start){ ans = mid; hi = mid - 1; }
      else lo = mid + 1;
    }
    if (ans !== -1) return ans;
    return previousVisibleOnOrBefore(vis, start);
  }

  // Consider extra “friendly” NL allowances to reduce false positives:
  // - after '->'
  // - after/before '|'
  // - after any paren/bracket, or anywhere inside (...) depth>0
  // - start/end of file
  for (let i = 0; i < toks.length; i++){
    const t = toks[i];

    if (t.type === 'OP') {
      if (t.value === '(' || t.value === '[' || t.value === '{') depth++;
      if (t.value === ')' || t.value === ']' || t.value === '}') depth = Math.max(0, depth - 1);
    }

    if (t.type !== 'NL') continue;

    const prev = prevSig(i);
    const next = nextSig(i);

    const afterArrow = prev && prev.type === 'OP' && prev.value === '->';
    const afterBar   = prev && prev.type === 'OP' && prev.value === '|';
    const beforeBar  = next && next.type === 'OP' && next.value === '|';
    const afterParenOrBracket = prev && prev.type === 'OP' && (
      prev.value === '(' || prev.value === ')' || prev.value === '[' || prev.value === ']'
    );
    const atFileEdge = (!prev || !next);
    const insideParens = depth > 0;
const prevIsNLorWS = prev && (prev.type === 'NL' || prev.type === 'WS');
const nextIsNLorWS = next && (next.type === 'NL' || next.type === 'WS');
const emptyLine = prevIsNLorWS && nextIsNLorWS;

    const allowed = afterArrow || afterBar || beforeBar || afterParenOrBracket || insideParens || atFileEdge || emptyLine;

    if (!allowed) {
      const k = nearestVisibleTokenIndex(visibleTokens, t.start);
      if (k !== -1) {
        errors.push({ i: visibleTokens[k].i, msg: "Unexpected newline here" });
      } else {
        const j = previousVisibleOnOrBefore(visibleTokens, t.start);
        if (j !== -1) errors.push({ i: visibleTokens[j].i, msg: "Unexpected newline here" });
      }
    }
  }

  return { errors };
}


  // ----- full analysis (tokens + rules + errors + reachability) -----

  function analyze() {
  const text   = ui.sourceInput.value || '';
  const tokens = tokenize(text);                    // SmartEditor’s visible tokens (must have start/end)
  const { vars, rules } = collectSymbols(text);
  const ruleIdx         = buildRuleIndex(text, tokens, rules);
  const { errors, errIdx } = diagnosticsPlus(text, tokens);

  // NEW: NL policy errors from GrammarLexer
  const nlDiag = grammarNLDiagnostics(text, tokens);
  for (const e of nlDiag.errors) {
    // avoid duplicate messages on the same token index
    if (!errIdx.has(e.i)) {
      errors.push(e);
      errIdx.add(e.i);
    }
  }

  // active rule & reachability (unchanged)
  const caret = ui.sourceInput.selectionStart ?? 0;
  const entry = ruleIdx.byName.has('Start') ? 'Start' : (ruleIdx.list[0]?.name ?? null);
  const active = caretActiveRule(text, tokens, ruleIdx, caret);
  const reach  = reachableFrom(ruleIdx, entry);

  return { text, tokens, vars, rules, ruleIdx, errors, errIdx, entry, active, reach };
}

  // ----- renderers (visible and hit layers) -----
  function classifyRuleSpan(t, A) {
    // t is an id token; decide def/ref + reachability classes
    let cls = '';
    const defTokIndex = A.ruleIdx.byName.get(t.raw)?.defIndex;
    const isDef = defTokIndex === t.i;
    if (isDef) cls += ' se-rule-def';
    else       cls += ' se-rule-ref';
    if (A.reach.has(t.raw)) cls += ' se-reach';
    else                    cls += ' se-unreach';
    if (isDef && A.active === t.raw) cls += ' se-active';
    return cls;
  }

  function renderLayer(targetEl, A) {
    const errMsgByIndex = new Map(A.errors.map(e => [e.i, e.msg]));
    let html = '';
    for (const t of A.tokens) {
      if (t.type === 'ws' || t.type === 'cmt') { html += escapeHtml(t.raw); continue; }

      let cls = 'tok-op';
      switch (t.type) {
        case 'cmt': cls = 'tok-cmt'; break;
        case 'kw':  cls = 'tok-kw';    break;
        case 'num': cls = 'tok-num';   break;
        case 'par': cls = 'tok-paren'; break;
        case 'br':  cls = 'tok-brack'; break;
        case 'id':  cls = A.rules.has(t.raw) ? 'tok-rule' : 'tok-var'; break;
      }
      if (A.errIdx.has(t.i)) cls += ' err-squiggle';
      if (t.type === 'id' && (A.rules.has(t.raw))) cls += classifyRuleSpan(t, A);

      const msg = errMsgByIndex.get(t.i);
      const ds  = ` data-type="${t.type}" data-i="${t.i}" data-s="${t.start}" data-e="${t.end}"` +
                  (msg ? ` data-err="${escapeHtml(msg)}"` : '');
      html += `<span class="${cls}"${ds}>${escapeHtml(t.raw)}</span>`;
    }
    targetEl.innerHTML = html + '\n';
  }

  function renderBoth() {
    const A = analyze();
    renderLineNumbers();
    renderLayer(ui.highlightLayer, A);
    renderLayer(ui.hitContent, A);

    const status = document.getElementById('status');
    if (status) {
      const n = A.errors.length;
      const reachInfo = A.entry
        ? ` · Entry: ${A.entry}${A.active && A.active !== A.entry ? ` · Active: ${A.active}` : ''} · Reachable: ${A.reach.size}`
        : '';
      status.textContent = n ? `⚠ ${n} issue${n>1?'s':''}${reachInfo}` : `Ready.${reachInfo}`;
    }
  }

  // ----- scroll & wrap sync -----
  function syncScroll() {
    const t = -ui.sourceInput.scrollTop + 'px';
    const l = -ui.sourceInput.scrollLeft + 'px';
    ui.highlightLayer.style.top = t;   ui.highlightLayer.style.left = l;
    ui.hitContent.style.top = t; ui.hitContent.style.left = l;
    if (ui.lineGutter) {
      ui.lineGutter.style.top = '0px';
      ui.lineGutter.style.left = '0px';
      ui.lineGutter.scrollTop = ui.sourceInput.scrollTop;
    }
  }
  function setWrap(on) {
    if (ui.wordWrapButton) ui.wordWrapButton.textContent = on ? 'Wrap: On' : 'Wrap: Off';
    document.body.classList.toggle('wrap-on', !!on);
    ui.sourceInput.setAttribute('wrap', on ? 'soft' : 'off');
    ui.sourceInput.style.whiteSpace = on ? 'pre-wrap' : 'pre';
    ui.highlightLayer.style.whiteSpace = on ? 'pre-wrap' : 'pre';
    ui.hitContent.style.whiteSpace = on ? 'pre-wrap' : 'pre';
    if (on) ui.sourceInput.scrollLeft = 0;
    requestPaint('wrap');
  }

  // ----- tooltip (errors take precedence) -----
  function spanAtPoint(x, y) {
    ui.hitLayer.style.pointerEvents = 'auto';
    const el = document.elementFromPoint(x, y);
    ui.hitLayer.style.pointerEvents = 'none';
    return (el && el.tagName === 'SPAN' && el.closest('#editorHitLayerContent')) ? el : null;
  }
function showTipForSpan(span, clientX, clientY) {
  const err = span.dataset.err;
  const type = span.dataset.type;
  const raw  = span.textContent;

  let msg = err;
  if (!msg) {
    if (type === "kw") {
      msg = GRAMMAR_TOOLTIPS[raw] || `Keyword: ${raw}`;
    } else {
      switch (type) {
        case "num": msg = `Number: ${raw}`; break;
        case "id":  msg = `Identifier: ${raw}`; break;
        case "op":  msg = `Operator: ${raw}`; break;
        case "par": msg = `Parenthesis: ${raw}`; break;
        case "br":  msg = `Bracket: ${raw}`; break;
        default:    msg = raw; break;
      }
    }
  }

  ui.tooltip.textContent = msg;
  ui.tooltip.classList.toggle("is-error", !!err);

  const pad = 10;
  ui.tooltip.style.left = (clientX + pad) + "px";
  ui.tooltip.style.top  = (clientY + pad + 8) + "px";
  ui.tooltip.style.display = "block";
}
  function hideTip() { ui.tooltip.style.display = 'none'; }

  // ----- paint pipeline -----
  let raf = 0;
  function requestPaint(reason) {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      cloneMetrics();
      renderBoth();
      syncScroll();
      // log(`[SE repaint] ${reason}`);
    });
  }

  // ----- events (bound once) -----
  ui.sourceInput.addEventListener('input', () => requestPaint('input'));
  ui.sourceInput.addEventListener('scroll', () => { syncScroll(); hideTip(); }, { passive: true });
  window.addEventListener('resize', () => requestPaint('resize'));
  if ('ResizeObserver' in window) new ResizeObserver(() => requestPaint('resize-observer')).observe(ui.sourceInput);

  // update reachability on caret moves too
  ui.sourceInput.addEventListener('keyup',  () => requestPaint('caret'));
  ui.sourceInput.addEventListener('click',  () => requestPaint('caret'));
  ui.sourceInput.addEventListener('blur',   hideTip);

  if (ui.wordWrapButton) {
    let wrapped = document.body.classList.contains('wrap-on');
    ui.wordWrapButton.addEventListener('click', () => { wrapped = !wrapped; setWrap(wrapped); });
  }

  // hover/tips
  codePane.addEventListener('mousemove', (e) => {
    const span = spanAtPoint(e.clientX, e.clientY);
    if (span) showTipForSpan(span, e.clientX, e.clientY);
    else hideTip();
  });
  codePane.addEventListener('mouseleave', hideTip);
  codePane.addEventListener('mousedown', () => { ui.hitLayer.style.pointerEvents = 'none'; }, true);
  codePane.addEventListener('mouseup',   () => { ui.hitLayer.style.pointerEvents = 'none'; }, true);

  // ----- public API (optional) -----
  window.SmartEditor = {
    refresh: () => requestPaint('api-refresh'),
    setWrap,
    analyze, // expose for debugging
  };

  // ----- boot -----
  setWrap(false);
  requestPaint('init');
  console.info('[SmartEditor] Ready.');
})();

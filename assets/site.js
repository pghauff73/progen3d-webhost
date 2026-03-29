(function () {
  const TOUR_KEY = 'p3d_site_tour_state_v1';
  let tourRoot = null;
  let tourTarget = null;
  let tourTimer = null;
  let currentUtterance = null;
  let tourScrollFrame = null;
  let tourStepDuration = 0;
  let tourStepElapsedBeforePause = 0;
  let tourStepStartedAt = 0;
  let tourScrollFrom = 0;
  let tourScrollTo = 0;

  function copyText(text, button) {
    if (!navigator.clipboard) {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      return announceCopied(button);
    }
    navigator.clipboard.writeText(text).then(function () {
      announceCopied(button);
    }).catch(function () {});
  }

  function announceCopied(button) {
    if (!button) return;
    const original = button.getAttribute('data-copy-label') || button.textContent;
    button.textContent = 'Copied';
    window.setTimeout(function () {
      button.textContent = original;
    }, 1400);
  }

  function initPasswordToggles() {
    document.querySelectorAll('.js-password-toggle').forEach(function (button) {
      button.addEventListener('click', function () {
        const field = button.closest('.password-field');
        const input = field ? field.querySelector('input') : null;
        if (!input) return;
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        button.setAttribute('aria-pressed', showing ? 'false' : 'true');
        button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      });
    });
  }

  function applyEmbeddedViewerChrome(doc) {
    if (!doc || !doc.head) return;
    if (!doc.getElementById('pg3d-embed-viewer-style')) {
      const style = doc.createElement('style');
      style.id = 'pg3d-embed-viewer-style';
      style.textContent = [
        'html, body { height: 100% !important; overflow: hidden !important; }',
        '#pg3d-hero, .app-footer, .status-strip, .editor-live-status, .match-topbar, #editorLocalSaveBtn, #editorOpenJsonBtn, #editorExportJsonBtn, #editorFileNameInput, #editorFileSelect, #debugToggleWrap { display: none !important; }',
        'body { background: #0b1120 !important; }',
        '.app-shell { padding-top: 0 !important; min-height: 100vh !important; }',
        '.wrap, .editor-workspace { padding-top: 0 !important; display: block !important; min-height: 100vh !important; height: 100vh !important; grid-template: none !important; }',
        '.input-card, .output-card, .layout-splitter { display: none !important; }',
        '.viewer-card { margin: 0 !important; min-height: 100vh !important; border-radius: 0 !important; border: 0 !important; padding-top: 0 !important; }',
        '.viewer-card > header { display: none !important; }',
        '.viewer-card .body, .viewer-body, .viewer-stage, .editor-viewer-stage { min-height: 100vh !important; height: 100vh !important; padding: 0 !important; margin: 0 !important; }',
        '#glcanvas { width: 100% !important; height: 100% !important; }'
      ].join('\n');
      doc.head.appendChild(style);
    }

    if (doc.body) {
      doc.body.classList.remove('layout-match-active', 'layout-resizing');
    }

    doc.querySelectorAll('.match-topbar').forEach(function (node) {
      node.remove();
    });

    const viewerCard = doc.querySelector('.viewer-card');
    const viewerBody = doc.querySelector('.viewer-card .body, .viewer-body');
    const viewerStage = doc.querySelector('.viewer-stage, .editor-viewer-stage');
    if (viewerCard) {
      viewerCard.style.margin = '0';
      viewerCard.style.border = '0';
      viewerCard.style.borderRadius = '0';
      viewerCard.style.padding = '0';
      viewerCard.style.minHeight = '100vh';
    }
    if (viewerBody) {
      viewerBody.style.padding = '0';
      viewerBody.style.margin = '0';
      viewerBody.style.height = '100vh';
      viewerBody.style.minHeight = '100vh';
    }
    if (viewerStage) {
      viewerStage.style.padding = '0';
      viewerStage.style.margin = '0';
      viewerStage.style.height = '100vh';
      viewerStage.style.minHeight = '100vh';
    }
  }

  window.PG3DSiteEmbed = Object.assign({}, window.PG3DSiteEmbed, {
    applyEmbeddedViewerChrome: applyEmbeddedViewerChrome
  });

  function normalizeGrammarText(text) {
    return String(text || '').replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
  }

  function extractDefinedRuleNames(text) {
    const names = new Set();
    const re = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\([^)]*\))?(?:\s+[^-\r\n][^\r\n]*)?\s*->/gm;
    let match;
    while ((match = re.exec(text))) {
      names.add(match[1]);
    }
    return names;
  }

  function extractDefinedRuleEntries(text) {
    const entries = [];
    const re = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\([^)]*\))?(?:\s+[^-\r\n][^\r\n]*)?\s*->/gm;
    let match;
    while ((match = re.exec(text))) {
      const before = String(text || '').slice(0, match.index);
      const lines = before.split(/\r\n|\r|\n/);
      const line = lines.length;
      const col = (lines[lines.length - 1] || '').length + 1;
      entries.push({
        name: match[1],
        line: line,
        col: col,
      });
    }
    return entries;
  }

  function hasRuleReference(text, ruleName) {
    const escaped = ruleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(?:^|[\\s\\[\\]:|])' + escaped + '(?:\\s*\\(|(?=[\\s\\]\\[:|)]|$))', 'm');
    return re.test(text);
  }

  function prepareBuiltinGrammar(ruleName, grammarText) {
    const grammar = normalizeGrammarText(grammarText).trim();
    if (!grammar) return '';
    if (!/\bStart\b/.test(grammar) || !ruleName || ruleName === 'Start') {
      return grammar;
    }
    return grammar.replace(/\bStart\b/g, ruleName);
  }

  const builtinRuleResolvePromises = {};

  function getBuiltinRuleLibrary() {
    const library = window.PG3DBuiltinRuleLibrary;
    return library && typeof library === 'object' ? library : {};
  }

  async function ensureBuiltinRulesResolved(ruleNames) {
    const library = getBuiltinRuleLibrary();
    const missingRuleNames = Array.isArray(ruleNames)
      ? ruleNames.filter(function (ruleName) {
          const record = library.rulesByEntryRule && library.rulesByEntryRule[ruleName];
          return !prepareBuiltinGrammar(ruleName, record && record.grammar ? record.grammar : '');
        })
      : [];

    if (!missingRuleNames.length) {
      return library;
    }

    const cacheKey = missingRuleNames.slice().sort().join(',');
    if (!builtinRuleResolvePromises[cacheKey]) {
      builtinRuleResolvePromises[cacheKey] = fetch('api/builtin_rules.php?action=resolve', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ entry_rules: missingRuleNames })
      }).then(function (response) {
        return response.text().then(function (raw) {
          let data = null;
          try {
            data = raw ? JSON.parse(raw) : null;
          } catch (error) {
            throw new Error(raw || 'Builtin rule request failed');
          }
          if (!response.ok || !data || !data.ok || !data.rulesByEntryRule) {
            throw new Error((data && data.error) || 'Builtin rule request failed');
          }
          const nextLibrary = Object.assign({}, library);
          nextLibrary.rulesByEntryRule = Object.assign({}, library.rulesByEntryRule || {}, data.rulesByEntryRule);
          window.PG3DBuiltinRuleLibrary = nextLibrary;
          return nextLibrary;
        });
      }).finally(function () {
        delete builtinRuleResolvePromises[cacheKey];
      });
    }

    return builtinRuleResolvePromises[cacheKey];
  }

  function augmentGrammarWithBuiltinRulesInternal(sourceText, rulesByEntryRule) {
    const source = normalizeGrammarText(sourceText);
    const definedEntries = extractDefinedRuleEntries(source);
    const collision = definedEntries.find(function (entry) {
      return Object.prototype.hasOwnProperty.call(rulesByEntryRule, entry.name);
    });
    if (collision) {
      const error = new Error('Builtin rule name collision @' + collision.line + ':' + collision.col + ': ' + collision.name + ' is reserved by the builtin rule library.');
      error.line = collision.line;
      error.col = collision.col;
      throw error;
    }
    const includedRuleNames = [];
    const missingRuleNames = [];
    const includedGrammarParts = [];
    const includedSet = new Set();
    const missingSet = new Set();
    let scanText = source;

    while (true) {
      let added = false;
      const definedRuleNames = extractDefinedRuleNames(scanText);
      Object.keys(rulesByEntryRule).forEach(function (ruleName) {
        if (added || includedSet.has(ruleName) || definedRuleNames.has(ruleName)) return;
        if (!hasRuleReference(scanText, ruleName)) return;
        const record = rulesByEntryRule[ruleName] || {};
        const grammar = prepareBuiltinGrammar(ruleName, record.grammar || '');
        if (!grammar) {
          if (!missingSet.has(ruleName)) {
            missingSet.add(ruleName);
            missingRuleNames.push(ruleName);
          }
          return;
        }
        includedSet.add(ruleName);
        includedRuleNames.push(ruleName);
        includedGrammarParts.push('/* BUILTIN RULE: ' + ruleName + ' */\n' + grammar);
        scanText = scanText + '\n\n' + grammar;
        added = true;
      });
      if (!added) break;
    }

    return {
      source: source,
      effectiveText: includedGrammarParts.length ? source + '\n\n' + includedGrammarParts.join('\n\n') : source,
      includedRuleNames: includedRuleNames,
      missingRuleNames: missingRuleNames,
    };
  }

  async function augmentGrammarWithBuiltinRules(sourceText) {
    const library = getBuiltinRuleLibrary();
    const rulesByEntryRule = library.rulesByEntryRule && typeof library.rulesByEntryRule === 'object'
      ? library.rulesByEntryRule
      : {};
    const source = normalizeGrammarText(sourceText);
    const initialResult = augmentGrammarWithBuiltinRulesInternal(source, rulesByEntryRule);
    const missingBuiltinGrammar = Array.isArray(initialResult.missingRuleNames) && initialResult.missingRuleNames.length > 0;

    if (!missingBuiltinGrammar) {
      return initialResult;
    }

    const resolvedLibrary = await ensureBuiltinRulesResolved(initialResult.missingRuleNames);
    const resolvedRules = resolvedLibrary.rulesByEntryRule && typeof resolvedLibrary.rulesByEntryRule === 'object'
      ? resolvedLibrary.rulesByEntryRule
      : {};
    return augmentGrammarWithBuiltinRulesInternal(source, resolvedRules);
  }

  window.PG3DBuiltinRules = Object.assign({}, window.PG3DBuiltinRules, {
    ensureRulesResolved: ensureBuiltinRulesResolved,
    augmentGrammar: augmentGrammarWithBuiltinRules,
  });

  function pageName() {
    return document.body.dataset.page || 'page';
  }

  function isAuthed() {
    return document.body.dataset.auth === '1';
  }

  function getTourSteps() {
    const steps = [
      {
        id: 'home-hero',
        page: 'home',
        url: 'index.php',
        selector: '.hero-main',
        title: 'Welcome to ProGen3D Live Site',
        text: 'This hero section introduces the live workflow. From here you can open the editor, browse published work, and move through the site in a clear sequence.'
      },
      {
        id: 'home-launchpad',
        page: 'home',
        url: 'index.php',
        selector: '.launchpad-grid',
        title: 'Launch points',
        text: 'This row is the fastest way to move between writing grammars, organising files, previewing public work, and reading the built-in documentation.'
      },
      {
        id: 'docs',
        page: 'docs',
        url: 'docs.php',
        selector: '.docs-grid',
        title: 'Documentation',
        text: 'The documentation page explains how the bundled live site works, from editing and saving through to publishing and viewing scenes.'
      },
      {
        id: 'reference',
        page: 'reference',
        url: 'reference.php',
        selector: '.reference-grid',
        title: 'Reference',
        text: 'The reference page collects operator summaries and syntax reminders so you can keep the language details close to the editor.'
      },
      {
        id: 'examples',
        page: 'examples',
        url: 'examples.php',
        selector: '.example-grid',
        title: 'Examples',
        text: 'Examples give you copy-ready starting points that can be pasted into the editor or opened directly for experimentation.'
      },
      {
        id: 'gallery',
        page: 'gallery',
        url: 'gallery.php',
        selector: '.gallery-live-panel, .file-grid',
        title: 'Gallery',
        text: 'The gallery previews published grammars in a live scene viewer, cycles through work automatically, and lets you reopen public pieces in the full viewer or the editor.'
      }
    ];

    if (isAuthed()) {
      steps.push(
        {
          id: 'files',
          page: 'files',
          url: 'files.php',
          selector: '.file-grid',
          title: 'My Files',
          text: 'Your private file library keeps saved drafts, publish state, and quick actions together so work can move cleanly from experiment to public piece.'
        },
        {
          id: 'editor',
          page: 'editor',
          url: 'editor.php',
          selector: '.editor-layout',
          title: 'Inline editor',
          text: 'The editor pairs the grammar input with the live scene viewer and console, so you can run, inspect, save, and publish from one workspace.'
        }
      );
    } else {
      steps.push({
        id: 'register',
        page: 'register',
        url: 'register.php',
        selector: '.auth-grid',
        title: 'Create an account',
        text: 'Registering unlocks private files, publishing, and the full live editing workflow.'
      });
    }

    return steps;
  }

  function loadTourState() {
    try {
      const raw = window.localStorage.getItem(TOUR_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function saveTourState(state) {
    try {
      window.localStorage.setItem(TOUR_KEY, JSON.stringify(state));
    } catch (error) {}
  }

  function clearTourState() {
    try {
      window.localStorage.removeItem(TOUR_KEY);
    } catch (error) {}
  }

  function clearTourTimer() {
    if (tourTimer) {
      window.clearTimeout(tourTimer);
      tourTimer = null;
    }
  }

  function stopSpeech() {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch (error) {}
    currentUtterance = null;
  }

  function speechDurationMs(text) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
    return Math.min(18000, Math.max(6200, words * 430));
  }

  function makeTourUi() {
    if (tourRoot) return tourRoot;
    const root = document.createElement('aside');
    root.className = 'site-tour';
    root.hidden = true;
    root.innerHTML = [
      '<div class="site-tour__veil"></div>',
      '<div class="site-tour__panel" role="dialog" aria-live="polite" aria-label="Interactive site tour">',
      '  <span class="site-tour__eyebrow">Interactive site tour</span>',
      '  <h2 class="site-tour__title"></h2>',
      '  <p class="site-tour__text"></p>',
      '  <div class="site-tour__meta">',
      '    <span class="site-tour__count"></span>',
      '    <span class="site-tour__audio">Narration enabled</span>',
      '  </div>',
      '  <div class="site-tour__progress"><span class="site-tour__progress-bar"></span></div>',
      '  <div class="site-tour__controls">',
      '    <button class="btn btn-secondary btn-sm" type="button" data-tour-prev>Previous</button>',
      '    <button class="btn btn-secondary btn-sm" type="button" data-tour-pause>Pause</button>',
      '    <button class="btn btn-primary btn-sm" type="button" data-tour-next>Next</button>',
      '    <button class="btn btn-ghost btn-sm" type="button" data-tour-stop>End tour</button>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(root);
    root.querySelector('[data-tour-prev]').addEventListener('click', function () {
      moveTour(-1);
    });
    root.querySelector('[data-tour-next]').addEventListener('click', function () {
      moveTour(1);
    });
    root.querySelector('[data-tour-pause]').addEventListener('click', function () {
      togglePauseTour();
    });
    root.querySelector('[data-tour-stop]').addEventListener('click', function () {
      stopTour();
    });
    tourRoot = root;
    return root;
  }

  function clearTargetHighlight() {
    if (tourTarget) {
      tourTarget.classList.remove('tour-target');
      tourTarget = null;
    }
  }

  function resolveTourTarget(selector) {
    if (!selector) return document.querySelector('main') || document.body;
    const parts = selector.split(',').map(function (part) { return part.trim(); }).filter(Boolean);
    for (let i = 0; i < parts.length; i += 1) {
      const node = document.querySelector(parts[i]);
      if (node) return node;
    }
    return document.querySelector('main') || document.body;
  }

  function easeInOutQuad(t) {
    return t < 0.5 ? (2 * t * t) : (1 - Math.pow(-2 * t + 2, 2) / 2);
  }

  function pageScrollTop() {
    return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  function maxPageScroll() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function clearTourScrollAnimation() {
    if (tourScrollFrame) {
      window.cancelAnimationFrame(tourScrollFrame);
      tourScrollFrame = null;
    }
  }

  function setTourScrollPosition(progress) {
    const clamped = Math.max(0, Math.min(1, progress));
    const eased = easeInOutQuad(clamped);
    const y = tourScrollFrom + ((tourScrollTo - tourScrollFrom) * eased);
    window.scrollTo(0, y);
  }

  function animateTourScroll() {
    clearTourScrollAnimation();
    if (tourStepDuration <= 0 || tourScrollTo <= tourScrollFrom) return;
    tourStepStartedAt = performance.now();

    function frame(now) {
      const elapsed = tourStepElapsedBeforePause + (now - tourStepStartedAt);
      const progress = Math.min(1, elapsed / tourStepDuration);
      setTourScrollPosition(progress);
      if (progress < 1) {
        tourScrollFrame = window.requestAnimationFrame(frame);
      } else {
        tourScrollFrame = null;
      }
    }

    tourScrollFrame = window.requestAnimationFrame(frame);
  }

  function prepareTourScroll(durationMs, resetToTop) {
    clearTourScrollAnimation();
    tourStepDuration = Math.max(1, durationMs || 1);
    tourStepElapsedBeforePause = 0;
    if (resetToTop) {
      window.scrollTo(0, 0);
    }
    tourScrollFrom = 0;
    tourScrollTo = maxPageScroll();
    setTourScrollPosition(0);
    animateTourScroll();
  }

  function pauseTourScroll() {
    if (tourStepDuration <= 0) return;
    if (tourScrollFrame) {
      tourStepElapsedBeforePause += Math.max(0, performance.now() - tourStepStartedAt);
    } else if (tourScrollTo > 0) {
      const currentProgress = Math.max(0, Math.min(1, pageScrollTop() / Math.max(1, tourScrollTo)));
      tourStepElapsedBeforePause = Math.max(tourStepElapsedBeforePause, currentProgress * tourStepDuration);
    }
    clearTourScrollAnimation();
  }

  function resumeTourScroll() {
    if (tourStepDuration <= 0 || tourScrollTo <= tourScrollFrom) return;
    animateTourScroll();
  }

  function stopTourScroll() {
    clearTourScrollAnimation();
    tourStepDuration = 0;
    tourStepElapsedBeforePause = 0;
    tourStepStartedAt = 0;
    tourScrollFrom = 0;
    tourScrollTo = 0;
  }

  function updateTourUi(state, step, index, steps) {
    const root = makeTourUi();
    root.hidden = false;
    root.classList.toggle('site-tour--paused', !!state.paused);
    root.querySelector('.site-tour__title').textContent = step.title;
    root.querySelector('.site-tour__text').textContent = step.text;
    root.querySelector('.site-tour__count').textContent = 'Step ' + (index + 1) + ' of ' + steps.length;
    root.querySelector('.site-tour__audio').textContent = ('speechSynthesis' in window)
      ? (state.paused ? 'Narration paused · page scroll paused' : 'Narration enabled · page scroll guided')
      : 'Narration unavailable in this browser · page scroll guided';
    root.querySelector('[data-tour-pause]').textContent = state.paused ? 'Resume' : 'Pause';
    root.querySelector('.site-tour__progress-bar').style.width = (((index + 1) / steps.length) * 100).toFixed(2) + '%';
  }

  function speakStep(step, state) {
    if (!('speechSynthesis' in window) || state.paused) return;
    stopSpeech();
    const spoken = step.title + '. ' + step.text;
    currentUtterance = new SpeechSynthesisUtterance(spoken);
    currentUtterance.rate = 1.02;
    currentUtterance.pitch = 1.0;
    currentUtterance.volume = 1.0;
    try {
      window.speechSynthesis.speak(currentUtterance);
    } catch (error) {}
  }

  function scheduleTourAdvance(step, state) {
    clearTourTimer();
    if (state.paused) return;
    const remainingMs = Math.max(450, speechDurationMs(step.title + ' ' + step.text) - tourStepElapsedBeforePause);
    tourTimer = window.setTimeout(function () {
      moveTour(1);
    }, remainingMs);
  }

  function renderTourStep() {
    const state = loadTourState();
    if (!state || !state.active) return;

    const steps = getTourSteps();
    const index = Math.max(0, Math.min(state.index || 0, steps.length - 1));
    const step = steps[index];
    if (!step) {
      stopTour();
      return;
    }

    if (pageName() !== step.page) {
      window.location.href = step.url + '#tour';
      return;
    }

    clearTargetHighlight();
    const target = resolveTourTarget(step.selector);
    target.classList.add('tour-target');
    tourTarget = target;

    updateTourUi(state, step, index, steps);

    const duration = speechDurationMs(step.title + ' ' + step.text);
    prepareTourScroll(duration, true);
    speakStep(step, state);
    scheduleTourAdvance(step, state);
  }

  function startTour() {
    const state = { active: true, paused: false, index: 0 };
    saveTourState(state);
    if (pageName() !== 'home') {
      window.location.href = 'index.php#tour';
      return;
    }
    renderTourStep();
  }

  function stopTour() {
    clearTourTimer();
    stopSpeech();
    stopTourScroll();
    clearTargetHighlight();
    clearTourState();
    const root = makeTourUi();
    root.hidden = true;
  }

  function moveTour(delta) {
    const state = loadTourState();
    if (!state || !state.active) return;
    const steps = getTourSteps();
    const nextIndex = state.index + delta;
    if (nextIndex < 0) {
      state.index = 0;
    } else if (nextIndex >= steps.length) {
      stopTour();
      return;
    } else {
      state.index = nextIndex;
    }
    state.paused = false;
    saveTourState(state);
    renderTourStep();
  }

  function togglePauseTour() {
    const state = loadTourState();
    if (!state || !state.active) return;
    state.paused = !state.paused;
    saveTourState(state);
    clearTourTimer();

    if ('speechSynthesis' in window) {
      try {
        if (state.paused) {
          if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
            window.speechSynthesis.pause();
          }
        } else if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (error) {}
    }

    if (state.paused) {
      pauseTourScroll();
    } else {
      const steps = getTourSteps();
      const index = Math.max(0, Math.min(state.index || 0, steps.length - 1));
      const step = steps[index];
      if (step) {
        if ('speechSynthesis' in window) {
          try {
            if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
              speakStep(step, state);
            }
          } catch (error) {
            speakStep(step, state);
          }
        }
        resumeTourScroll();
        scheduleTourAdvance(step, state);
      }
    }

    const steps = getTourSteps();
    const index = Math.max(0, Math.min(state.index || 0, steps.length - 1));
    const step = steps[index];
    if (step) {
      updateTourUi(state, step, index, steps);
    }
  }

  window.addEventListener('DOMContentLoaded', function () {
    initPasswordToggles();

    document.querySelectorAll('[data-copy-text]').forEach(function (button) {
      button.setAttribute('data-copy-label', button.textContent);
      button.addEventListener('click', function () {
        copyText(button.getAttribute('data-copy-text') || '', button);
      });
    });

    document.querySelectorAll('[data-copy-target]').forEach(function (button) {
      button.setAttribute('data-copy-label', button.textContent);
      button.addEventListener('click', function () {
        const target = document.querySelector(button.getAttribute('data-copy-target'));
        if (!target) return;
        copyText(target.textContent || target.innerText || '', button);
      });
    });

    document.querySelectorAll('.js-site-tour-launch').forEach(function (button) {
      button.addEventListener('click', function () {
        startTour();
      });
    });

    const state = loadTourState();
    if (state && state.active) {
      renderTourStep();
    }
  });

  window.addEventListener('beforeunload', function () {
    clearTourTimer();
    stopSpeech();
    stopTourScroll();
  });
})();

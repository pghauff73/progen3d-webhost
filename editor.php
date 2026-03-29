<?php
/* progen3d-editor-single-runtime */
require __DIR__ . '/includes/bootstrap.php';
require_login();
$user = current_user();
$creditSummary = firebase_credit_summary($user);
$builtinRuleLibrary = firebase_builtin_rule_library_payload(false);
$initialFileId = trim((string) ($_GET['file'] ?? ''));
$copyFileId = trim((string) ($_GET['copy'] ?? ''));
$example = site_example_by_slug($_GET['example'] ?? '');
$editorAssetVersion = '20260315-resizable-panes';
$editorHead = str_replace('{{v}}', $editorAssetVersion, <<<'HTML'
<link rel="stylesheet" href="assets/editor/css/editor.css?v={{v}}">
<link rel="stylesheet" href="assets/editor/css/editor-layout-target.css?v={{v}}">
<link rel="stylesheet" href="assets/editor/css/editor-diagnostics.css?v={{v}}">
<link rel="stylesheet" href="assets/editor/css/editor-integrated-page.css?v={{v}}">
HTML
);
render_header('Editor', 'editor', ['body_class' => 'editor-integrated-page', 'extra_head' => $editorHead]);
?>
<style>
  body.editor-integrated-page:not([data-editor-loaded="1"]) .editor-page-shell {
    visibility: hidden;
  }
  body.editor-integrated-page:not([data-editor-loaded="1"]) #editorLoadingScreen {
    opacity: 1;
  }
  #editorLoadingScreen {
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: grid;
    place-items: center;
    background: linear-gradient(180deg, #050816, #0b1120);
    color: #dbeafe;
    letter-spacing: 0.04em;
    font: 600 0.95rem/1.4 ui-sans-serif, system-ui, sans-serif;
    transition: opacity .18s ease;
    pointer-events: none;
  }
</style>
<div id="editorLoadingScreen" aria-live="polite">Loading editor…</div>
<main class="editor-page-shell">
  <div id="editorTopbarRail" class="editor-topbar-rail" aria-hidden="true"></div>
  <div id="editorTopbarScrim" class="editor-topbar-scrim" hidden></div>
  <section class="site-shell editor-topbar editor-topbar--compact">
    <div class="editor-topbar__main">
      <a class="brand" href="index.php">
        <span class="brand-mark">P3D</span>
        <span>
          <strong>ProGen3D</strong>
          <small>Live grammar studio</small>
        </span>
      </a>
    </div>
    <nav class="editor-topbar__meta site-nav" aria-label="Primary navigation">
      <a href="index.php">Home</a>
      <a href="docs.php">Docs</a>
      <a href="reference.php">Reference</a>
      <a href="examples.php">Examples</a>
      <a href="gallery.php">Gallery</a>
      <a class="active" href="editor.php">Editor</a>
      <a href="files.php"><?= is_admin($user) ? 'All Files' : 'My Files' ?></a>
      <a href="account.php">Account</a>
      <?php if (is_admin($user)): ?>
        <a href="BuiltinRuleLibrary.php">Builtin Rules</a>
        <a href="admin.php">Admin</a>
      <?php endif; ?>
      <span class="nav-pill nav-pill--credits" data-site-credits data-credit-label="AI Credits">
        <strong data-site-credits-available><?= e((string) ($creditSummary['available'] ?? 0)) ?></strong>
        <span data-site-credits-detail><?= !empty($creditSummary['reserved']) ? e((string) ($creditSummary['reserved'] ?? 0)) . ' reserved' : 'available' ?></span>
      </span>
      <a class="nav-pill" href="logout.php">Logout · <?= e($user['username']) ?></a>
    </nav>
  </section>

  <section class="site-shell editor-layout editor-layout--refined">
    <div id="editorSidebarRail" class="editor-sidebar-rail" aria-hidden="true"></div>
    <div id="editorSidebarScrim" class="editor-sidebar-scrim" hidden></div>
    <div id="editorSecondaryRail" class="editor-secondary-rail" aria-hidden="true"></div>
    <div id="editorSecondaryScrim" class="editor-secondary-scrim" hidden></div>
    <aside id="editorSidebar" class="editor-sidebar panel">
      <div class="sidebar-section sidebar-section--file">
        <span class="sidebar-kicker">Project</span>
        <label>Title
          <input id="siteFileTitle" type="text" maxlength="160" placeholder="Untitled grammar">
        </label>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section__head">
          <h2>Actions</h2>
          <span class="sidebar-caption">Draft, run, and publish</span>
        </div>
        <div class="stack-actions stack-actions--grid">
          <button id="newFileBtn" class="btn btn-secondary" type="button">New</button>
          <button id="runGrammarBtn" class="btn btn-secondary" type="button">Run</button>
          <button id="saveGrammarBtn" class="btn btn-primary" type="button">Save</button>
          <button id="publishGrammarBtn" class="btn btn-primary" type="button">Publish</button>
          <button id="unpublishGrammarBtn" class="btn btn-secondary stack-actions__wide" type="button">Unpublish</button>
          <?php if (is_admin($user)): ?>
            <button id="publishBuiltinRuleBtn" class="btn btn-secondary stack-actions__wide" type="button">Publish Builtin Rule</button>
          <?php endif; ?>
        </div>
      </div>

      <div class="sidebar-section sidebar-section--status">
        <div class="sidebar-section__head">
          <h2>Status</h2>
          <span class="sidebar-caption">Current workspace state</span>
        </div>
        <div class="sidebar-status-grid">
          <div class="sidebar-status-item">
            <span class="sidebar-status-label">Current file</span>
            <strong id="currentFileLabel">New unsaved grammar</strong>
          </div>
          <div class="sidebar-status-item">
            <span class="sidebar-status-label">Editor</span>
            <strong id="editorStatus">Loading editor…</strong>
          </div>
        </div>
      </div>

    </aside>

    <aside id="editorSecondarySidebar" class="editor-secondary-sidebar panel">
      <div class="sidebar-section sidebar-section--accent">
        <div class="sidebar-section__head">
          <h2>AI Assistant</h2>
          <span class="sidebar-caption" data-compact="2">Helper, repair, draft, tutor</span>
        </div>
        <div class="ai-assistant-panel" id="aiAssistantPanel">
          <label for="aiAssistantPrompt">Request
            <textarea id="aiAssistantPrompt" class="text-input" rows="5" placeholder="Ask for a new draft, explain a rule, repair the current parser error, or tutor the next step."></textarea>
          </label>
          <div class="ai-assistant-grid">
            <button class="btn btn-secondary" type="button" data-ai-mode="active_helper_chat">Active Helper</button>
            <button class="btn btn-secondary" type="button" data-ai-mode="draft_grammar">Draft Grammar</button>
            <button class="btn btn-secondary" type="button" data-ai-mode="repair_grammar">Repair Grammar</button>
            <button class="btn btn-secondary" type="button" data-ai-mode="tutor_next_step">Tutor Next Step</button>
          </div>
          <div class="ai-assistant-toolbar">
            <button id="aiExplainSelectionBtn" class="btn btn-secondary" type="button">Explain Selection</button>
            <button id="aiApplyGrammarBtn" class="btn btn-primary" type="button" disabled>Apply Result</button>
          </div>
          <div class="sidebar-status-grid ai-assistant-credits" aria-live="polite">
            <div class="sidebar-status-item">
              <span class="sidebar-status-label">Available credits</span>
              <strong id="aiCreditsAvailable"><?= e((string) ($creditSummary['available'] ?? 0)) ?></strong>
            </div>
            <div class="sidebar-status-item">
              <span class="sidebar-status-label">Reserved credits</span>
              <strong id="aiCreditsReserved"><?= e((string) ($creditSummary['reserved'] ?? 0)) ?></strong>
            </div>
            <div class="sidebar-status-item">
              <span class="sidebar-status-label">Next request estimate</span>
              <strong id="aiCreditsEstimate">Select an AI action</strong>
            </div>
            <div class="sidebar-status-item">
              <span class="sidebar-status-label">Last request cost</span>
              <strong id="aiCreditsLastCost">No requests yet</strong>
            </div>
          </div>
          <div id="aiAssistantStatus" class="ai-assistant-status" aria-live="polite">Ready. The assistant uses the current grammar, selected text, and latest console error.</div>
          <section id="aiAssistantOutput" class="ai-assistant-output" hidden>
            <div class="ai-assistant-kv">
              <strong id="aiAssistantResultTitle">AI result</strong>
              <div id="aiAssistantSummary"></div>
            </div>
            <ul id="aiAssistantList" class="ai-assistant-list" hidden></ul>
            <pre id="aiAssistantGrammar" hidden></pre>
          </section>
        </div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-section__head">
          <h2>Workflow</h2>
          <span class="sidebar-caption" data-compact="2">How this page is arranged</span>
        </div>
        <p data-compact="1">Keep authoring in the wide inline editor, use the SVEC viewer to inspect forms, then save drafts or publish directly from this rail.</p>
      </div>
      <?php if ($example): ?>
        <div class="sidebar-section sidebar-section--accent">
          <div class="sidebar-section__head">
            <h2>Loaded example</h2>
            <span class="sidebar-caption" data-compact="2">Ready on load</span>
          </div>
          <p data-compact="1"><?= e($example['title']) ?> will be injected into the editor as soon as the runtime is ready.</p>
        </div>
      <?php endif; ?>
      <div class="sidebar-section">
        <div class="sidebar-section__head">
          <h2>Reference links</h2>
          <span class="sidebar-caption" data-compact="2">Keep nearby while authoring</span>
        </div>
        <div class="help-links help-links--grid">
          <a class="btn btn-secondary btn-sm" href="docs.php">Docs</a>
          <a class="btn btn-secondary btn-sm" href="reference.php">Reference</a>
          <a class="btn btn-secondary btn-sm" href="examples.php">Examples</a>
        </div>
      </div>
      <div class="sidebar-section sidebar-section--accent">
        <div class="sidebar-section__head">
          <h2>Texture Library</h2>
          <span class="sidebar-caption" data-compact="2">Private user textures 1-20</span>
        </div>
        <div id="textureLibraryPanel" class="texture-library-panel">
          <form id="textureUploadForm" class="texture-library-form">
            <label for="textureSlotSelect">Slot
              <select id="textureSlotSelect" class="text-input">
                <?php for ($i = 1; $i <= 20; $i += 1): ?>
                  <option value="usertexture<?= $i ?>">usertexture<?= $i ?></option>
                <?php endfor; ?>
              </select>
            </label>
            <label for="textureDisplayName">Display name
              <input id="textureDisplayName" class="text-input" type="text" maxlength="120" placeholder="Stone, bark, glass, moss">
            </label>
            <label for="textureAlphaRange">Alpha
              <input id="textureAlphaRange" type="range" min="0" max="1" step="0.01" value="1">
            </label>
            <div class="texture-library-alpha-readout">
              <strong id="textureAlphaValue">1.00</strong>
              <span class="muted">Applied in the renderer for this slot.</span>
            </div>
            <label for="textureFileInput">Upload image
              <input id="textureFileInput" class="text-input" type="file" accept="image/png,image/jpeg,image/webp">
            </label>
            <label for="texturePromptInput">AI texture prompt
              <textarea id="texturePromptInput" class="text-input" rows="4" placeholder="Example: weathered basalt stone tile with fine cracks and cool gray variation"></textarea>
            </label>
            <div class="help-links help-links--grid">
              <button id="textureUploadBtn" class="btn btn-primary btn-sm" type="submit">Upload To Slot</button>
              <button id="textureGenerateBtn" class="btn btn-primary btn-sm" type="button">Generate Texture</button>
              <button id="textureSaveMetaBtn" class="btn btn-secondary btn-sm" type="button">Save Alpha</button>
            </div>
            <p class="muted" data-compact="2">Uploads are center-cropped and normalized to 512x512 PNG. AI generation requests a seamless square texture and then runs through the same 512x512 normalization pipeline. Use the grammar names <code>usertexture1</code> to <code>usertexture20</code>.</p>
          </form>
          <div id="textureLibraryStatus" class="ai-assistant-status" aria-live="polite">Loading your texture slots…</div>
          <div id="textureLibraryList" class="texture-library-list"></div>
        </div>
      </div>
      <?php if (!empty($builtinRuleLibrary['items'])): ?>
        <div class="sidebar-section">
          <div class="sidebar-section__head">
            <h2>Builtin rules</h2>
            <span class="sidebar-caption" data-compact="2">Injected only when called</span>
          </div>
          <div class="reference-table" data-compact="2">
            <?php foreach ($builtinRuleLibrary['items'] as $builtinItem): ?>
              <div class="reference-row">
                <div class="reference-syntax"><code><?= e((string) ($builtinItem['entry_rule'] ?? '')) ?></code></div>
                <div><?= e((string) ($builtinItem['group'] ?? 'General')) ?><?php if (!empty($builtinItem['summary'])): ?> · <?= e((string) $builtinItem['summary']) ?><?php endif; ?></div>
              </div>
            <?php endforeach; ?>
          </div>
          <?php if (is_admin($user)): ?>
            <div class="section-band" data-compact="2">
              <a class="btn btn-secondary btn-sm" href="BuiltinRuleLibrary.php">Open builtin library</a>
            </div>
          <?php endif; ?>
        </div>
      <?php endif; ?>
    </aside>
    <section class="editor-stage panel panel-fill">
      <div class="editor-inline-shell">
        <div class="app-shell">
          <div class="editor-live-status" aria-live="polite" hidden>
            <span id="status" class="pill pill-status ready">Ready. · Start: Start · Reachable: 1</span>
            <span id="autoRunState" class="pill pill-auto idle">Auto-run idle</span>
          </div>

          <div class="editor-workspace">
            <section class="card input-card">
              <header>
                <div class="card-title-wrap">
                  <h2>Grammar Input</h2>
                </div>
                <div class="toolbar" id="toolbar">
                  <input id="editorFileNameInput" class="text-input" placeholder="unique_name_identifier" aria-label="Type or choose identifier">
                  <select id="editorFileSelect" class="select-input" aria-label="Choose saved identifier"><option value="" disabled selected>No saved entries</option></select>
                  <button id="editorLocalSaveBtn" class="btn_save" title="Save To JSON" type="button">Save JSON</button>
                  <button id="editorWordWrapBtn" class="btn ghost" title="Toggle word wrap" type="button">Wrap: Off</button>
                  <label id="debugToggleWrap" class="pg3d-debug-toggle" title="Toggle debug logging">
                    <input id="debugToggle" type="checkbox">
                    <span>Debug</span>
                  </label>
                  <button id="editorRunBtn" class="btn" type="button">Run Grammar</button>
                  <button id="editorClearBtn" class="btn secondary" type="button">Clear</button>
                  <button id="editorOpenJsonBtn" class="btn ghost" type="button">Open JSON</button>
                  <button id="editorExportJsonBtn" class="btn secondary" type="button">Export JSON</button>
                  <button id="editorExportStlBtn" class="btn" type="button">Export STL</button>
                </div>
              </header>
              <div class="body">
                <div class="editor-codepane" id="editorCodePane">
                  <pre id="editorHighlightLayer" class="highlighter"></pre>
                  <textarea id="editorSourceInput" wrap="off" spellcheck="false" placeholder="Enter grammar using the current BNF form..." aria-label="Grammar code editor" style="white-space: pre;">Start -&gt; Base [ T ( 0 1.2 0 ) Tower( 2.4 0.84 ) ]

Base -&gt;
[ S ( 1.6 0.4 1.6 ) I ( Cube grayStone 0.24 ) ]
[ T ( 0 0.42 0 ) S ( 1.2 0.18 1.2 ) I ( Cube brushedAluminum 0.18 ) ]

Tower( h r ) -&gt;
[ S ( r h r ) I ( CubeY darkBasalt 0.18 ) ]
[ T ( 0 h 0 ) Crown( r 0.16 ) ]

Crown( r glow ) -&gt;
[ S ( r * 2 0.32 r * 2 ) I ( Cube chromeSurface glow ) ]
[ A ( 45 1 ) S ( r * 1.3 0.14 r * 1.3 ) I ( Cube glowingPanel glow * 0.75 ) ]</textarea>
                  <div id="editorHitLayer" aria-hidden="true"><pre id="editorHitLayerContent" class="highlighter"></pre></div>
                  <div id="editorTooltip" role="tooltip"></div>
                </div>
              </div>
            </section>

            <div class="layout-splitter layout-splitter-v" aria-hidden="true" tabindex="-1"></div>

            <section class="card viewer-card">
              <header class="viewer-card-header">
                <div class="toolbar editor-viewer-toolbar" role="toolbar" aria-label="Scene viewer controls">
                  <button id="editorOrbitToggleBtn" class="btn ghost viewer-icon-btn" title="Start slow auto orbit" aria-label="Start slow auto orbit" type="button">
                    <span class="viewer-icon-btn__glyph" aria-hidden="true">◎</span>
                  </button>
                </div>
              </header>
              <div class="body viewer-body">
                <div class="editor-viewer-stage">
                  <canvas id="glcanvas" aria-label="WebGL scene canvas">Your browser does not support the canvas element.</canvas>
                </div>
              </div>
            </section>

            <div class="layout-splitter layout-splitter-h" aria-hidden="true" tabindex="-1"></div>

            <section class="card output-card">
              <header class="output-card-header" aria-label="Console"></header>
              <div class="body">
                <div id="editorConsoleOutput" class="editor-console-panel" aria-live="polite"></div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  </section>
</main>
<script defer src="assets/editor/js/core/helpers.js?v=<?= e($editorAssetVersion) ?>"></script>
<script defer src="assets/editor/js/core/renderer.js?v=<?= e($editorAssetVersion) ?>"></script>
<script defer src="assets/editor/js/core/scene.js?v=<?= e($editorAssetVersion) ?>"></script>
<script defer src="assets/editor/js/core/scope-context.js?v=<?= e($editorAssetVersion) ?>"></script>
<script defer src="assets/editor/js/core/variables.js?v=<?= e($editorAssetVersion) ?>"></script>
<script defer src="assets/editor/js/core/substitution.js?v=<?= e($editorAssetVersion) ?>"></script>
<script defer src="assets/editor/js/core/math-eval.js?v=<?= e($editorAssetVersion) ?>"></script>
<script defer src="assets/editor/js/core/lexer-token.js?v=<?= e($editorAssetVersion) ?>"></script>
<script defer src="assets/editor/js/core/grammar.js?v=<?= e($editorAssetVersion) ?>"></script>
<script defer src="assets/editor/js/optional/smart-editor-v0.4.js?v=<?= e($editorAssetVersion) ?>"></script>
<script defer src="assets/editor/js/app/editor-app.js?v=<?= e($editorAssetVersion) ?>"></script>
<script defer src="assets/editor/js/app/storage.js?v=<?= e($editorAssetVersion) ?>"></script>
<script defer src="assets/editor/js/app/actions-extra.js?v=<?= e($editorAssetVersion) ?>"></script>
<script defer src="assets/editor/js/app/ui-redesign.js?v=<?= e($editorAssetVersion) ?>"></script>
<script defer src="assets/editor/js/app/editor-integrated-enhancements.js?v=<?= e($editorAssetVersion) ?>"></script>
<script defer src="assets/editor/js/app/editor-diagnostics.js?v=<?= e($editorAssetVersion) ?>"></script>
<script defer src="assets/editor/js/app/ui-resizable-layout.js?v=<?= e($editorAssetVersion) ?>"></script>
<script>
const csrfToken = <?= json_encode(csrf_token()) ?>;
const initialFileId = <?= json_encode($initialFileId) ?>;
const copyFileId = <?= json_encode($copyFileId) ?>;
const exampleContent = <?= json_encode($example['grammar'] ?? null, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
const exampleTitle = <?= json_encode($example['title'] ?? null, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
window.PG3DBuiltinRuleLibrary = <?= json_encode($builtinRuleLibrary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
let currentFileId = initialFileId || null;
let editorReady = false;
let pendingContent = null;
let currentStorageBackend = <?= json_encode(app_file_backend_label($user)) ?>;

function editorTextArea() {
  return document.getElementById('editorSourceInput');
}

function defaultGrammarText() {
  return [
    'Start -> Base [ T ( 0 1.2 0 ) Tower( 2.4 0.84 ) ]',
    '',
    'Base ->',
    '[ S ( 1.6 0.4 1.6 ) I ( Cube grayStone 0.24 ) ]',
    '[ T ( 0 0.42 0 ) S ( 1.2 0.18 1.2 ) I ( Cube brushedAluminum 0.18 ) ]',
    '',
    'Tower( h r ) ->',
    '[ S ( r h r ) I ( CubeY darkBasalt 0.18 ) ]',
    '[ T ( 0 h 0 ) Crown( r 0.16 ) ]',
    '',
    'Crown( r glow ) ->',
    '[ S ( r * 2 0.32 r * 2 ) I ( Cube chromeSurface glow ) ]',
    '[ A ( 45 1 ) S ( r * 1.3 0.14 r * 1.3 ) I ( Cube glowingPanel glow * 0.75 ) ]'
  ].join('\n');
}

function syncEditorBuffer() {
  const textarea = editorTextArea();
  if (!textarea) return '';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  return textarea.value || '';
}

function getEditorText() {
  const textarea = editorTextArea();
  return textarea ? textarea.value : '';
}

function getEditorSelectionText() {
  const textarea = editorTextArea();
  if (!textarea) return '';
  const start = Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : 0;
  const end = Number.isFinite(textarea.selectionEnd) ? textarea.selectionEnd : 0;
  if (end <= start) return '';
  return textarea.value.slice(start, end);
}

function setEditorText(value, runAfter = true) {
  const textarea = editorTextArea();
  if (!textarea) return;
  textarea.value = value || '';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  if (runAfter) {
    const goBtn = document.getElementById('editorRunBtn');
    if (goBtn) goBtn.click();
  }
}

function setStatus(message) {
  const el = document.getElementById('editorStatus');
  if (el) el.textContent = message;
}

function setCurrentLabel(text) {
  const el = document.getElementById('currentFileLabel');
  if (el) el.textContent = text;
}

function latestConsoleErrorText() {
  const recentErrors = window.PG3DConsole && typeof window.PG3DConsole.getRecentErrors === 'function'
    ? window.PG3DConsole.getRecentErrors()
    : [];
  if (Array.isArray(recentErrors) && recentErrors.length) {
    return recentErrors.join('\n');
  }
  const errorMessages = document.querySelectorAll('#editorConsoleOutput .console-error .console-msg');
  const lastError = errorMessages.length ? errorMessages[errorMessages.length - 1] : null;
  return lastError ? (lastError.textContent || '').trim() : '';
}

async function buildApiHeaders() {
  const headers = { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
  const firebase = window.P3DFirebase;
  if (firebase && firebase.ensureInitialized && firebase.ensureInitialized()) {
    const authUser = firebase.currentUser();
    if (authUser) {
      try {
        headers.Authorization = 'Bearer ' + await authUser.getIdToken();
      } catch (error) {}
    }
  }
  if (!headers.Authorization && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  return headers;
}

async function requestJson(path, action, payload = {}, method = 'POST') {
  const headers = await buildApiHeaders();
  const options = {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers
  };
  const url = new URL(path, window.location.href);
  if (action) {
    url.searchParams.set('action', action);
  }
  if (method !== 'GET') {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(payload);
  } else {
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  const response = await fetch(url.toString(), options);
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (error) {
    throw new Error(raw || 'Request failed');
  }
  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

async function api(action, payload = {}, method = 'POST') {
  const data = await requestJson('api/file.php', action, payload, method);
  if (data.backend) {
    currentStorageBackend = data.backend;
  }
  return data;
}

async function builtinRuleApi(payload = {}) {
  const data = await requestJson('api/builtin_rules.php', 'publish', payload, 'POST');
  if (data.library) {
    window.PG3DBuiltinRuleLibrary = data.library;
  }
  return data;
}

function syncEditorUrl(fileId) {
  if (!fileId || !window.history || typeof window.history.replaceState !== 'function') return;
  const next = new URL(window.location.href);
  next.searchParams.set('file', String(fileId));
  next.searchParams.delete('copy');
  next.searchParams.delete('example');
  window.history.replaceState({}, '', next.toString());
}

async function loadInitialData() {
  try {
    if (initialFileId) {
      const data = await api('get', { id: initialFileId }, 'GET');
      if (data.ok) {
        document.getElementById('siteFileTitle').value = data.file.title || '';
        setCurrentLabel(data.file.title || ('File #' + data.file.id));
        pendingContent = data.file.content || '';
        setStatus(data.file.is_published ? 'Published file loaded.' : 'Draft loaded.');
      }
    } else if (copyFileId) {
      const data = await api('get_public', { id: copyFileId }, 'GET');
      if (data.ok) {
        currentFileId = null;
        document.getElementById('siteFileTitle').value = (data.file.title || 'Gallery copy') + ' copy';
        setCurrentLabel('New copy from gallery');
        pendingContent = data.file.content || '';
        setStatus('Gallery item copied into editor as a new draft.');
      }
    } else if (exampleContent) {
      currentFileId = null;
      document.getElementById('siteFileTitle').value = exampleTitle || 'Example grammar';
      setCurrentLabel('Example template');
      pendingContent = exampleContent;
      setStatus('Example loaded into editor.');
    } else {
      pendingContent = defaultGrammarText();
      setStatus('New grammar ready.');
    }
    if (editorReady && pendingContent !== null) {
      setEditorText(pendingContent, true);
      pendingContent = null;
    }
  } catch (error) {
    setStatus(error.message);
  }
}

async function initIntegratedEditorPage() {
  editorReady = true;
  if (pendingContent !== null) {
    setEditorText(pendingContent, true);
    pendingContent = null;
  }
  setStatus(document.getElementById('editorStatus').textContent === 'Loading editor…' ? 'Editor ready.' : document.getElementById('editorStatus').textContent);

  document.getElementById('runGrammarBtn').addEventListener('click', () => {
    const goBtn = document.getElementById('editorRunBtn');
    if (goBtn) {
      goBtn.click();
      setStatus('Grammar executed.');
    } else {
      setStatus('Editor runtime is still loading.');
    }
  });

  document.getElementById('newFileBtn').addEventListener('click', () => {
    currentFileId = null;
    document.getElementById('siteFileTitle').value = '';
    setCurrentLabel('New unsaved grammar');
    setEditorText(defaultGrammarText(), false);
    setStatus('New grammar created.');
  });

  document.getElementById('saveGrammarBtn').addEventListener('click', async () => {
    try {
      const title = document.getElementById('siteFileTitle').value.trim() || 'Untitled grammar';
      const content = syncEditorBuffer().trim();
      if (!content) {
        setStatus('Nothing to save. Add grammar content first.');
        return;
      }
      const data = await api('save', { file_id: currentFileId, title, content });
      currentFileId = data.file.id;
      document.getElementById('siteFileTitle').value = data.file.title;
      setCurrentLabel(data.file.title);
      syncEditorUrl(currentFileId);
      setStatus('Saved to your file library. Backend: ' + currentStorageBackend + '.');
    } catch (error) {
      setStatus(error.message);
    }
  });

  document.getElementById('publishGrammarBtn').addEventListener('click', async () => {
    try {
      const title = document.getElementById('siteFileTitle').value.trim() || 'Untitled grammar';
      const content = syncEditorBuffer().trim();
      if (!content) {
        setStatus('Nothing to publish. Add grammar content first.');
        return;
      }
      const data = await api('publish', { file_id: currentFileId, title, content });
      currentFileId = data.file.id;
      document.getElementById('siteFileTitle').value = data.file.title;
      setCurrentLabel(data.file.title);
      syncEditorUrl(currentFileId);
      setStatus('Published to gallery. Backend: ' + currentStorageBackend + '.');
    } catch (error) {
      setStatus(error.message);
    }
  });

  document.getElementById('unpublishGrammarBtn').addEventListener('click', async () => {
    if (!currentFileId) {
      setStatus('Save the grammar before unpublishing.');
      return;
    }
    try {
      await api('unpublish', { file_id: currentFileId });
      setStatus('Removed from gallery. Backend: ' + currentStorageBackend + '.');
    } catch (error) {
      setStatus(error.message);
    }
  });

  const publishBuiltinBtn = document.getElementById('publishBuiltinRuleBtn');
  if (publishBuiltinBtn) {
    publishBuiltinBtn.addEventListener('click', async () => {
      try {
        const title = document.getElementById('siteFileTitle').value.trim() || 'Untitled builtin rule';
        const grammar = syncEditorBuffer().trim();
        if (!grammar) {
          setStatus('Nothing to publish to the builtin library.');
          return;
        }

        const suggestedRule = (title.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^([^A-Za-z_])/, '_$1').replace(/^_+/, '') || 'BuiltinRule').slice(0, 64);
        const entryRule = window.prompt('Builtin entry rule name', suggestedRule);
        if (entryRule === null) return;
        const group = window.prompt('Builtin group', 'General');
        if (group === null) return;
        const summary = window.prompt('Builtin summary', '');
        if (summary === null) return;

        const data = await builtinRuleApi({
          title,
          entry_rule: entryRule,
          group,
          summary,
          grammar,
        });
        setStatus((data.record.was_update ? 'Updated' : 'Published') + ' builtin rule ' + data.record.entry_rule + '.');
      } catch (error) {
        setStatus(error.message);
      }
    });
  }

  try {
    await loadInitialData();
  } finally {
    document.body.setAttribute('data-editor-loaded', '1');
    const loadingScreen = document.getElementById('editorLoadingScreen');
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      window.setTimeout(() => loadingScreen.remove(), 220);
    }
    window.dispatchEvent(new CustomEvent('p3d:editorready'));
  }
}

window.addEventListener('load', initIntegratedEditorPage, { once: true });
window.PG3DEditorPage = {
  csrfToken,
  buildApiHeaders,
  requestJson,
  getEditorText,
  getEditorSelectionText,
  setEditorText,
  setStatus,
  insertTextAtCursor(text) {
    const textarea = editorTextArea();
    if (!textarea) return;
    const value = String(text || '');
    const start = Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : textarea.value.length;
    const end = Number.isFinite(textarea.selectionEnd) ? textarea.selectionEnd : start;
    textarea.value = textarea.value.slice(0, start) + value + textarea.value.slice(end);
    const nextPos = start + value.length;
    textarea.selectionStart = nextPos;
    textarea.selectionEnd = nextPos;
    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  },
  getStatus() {
    const el = document.getElementById('editorStatus');
    return el ? (el.textContent || '') : '';
  },
  getTitle() {
    const el = document.getElementById('siteFileTitle');
    return el ? (el.value || '') : '';
  },
  latestConsoleErrorText,
  runGrammar() {
    const goBtn = document.getElementById('editorRunBtn');
    if (goBtn) goBtn.click();
  },
  getRenderer() {
    return window.__PG3D_ACTIVE_RENDERER || null;
  },
  refreshRendererTextures() {
    const renderer = window.__PG3D_ACTIVE_RENDERER || null;
    if (renderer && typeof renderer.invalidate === 'function') {
      const goBtn = document.getElementById('editorRunBtn');
      if (goBtn) {
        goBtn.click();
      } else {
        renderer.invalidate();
      }
    }
  }
};
</script>
<script defer src="assets/editor/js/app/ai-assistant.js?v=<?= e($editorAssetVersion) ?>"></script>
<script defer src="assets/editor/js/app/texture-library.js?v=<?= e($editorAssetVersion) ?>"></script>
<?php render_footer(); ?>

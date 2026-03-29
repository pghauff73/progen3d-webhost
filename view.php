<?php
require __DIR__ . '/includes/bootstrap.php';
$id = trim((string) ($_GET['id'] ?? ''));
$builtinRuleLibrary = firebase_builtin_rule_library_payload();
$item = app_find_public_file($id);
if (!$item) {
    http_response_code(404);
    render_header('Not found', 'gallery');
    echo '<main class="site-shell page-shell"><section class="panel"><h1>Published item not found</h1><p>The requested gallery entry does not exist or is no longer public.</p></section></main>';
    render_footer();
    exit;
}
render_header($item['title'], 'gallery');
?>
<main class="viewer-page">
  <section class="site-shell viewer-meta-bar">
    <div>
      <span class="page-kicker">Public viewer</span>
      <h1><?= e($item['title']) ?></h1>
      <p class="page-intro">Published by <?= e($item['username']) ?> · Updated <?= e(substr($item['updated_at'], 0, 19)) ?> UTC</p>
    </div>
    <div class="hero-actions">
      <a class="btn btn-secondary" href="gallery.php">Back to gallery</a>
      <?php if (current_user()): ?>
        <a class="btn btn-primary" href="editor.php?copy=<?= e(rawurlencode((string) $item['id'])) ?>">Copy into my editor</a>
      <?php endif; ?>
    </div>
  </section>

  <section class="site-shell viewer-copy-panel">
    <article class="panel">
      <h2>Published grammar</h2>
      <p class="muted">This page uses the same scene-first presentation as the gallery viewer while also showing the source grammar text.</p>
      <pre id="published-grammar-code" class="example-code"><?= e($item['content']) ?></pre>
      <div class="copy-group" style="margin-top:1rem;">
        <button class="btn btn-secondary btn-sm" type="button" data-copy-target="#published-grammar-code">Copy grammar</button>
        <?php if (current_user()): ?>
          <a class="btn btn-primary btn-sm" href="editor.php?copy=<?= e(rawurlencode((string) $item['id'])) ?>">Copy into editor</a>
        <?php endif; ?>
      </div>
    </article>
    <article class="panel">
      <h2>Viewer notes</h2>
      <div class="data-points">
        <div class="data-point">Scene viewer is loaded from the embedded modular editor in read-only mode.</div>
        <div class="data-point">Orbit, zoom, grid, and axis widget remain available.</div>
        <div class="data-point">Use the gallery to jump between published grammars without leaving the live viewer workflow.</div>
      </div>
    </article>
  </section>

  <section class="viewer-frame-wrap viewer-stage-card">
    <iframe id="publicViewerFrame" class="editor-frame" src="assets/editor/editor-modular.html?v=20260315-galleryfix" title="Published grammar viewer"></iframe>
  </section>
</main>
<script>
window.PG3DBuiltinRuleLibrary = <?= json_encode($builtinRuleLibrary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
const publishedGrammarContent = <?= json_encode($item['content'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
window.addEventListener('DOMContentLoaded', () => {
  const frame = document.getElementById('publicViewerFrame');
  frame.addEventListener('load', () => {
    const doc = frame.contentWindow.document;
    const textarea = doc.getElementById('editorSourceInput');
    const goBtn = doc.getElementById('editorRunBtn');
    if (!textarea) return;
    const applyViewerChrome = () => {
      window.PG3DSiteEmbed?.applyEmbeddedViewerChrome?.(doc);
      const sourceInput = doc.getElementById('editorSourceInput');
      if (sourceInput) {
        sourceInput.style.pointerEvents = 'none';
        sourceInput.style.userSelect = 'text';
      }
    };
    applyViewerChrome();
    const prepared = window.PG3DBuiltinRules?.augmentGrammar?.(publishedGrammarContent) || { effectiveText: publishedGrammarContent };
    textarea.value = prepared.effectiveText || publishedGrammarContent;
    textarea.readOnly = true;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    if (goBtn) goBtn.click();
    window.setTimeout(applyViewerChrome, 80);
    window.setTimeout(applyViewerChrome, 240);
  }, { once: true });
});
</script>
<?php render_footer(); ?>

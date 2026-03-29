<?php
require __DIR__ . '/includes/bootstrap.php';
$examples = site_examples();
$user = current_user();
render_header('Examples', 'examples');
?>
<main class="site-shell page-shell">
  <section class="page-heading">
    <div>
      <span class="page-kicker">Examples to copy</span>
      <h1>Copy-ready ProGen3D grammar snippets</h1>
      <p class="page-intro">These examples are written to be pasted straight into the live editor. Use them as starting points, material tests, scene-layout references, or gallery-ready templates.</p>
    </div>
    <div class="topbar-actions">
      <?php if ($user): ?>
        <a class="btn btn-primary" href="editor.php">Open editor</a>
      <?php else: ?>
        <a class="btn btn-primary" href="login.php">Login to use editor</a>
      <?php endif; ?>
      <a class="btn btn-secondary" href="reference.php">View reference</a>
    </div>
  </section>

  <section class="example-grid">
    <?php foreach ($examples as $example): ?>
      <article class="example-card">
        <div class="example-card-head">
          <div>
            <h2><?= e($example['title']) ?></h2>
            <p class="muted"><?= e($example['summary']) ?></p>
          </div>
        </div>
        <div class="example-meta">
          <?php foreach ($example['tags'] as $tag): ?>
            <span class="example-tag"><?= e($tag) ?></span>
          <?php endforeach; ?>
        </div>
        <pre id="example-<?= e($example['slug']) ?>" class="example-code"><?= e($example['grammar']) ?></pre>
        <div class="copy-bar">
          <div class="copy-group">
            <button class="btn btn-secondary btn-sm" type="button" data-copy-target="#example-<?= e($example['slug']) ?>">Copy example</button>
            <?php if ($user): ?>
              <a class="btn btn-primary btn-sm" href="editor.php?example=<?= e($example['slug']) ?>">Open in editor</a>
            <?php else: ?>
              <a class="btn btn-primary btn-sm" href="login.php">Login to open</a>
            <?php endif; ?>
          </div>
          <a class="btn btn-ghost btn-sm" href="reference.php">Check syntax</a>
        </div>
      </article>
    <?php endforeach; ?>
  </section>
</main>
<?php render_footer(); ?>

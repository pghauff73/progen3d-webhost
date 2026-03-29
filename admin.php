<?php
require __DIR__ . '/includes/bootstrap.php';
require_admin();

$user = current_user();
$users = all_users();
$files = app_all_files();
$publishedFiles = array_values(array_filter($files, fn($file) => !empty($file['is_published'])));
$firebaseRuntime = firebase_admin_runtime_status();

usort($users, function ($a, $b) {
    return strcmp((string) ($a['created_at'] ?? ''), (string) ($b['created_at'] ?? ''));
});
usort($files, function ($a, $b) {
    return strcmp((string) ($b['updated_at'] ?? ''), (string) ($a['updated_at'] ?? ''));
});

$mailLogPath = storage_path('mail-debug.log');
$mailLogEntries = [];
if (is_file($mailLogPath)) {
    $lines = @file($mailLogPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    $lines = array_slice($lines, -30);
    foreach ($lines as $line) {
        $decoded = json_decode($line, true);
        if (is_array($decoded)) {
            $mailLogEntries[] = $decoded;
        }
    }
}

render_header('Admin', 'admin');
?>
<main class="site-shell page-shell">
  <section class="page-heading">
    <div>
      <span class="page-kicker">Admin</span>
      <h1>Admin dashboard</h1>
      <p class="page-intro">Manage site-wide access, inspect user accounts, review grammar activity, and check outgoing mail diagnostics from one page.</p>
    </div>
    <div class="topbar-actions">
      <a class="btn btn-secondary" href="files.php">All files</a>
      <a class="btn btn-secondary" href="BuiltinRuleLibrary.php">Builtin rules</a>
      <a class="btn btn-primary" href="editor.php">Open editor</a>
    </div>
  </section>

  <section class="metric-grid">
    <article class="metric-card"><span class="metric-value"><?= count($users) ?></span><span class="metric-label">Total users</span></article>
    <article class="metric-card"><span class="metric-value"><?= count(array_filter($users, fn($entry) => is_admin($entry))) ?></span><span class="metric-label">Admin accounts</span></article>
    <article class="metric-card"><span class="metric-value"><?= count($files) ?></span><span class="metric-label">Total grammars</span></article>
    <article class="metric-card"><span class="metric-value"><?= count($publishedFiles) ?></span><span class="metric-label">Published grammars</span></article>
  </section>

  <section class="docs-grid">
    <div class="stack-col">
      <article class="panel">
        <h2>Accounts</h2>
        <div class="reference-table">
          <?php foreach ($users as $entry): ?>
            <div class="reference-row">
              <div class="reference-syntax">
                <code><?= e($entry['username'] ?? '') ?></code>
              </div>
              <div>
                role <?= e($entry['role'] ?? 'user') ?>
                · <?= !empty($entry['email']) ? e($entry['email']) : 'no email' ?>
                · verified <?= !empty($entry['email_verified']) ? 'yes' : 'no' ?>
                · created <?= e(substr((string) ($entry['created_at'] ?? ''), 0, 19)) ?> UTC
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      </article>

      <article class="panel">
        <h2>Recent grammars</h2>
        <div class="reference-table">
          <?php foreach (array_slice($files, 0, 20) as $file): ?>
            <div class="reference-row">
              <div class="reference-syntax">
                <code>#<?= e((string) ($file['id'] ?? '')) ?> <?= e($file['title'] ?? 'Untitled grammar') ?></code>
              </div>
              <div>
                owner <?= e((string) ($file['username'] ?? 'unknown')) ?>
                · <?= !empty($file['is_published']) ? 'published' : 'draft' ?>
                · updated <?= e(substr((string) ($file['updated_at'] ?? ''), 0, 19)) ?> UTC
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      </article>
    </div>

    <aside class="stack-col">
      <article class="panel">
        <h2>Firebase admin bootstrap</h2>
        <div class="note-block">
          <p><strong>Bootstrap admin email:</strong> <code><?= e(firebase_bootstrap_admin_email()) ?></code></p>
          <p><strong>Composer autoload:</strong> <?= !empty($firebaseRuntime['vendorAutoloadExists']) ? 'present' : 'missing' ?></p>
          <p><strong>Service account:</strong> <?= !empty($firebaseRuntime['serviceAccountExists']) ? 'present' : 'missing' ?></p>
          <p><strong>Current account:</strong> <?= e($user['username'] ?? '') ?> (<?= e($user['role'] ?? 'user') ?>)</p>
        </div>
      </article>

      <article class="panel">
        <h2>Mail debug</h2>
        <?php if (!$mailLogEntries): ?>
          <p class="muted">No mail debug entries recorded yet.</p>
        <?php else: ?>
          <div class="reference-table">
            <?php foreach (array_reverse($mailLogEntries) as $entry): ?>
              <?php $meta = $entry['entry'] ?? []; ?>
              <div class="reference-row">
                <div class="reference-syntax"><code><?= e((string) ($meta['status'] ?? 'unknown')) ?></code></div>
                <div>
                  <?= e((string) ($meta['to'] ?? '')) ?>
                  <?php if (!empty($meta['subject'])): ?> · <?= e((string) $meta['subject']) ?><?php endif; ?>
                  · <?= e(substr((string) ($entry['timestamp'] ?? ''), 0, 19)) ?> UTC
                </div>
              </div>
            <?php endforeach; ?>
          </div>
          <div class="section-band">
            <strong>Log file</strong>
            <p class="muted"><code><?= e($mailLogPath) ?></code></p>
          </div>
        <?php endif; ?>
      </article>
    </aside>
  </section>
</main>
<?php render_footer(); ?>

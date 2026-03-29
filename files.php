<?php
require __DIR__ . '/includes/bootstrap.php';
require_login();
$user = current_user();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $id = trim((string) ($_POST['file_id'] ?? ''));
    $action = (string) ($_POST['action'] ?? '');

    if ($action === 'delete' && app_delete_file_record($id, $user)) {
        flash_set('success', 'File deleted.');
    } elseif ($action === 'publish' && app_set_file_published($id, $user, true)) {
        flash_set('success', 'File published to gallery.');
    } elseif ($action === 'unpublish' && app_set_file_published($id, $user, false)) {
        flash_set('success', 'File removed from gallery.');
    }
    app_redirect('files.php');
}

$files = app_get_user_files($user);
$publishedCount = count(array_filter($files, fn($file) => !empty($file['is_published'])));
render_header('My Files', 'files');
?>
<main class="site-shell page-shell">
  <section class="page-heading">
    <div>
      <span class="page-kicker">Workspace files</span>
      <h1>My grammar files</h1>
      <p class="page-intro">Open saved grammars, delete drafts, or publish selected pieces into the public gallery. Your draft library stays separate from the public gallery until you choose to publish.</p>
    </div>
    <div class="topbar-actions">
      <a class="btn btn-secondary" href="gallery.php">View gallery</a>
      <a class="btn btn-primary" href="editor.php">New grammar</a>
    </div>
  </section>

  <section class="metric-grid">
    <article class="metric-card"><span class="metric-value"><?= count($files) ?></span><span class="metric-label">Total files in your workspace</span></article>
    <article class="metric-card"><span class="metric-value"><?= $publishedCount ?></span><span class="metric-label">Published into the gallery</span></article>
    <article class="metric-card"><span class="metric-value"><?= count($files) - $publishedCount ?></span><span class="metric-label">Private drafts</span></article>
    <article class="metric-card"><span class="metric-value"><?= e(app_file_backend_label($user)) ?></span><span class="metric-label">Current active storage backend</span></article>
  </section>

  <section class="file-grid">
    <?php if (!$files): ?>
      <article class="panel empty-panel">
        <h2>No saved files yet</h2>
        <p>Create your first grammar from the editor page and it will appear here.</p>
      </article>
    <?php endif; ?>

    <?php foreach ($files as $file): ?>
      <article class="panel file-card">
        <div class="file-card-head">
          <div>
            <h2><?= e($file['title']) ?></h2>
            <p class="muted">Updated <?= e(substr($file['updated_at'], 0, 19)) ?> UTC</p>
          </div>
          <span class="status-pill <?= !empty($file['is_published']) ? 'published' : 'draft' ?>"><?= !empty($file['is_published']) ? 'Published' : 'Draft' ?></span>
        </div>
        <pre class="code-preview"><?= e(preview_excerpt($file['content'], 260)) ?></pre>
        <div class="file-actions">
          <a class="btn btn-secondary" href="editor.php?file=<?= e(rawurlencode((string) $file['id'])) ?>">Open in editor</a>
          <?php if (!empty($file['is_published'])): ?>
            <a class="btn btn-secondary" href="view.php?id=<?= e(rawurlencode((string) $file['id'])) ?>">View public page</a>
          <?php endif; ?>
        </div>
        <div class="inline-form-row">
          <form method="post">
            <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
            <input type="hidden" name="file_id" value="<?= e((string) $file['id']) ?>">
            <input type="hidden" name="action" value="<?= !empty($file['is_published']) ? 'unpublish' : 'publish' ?>">
            <button class="btn <?= !empty($file['is_published']) ? 'btn-secondary' : 'btn-primary' ?>" type="submit"><?= !empty($file['is_published']) ? 'Unpublish' : 'Publish' ?></button>
          </form>
          <form method="post" onsubmit="return confirm('Delete this grammar file?');">
            <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
            <input type="hidden" name="file_id" value="<?= e((string) $file['id']) ?>">
            <input type="hidden" name="action" value="delete">
            <button class="btn btn-danger" type="submit">Delete</button>
          </form>
        </div>
      </article>
    <?php endforeach; ?>
  </section>
</main>
<?php render_footer(); ?>

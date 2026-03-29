<?php
require __DIR__ . '/includes/bootstrap.php';
require_admin();

$user = current_user();
$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $action = (string) ($_POST['action'] ?? '');
    if ($action === 'delete') {
        $id = trim((string) ($_POST['builtin_id'] ?? ''));
        try {
            if (firebase_delete_builtin_rule($id, $user)) {
                flash_set('success', 'Builtin rule removed from the library.');
                app_redirect('BuiltinRuleLibrary.php');
            }
            $error = 'Builtin rule not found.';
        } catch (Throwable $deleteError) {
            $error = $deleteError->getMessage();
        }
    }
}

$rules = firebase_all_builtin_rules(true, false);
$groups = [];
foreach ($rules as $rule) {
    $group = (string) ($rule['group'] ?? 'General');
    if (!isset($groups[$group])) {
        $groups[$group] = [];
    }
    $groups[$group][] = $rule;
}
ksort($groups);

render_header('Builtin Rule Library', 'builtin-rules');
?>
<main class="site-shell page-shell">
  <section class="page-heading">
    <div>
      <span class="page-kicker">Admin</span>
      <h1>Builtin rule library</h1>
      <p class="page-intro">Builtin grammars live in Firebase Storage and are injected into user grammars only when their entry rule is called.</p>
    </div>
    <div class="topbar-actions">
      <a class="btn btn-secondary" href="admin.php">Admin dashboard</a>
      <a class="btn btn-primary" href="editor.php">Open editor</a>
    </div>
  </section>

  <?php if ($error): ?>
    <section class="panel">
      <div class="form-error"><?= e($error) ?></div>
    </section>
  <?php endif; ?>

  <section class="metric-grid">
    <article class="metric-card"><span class="metric-value"><?= count($rules) ?></span><span class="metric-label">Active builtin grammars</span></article>
    <article class="metric-card"><span class="metric-value"><?= count($groups) ?></span><span class="metric-label">Groups</span></article>
    <article class="metric-card"><span class="metric-value"><?= firebase_builtin_rules_runtime_ready() ? 'Ready' : 'Offline' ?></span><span class="metric-label">Storage backend</span></article>
    <article class="metric-card"><span class="metric-value"><?= e($user['username'] ?? '') ?></span><span class="metric-label">Publishing account</span></article>
  </section>

  <?php if (!$groups): ?>
    <section class="panel empty-panel">
      <h2>No builtin rules yet</h2>
      <p>Use the admin-only publish button in the editor to add the current grammar to the builtin library.</p>
    </section>
  <?php endif; ?>

  <section class="docs-grid">
    <?php foreach ($groups as $group => $items): ?>
      <article class="panel">
        <h2><?= e($group) ?></h2>
        <div class="reference-table">
          <?php foreach ($items as $item): ?>
            <div class="reference-row">
              <div class="reference-syntax">
                <code><?= e((string) ($item['entry_rule'] ?? '')) ?></code>
              </div>
              <div>
                <?= e((string) ($item['title'] ?? 'Untitled builtin rule')) ?>
                <?php if (!empty($item['summary'])): ?> · <?= e((string) $item['summary']) ?><?php endif; ?>
                · updated <?= e(substr((string) ($item['updated_at'] ?? ''), 0, 19)) ?> UTC
                <?php if (!empty($item['published_by_username'])): ?> · by <?= e((string) $item['published_by_username']) ?><?php endif; ?>
              </div>
              <form method="post" onsubmit="return confirm('Delete this builtin rule?');">
                <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="builtin_id" value="<?= e((string) ($item['id'] ?? '')) ?>">
                <button class="btn btn-danger btn-sm" type="submit">Delete</button>
              </form>
            </div>
          <?php endforeach; ?>
        </div>
      </article>
    <?php endforeach; ?>
  </section>
</main>
<?php render_footer(); ?>

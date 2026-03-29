<?php
require __DIR__ . '/includes/bootstrap.php';
require_admin();

$user = current_user();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $action = trim((string) ($_POST['action'] ?? ''));

    try {
        if ($action === 'grant_credits') {
            $identity = trim((string) ($_POST['identity'] ?? ''));
            $amount = (int) ($_POST['amount'] ?? 0);
            $source = trim((string) ($_POST['source'] ?? 'admin_grant'));

            if ($identity === '') {
                throw new RuntimeException('Choose a user email or Firebase UID.');
            }
            if ($amount === 0) {
                throw new RuntimeException('Grant amount must not be zero.');
            }
            if (!firebase_credit_transactions_available()) {
                throw new RuntimeException('AI credit transactions are not available on this server.');
            }

            $target = str_contains($identity, '@') ? find_user_by_email($identity) : find_user_by_id($identity);
            if (!$target) {
                throw new RuntimeException('User not found for that email or UID.');
            }

            $updated = firebase_grant_ai_credits(
                (string) ($target['uid'] ?? $target['id'] ?? ''),
                $amount,
                $source !== '' ? $source : 'admin_grant',
                'admin_action',
                'admin:' . (string) ($user['uid'] ?? $user['id'] ?? ''),
                ['operator_uid' => (string) ($user['uid'] ?? $user['id'] ?? ''), 'operator_username' => (string) ($user['username'] ?? '')]
            );

            flash_set('success', sprintf(
                'Adjusted %s by %d credits. New available balance: %d.',
                (string) ($updated['username'] ?? 'user'),
                $amount,
                (int) (firebase_credit_summary($updated)['available'] ?? 0)
            ));
            app_redirect('admin.php?credit_user=' . rawurlencode((string) ($updated['uid'] ?? $updated['id'] ?? '')));
        }
    } catch (Throwable $error) {
        flash_set('error', $error->getMessage());
        app_redirect('admin.php');
    }
}

$creditUserId = trim((string) ($_GET['credit_user'] ?? ''));
$creditUser = $creditUserId !== '' ? find_user_by_id($creditUserId) : null;
$users = all_users();
$files = app_all_files();
$publishedFiles = array_values(array_filter($files, fn($file) => !empty($file['is_published'])));
$firebaseRuntime = firebase_admin_runtime_status();
$allAiUsage = firebase_all_ai_usage();
$allCreditLedger = firebase_all_credit_ledger();

function admin_query_with(array $changes): string
{
    $query = $_GET;
    foreach ($changes as $key => $value) {
        if ($value === null || $value === '') {
            unset($query[$key]);
        } else {
            $query[$key] = (string) $value;
        }
    }

    $queryString = http_build_query($query);
    return 'admin.php' . ($queryString !== '' ? '?' . $queryString : '');
}

function admin_owner_index(array $users): array
{
    $index = [];
    foreach ($users as $entry) {
        $uid = (string) ($entry['uid'] ?? $entry['id'] ?? '');
        if ($uid === '') {
            continue;
        }
        $index[$uid] = [
            'username' => (string) ($entry['username'] ?? 'unknown'),
            'email' => (string) ($entry['email'] ?? ''),
        ];
    }

    return $index;
}

function admin_owner_label(array $ownerIndex, string $uid): string
{
    $owner = $ownerIndex[$uid] ?? null;
    if (!$owner) {
        return $uid !== '' ? $uid : 'unknown';
    }

    $username = trim((string) ($owner['username'] ?? ''));
    $email = trim((string) ($owner['email'] ?? ''));
    if ($username !== '' && $email !== '') {
        return $username . ' (' . $email . ')';
    }
    if ($username !== '') {
        return $username;
    }
    if ($email !== '') {
        return $email;
    }

    return $uid !== '' ? $uid : 'unknown';
}

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

$usageItems = $creditUser
    ? array_values(array_filter($allAiUsage, fn($entry) => (string) ($entry['owner_uid'] ?? '') === (string) ($creditUser['uid'] ?? $creditUser['id'] ?? '')))
    : $allAiUsage;
$ledgerItems = $creditUser
    ? array_values(array_filter($allCreditLedger, fn($entry) => (string) ($entry['owner_uid'] ?? '') === (string) ($creditUser['uid'] ?? $creditUser['id'] ?? '')))
    : $allCreditLedger;
$ownerIndex = admin_owner_index($users);
$usagePage = max(1, (int) ($_GET['usage_page'] ?? 1));
$ledgerPage = max(1, (int) ($_GET['ledger_page'] ?? 1));
$usagePerPage = 12;
$ledgerPerPage = 16;
$usageTotal = count($usageItems);
$ledgerTotal = count($ledgerItems);
$usagePages = max(1, (int) ceil($usageTotal / $usagePerPage));
$ledgerPages = max(1, (int) ceil($ledgerTotal / $ledgerPerPage));
$usagePage = min($usagePage, $usagePages);
$ledgerPage = min($ledgerPage, $ledgerPages);
$usageItems = array_slice($usageItems, ($usagePage - 1) * $usagePerPage, $usagePerPage);
$ledgerItems = array_slice($ledgerItems, ($ledgerPage - 1) * $ledgerPerPage, $ledgerPerPage);
$creditTotals = array_reduce($users, function ($carry, $entry) {
    $summary = firebase_credit_summary($entry);
    $carry['available'] += (int) ($summary['available'] ?? 0);
    $carry['reserved'] += (int) ($summary['reserved'] ?? 0);
    return $carry;
}, ['available' => 0, 'reserved' => 0]);

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
    <article class="metric-card"><span class="metric-value"><?= (int) $creditTotals['available'] ?></span><span class="metric-label">Total available AI credits</span></article>
    <article class="metric-card"><span class="metric-value"><?= (int) $creditTotals['reserved'] ?></span><span class="metric-label">Total reserved AI credits</span></article>
  </section>

  <section class="docs-grid">
    <div class="stack-col">
      <article class="panel">
        <h2>Grant AI credits</h2>
        <p class="muted">Use a Firebase UID or account email. Negative numbers remove credits without counting as AI spend.</p>
        <form method="post" class="auth-form">
          <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
          <input type="hidden" name="action" value="grant_credits">
          <label>User email or UID
            <input type="text" name="identity" placeholder="user@example.com or firebase-uid" value="<?= e($creditUser['email'] ?? $creditUser['uid'] ?? '') ?>">
          </label>
          <label>Credit amount
            <input type="text" name="amount" inputmode="numeric" placeholder="25 or -5">
          </label>
          <label>Source label
            <input type="text" name="source" maxlength="80" placeholder="admin_grant" value="admin_grant">
          </label>
          <div class="topbar-actions">
            <button class="btn btn-primary" type="submit">Apply credit adjustment</button>
            <?php if ($creditUser): ?>
              <a class="btn btn-secondary" href="admin.php">Clear history filter</a>
            <?php endif; ?>
          </div>
        </form>
        <?php if ($creditUser): ?>
          <?php $selectedSummary = firebase_credit_summary($creditUser); ?>
          <div class="section-band">
            <strong>Current selection</strong>
            <p class="muted">
              <?= e((string) ($creditUser['username'] ?? 'unknown')) ?>
              · <?= e((string) ($creditUser['email'] ?? 'no email')) ?>
              · available <?= (int) ($selectedSummary['available'] ?? 0) ?>
              · reserved <?= (int) ($selectedSummary['reserved'] ?? 0) ?>
            </p>
          </div>
        <?php endif; ?>
      </article>

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
                · credits <?= e((string) (firebase_credit_summary($entry)['available'] ?? 0)) ?> available / <?= e((string) (firebase_credit_summary($entry)['reserved'] ?? 0)) ?> reserved
                · created <?= e(substr((string) ($entry['created_at'] ?? ''), 0, 19)) ?> UTC
                · <a href="admin.php?credit_user=<?= e(rawurlencode((string) ($entry['uid'] ?? $entry['id'] ?? ''))) ?>">View credit history</a>
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
          <p><strong>Credit transactions:</strong> <?= firebase_credit_transactions_available() ? 'available' : 'unavailable' ?></p>
          <p><strong>Current account:</strong> <?= e($user['username'] ?? '') ?> (<?= e($user['role'] ?? 'user') ?>)</p>
        </div>
      </article>

      <article class="panel">
        <h2>Recent AI usage<?= $creditUser ? ' for ' . e((string) ($creditUser['username'] ?? 'user')) : '' ?></h2>
        <?php if (!$usageItems): ?>
          <p class="muted">No AI usage records found.</p>
        <?php else: ?>
          <div class="reference-table">
            <?php foreach ($usageItems as $entry): ?>
              <div class="reference-row">
                <div class="reference-syntax">
                  <code><?= e((string) ($entry['mode'] ?? 'ai')) ?></code>
                </div>
                <div>
                  owner <?= e(admin_owner_label($ownerIndex, (string) ($entry['owner_uid'] ?? ''))) ?>
                  · status <?= e((string) ($entry['status'] ?? 'unknown')) ?>
                  · credits est/final <?= (int) ($entry['estimated_credits'] ?? 0) ?>/<?= (int) ($entry['final_credits'] ?? 0) ?>
                  · tokens <?= (int) ($entry['total_tokens'] ?? 0) ?>
                  · <?= e(substr((string) ($entry['created_at'] ?? ''), 0, 19)) ?> UTC
                  <?php if (!empty($entry['owner_uid'])): ?> · uid <code><?= e((string) $entry['owner_uid']) ?></code><?php endif; ?>
                  <?php if (!empty($entry['error_message'])): ?> · error <?= e((string) $entry['error_message']) ?><?php endif; ?>
                </div>
              </div>
            <?php endforeach; ?>
          </div>
          <?php if ($usagePages > 1): ?>
            <div class="topbar-actions section-band">
              <?php if ($usagePage > 1): ?>
                <a class="btn btn-secondary btn-sm" href="<?= e(admin_query_with(['usage_page' => $usagePage - 1])) ?>">Previous usage page</a>
              <?php endif; ?>
              <span class="muted">Page <?= $usagePage ?> of <?= $usagePages ?></span>
              <?php if ($usagePage < $usagePages): ?>
                <a class="btn btn-secondary btn-sm" href="<?= e(admin_query_with(['usage_page' => $usagePage + 1])) ?>">Next usage page</a>
              <?php endif; ?>
            </div>
          <?php endif; ?>
        <?php endif; ?>
      </article>

      <article class="panel">
        <h2>Credit ledger<?= $creditUser ? ' for ' . e((string) ($creditUser['username'] ?? 'user')) : '' ?></h2>
        <?php if (!$ledgerItems): ?>
          <p class="muted">No credit ledger entries found.</p>
        <?php else: ?>
          <div class="reference-table">
            <?php foreach ($ledgerItems as $entry): ?>
              <div class="reference-row">
                <div class="reference-syntax">
                  <code><?= e((string) ($entry['type'] ?? 'entry')) ?></code>
                </div>
                <div>
                  owner <?= e(admin_owner_label($ownerIndex, (string) ($entry['owner_uid'] ?? ''))) ?>
                  · amount <?= (int) ($entry['amount'] ?? 0) ?>
                  · balance after <?= (int) ($entry['balance_after'] ?? 0) ?>
                  · source <?= e((string) ($entry['source'] ?? '')) ?>
                  <?php if (!empty($entry['reference_id'])): ?> · ref <?= e((string) $entry['reference_id']) ?><?php endif; ?>
                  · <?= e(substr((string) ($entry['created_at'] ?? ''), 0, 19)) ?> UTC
                  <?php if (!empty($entry['owner_uid'])): ?> · uid <code><?= e((string) $entry['owner_uid']) ?></code><?php endif; ?>
                </div>
              </div>
            <?php endforeach; ?>
          </div>
          <?php if ($ledgerPages > 1): ?>
            <div class="topbar-actions section-band">
              <?php if ($ledgerPage > 1): ?>
                <a class="btn btn-secondary btn-sm" href="<?= e(admin_query_with(['ledger_page' => $ledgerPage - 1])) ?>">Previous ledger page</a>
              <?php endif; ?>
              <span class="muted">Page <?= $ledgerPage ?> of <?= $ledgerPages ?></span>
              <?php if ($ledgerPage < $ledgerPages): ?>
                <a class="btn btn-secondary btn-sm" href="<?= e(admin_query_with(['ledger_page' => $ledgerPage + 1])) ?>">Next ledger page</a>
              <?php endif; ?>
            </div>
          <?php endif; ?>
        <?php endif; ?>
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

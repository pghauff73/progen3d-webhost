<?php
require __DIR__ . '/includes/bootstrap.php';
require_login();
$user = current_user();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $selectedModel = firebase_normalize_ai_model((string) ($_POST['ai_model_preference'] ?? ''));
    $selectedImageModel = firebase_normalize_ai_image_model((string) ($_POST['ai_image_model_preference'] ?? ''));
    $updated = update_user_record((string) ($user['uid'] ?? $user['id'] ?? ''), function (array $record) use ($selectedModel, $selectedImageModel): array {
        $record['ai_model_preference'] = $selectedModel;
        $record['ai_model_updated_at'] = gmdate('c');
        $record['ai_image_model_preference'] = $selectedImageModel;
        $record['ai_image_model_updated_at'] = gmdate('c');
        $record['updated_at'] = gmdate('c');
        return $record;
    });

    if ($updated) {
        flash_set('success', 'Preferred AI models updated.');
    } else {
        flash_set('error', 'Could not update the preferred AI models.');
    }
    app_redirect('account.php');
}

$user = current_user();
$creditSummary = firebase_credit_summary($user);
$modelCatalog = firebase_ai_model_catalog();
$imageModelCatalog = firebase_ai_image_model_catalog();
$selectedModel = firebase_user_ai_model($user);
$selectedImageModel = firebase_user_ai_image_model($user);
render_header('Account', 'account');
?>
<main class="site-shell page-shell">
  <section class="page-heading">
    <div>
      <span class="page-kicker">Account settings</span>
      <h1>Account</h1>
      <p class="page-intro">Manage the models used for AI grammar requests and AI texture generation. Text requests charge from actual token usage, while texture generation charges from the selected image model’s per-image pricing, both converted into credits at <strong>$0.01 per credit</strong>.</p>
    </div>
    <div class="topbar-actions">
      <a class="btn btn-secondary" href="files.php">Open workspace</a>
      <a class="btn btn-primary" href="editor.php">Open editor</a>
    </div>
  </section>

  <section class="metric-grid">
    <article class="metric-card"><span class="metric-value"><?= e((string) ($creditSummary['available'] ?? 0)) ?></span><span class="metric-label">Available AI credits</span></article>
    <article class="metric-card"><span class="metric-value"><?= e((string) ($creditSummary['reserved'] ?? 0)) ?></span><span class="metric-label">Reserved credits</span></article>
    <article class="metric-card"><span class="metric-value"><?= e($modelCatalog[$selectedModel]['label'] ?? $selectedModel) ?></span><span class="metric-label">Current AI model</span></article>
    <article class="metric-card"><span class="metric-value"><?= e($imageModelCatalog[$selectedImageModel]['label'] ?? $selectedImageModel) ?></span><span class="metric-label">Current texture model</span></article>
  </section>

  <section class="panel" style="padding: 1.4rem;">
    <form method="post" class="stack-actions" style="gap: 1rem;">
      <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
      <label for="aiModelSelect"><strong>Preferred model</strong></label>
      <select id="aiModelSelect" name="ai_model_preference" class="text-input">
        <?php foreach ($modelCatalog as $modelId => $modelInfo): ?>
          <option value="<?= e($modelId) ?>"<?= $modelId === $selectedModel ? ' selected' : '' ?>>
            <?= e((string) ($modelInfo['label'] ?? $modelId)) ?>
          </option>
        <?php endforeach; ?>
      </select>
      <label for="aiImageModelSelect"><strong>Preferred texture generation model</strong></label>
      <select id="aiImageModelSelect" name="ai_image_model_preference" class="text-input">
        <?php foreach ($imageModelCatalog as $modelId => $modelInfo): ?>
          <option value="<?= e($modelId) ?>"<?= $modelId === $selectedImageModel ? ' selected' : '' ?>>
            <?= e((string) ($modelInfo['label'] ?? $modelId)) ?>
          </option>
        <?php endforeach; ?>
      </select>
      <p class="muted">The text model is used by the grammar assistant in the editor. The texture model is used by AI texture generation. Both reservation estimates and final settlement come from these selected pricing tables.</p>
      <div class="help-links">
        <button class="btn btn-primary" type="submit">Save model preferences</button>
      </div>
    </form>
  </section>

  <section class="file-grid" style="margin-top: 1.5rem;">
    <?php foreach ($modelCatalog as $modelId => $modelInfo): ?>
      <article class="panel file-card">
        <div class="file-card-head">
          <div>
            <h2><?= e((string) ($modelInfo['label'] ?? $modelId)) ?></h2>
            <p class="muted"><?= e((string) ($modelInfo['description'] ?? '')) ?></p>
          </div>
          <span class="status-pill <?= $modelId === $selectedModel ? 'published' : 'draft' ?>"><?= $modelId === $selectedModel ? 'Selected' : 'Available' ?></span>
        </div>
        <div class="reference-table" data-compact="2">
          <div class="reference-row">
            <div class="reference-syntax"><code>Input</code></div>
            <div>$<?= e(number_format((float) ($modelInfo['input_per_million_usd'] ?? 0), 3)) ?> / 1M tokens</div>
          </div>
          <div class="reference-row">
            <div class="reference-syntax"><code>Cached input</code></div>
            <div>$<?= e(number_format((float) ($modelInfo['cached_input_per_million_usd'] ?? 0), 3)) ?> / 1M tokens</div>
          </div>
          <div class="reference-row">
            <div class="reference-syntax"><code>Output</code></div>
            <div>$<?= e(number_format((float) ($modelInfo['output_per_million_usd'] ?? 0), 3)) ?> / 1M tokens</div>
          </div>
          <div class="reference-row">
            <div class="reference-syntax"><code>Credit conversion</code></div>
            <div>Charged from actual input + output token cost, rounded up to whole credits.</div>
          </div>
        </div>
        <p class="muted">Pricing source: <a href="<?= e((string) ($modelInfo['source'] ?? 'https://openai.com/api/pricing/')) ?>" target="_blank" rel="noopener noreferrer"><?= e((string) ($modelInfo['source'] ?? 'https://openai.com/api/pricing/')) ?></a> · checked <?= e((string) ($modelInfo['updated_at'] ?? '')) ?></p>
      </article>
    <?php endforeach; ?>
  </section>

  <section class="file-grid" style="margin-top: 1.5rem;">
    <?php foreach ($imageModelCatalog as $modelId => $modelInfo): ?>
      <article class="panel file-card">
        <div class="file-card-head">
          <div>
            <h2><?= e((string) ($modelInfo['label'] ?? $modelId)) ?></h2>
            <p class="muted"><?= e((string) ($modelInfo['description'] ?? '')) ?></p>
          </div>
          <span class="status-pill <?= $modelId === $selectedImageModel ? 'published' : 'draft' ?>"><?= $modelId === $selectedImageModel ? 'Selected' : 'Available' ?></span>
        </div>
        <div class="reference-table" data-compact="2">
          <?php foreach ((array) (($modelInfo['generation_costs_usd']['medium'] ?? [])) as $size => $cost): ?>
            <div class="reference-row">
              <div class="reference-syntax"><code>Medium <?= e((string) $size) ?></code></div>
              <div>$<?= e(number_format((float) $cost, 3)) ?> per image</div>
            </div>
          <?php endforeach; ?>
          <div class="reference-row">
            <div class="reference-syntax"><code>Current texture flow</code></div>
            <div>Editor texture generation uses <strong>medium</strong> quality at <strong>1024x1024</strong>, then normalizes to 512x512 PNG.</div>
          </div>
          <div class="reference-row">
            <div class="reference-syntax"><code>Credit conversion</code></div>
            <div>Reservation and settlement use the configured per-image cost, rounded up to whole credits.</div>
          </div>
        </div>
        <p class="muted">Pricing source: <a href="<?= e((string) ($modelInfo['source'] ?? 'https://platform.openai.com/docs/models/gpt-image-1.5')) ?>" target="_blank" rel="noopener noreferrer"><?= e((string) ($modelInfo['source'] ?? 'https://platform.openai.com/docs/models/gpt-image-1.5')) ?></a> · checked <?= e((string) ($modelInfo['updated_at'] ?? '')) ?></p>
      </article>
    <?php endforeach; ?>
  </section>
</main>
<?php render_footer(); ?>

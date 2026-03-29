<?php
require __DIR__ . '/includes/bootstrap.php';
$items = app_get_public_files();
$builtinRuleLibrary = firebase_builtin_rule_library_payload();
render_header('Gallery', 'gallery');
?>
<main class="site-shell page-shell">
  <section class="page-heading">
    <div>
      <span class="page-kicker">Published work</span>
      <h1>Gallery</h1>
      <p class="page-intro">Browse grammars that have been published from private workspaces and preview them directly in the live scene viewer below.</p>
    </div>
    <?php if (current_user()): ?>
      <a class="btn btn-primary" href="editor.php">Create new piece</a>
    <?php else: ?>
      <a class="btn btn-primary" href="register.php">Join to publish</a>
    <?php endif; ?>
  </section>

  <?php if ($items): ?>
    <section class="panel gallery-live-panel">
      <div class="gallery-live-head">
        <div>
          <p class="gallery-live-kicker">Live scene viewer</p>
          <h2 id="galleryViewerTitle"><?= e($items[0]['title']) ?></h2>
          <p id="galleryViewerMeta" class="muted">By <?= e($items[0]['username']) ?> · Published <?= e(substr((string) ($items[0]['published_at'] ?: $items[0]['updated_at']), 0, 19)) ?> UTC</p>
        </div>
        <div class="hero-actions gallery-live-actions">
          <button id="galleryPrevBtn" class="gallery-nav-btn" type="button" aria-label="Previous gallery item" title="Previous published grammar">&#10094;</button>
          <button id="galleryNextBtn" class="gallery-nav-btn" type="button" aria-label="Next gallery item" title="Next published grammar">&#10095;</button>
          <a id="galleryOpenViewerLink" class="btn btn-secondary" href="view.php?id=<?= e(rawurlencode((string) $items[0]['id'])) ?>">Open full viewer</a>
          <?php if (current_user()): ?>
            <a id="galleryCopyLink" class="btn btn-primary" href="editor.php?copy=<?= e(rawurlencode((string) $items[0]['id'])) ?>">Copy into editor</a>
          <?php endif; ?>
        </div>
      </div>
      <div id="galleryViewerStage" class="gallery-live-frame-wrap gallery-viewer-stage">
        <button id="galleryPrevBtnOverlay" class="gallery-side-arrow gallery-side-arrow--left" type="button" aria-label="Previous gallery item" title="Previous published grammar">&#10094;</button>
        <iframe id="galleryViewerFrame" class="gallery-viewer-frame" src="assets/editor/editor-modular.html?v=20260315-galleryfix" title="Gallery scene viewer" loading="lazy"></iframe>
        <button id="galleryNextBtnOverlay" class="gallery-side-arrow gallery-side-arrow--right" type="button" aria-label="Next gallery item" title="Next published grammar">&#10095;</button>
      </div>
    </section>
  <?php endif; ?>

  <section class="file-grid gallery-file-grid">
    <?php if (!$items): ?>
      <article class="panel empty-panel">
        <h2>No published works yet</h2>
        <p>When a user publishes a grammar from the editor or files page, it will appear here.</p>
      </article>
    <?php endif; ?>

    <?php foreach ($items as $index => $item): ?>
      <article class="panel file-card gallery-card<?= $index === 0 ? ' is-selected' : '' ?>" data-gallery-item data-file-id="<?= e((string) $item['id']) ?>" data-title="<?= e($item['title']) ?>" data-username="<?= e($item['username']) ?>" data-published="<?= e(substr((string) ($item['published_at'] ?: $item['updated_at']), 0, 19)) ?> UTC" data-content="<?= e($item['content']) ?>">
        <div class="file-card-head">
          <div>
            <h2><?= e($item['title']) ?></h2>
            <p class="muted">By <?= e($item['username']) ?> · Published <?= e(substr((string) ($item['published_at'] ?: $item['updated_at']), 0, 19)) ?> UTC</p>
          </div>
          <span class="status-pill published">Published</span>
        </div>
        <pre class="code-preview"><?= e(preview_excerpt($item['content'], 280)) ?></pre>
        <div class="file-actions">
          <button class="btn btn-secondary gallery-preview-btn" type="button">Preview here</button>
          <a class="btn btn-secondary" href="view.php?id=<?= e(rawurlencode((string) $item['id'])) ?>">Open full viewer</a>
          <?php if (current_user()): ?>
            <a class="btn btn-primary" href="editor.php?copy=<?= e(rawurlencode((string) $item['id'])) ?>">Copy into editor</a>
          <?php endif; ?>
        </div>
      </article>
    <?php endforeach; ?>
  </section>
</main>
<?php if ($items): ?>
<script>
window.PG3DBuiltinRuleLibrary = <?= json_encode($builtinRuleLibrary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
const galleryPublishedItems = <?= json_encode(array_map(function ($item) {
    return [
        'id' => (string) $item['id'],
        'backend' => (string) ($item['backend'] ?? ''),
        'title' => (string) $item['title'],
        'username' => (string) $item['username'],
        'published' => substr((string) ($item['published_at'] ?: $item['updated_at']), 0, 19) . ' UTC',
        'content' => (string) $item['content'],
    ];
}, $items), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;

window.addEventListener('DOMContentLoaded', () => {
  const frame = document.getElementById('galleryViewerFrame');
  const stage = document.getElementById('galleryViewerStage');
  const titleEl = document.getElementById('galleryViewerTitle');
  const metaEl = document.getElementById('galleryViewerMeta');
  const openLink = document.getElementById('galleryOpenViewerLink');
  const copyLink = document.getElementById('galleryCopyLink');
  const prevButtons = Array.from(document.querySelectorAll('#galleryPrevBtn, #galleryPrevBtnOverlay'));
  const nextButtons = Array.from(document.querySelectorAll('#galleryNextBtn, #galleryNextBtnOverlay'));
  const cards = Array.from(document.querySelectorAll('[data-gallery-item]'));
  let frameReady = false;
  let pendingItem = galleryPublishedItems[0] || null;
  let currentIndex = 0;
  let autoAdvanceTimer = null;
  let isTransitioning = false;
  let autoAdvancePaused = false;
  let viewerOrbitPausedForHover = false;
  const AUTO_ADVANCE_MS = 4000;
  const FADE_MS = 260;

  function applyViewerChrome(doc) {
    window.PG3DSiteEmbed?.applyEmbeddedViewerChrome?.(doc);
  }


  function getOrbitToggle() {
    try {
      return frame.contentWindow?.document?.getElementById('editorOrbitToggleBtn') || null;
    } catch (error) {
      return null;
    }
  }

  function isViewerOrbitOn() {
    const button = getOrbitToggle();
    if (!button) return false;
    const raw = String(button.textContent || '').toLowerCase();
    if (raw.includes('pause') || raw.includes('auto orbit: on') || raw.includes(' on')) return true;
    if (raw.includes('play') || raw.includes('▶') || raw.includes('auto orbit: off') || raw.includes(' off')) return false;
    return !button.classList.contains('is-off');
  }

  function setViewerOrbit(enabled) {
    const button = getOrbitToggle();
    if (!button) return;
    const on = isViewerOrbitOn();
    if (enabled === on) return;
    button.click();
  }

  function setSelectedCard(id) {
    cards.forEach((card) => {
      card.classList.toggle('is-selected', String(card.dataset.fileId || '') === String(id || ''));
    });
  }

  function updateButtonState() {
    const disabled = galleryPublishedItems.length <= 1 || isTransitioning;
    [...prevButtons, ...nextButtons].forEach((button) => {
      button.disabled = disabled;
      button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    });
  }

  function writeItemIntoViewer(item) {
    const doc = frame.contentWindow.document;
    const textarea = doc.getElementById('editorSourceInput');
    const goBtn = doc.getElementById('editorRunBtn');
    if (!textarea) return;
    const prepared = window.PG3DBuiltinRules?.augmentGrammar?.(item.content || '') || { effectiveText: item.content || '' };
    textarea.value = prepared.effectiveText || item.content || '';
    textarea.readOnly = true;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    if (goBtn) goBtn.click();
    window.setTimeout(() => setViewerOrbit(!viewerOrbitPausedForHover), 60);
    titleEl.textContent = item.title || 'Untitled grammar';
    metaEl.textContent = 'By ' + (item.username || 'unknown') + ' · Published ' + (item.published || '');
    openLink.href = 'view.php?id=' + encodeURIComponent(item.id);
    if (copyLink) copyLink.href = 'editor.php?copy=' + encodeURIComponent(item.id);
    setSelectedCard(item.id);
    currentIndex = Math.max(0, galleryPublishedItems.findIndex((entry) => String(entry.id || '') === String(item.id || '')));
  }

  function transitionToItem(item, options = {}) {
    if (!item || !frameReady || isTransitioning) return;
    const animate = options.animate !== false;
    isTransitioning = animate;
    updateButtonState();
    const finalize = () => {
      writeItemIntoViewer(item);
      stage.classList.add('is-visible');
      stage.classList.remove('is-fading');
      window.setTimeout(() => {
        isTransitioning = false;
        updateButtonState();
      }, animate ? FADE_MS : 0);
    };
    if (!animate) {
      finalize();
      return;
    }
    stage.classList.remove('is-visible');
    stage.classList.add('is-fading');
    window.setTimeout(finalize, FADE_MS);
  }

  function loadItemIntoViewer(item, options = {}) {
    if (!item) return;
    if (!frameReady) {
      pendingItem = item;
      return;
    }
    transitionToItem(item, options);
  }

  function getItemByIndex(index) {
    const total = galleryPublishedItems.length;
    if (!total) return null;
    const normalized = ((index % total) + total) % total;
    return galleryPublishedItems[normalized] || null;
  }

  function queueByOffset(offset, options = {}) {
    const targetItem = getItemByIndex(currentIndex + offset);
    if (!targetItem) return;
    loadItemIntoViewer(targetItem, options);
  }

  function resetAutoAdvance() {
    if (autoAdvanceTimer) window.clearInterval(autoAdvanceTimer);
    if (autoAdvancePaused || galleryPublishedItems.length <= 1) {
      autoAdvanceTimer = null;
      return;
    }
    autoAdvanceTimer = window.setInterval(() => {
      if (!document.hidden && !autoAdvancePaused) queueByOffset(1, { animate: true });
    }, AUTO_ADVANCE_MS);
  }


  stage.addEventListener('mouseenter', () => {
    autoAdvancePaused = true;
    viewerOrbitPausedForHover = true;
    stage.classList.add('is-hovered');
    if (autoAdvanceTimer) {
      window.clearInterval(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
    setViewerOrbit(false);
  });

  stage.addEventListener('mouseleave', () => {
    autoAdvancePaused = false;
    viewerOrbitPausedForHover = false;
    stage.classList.remove('is-hovered');
    setViewerOrbit(true);
    resetAutoAdvance();
  });

  frame.addEventListener('load', () => {
    frameReady = true;
    const doc = frame.contentWindow.document;
    applyViewerChrome(doc);
    stage.classList.add('is-visible');
    if (pendingItem) {
      loadItemIntoViewer(pendingItem, { animate: false });
      pendingItem = null;
    }
    window.setTimeout(() => applyViewerChrome(doc), 80);
    window.setTimeout(() => applyViewerChrome(doc), 240);
    window.setTimeout(() => setViewerOrbit(!viewerOrbitPausedForHover), 120);
    updateButtonState();
    resetAutoAdvance();
  }, { once: true });

  cards.forEach((card) => {
    const item = galleryPublishedItems.find((entry) => String(entry.id || '') === String(card.dataset.fileId || ''));
    const previewBtn = card.querySelector('.gallery-preview-btn');
    const activate = () => {
      if (!item) return;
      loadItemIntoViewer(item, { animate: true });
      frame.scrollIntoView({ behavior: 'smooth', block: 'start' });
      resetAutoAdvance();
    };
    card.addEventListener('click', (event) => {
      if (event.target.closest('a, button')) return;
      activate();
    });
    previewBtn?.addEventListener('click', activate);
  });

  prevButtons.forEach((button) => {
    button.addEventListener('click', () => {
      queueByOffset(-1, { animate: true });
      resetAutoAdvance();
    });
  });

  nextButtons.forEach((button) => {
    button.addEventListener('click', () => {
      queueByOffset(1, { animate: true });
      resetAutoAdvance();
    });
  });

  stage?.addEventListener('mouseenter', () => {
    if (autoAdvanceTimer) {
      window.clearInterval(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
  });

  stage?.addEventListener('mouseleave', () => {
    resetAutoAdvance();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (autoAdvanceTimer) {
        window.clearInterval(autoAdvanceTimer);
        autoAdvanceTimer = null;
      }
    } else {
      resetAutoAdvance();
    }
  });

  updateButtonState();
});
</script>
<?php endif; ?>
<?php render_footer(); ?>

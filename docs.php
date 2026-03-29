<?php
require __DIR__ . '/includes/bootstrap.php';
$sections = site_docs_sections();
$archetypes = site_archetype_reference();
render_header('Documentation', 'docs');
?>
<main class="site-shell page-shell">
  <section class="page-heading">
    <div>
      <span class="page-kicker">Documentation</span>
      <h1>Using the ProGen3D live site</h1>
      <p class="page-intro">This guide focuses on the actual site workflow: authoring grammars, managing drafts, using the live viewer, and publishing pieces into the public gallery.</p>
    </div>
    <div class="topbar-actions">
      <a class="btn btn-secondary" href="reference.php">Open reference</a>
      <a class="btn btn-primary" href="examples.php">Open examples</a>
    </div>
  </section>

  <section class="docs-grid">
    <div class="stack-col">
      <?php foreach ($sections as $section): ?>
        <article class="panel doc-section">
          <h2><?= e($section['title']) ?></h2>
          <?php foreach ($section['body'] as $paragraph): ?>
            <p><?= e($paragraph) ?></p>
          <?php endforeach; ?>
          <?php if (!empty($section['bullets'])): ?>
            <ul class="doc-bullets">
              <?php foreach ($section['bullets'] as $bullet): ?>
                <li><?= e($bullet) ?></li>
              <?php endforeach; ?>
            </ul>
          <?php endif; ?>
        </article>
      <?php endforeach; ?>
    </div>
    <aside class="stack-col">
      <article class="panel">
        <h2>Recommended first session</h2>
        <ol class="feature-list">
          <li>Open the examples page and copy the starter cube.</li>
          <li>Paste it into the editor and run it.</li>
          <li>Save it as your first draft.</li>
          <li>Change scale, material, and grouped transforms.</li>
          <li>Publish when the scene reads clearly in the gallery viewer.</li>
        </ol>
      </article>
      <article class="panel">
        <h2>Common pitfalls</h2>
        <div class="note-block">
          <p><strong>Whitespace is flexible.</strong> Both <code>S(1 2 3)</code> and <code>S ( 1 2 3 )</code> are valid, and expressions may span lines with spaces, tabs, newlines, or carriage returns.</p>
          <p><strong>Groups define scope.</strong> Use <code>[ ... ]</code> when you want transforms, local DS*/DT*, or global GDS*/GDT* state to apply only to cubes emitted while that bracketed group is active.</p>
          <p><strong>Build visually.</strong> Start from one visible primitive before stacking transforms and grouped blocks.</p>
        </div>
      </article>
      <article class="panel">
        <h2>Where to go next</h2>
        <div class="help-links">
          <a class="btn btn-secondary btn-sm" href="reference.php">Syntax reference</a>
          <a class="btn btn-secondary btn-sm" href="examples.php">Copy snippets</a>
          <a class="btn btn-secondary btn-sm" href="gallery.php">Browse gallery</a>
          <a class="btn btn-primary btn-sm" href="editor.php">Open editor</a>
        </div>
      </article>
    </aside>
  </section>


  <section class="section-band archetype-library">
    <article class="page-heading archetype-library__intro">
      <div>
        <span class="page-kicker">Design vocabulary</span>
        <h2><?= e($archetypes['overview']['title']) ?></h2>
        <p class="page-intro"><?= e($archetypes['overview']['intro']) ?></p>
      </div>
      <div class="panel panel-quiet archetype-library__conventions">
        <h3>Conventions</h3>
        <ul class="doc-bullets">
          <?php foreach ($archetypes['overview']['conventions'] as $bullet): ?>
            <li><?= e($bullet) ?></li>
          <?php endforeach; ?>
        </ul>
      </div>
    </article>

    <?php foreach ($archetypes['categories'] as $category): ?>
      <section class="panel archetype-category">
        <header class="archetype-category__head">
          <div>
            <span class="page-kicker">Archetype family</span>
            <h2><?= e($category['title']) ?></h2>
          </div>
          <p><?= e($category['intro']) ?></p>
        </header>

        <div class="archetype-grid">
          <?php foreach ($category['motifs'] as $motif): ?>
            <article class="archetype-card">
              <div class="archetype-card__head">
                <h3><?= e($motif['name']) ?></h3>
                <p><?= e($motif['description']) ?></p>
              </div>

              <div class="archetype-meta">
                <?php foreach ($motif['parameters'] as $param): ?>
                  <span class="example-tag"><?= e($param) ?></span>
                <?php endforeach; ?>
              </div>

              <div class="archetype-card__block">
                <strong>Typical uses</strong>
                <ul class="doc-bullets archetype-uses">
                  <?php foreach ($motif['uses'] as $use): ?>
                    <li><?= e($use) ?></li>
                  <?php endforeach; ?>
                </ul>
              </div>

              <div class="archetype-card__block">
                <strong>Grammar-template pseudocode</strong>
                <pre class="example-code archetype-code"><code><?= e($motif['pseudocode']) ?></code></pre>
              </div>
            </article>
          <?php endforeach; ?>
        </div>
      </section>
    <?php endforeach; ?>
  </section>

</main>
<?php render_footer(); ?>

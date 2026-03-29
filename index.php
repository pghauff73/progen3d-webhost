<?php
require __DIR__ . '/includes/bootstrap.php';
$user = current_user();
$examples = site_examples();
$reference = site_reference_sections();
render_header('Home', 'home');
?>
<main class="home-page">
  <section class="home-stage">
    <div class="site-shell home-hero-grid">
      <article class="hero-main panel panel-hero">
        <div class="hero-copy-wrap">
          <span class="eyebrow">Procedural design live site</span>
          <h1>Author grammars, view scenes live, and publish finished explorations with a cleaner end-to-end flow.</h1>
          <p class="hero-copy">ProGen3D Live Site wraps the modular grammar editor in a focused publishing workflow: write and run grammars, manage private drafts, preview public work in the gallery, and keep documentation, reference, and examples close to the editor instead of scattered across the site.</p>
        </div>
        <div class="hero-actions hero-actions--compact">
          <?php if ($user): ?>
            <a class="btn btn-primary" href="editor.php">Open editor</a>
            <a class="btn btn-secondary" href="files.php">Open workspace</a>
          <?php else: ?>
            <a class="btn btn-primary" href="register.php">Create account</a>
            <a class="btn btn-secondary" href="login.php">Login</a>
          <?php endif; ?>
          <a class="btn btn-ghost" href="gallery.php">Browse published work</a>
        </div>
        <div class="inline-stat-row inline-stat-row--hero">
          <div class="inline-stat"><strong><?= count($examples) ?></strong><span>copy-ready examples</span></div>
          <div class="inline-stat"><strong><?= count($reference) ?></strong><span>reference sections</span></div>
          <div class="inline-stat"><strong>Live</strong><span>gallery scene preview</span></div>
        </div>
      </article>

      <aside class="hero-side stack-col">
        <article class="panel panel-quiet hero-summary-card">
          <span class="page-kicker">What is here</span>
          <h2>One workflow instead of scattered tools</h2>
          <ul class="feature-list feature-list--tight">
            <li>Embedded grammar editor with SmartEditor, live scene viewer, XZ grid, and axis widget.</li>
            <li>Private file library for saving, reopening, publishing, and unpublishing grammars.</li>
            <li>Gallery page with live preview so published pieces can be browsed visually.</li>
            <li>Built-in docs, comprehensive reference, and examples that can be copied or opened directly.</li>
          </ul>
        </article>
        <article class="panel panel-soft mini-summary-card">
          <strong>Current packaged storage</strong>
          <p>This build uses JSON files under <code>storage/</code> for users, files, and counters, so the live site runs without SQL setup.</p>
        </article>
      </aside>
    </div>
  </section>

  <section class="site-shell home-rail">
    <div class="section-heading section-heading--simple">
      <div>
        <span class="page-kicker">Launch points</span>
        <h2>Move through the product from one clear row</h2>
      </div>
    </div>
    <div class="launchpad-grid">
      <a class="route-card" href="editor.php">
        <span class="route-card__eyebrow">Build</span>
        <strong>Editor</strong>
        <p>Write grammar, run scenes, export models, and manage your live authoring session.</p>
      </a>
      <a class="route-card" href="files.php">
        <span class="route-card__eyebrow">Organise</span>
        <strong>Files</strong>
        <p>Reopen saved drafts, keep private versions, and control what becomes public.</p>
      </a>
      <a class="route-card" href="gallery.php">
        <span class="route-card__eyebrow">Preview</span>
        <strong>Gallery</strong>
        <p>See published grammars inside the live viewer and move strong work back into the editor.</p>
      </a>
    </div>
  </section>

  <section class="site-shell process-section">
    <div class="section-heading section-heading--split section-heading--soft">
      <div>
        <span class="page-kicker">Workflow</span>
        <h2>From idea to published grammar</h2>
        <p>Use the live site as a continuous sequence: author, store, and publish without leaving the same environment.</p>
      </div>
      <div class="help-links">
        <a class="btn btn-secondary btn-sm" href="docs.php">Read docs</a>
        <a class="btn btn-secondary btn-sm" href="reference.php">See reference</a>
      </div>
    </div>
    <div class="process-band">
      <article class="process-step">
        <span class="process-step__number">01</span>
        <h3>Author live</h3>
        <p>Start from a primitive, an example, or a saved file. Use the integrated viewer to check scale, symmetry, composition, and scene balance as you write.</p>
      </article>
      <article class="process-step">
        <span class="process-step__number">02</span>
        <h3>Save and iterate</h3>
        <p>Store drafts under your account, reopen them from the file library, and keep polished public pieces separate from in-progress experiments.</p>
      </article>
      <article class="process-step">
        <span class="process-step__number">03</span>
        <h3>Publish and remix</h3>
        <p>Push strong grammars into the gallery, preview them in the live scene viewer, and copy public work back into the editor for new variations.</p>
      </article>
    </div>
  </section>

  <section class="site-shell knowledge-section">
    <div class="section-heading section-heading--split section-heading--simple">
      <div>
        <span class="page-kicker">Knowledge hub</span>
        <h2>Documentation, reference, and examples in one grouped section</h2>
        <p>These pages are organised around the actual bundled editor and live-site workflow, so the guidance matches the runtime instead of drifting into generic notes.</p>
      </div>
    </div>
    <div class="knowledge-grid">
      <article class="knowledge-card panel">
        <span class="route-card__eyebrow">Guide</span>
        <h3>Documentation</h3>
        <p>Workflow guidance, publishing steps, control notes, and first-session recommendations written around the actual site bundle.</p>
        <a class="btn btn-secondary btn-sm" href="docs.php">Open documentation</a>
      </article>
      <article class="knowledge-card panel">
        <span class="route-card__eyebrow">Syntax</span>
        <h3>Reference</h3>
        <p>Operator summaries, structure reminders, grouped transform notes, deformation parameters, and practical reminders for visible grammar features.</p>
        <a class="btn btn-secondary btn-sm" href="reference.php">Open reference</a>
      </article>
      <article class="knowledge-card panel">
        <span class="route-card__eyebrow">Copy</span>
        <h3>Examples</h3>
        <p>Starter cubes, grouped assemblies, architectural arrangements, deform tests, and snippets that can be copied or opened directly into the editor.</p>
        <a class="btn btn-secondary btn-sm" href="examples.php">Browse examples</a>
      </article>
    </div>
  </section>
</main>
<?php render_footer(); ?>

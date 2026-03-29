<?php
require __DIR__ . '/includes/bootstrap.php';
if (current_user()) {
    app_redirect('editor.php');
}

$errors = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $errors[] = 'This registration page requires the Firebase browser flow. Enable JavaScript and create the account again.';
}

render_header('Create account', 'login');
?>
<main class="site-shell auth-shell">
  <section class="auth-grid">
    <article class="auth-card auth-card--intro">
      <div>
        <span class="page-kicker">Create account</span>
        <h1>Start building your ProGen3D workspace</h1>
        <p class="lead">Registration unlocks private file storage, publish-to-gallery controls, and a repeatable workflow around the live modular editor.</p>
      </div>
      <div class="data-points">
        <div class="data-point">Save drafts under your own account</div>
        <div class="data-point">Open examples and adapt them in the editor</div>
        <div class="data-point">Publish selected grammars to the gallery when ready</div>
      </div>
    </article>

    <section class="auth-card">
      <h1>Create account</h1>
      <p class="muted">New registrations create the Firebase account first, then the PHP site mirrors that identity after verified sign-in.</p>
      <?php foreach ($errors as $error): ?>
        <div class="form-error"><?= e($error) ?></div>
      <?php endforeach; ?>
      <form method="post" class="auth-form" data-firebase-auth="register">
        <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
        <div class="form-error" data-firebase-status hidden></div>
        <label>Username
          <input type="text" name="username" required maxlength="32" autocomplete="nickname" value="<?= e($_POST['username'] ?? '') ?>">
        </label>
        <label>Email
          <input type="email" name="email" required maxlength="160" autocomplete="email" value="<?= e($_POST['email'] ?? '') ?>">
        </label>
        <label>Password
          <input type="password" name="password" required autocomplete="new-password">
        </label>
        <label>Confirm password
          <input type="password" name="password_confirm" required autocomplete="new-password">
        </label>
        <button class="btn btn-primary" type="submit">Create account</button>
        <div class="auth-divider" role="separator" aria-label="Or">
          <span>or</span>
        </div>
        <button class="btn btn-provider-google" type="button" data-firebase-google="register">
          <span class="btn-provider-google__mark" aria-hidden="true">G</span>
          <span>Continue with Google</span>
        </button>
      </form>
      <noscript><div class="form-error">JavaScript is required because account creation is handled by Firebase in the browser.</div></noscript>
      <div class="section-band">
        <strong>Already have an account?</strong>
        <p class="muted">Sign in to continue editing your saved grammars.</p>
        <a class="btn btn-secondary btn-sm" href="login.php">Login</a>
      </div>
    </section>
  </section>
</main>
<?php render_footer(); ?>

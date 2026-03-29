<?php
require __DIR__ . '/includes/bootstrap.php';
if (current_user()) {
    app_redirect('editor.php');
}

$error = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $error = 'This sign-in page requires the Firebase browser flow. Enable JavaScript and sign in again.';
}

render_header('Login', 'login');
?>
<main class="site-shell auth-shell">
  <section class="auth-grid">
    <article class="auth-card auth-card--intro">
      <div>
        <span class="page-kicker">Sign in</span>
        <h1>Return to your grammar workspace</h1>
        <p class="lead">Login gives you access to the embedded editor, saved drafts, live publish controls, and gallery remix workflow.</p>
      </div>
      <div class="data-points">
        <div class="data-point">Private draft storage inside the site</div>
        <div class="data-point">Publish or unpublish grammars without leaving your account workspace</div>
        <div class="data-point">Copy gallery work back into the editor for new iterations</div>
      </div>
    </article>

    <section class="auth-card">
      <h1>Login</h1>
      <p class="muted">Firebase sign-in is the primary path. The PHP session is created only after the Firebase identity is verified.</p>
      <?php if ($error): ?>
        <div class="form-error"><?= e($error) ?></div>
      <?php endif; ?>
      <form method="post" class="auth-form" data-firebase-auth="login">
        <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
        <div class="form-error" data-firebase-status hidden></div>
        <label>Email
          <input type="email" name="identity" required autocomplete="email" value="<?= e($_POST['identity'] ?? '') ?>">
        </label>
        <label>Password
          <span class="password-field">
            <input type="password" name="password" required autocomplete="current-password">
            <button class="password-toggle js-password-toggle" type="button" aria-label="Show password" aria-pressed="false">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M1.5 12s3.8-6 10.5-6 10.5 6 10.5 6-3.8 6-10.5 6S1.5 12 1.5 12Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="12" cy="12" r="3.25" fill="none" stroke="currentColor" stroke-width="1.8"/>
              </svg>
            </button>
          </span>
        </label>
        <button class="btn btn-primary" type="submit">Login</button>
        <div class="auth-divider" role="separator" aria-label="Or">
          <span>or</span>
        </div>
        <button class="btn btn-provider-google" type="button" data-firebase-google="login">
          <span class="btn-provider-google__mark" aria-hidden="true">G</span>
          <span>Sign in with Google</span>
        </button>
      </form>
      <noscript><div class="form-error">JavaScript is required because sign-in is handled by Firebase in the browser.</div></noscript>
      <div class="section-band">
        <strong>Need to reset your password?</strong>
        <a class="btn btn-secondary btn-sm" href="forgot-password.php">Forgot password</a>
      </div>
      <div class="section-band">
        <strong>New to this site?</strong>
        <p class="muted">Create an account to save drafts, organise files, and publish grammars into the public gallery.</p>
        <a class="btn btn-secondary btn-sm" href="register.php">Create account</a>
      </div>
    </section>
  </section>
</main>
<?php render_footer(); ?>

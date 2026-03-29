<?php
require __DIR__ . '/includes/bootstrap.php';
if (current_user()) {
    app_redirect('editor.php');
}

$error = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verify_csrf();
    $error = 'This password reset page requires the Firebase browser flow. Enable JavaScript and request the reset email again.';
}

render_header('Forgot Password', 'forgot-password');
?>
<main class="site-shell auth-shell">
  <section class="auth-grid">
    <article class="auth-card auth-card--intro">
      <div>
        <span class="page-kicker">Password reset</span>
        <h1>Request a reset email</h1>
        <p class="lead">Enter the account email address and Firebase will send a password reset link.</p>
      </div>
      <div class="data-points">
        <div class="data-point">The reset link goes only to the registered email address</div>
        <div class="data-point">Password changes happen through the Firebase reset flow</div>
        <div class="data-point">After reset, sign in again to recreate the site session</div>
      </div>
    </article>

    <section class="auth-card">
      <h1>Forgot password</h1>
      <?php if ($error): ?>
        <div class="form-error"><?= e($error) ?></div>
      <?php endif; ?>
      <form method="post" class="auth-form" data-firebase-auth="forgot-password">
        <input type="hidden" name="csrf_token" value="<?= e(csrf_token()) ?>">
        <div class="form-error" data-firebase-status hidden></div>
        <label>Email
          <input type="email" name="email" required autocomplete="email" value="<?= e($_POST['email'] ?? '') ?>">
        </label>
        <button class="btn btn-primary" type="submit">Send reset email</button>
      </form>
      <noscript><div class="form-error">JavaScript is required because password reset email delivery is handled by Firebase in the browser.</div></noscript>
      <div class="section-band">
        <strong>Remembered your password?</strong>
        <a class="btn btn-secondary btn-sm" href="login.php">Back to login</a>
      </div>
    </section>
  </section>
</main>
<?php render_footer(); ?>

<?php
require __DIR__ . '/includes/bootstrap.php';

if (current_user()) {
    app_redirect('editor.php');
}

$hasActionCode = isset($_GET['oobCode']) && trim((string) $_GET['oobCode']) !== '';
render_header('Reset Password', 'login');
?>
<main class="site-shell auth-shell">
  <section class="auth-grid">
    <article class="auth-card auth-card--intro">
      <div>
        <span class="page-kicker">Reset password</span>
        <h1>Choose a new password</h1>
        <p class="lead">Password resets now use the Firebase reset link sent to the account email.</p>
      </div>
      <div class="data-points">
        <div class="data-point">Open the reset link from your inbox</div>
        <div class="data-point">Set the new password here if the link includes a valid action code</div>
        <div class="data-point">After reset, return to login and sign in normally</div>
      </div>
    </article>

    <section class="auth-card">
      <h1>Update password</h1>
      <form class="auth-form" data-firebase-auth="reset-password">
        <div class="form-error" data-firebase-status hidden></div>
        <?php if ($hasActionCode): ?>
          <label>New password
            <input type="password" name="password" required autocomplete="new-password">
          </label>
          <label>Confirm new password
            <input type="password" name="password_confirm" required autocomplete="new-password">
          </label>
          <button class="btn btn-primary" type="submit">Update password</button>
        <?php else: ?>
          <p class="muted">Use the reset link from the email message. This page needs the Firebase action code from that link before a password can be changed.</p>
          <a class="btn btn-secondary" href="forgot-password.php">Request another reset email</a>
        <?php endif; ?>
      </form>
      <noscript><div class="form-error">JavaScript is required because password reset confirmation is handled by Firebase in the browser.</div></noscript>
    </section>
  </section>
</main>
<?php render_footer(); ?>

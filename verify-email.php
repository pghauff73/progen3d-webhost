<?php
require __DIR__ . '/includes/bootstrap.php';

if (current_user()) {
    app_redirect('editor.php');
}

$email = trim((string) ($_GET['email'] ?? ''));
render_header('Verify Email', 'verify-email');
?>
<main class="site-shell auth-shell" data-firebase-page="verify-email">
  <section class="auth-grid">
    <article class="auth-card auth-card--intro">
      <div>
        <span class="page-kicker">Verify email</span>
        <h1>Confirm your email address</h1>
        <p class="lead">Firebase verification now uses an email link instead of the old 6-digit code flow.</p>
      </div>
      <div class="data-points">
        <div class="data-point">Open the verification link from your inbox</div>
        <div class="data-point">After verification, sign in again to create the site session</div>
        <div class="data-point">The first verified sign-in for admin@progen3d.com becomes the site admin</div>
      </div>
    </article>

    <section class="auth-card">
      <h1>Email verification</h1>
      <?php if ($email !== ''): ?>
        <p class="muted">Verification email sent to <?= e($email) ?>.</p>
      <?php else: ?>
        <p class="muted">Use the verification link from the email that Firebase sent to your account.</p>
      <?php endif; ?>
      <div class="form-error" data-firebase-status hidden></div>
      <div class="section-band">
        <strong>Already verified?</strong>
        <p class="muted">Return to login and sign in again. The site session is created only after Firebase reports the email as verified.</p>
        <a class="btn btn-primary btn-sm" href="login.php">Back to login</a>
      </div>
      <div class="section-band">
        <strong>Need another verification email?</strong>
        <p class="muted">If you are still signed in on this browser, you can resend it from here.</p>
        <button class="btn btn-secondary btn-sm" type="button" data-firebase-resend-verification>Resend verification</button>
      </div>
    </section>
  </section>
</main>
<?php render_footer(); ?>

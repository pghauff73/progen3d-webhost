<?php
require __DIR__ . '/includes/bootstrap.php';

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
}
session_destroy();

session_id('');
app_session_start();
csrf_regenerate_token();

render_header('Logout', 'logout');
?>
<main class="site-shell auth-shell" data-firebase-page="logout">
  <section class="auth-grid">
    <article class="auth-card auth-card--intro">
      <div>
        <span class="page-kicker">Logout</span>
        <h1>Ending your session</h1>
        <p class="lead">The local PHP session has been cleared. The page is now signing out the Firebase browser session as well.</p>
      </div>
    </article>

    <section class="auth-card">
      <h1>Signing out</h1>
      <div class="form-error" data-firebase-status hidden></div>
      <p class="muted">If you are not redirected automatically, use the button below.</p>
      <a class="btn btn-primary" href="index.php">Return home</a>
    </section>
  </section>
</main>
<?php render_footer(); ?>

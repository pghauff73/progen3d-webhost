function statusNode(scope) {
  return scope ? scope.querySelector('[data-firebase-status]') : null;
}

function setStatus(scope, message, tone = 'error') {
  const node = statusNode(scope);
  if (!node) return;
  node.hidden = !message;
  node.textContent = message || '';
  node.className = tone === 'success' ? 'form-success' : 'form-error';
}

function requireFirebase(scope) {
  const api = window.P3DFirebase;
  if (!api || !api.ensureInitialized || !api.ensureInitialized()) {
    setStatus(scope, 'Firebase client startup failed. Check the browser console and site config.');
    return null;
  }
  return api;
}

function redirectTo(path) {
  window.location.href = path;
}

async function completeFirebaseLogin(firebase, user) {
  if (!user) {
    throw new Error('Firebase did not return a user.');
  }

  if (!user.emailVerified) {
    if (user.email) {
      await firebase.sendEmailVerification(user);
    }
    await firebase.signOutEverywhere();
    redirectTo(`verify-email.php?email=${encodeURIComponent(user.email || '')}`);
    return;
  }

  await firebase.syncSession(user.displayName || '');
  redirectTo('editor.php');
}

async function handleLogin(form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus(form, 'Signing in...', 'success');
    const firebase = requireFirebase(form);
    if (!firebase) return;

    const identity = String(new FormData(form).get('identity') || '').trim();
    const password = String(new FormData(form).get('password') || '');

    if (!identity.includes('@')) {
      setStatus(form, 'Firebase sign-in uses email addresses. Enter the account email.');
      return;
    }

    try {
      const result = await firebase.signInWithEmailAndPassword(identity, password);
      await completeFirebaseLogin(firebase, result.user);
    } catch (error) {
      setStatus(form, error.message || 'Login failed.');
    }
  });
}

async function handleGoogleAuth(scope, button) {
  if (!button) return;

  button.addEventListener('click', async () => {
    setStatus(scope, 'Opening Google sign-in…', 'success');
    const firebase = requireFirebase(scope);
    if (!firebase) return;

    try {
      const result = await firebase.signInWithGoogle();
      await completeFirebaseLogin(firebase, result.user);
    } catch (error) {
      setStatus(scope, error.message || 'Google sign-in failed.');
    }
  });
}

async function handleRegister(form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus(form, 'Creating account...', 'success');
    const firebase = requireFirebase(form);
    if (!firebase) return;

    const data = new FormData(form);
    const username = String(data.get('username') || '').trim();
    const email = String(data.get('email') || '').trim();
    const password = String(data.get('password') || '');
    const confirm = String(data.get('password_confirm') || '');

    if (password !== confirm) {
      setStatus(form, 'Password confirmation does not match.');
      return;
    }

    try {
      const result = await firebase.createUserWithEmailAndPassword(email, password);
      if (username) {
        await firebase.updateProfile(result.user, { displayName: username });
      }
      await firebase.sendEmailVerification(result.user);
      await firebase.signOutEverywhere();
      redirectTo(`verify-email.php?email=${encodeURIComponent(email)}`);
    } catch (error) {
      setStatus(form, error.message || 'Account creation failed.');
    }
  });
}

async function handleForgotPassword(form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus(form, 'Sending reset email...', 'success');
    const firebase = requireFirebase(form);
    if (!firebase) return;

    const email = String(new FormData(form).get('email') || '').trim();
    if (!email.includes('@')) {
      setStatus(form, 'Enter the account email address.');
      return;
    }

    try {
      await firebase.sendPasswordResetEmail(email);
      setStatus(form, 'Password reset email sent. Use the link in your inbox.', 'success');
    } catch (error) {
      setStatus(form, error.message || 'Password reset email could not be sent.');
    }
  });
}

async function handleVerifyPage(scope) {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('oobCode') || '';
  const mode = params.get('mode') || '';
  const resendButton = document.querySelector('[data-firebase-resend-verification]');

  if (mode === 'verifyEmail' && code) {
    setStatus(scope, 'Applying verification link...', 'success');
    try {
      const firebase = requireFirebase(scope);
      if (!firebase) return;
      await firebase.applyActionCode(code);
      setStatus(scope, 'Email verified. Sign in to continue.', 'success');
    } catch (error) {
      setStatus(scope, error.message || 'Email verification link failed.');
    }
  }

  if (resendButton) {
    resendButton.addEventListener('click', async () => {
      const firebase = requireFirebase(scope);
      if (!firebase) return;
      const user = firebase.currentUser();
      if (!user) {
        setStatus(scope, 'Sign in first if you need another verification email.');
        return;
      }
      try {
        await firebase.sendEmailVerification(user);
        setStatus(scope, 'Verification email sent.', 'success');
      } catch (error) {
        setStatus(scope, error.message || 'Could not resend the verification email.');
      }
    });
  }
}

async function handleResetPage(form) {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('oobCode') || '';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus(form, 'Updating password...', 'success');
    const firebase = requireFirebase(form);
    if (!firebase) return;

    if (!code) {
      setStatus(form, 'Password reset link is missing or expired.');
      return;
    }

    const data = new FormData(form);
    const password = String(data.get('password') || '');
    const confirm = String(data.get('password_confirm') || '');

    if (password !== confirm) {
      setStatus(form, 'Password confirmation does not match.');
      return;
    }

    try {
      await firebase.confirmPasswordReset(code, password);
      setStatus(form, 'Password updated. Sign in with the new password.', 'success');
      window.setTimeout(() => redirectTo('login.php'), 1200);
    } catch (error) {
      setStatus(form, error.message || 'Password reset failed.');
    }
  });
}

async function handleLogoutPage(scope) {
  setStatus(scope, 'Signing out...', 'success');
  const firebase = requireFirebase(scope);
  if (!firebase) {
    window.setTimeout(() => redirectTo('index.php'), 300);
    return;
  }
  await firebase.signOutEverywhere();
  redirectTo('index.php');
}

window.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.querySelector('[data-firebase-auth="login"]');
  if (loginForm) handleLogin(loginForm);
  const loginGoogleButton = document.querySelector('[data-firebase-google="login"]');
  if (loginForm && loginGoogleButton) handleGoogleAuth(loginForm, loginGoogleButton);

  const registerForm = document.querySelector('[data-firebase-auth="register"]');
  if (registerForm) handleRegister(registerForm);
  const registerGoogleButton = document.querySelector('[data-firebase-google="register"]');
  if (registerForm && registerGoogleButton) handleGoogleAuth(registerForm, registerGoogleButton);

  const forgotForm = document.querySelector('[data-firebase-auth="forgot-password"]');
  if (forgotForm) handleForgotPassword(forgotForm);

  const verifyScope = document.querySelector('[data-firebase-page="verify-email"]');
  if (verifyScope) handleVerifyPage(verifyScope);

  const resetForm = document.querySelector('[data-firebase-auth="reset-password"]');
  if (resetForm) handleResetPage(resetForm);

  const logoutScope = document.querySelector('[data-firebase-page="logout"]');
  if (logoutScope) handleLogoutPage(logoutScope);
});

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  applyActionCode,
  confirmPasswordReset
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';

const config = window.P3D_FIREBASE_CONFIG || null;
const baseUrl = new URL('.', window.location.href);

let app = null;
let auth = null;
let firestore = null;
let storage = null;
let initError = null;
let googleProvider = null;

function sessionUrl(action) {
  return `api/session.php?action=${encodeURIComponent(action)}`;
}

function actionUrl(pathname) {
  return new URL(pathname, baseUrl).toString();
}

function ensureInitialized() {
  if (!config) {
    initError = new Error('Firebase config is missing.');
    return false;
  }
  if (app) {
    return true;
  }

  try {
    app = getApps()[0] || initializeApp(config);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    firestore = getFirestore(app);
    storage = getStorage(app);
    return true;
  } catch (error) {
    initError = error;
    return false;
  }
}

async function syncSession(displayName = '') {
  if (!ensureInitialized() || !auth.currentUser) {
    throw new Error(initError?.message || 'Firebase authentication is not ready.');
  }

  const idToken = await auth.currentUser.getIdToken(true);
  const response = await fetch(sessionUrl('login'), {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      idToken,
      displayName
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data || !data.ok) {
    throw new Error((data && data.error) || 'Could not create the site session.');
  }

  return data;
}

async function clearSession() {
  const response = await fetch(sessionUrl('logout'), {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: '{}'
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || !data.ok) {
    throw new Error((data && data.error) || 'Could not clear the site session.');
  }
  return data;
}

async function signOutEverywhere() {
  if (ensureInitialized() && auth) {
    try {
      await signOut(auth);
    } catch (error) {}
  }
  try {
    await clearSession();
  } catch (error) {}
}

window.P3DFirebase = {
  config,
  ensureInitialized,
  get app() {
    ensureInitialized();
    return app;
  },
  get auth() {
    ensureInitialized();
    return auth;
  },
  get firestore() {
    ensureInitialized();
    return firestore;
  },
  get storage() {
    ensureInitialized();
    return storage;
  },
  onAuthStateChanged(callback) {
    ensureInitialized();
    return onAuthStateChanged(auth, callback);
  },
  signInWithEmailAndPassword(email, password) {
    ensureInitialized();
    return signInWithEmailAndPassword(auth, email, password);
  },
  createUserWithEmailAndPassword(email, password) {
    ensureInitialized();
    return createUserWithEmailAndPassword(auth, email, password);
  },
  signInWithGoogle() {
    ensureInitialized();
    return signInWithPopup(auth, googleProvider);
  },
  sendEmailVerification(user) {
    ensureInitialized();
    return sendEmailVerification(user, {
      url: actionUrl('verify-email.php'),
      handleCodeInApp: false
    });
  },
  sendPasswordResetEmail(email) {
    ensureInitialized();
    return sendPasswordResetEmail(auth, email, {
      url: actionUrl('reset-password.php'),
      handleCodeInApp: false
    });
  },
  updateProfile(user, profile) {
    ensureInitialized();
    return updateProfile(user, profile);
  },
  applyActionCode(code) {
    ensureInitialized();
    return applyActionCode(auth, code);
  },
  confirmPasswordReset(code, newPassword) {
    ensureInitialized();
    return confirmPasswordReset(auth, code, newPassword);
  },
  signOutEverywhere,
  syncSession,
  clearSession,
  currentUser() {
    ensureInitialized();
    return auth ? auth.currentUser : null;
  }
};

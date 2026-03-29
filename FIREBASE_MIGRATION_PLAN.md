# Firebase Migration Plan

This repo now runs on Firebase-only runtime storage. The remaining migration work is limited to optional one-time legacy data imports.

## Current blocker

- Firebase Admin credentials are not provisioned in the current runtime. `vendor/autoload.php` is present, but the runtime still needs either `FIREBASE_SERVICE_ACCOUNT_PATH`, `GOOGLE_APPLICATION_CREDENTIALS`, or a valid gcloud Application Default Credentials file before Firebase session exchange, Firestore-backed files, Cloud Storage blobs, and admin bootstrap can work.

## Target architecture

- Firebase Auth for browser sign-in, registration, verification, password reset
- PHP session exchange endpoint to verify Firebase ID tokens and mirror users into the Firestore-backed account model
- Firestore for canonical user profile data and file metadata
- Cloud Storage for grammar content blobs
- `admin@progen3d.com` auto-promoted to admin after first verified sign-in

## Current migration stages

1. Shared Firebase config and browser bootstrap
2. Firebase login/register/logout/password-reset pages
3. PHP token verification and local user/session bridge
4. Firestore + Cloud Storage adapters for file metadata/content
5. Editor/files/gallery/admin cutover to Firebase-backed storage
6. Legacy JSON retirement and data migration
7. Firestore-backed user repository and Firebase-UID session cutover

## File-by-file implementation plan

- [x] `composer.json`
  Add `kreait/firebase-php` as the PHP Admin dependency.

- [x] `includes/firebase.php`
  Centralize Firebase client config, Admin SDK bootstrap, ID token verification, and bootstrap-admin promotion logic.

- [x] `api/session.php`
  Accept Firebase ID tokens, verify them, mirror users into the Firestore-backed user repository, and create the existing PHP session.

- [x] `assets/firebase-client.js`
  Initialize Firebase App/Auth/Firestore/Storage in the browser and expose shared helpers.

- [x] `assets/firebase-auth-pages.js`
  Intercept auth page forms and route them through Firebase Auth.

- [x] `login.php`
  Switch UI to Firebase-only browser sign-in and remove the legacy server-side password fallback.

- [x] `register.php`
  Keep username as display name, but create accounts through Firebase Auth only.

- [x] `verify-email.php`
  Replace local 6-digit code flow with Firebase email-action flow.

- [x] `forgot-password.php`
  Replace local reset-code mail with Firebase password reset email only.

- [x] `reset-password.php`
  Replace local 6-digit reset flow with Firebase reset-link flow only.

- [x] `logout.php`
  Sign out both the local PHP session and the Firebase browser session.

- [x] `includes/bootstrap.php`
  Remove built-in admin account assumptions, move runtime storage out of the web root, and prepare Firestore/Storage-backed helpers.

- [x] `api/file.php`
  Verify Firebase bearer tokens and route save/load/publish calls through Firestore + Cloud Storage only.

- [x] `editor.php`
  Send bearer tokens on file requests and use the Firebase-backed file ids end to end.

- [x] `files.php`
  Render Firestore-backed file listings only.

- [x] `gallery.php`
  Render Firestore-backed published listings only.

- [x] `admin.php`
  Replace built-in admin diagnostics with Firebase runtime/admin diagnostics.

- [x] `bin/migrate-legacy-files-to-firebase.php`
  Backfill legacy `files.json` entries into Firestore + Cloud Storage and stamp the legacy records with the Firebase destination id.

- [x] `firestore.rules` and `storage.rules`
  Commit explicit Firebase security rules instead of relying on out-of-band configuration.

- [x] `storage/users.json` and `storage/files.json`
  Remove them as the source of truth. They remain as offline migration inputs only.

## Cutover notes

- User reads, session lookups, and admin views now use the Firestore user repository only, keyed by Firebase UID.
- Runtime file reads and writes use Firestore + Cloud Storage only.
- Migration scripts skip legacy files whose owners are not yet mapped to a Firebase profile.
- `bin/seed-legacy-firestore-users.php` can create placeholder Firestore owner records for legacy-only accounts so file imports are not blocked on interactive Firebase sign-in.

# ProGen3D Live Site

This package wraps the modular ProGen3D grammar editor in a small PHP site with:

- login and registration
- private grammar storage
- publish to gallery workflow
- live public gallery viewer
- documentation page
- grammar reference page
- copy-ready examples page

## Run locally

```bash
php -S localhost:8000
```

Open:

```text
http://localhost:8000
```

## Checks

Run the active editor/runtime guardrails from the project root:

```bash
npm run test:syntax
npm run test:grammar
```

What they cover:

- `test:syntax` checks the active editor and grammar runtime JavaScript files with `node --check`
- `test:grammar` runs the grammar smoke suite for tokenizer, parser, grouped transforms, matrix ordering, and `Start` entry handling

## Manual QA

After the CLI checks pass, run this browser-side editor checklist:

1. Open `editor.php` and load a small grammar with `Start`, one nested rule call, and two grouped blocks.
2. Run the grammar and confirm the scene viewer renders visible geometry instead of a blank canvas.
3. Toggle `Wrap`, `Auto Orbit`, and `Debug`, then confirm the button labels and debug state update correctly.
4. Edit the grammar and confirm the line gutter stays aligned with the source text while scrolling.
5. Use comments containing `:` and grouped blocks containing rule calls, then confirm the editor does not show false parser warnings.
6. Save the draft, refresh `files.php`, and confirm the draft appears in My Files.
7. Publish the draft, refresh `gallery.php`, and confirm the published item appears with a working viewer.

## Package notes

This streamlined package removes unused development-only artifacts and orphaned editor modules while keeping the active PHP site, editor, viewer, gallery, authentication flow, documentation pages, and published-grammar preview workflow intact.

## Storage

This build now uses Firebase only at runtime:

- Firestore is the canonical store for user profiles and file metadata.
- Cloud Storage stores grammar source content.
- Legacy `users.json` and `files.json` are offline migration inputs only.
- Runtime storage such as `mail-debug.log` lives under `APP_STORAGE_DIR` or `/var/progen3d-storage` by default.

Make sure PHP can write to the runtime storage directory and that Firebase Admin credentials are configured.

## Sessions and CSRF

This site uses PHP sessions and CSRF tokens for login, registration, authenticated form posts, and authenticated API requests.

- Keep cookies enabled in your browser while testing.
- Use one host consistently, for example `http://localhost:8000`.
- Do not switch between `localhost` and `127.0.0.1` during the same session, because they use different session cookies and can trigger CSRF token mismatches.
- Ensure the runtime storage directory remains writable.


## Main pages

- `index.php` — front page
- `docs.php` — workflow documentation
- `reference.php` — operator and syntax reference
- `examples.php` — examples to copy or open in editor
- `editor.php` — authenticated grammar editor page
- `files.php` — authenticated file management
- `gallery.php` — public gallery with live scene viewer
- `view.php` — public read-only viewer for a published grammar

## Notes

- The editor under `assets/editor/` remains the working modular editor bundle.
- The gallery and public viewer both reuse the same live scene renderer in read-only mode.
- The live app is Firebase-backed. Legacy JSON data is kept only for migration tooling.

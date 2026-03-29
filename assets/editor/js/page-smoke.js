#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..', '..', '..');

function runPhp(code) {
  const result = spawnSync('php', ['-d', 'session.save_path=/tmp', '-r', code], {
    cwd: rootDir,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    throw new Error(`PHP render failed.\n${stderr || stdout}`);
  }

  return result.stdout;
}

function renderPage(scriptName, query = {}) {
  const queryKeys = Object.keys(query);
  const queryCode = queryKeys
    .map((key) => `$_GET[${JSON.stringify(key)}] = ${JSON.stringify(String(query[key]))};`)
    .join('\n');
  const queryString = queryKeys.length
    ? '?' + queryKeys.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(query[key]))}`).join('&')
    : '';

  return runPhp(`
    ${queryCode}
    $_SERVER["REQUEST_METHOD"] = "GET";
    $_SERVER["HTTP_HOST"] = "localhost";
    $_SERVER["REQUEST_URI"] = "/${scriptName}${queryString}";
    ob_start();
    include ${JSON.stringify(scriptName)};
    $out = ob_get_clean();
    echo $out;
  `);
}

function renderAuthedEditor(userId) {
  return runPhp(`
    session_id("codex-page-smoke");
    session_start();
    $_SESSION["user_id"] = ${Number(userId)};
    session_write_close();
    $_COOKIE[session_name()] = "codex-page-smoke";
    $_SERVER["REQUEST_METHOD"] = "GET";
    $_SERVER["HTTP_HOST"] = "localhost";
    $_SERVER["REQUEST_URI"] = "/editor.php";
    ob_start();
    include "editor.php";
    $out = ob_get_clean();
    echo $out;
  `);
}

function runTest(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

const galleryHtml = renderPage('gallery.php');
const publicViewHtml = renderPage('view.php', { id: 4 });
const editorHtml = renderAuthedEditor(4);

runTest('gallery page renders live viewer with seeded published entries', () => {
  assert.ok(galleryHtml.includes('id="galleryViewerFrame"'));
  assert.ok(galleryHtml.includes('assets/editor/editor-modular.html?v=20260315-galleryfix'));
  assert.ok(galleryHtml.includes('const galleryPublishedItems ='));
  assert.ok(galleryHtml.includes('"title":"Spiral"'));
  assert.ok(galleryHtml.includes('"title":"Simple Column"'));
  assert.ok(galleryHtml.includes("doc.getElementById('editorSourceInput')"));
  assert.ok(galleryHtml.includes("doc.getElementById('editorRunBtn')"));
});

runTest('public viewer page renders selected published grammar with embedded runtime hooks', () => {
  assert.ok(publicViewHtml.includes('id="publicViewerFrame"'));
  assert.ok(publicViewHtml.includes('Published grammar'));
  assert.ok(publicViewHtml.includes('const publishedGrammarContent ='));
  assert.ok(publicViewHtml.includes('Spiral'));
  assert.ok(publicViewHtml.includes("doc.getElementById('editorSourceInput')"));
  assert.ok(publicViewHtml.includes("doc.getElementById('editorRunBtn')"));
});

runTest('authenticated editor page renders integrated runtime and file actions', () => {
  assert.ok(editorHtml.includes('id="editorSourceInput"'));
  assert.ok(editorHtml.includes('id="editorRunBtn"'));
  assert.ok(editorHtml.includes('id="saveGrammarBtn"'));
  assert.ok(editorHtml.includes('id="publishGrammarBtn"'));
  assert.ok(editorHtml.includes('assets/editor/js/app/editor-integrated-enhancements.js'));
  assert.ok(editorHtml.includes("const csrfToken ="));
  assert.ok(editorHtml.includes("window.addEventListener('load', initIntegratedEditorPage, { once: true });"));
});

console.log('All page smoke tests passed.');

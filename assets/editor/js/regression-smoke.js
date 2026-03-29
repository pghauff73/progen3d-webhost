#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function runTest(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

const siteJs = read('assets/site.js');
const editorPhp = read('editor.php');
const galleryPhp = read('gallery.php');
const viewPhp = read('view.php');

runTest('embed helper keeps gallery and public-viewer runtime hooks available', () => {
  assert.match(siteJs, /function applyEmbeddedViewerChrome\(doc\)/);
  assert.ok(
    !siteJs.includes(".match-topbar, .input-card, .output-card, .layout-splitter, .toolbar, .viewer-toolbar, .editor-viewer-toolbar"),
    'embed helper should not remove the editor input or toolbar runtime nodes'
  );
  assert.ok(
    !siteJs.includes('#editorRunBtn'),
    'embed helper should not explicitly hide the embedded run button'
  );
  assert.ok(
    !siteJs.includes('#editorSourceInput'),
    'embed helper should not explicitly hide the embedded source input'
  );
  assert.ok(
    siteJs.includes("doc.querySelectorAll('.match-topbar').forEach"),
    'embed helper should only strip match-topbar scaffolding nodes'
  );
  assert.ok(
    galleryPhp.includes("doc.getElementById('editorSourceInput')") &&
    galleryPhp.includes("doc.getElementById('editorRunBtn')"),
    'gallery relies on embedded editor source and run controls'
  );
  assert.ok(
    viewPhp.includes("doc.getElementById('editorSourceInput')") &&
    viewPhp.includes("doc.getElementById('editorRunBtn')"),
    'public viewer relies on embedded editor source and run controls'
  );
});

runTest('integrated editor page keeps loading layout-target runtime helpers', () => {
  assert.ok(
    editorPhp.includes('assets/editor/js/app/editor-integrated-enhancements.js'),
    'editor.php must load the integrated editor enhancements for line gutter and Ctrl+Enter support'
  );
  assert.ok(
    !editorPhp.includes('assets/editor/js/app/ui-layout-target.js'),
    'editor.php should not depend on the full layout-target runtime module'
  );
});

console.log('All regression smoke tests passed.');

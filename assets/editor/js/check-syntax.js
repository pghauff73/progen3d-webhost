#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..', '..');
const files = [
  'assets/editor/js/app/editor-app.js',
  'assets/editor/js/app/storage.js',
  'assets/editor/js/app/actions-extra.js',
  'assets/editor/js/app/editor-integrated-enhancements.js',
  'assets/editor/js/app/ui-layout-target.js',
  'assets/editor/js/app/ui-redesign.js',
  'assets/editor/js/app/ui-resizable-layout.js',
  'assets/editor/js/app/editor-diagnostics.js',
  'assets/editor/js/core/grammar.js',
  'assets/editor/js/core/scope-context.js',
  'assets/editor/js/core/lexer-token.js',
  'assets/editor/js/core/grammar-smoke.js',
  'assets/editor/js/page-smoke.js',
  'assets/editor/js/regression-smoke.js',
  'assets/editor/js/optional/smart-editor-v0.4.js',
  'assets/designer/building-generator.js',
  'assets/designer/building-generator-smoke.js',
  'assets/grammar-writer.js',
];

let failed = false;

for (const relativePath of files) {
  const absolutePath = path.join(rootDir, relativePath);
  const result = spawnSync(process.execPath, ['--check', absolutePath], {
    cwd: rootDir,
    encoding: 'utf8',
  });

  if (result.status === 0) {
    console.log(`PASS ${relativePath}`);
    continue;
  }

  failed = true;
  console.error(`FAIL ${relativePath}`);
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

if (failed) {
  process.exit(1);
}

console.log('All syntax checks passed.');

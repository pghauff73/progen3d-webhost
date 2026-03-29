#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadBuildingGenerator() {
  const filePath = path.join(__dirname, 'building-generator.js');
  const source = fs.readFileSync(filePath, 'utf8');
  const sandbox = {
    console,
    Math,
    globalThis: null,
    window: null,
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: filePath });
  return sandbox.window.PG3DBuildingGenerator;
}

function loadGrammarApi() {
  const grammarPath = path.join(__dirname, '..', 'editor', 'js', 'core', 'grammar.js');
  const source = fs.readFileSync(grammarPath, 'utf8');
  const sandboxConsole = {
    log() {},
    warn() {},
    error() {},
    group() {},
    groupEnd() {},
  };
  const sandbox = {
    console: sandboxConsole,
    Math,
    Float32Array,
    globalThis: null,
    window: null,
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(
    `${source}\n;globalThis.__buildingSmokeExports = { Grammar, createRuntime };`,
    sandbox,
    { filename: grammarPath }
  );
  return sandbox.__buildingSmokeExports;
}

function runTest(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

const buildingGenerator = loadBuildingGenerator();
const { Grammar, createRuntime } = loadGrammarApi();

assert.ok(buildingGenerator && typeof buildingGenerator.buildDraft === 'function', 'building generator unavailable');
assert.ok(typeof buildingGenerator.buildSpec === 'function', 'building spec builder unavailable');

const fixtureTypes = ['tower', 'stepped', 'slab', 'bridge', 'courtyard', 'frame'];
const fixtureSeeds = {
  tower: 1874639201,
  stepped: 941205337,
  slab: 2541186003,
  bridge: 318770145,
  courtyard: 4019921777,
  frame: 1264835549,
};

runTest('building generator exposes all expected fixture families', () => {
  assert.deepStrictEqual(Object.keys(fixtureSeeds), fixtureTypes);
});

runTest('building generator exposes a deterministic spec API', () => {
  const spec = buildingGenerator.buildSpec(1874639201, 'tower', {
    width: 2.4,
    depth: 1.8,
    floors: 12,
    floorHeight: 0.5,
    shell: 'darkBasalt',
    accent: 'frostedGlass'
  });
  assert.strictEqual(spec.type, 'tower');
  assert.strictEqual(spec.massing.width, 2.4);
  assert.strictEqual(spec.massing.depth, 1.8);
  assert.strictEqual(spec.massing.floors, 12);
  assert.strictEqual(spec.massing.floorHeight, 0.5);
  assert.strictEqual(spec.shell, 'darkBasalt');
  assert.strictEqual(spec.accent, 'frostedGlass');
});

runTest('building program override drives default massing profile', () => {
  const office = buildingGenerator.buildSpec(4242, 'tower', { program: 'office' });
  const residential = buildingGenerator.buildSpec(4242, 'tower', { program: 'residential' });
  const civic = buildingGenerator.buildSpec(4242, 'tower', { program: 'civic' });
  assert.strictEqual(office.program, 'office');
  assert.strictEqual(residential.program, 'residential');
  assert.strictEqual(civic.program, 'civic');
  assert.ok(residential.massing.floorHeight < office.massing.floorHeight);
  assert.ok(civic.massing.floorHeight > office.massing.floorHeight);
  assert.ok(civic.structure.podiumHeight > office.structure.podiumHeight);
});

runTest('building program override changes emitted facade language', () => {
  const office = buildingGenerator.buildDraft(5151, 'tower', { program: 'office', floors: 10, floorHeight: 0.5 });
  const residential = buildingGenerator.buildDraft(5151, 'tower', { program: 'residential', floors: 10, floorHeight: 0.5 });
  const civic = buildingGenerator.buildDraft(5151, 'tower', { program: 'civic', floors: 10, floorHeight: 0.5 });
  assert.ok(office.grammar.includes('w * 0.88'));
  assert.ok(residential.grammar.includes('w * 0.92'));
  assert.ok(civic.grammar.includes('w * 0.82'));
  assert.ok(civic.grammar.includes('w * 0.86'));
});

for (const type of fixtureTypes) {
  runTest(`building draft shape: ${type}`, () => {
    const draft = buildingGenerator.buildDraft(fixtureSeeds[type], type);
    assert.strictEqual(draft.mode, 'building');
    assert.strictEqual(draft.buildingType, type);
    assert.ok(typeof draft.title === 'string' && draft.title.length > 0);
    assert.ok(typeof draft.primary === 'string' && draft.primary.length > 0);
    assert.ok(typeof draft.secondary === 'string' && draft.secondary.length > 0);
    assert.ok(typeof draft.grammar === 'string' && draft.grammar.includes('Start -> BuildingBody'));
    assert.ok(draft.metrics && typeof draft.metrics === 'object');
  });

  runTest(`building grammar parses: ${type}`, () => {
    const draft = buildingGenerator.buildDraft(fixtureSeeds[type], type);
    const grammar = new Grammar(draft.grammar);
    assert.ok(Array.isArray(grammar.visualTokens));
    assert.ok(grammar.visualTokens.length > 0, 'no visual tokens emitted');
    const runtime = createRuntime(draft.grammar, { seed: fixtureSeeds[type] });
    const emitted = runtime.runAll();
    assert.ok(Array.isArray(emitted));
    assert.ok(emitted.length > 0, 'no runtime instances emitted');
  });
}

runTest('random building mode still returns a valid typed draft', () => {
  const draft = buildingGenerator.buildDraft(123456789, 'random');
  assert.strictEqual(draft.mode, 'building');
  assert.ok(fixtureTypes.includes(draft.buildingType));
  const grammar = new Grammar(draft.grammar);
  assert.ok(grammar.visualTokens.length > 0);
});

runTest('building draft honors explicit design overrides', () => {
  const draft = buildingGenerator.buildDraft(555, 'bridge', {
    width: 1.1,
    height: 3.6,
    span: 4.4,
    floorHeight: 0.28,
    shell: 'grayStone',
    accent: 'glowingPanel'
  });
  assert.strictEqual(draft.buildingType, 'bridge');
  assert.ok(draft.spec);
  assert.strictEqual(draft.spec.structure.towerWidth, 1.1);
  assert.strictEqual(draft.spec.structure.towerHeight, 3.6);
  assert.strictEqual(draft.spec.structure.span, 4.4);
  assert.strictEqual(draft.spec.structure.deckHeight, 0.28);
  assert.strictEqual(draft.spec.shell, 'grayStone');
  assert.strictEqual(draft.spec.accent, 'glowingPanel');
  assert.ok(draft.grammar.includes('TowerLeg( 1.1 3.6 )'));
});

runTest('stepped draft honors explicit depth override in emitted grammar', () => {
  const draft = buildingGenerator.buildDraft(777, 'stepped', {
    width: 2.6,
    depth: 1.2,
    floors: 5,
    floorHeight: 0.42,
    setback: 0.22
  });
  assert.strictEqual(draft.spec.massing.width, 2.6);
  assert.strictEqual(draft.spec.massing.depth, 1.2);
  assert.ok(draft.grammar.includes('TierStack( 5 2.6 1.2 0.42 0.22 )'));
  assert.ok(draft.grammar.includes('S ( spanW h spanD )'));
});

runTest('slab draft honors explicit total width override', () => {
  const draft = buildingGenerator.buildDraft(888, 'slab', {
    width: 5.5,
    bays: 4,
    depth: 1.1,
    floorHeight: 0.45
  });
  assert.strictEqual(draft.spec.massing.width, 5.5);
  assert.strictEqual(draft.spec.structure.bays, 4);
  assert.strictEqual(draft.spec.structure.bay, 1.375);
  assert.ok(draft.grammar.includes('SlabPodium( 5.61 1.166 )'));
  assert.ok(draft.grammar.includes('SlabShaft('));
  assert.ok(draft.grammar.includes(' 4 1.375 0.45 1.1 )'));
});

console.log('All building generator smoke tests passed.');

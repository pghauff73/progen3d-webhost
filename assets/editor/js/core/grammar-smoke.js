#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadGrammarApi() {
  const grammarPath = path.join(__dirname, 'grammar.js');
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
    `${source}\n;globalThis.__grammarSmokeExports = { GrammarTokenizer, parseGrammar, createRuntime, Grammar };`,
    sandbox,
    { filename: grammarPath }
  );
  return sandbox.__grammarSmokeExports;
}

function loadSceneApi() {
  const scenePath = path.join(__dirname, 'scene.js');
  const source = fs.readFileSync(scenePath, 'utf8');
  const sandbox = {
    console,
    Math,
    Float32Array,
    globalThis: null,
    window: null,
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(
    `${source}\n;globalThis.__sceneSmokeExports = { Scene };`,
    sandbox,
    { filename: scenePath }
  );
  return sandbox.__sceneSmokeExports;
}

function approxEqual(actual, expected, epsilon = 1e-6, label = 'value') {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${label}: expected ${expected}, got ${actual}`
  );
}

function runTest(name, fn) {
  fn();
  console.log(`PASS ${name}`);
}

const { GrammarTokenizer, parseGrammar, createRuntime, Grammar } = loadGrammarApi();
const { Scene } = loadSceneApi();

runTest('tokenizer ignores colon inside line comments', () => {
  const tokenizer = new GrammarTokenizer('Start -> I ( Cube grayStone 0.1 ) // ignored : token\n');
  const parseTypes = tokenizer.getParseTokens().map(token => token.type);
  assert.ok(parseTypes.includes('id'));
  assert.ok(!parseTypes.includes(':'));
});

runTest('Grammar bridge exposes canonical visual tokens', () => {
  const grammar = new Grammar('Start -> I ( Cube grayStone 0.1 )');
  assert.ok(Array.isArray(grammar.visualTokens));
  assert.ok(grammar.visualTokens.length > 0);
});

runTest('multi-argument rule calls evaluate correctly', () => {
  const runtime = createRuntime(`
Start -> Pair( 1 2 )
Pair( a b ) -> T ( a b 0 ) I ( Cube grayStone 0.1 )
`);
  const output = runtime.runAll();
  assert.strictEqual(output.length, 1);
  assert.deepStrictEqual(Array.from(output[0].state.T), [1, 2, 0]);
});

runTest('group blocks isolate transforms from sibling blocks', () => {
  const runtime = createRuntime(`
Start -> [ S ( 2 3 4 ) I ( Cube grayStone 0.1 ) ] [ I ( Cube grayStone 0.1 ) ]
`);
  const output = runtime.runAll();
  assert.strictEqual(output.length, 2);
  assert.deepStrictEqual(Array.from(output[0].state.S), [2, 3, 4]);
  assert.deepStrictEqual(Array.from(output[1].state.S), [1, 1, 1]);
});

runTest('random variable statements bind values into later expressions', () => {
  const runtime = createRuntime(`
Start ->
R height ( 2 2 )
R* axis ( 1 1 )
T ( 0 height 0 )
A ( 45 axis )
I ( Cube grayStone 0.1 )
`, { seed: 7 });
  const output = runtime.runAll();
  assert.strictEqual(output.length, 1);
  assert.deepStrictEqual(Array.from(output[0].state.T), [0, 2, 0]);
  approxEqual(output[0].state.A[1], 45, 1e-6, 'axis rotation');
});

runTest('global deformation operators parse and persist in emitted state', () => {
  const runtime = createRuntime(`
Start ->
GDSX ( 1.2 1 1 )
GDTY ( 0 0.25 0 )
I ( Cube grayStone 0.1 )
`);
  const output = runtime.runAll();
  assert.strictEqual(output.length, 1);
  assert.deepStrictEqual(Array.from(output[0].state.GDSX), [1.2, 1, 1]);
  assert.deepStrictEqual(Array.from(output[0].state.GDTY), [0, 0.25, 0]);
});

runTest('group scoping pushes and pops global deformation state for subsets', () => {
  const runtime = createRuntime(`
Start ->
I ( Cube grayStone 0.1 )
[ GDSX ( 1.4 1 1 ) I ( Cube grayStone 0.1 ) ]
I ( Cube grayStone 0.1 )
`);
  const output = runtime.runAll();
  assert.strictEqual(output.length, 3);
  assert.deepStrictEqual(Array.from(output[0].state.GDSX), [1, 1, 1]);
  assert.deepStrictEqual(Array.from(output[1].state.GDSX), [1.4, 1, 1]);
  assert.deepStrictEqual(Array.from(output[2].state.GDSX), [1, 1, 1]);
});

runTest('separate groups with the same global deform values get distinct subset scopes', () => {
  const runtime = createRuntime(`
Start ->
[ GDSZ ( 1 0.5 1 ) I ( Cube grayStone 0.1 ) ]
T ( 0 0 1 )
[ GDSZ ( 1 0.5 1 ) I ( Cube grayStone 0.1 ) ]
`);
  const output = runtime.runAll();
  assert.strictEqual(output.length, 2);
  assert.strictEqual(Array.from(output[0].state.GDSZ)[1], 0.5);
  assert.strictEqual(Array.from(output[1].state.GDSZ)[1], 0.5);
  assert.ok(output[0].state.GDSCOPE);
  assert.ok(output[1].state.GDSCOPE);
  assert.notStrictEqual(output[0].state.GDSCOPE, output[1].state.GDSCOPE);
});

runTest('scene global scale operators deform positive X/Y/Z sides in subset space', () => {
  const scene = new Scene();
  const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const baseGlobal = {
    active: true,
    scopeId: 'subset-scale',
    dsx: [2, 1, 1],
    dsy: [1, 3, 1],
    dsz: [1, 1, 4],
    dtx: [0, 0, 0],
    dty: [0, 0, 0],
    dtz: [0, 0, 0],
  };
  scene.add('Cube', identity, identity, identity, 0, 0, 0.1, 'z', null, baseGlobal);
  scene.applyGlobalAxisDeform();
  const verts = scene.getAll()[0].verts;
  approxEqual(verts[0][0], -0.5, 1e-6, 'negX unchanged');
  approxEqual(verts[1][0], 1.0, 1e-6, 'posX scaled');
  approxEqual(verts[2][1], 1.5, 1e-6, 'posY scaled');
  approxEqual(verts[4][2], 2.0, 1e-6, 'posZ scaled');
});

runTest('scene global translate operators move positive X/Y/Z sides in subset space', () => {
  const scene = new Scene();
  const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const baseGlobal = {
    active: true,
    scopeId: 'subset-translate',
    dsx: [1, 1, 1],
    dsy: [1, 1, 1],
    dsz: [1, 1, 1],
    dtx: [0.25, 0, 0],
    dty: [0, 0.5, 0],
    dtz: [0, 0, -0.75],
  };
  scene.add('Cube', identity, identity, identity, 0, 0, 0.1, 'z', null, baseGlobal);
  scene.applyGlobalAxisDeform();
  const verts = scene.getAll()[0].verts;
  approxEqual(verts[0][0], -0.5, 1e-6, 'negX unchanged');
  approxEqual(verts[1][0], 0.625, 1e-6, 'posX translated');
  approxEqual(verts[2][1], 0.75, 1e-6, 'posY translated');
  approxEqual(verts[4][2], 0.125, 1e-6, 'posZ translated');
});

runTest('scene global deformation stays scoped to matching subset ids', () => {
  const scene = new Scene();
  const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  scene.add('Cube', identity, identity, identity, 0, 0, 0.1, 'z', null, {
    active: true,
    scopeId: 'subset-a',
    dsx: [2, 1, 1],
    dsy: [1, 1, 1],
    dsz: [1, 1, 1],
    dtx: [0, 0, 0],
    dty: [0, 0, 0],
    dtz: [0, 0, 0],
  });
  const translated = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 3, 0, 0, 1]);
  scene.add('Cube', translated, identity, identity, 0, 0, 0.1, 'z', null, {
    active: true,
    scopeId: 'subset-b',
    dsx: [2, 1, 1],
    dsy: [1, 1, 1],
    dsz: [1, 1, 1],
    dtx: [0, 0, 0],
    dty: [0, 0, 0],
    dtz: [0, 0, 0],
  });
  scene.applyGlobalAxisDeform();
  const items = scene.getAll();
  approxEqual(items[0].verts[1][0], 1.0, 1e-6, 'subset A posX scaled in own bounds');
  approxEqual(items[1].verts[1][0], 4.0, 1e-6, 'subset B posX scaled in own bounds');
});

runTest('int() and float() functions evaluate inside expressions', () => {
  const runtime = createRuntime(`
Start ->
T ( int( 1.9 ) float( 2 ) 0 )
I ( Cube grayStone 0.1 )
`);
  const output = runtime.runAll();
  assert.strictEqual(output.length, 1);
  assert.deepStrictEqual(Array.from(output[0].state.T), [1, 2, 0]);
});

runTest('rand() produces bounded runtime values from the seeded RNG', () => {
  const runtime = createRuntime(`
Start ->
T ( rand( 2 2 ) rand( 3 3 ) 0 )
I ( Cube grayStone 0.1 )
`, { seed: 123 });
  const output = runtime.runAll();
  assert.strictEqual(output.length, 1);
  assert.deepStrictEqual(Array.from(output[0].state.T), [2, 3, 0]);
});

runTest('rand(var) rerolls from the stored R variable range', () => {
  const runtime = createRuntime(`
Start ->
R height ( 2 2 )
T ( 0 rand( height ) 0 )
T ( 0 height 0 )
I ( Cube grayStone 0.1 )
`, { seed: 99 });
  const output = runtime.runAll();
  assert.strictEqual(output.length, 1);
  assert.deepStrictEqual(Array.from(output[0].state.T), [0, 4, 0]);
});

runTest('R var rerolls and updates the variable without brackets', () => {
  const runtime = createRuntime(`
Start ->
R height ( 3 3 )
R height
T ( 0 height 0 )
I ( Cube grayStone 0.1 )
`, { seed: 77 });
  const output = runtime.runAll();
  assert.strictEqual(output.length, 1);
  assert.deepStrictEqual(Array.from(output[0].state.T), [0, 3, 0]);
});

runTest('legacy conditional syntax still accepts a single rule call branch', () => {
  const runtime = createRuntime(`
Start -> ?( 1 ) Tall I ( Cube grayStone 0.1 )
Tall -> T ( 0 2 0 ) I ( Cube grayStone 0.1 )
`);
  const output = runtime.runAll();
  assert.strictEqual(output.length, 2);
  assert.deepStrictEqual(Array.from(output[0].state.T), [0, 2, 0]);
  assert.deepStrictEqual(Array.from(output[1].state.T), [0, 0, 0]);
});

runTest('conditional branch lists execute inline statements on each side of ":"', () => {
  const runtime = createRuntime(`
Start -> ?( 1 ) T ( 1 0 0 ) I ( Cube grayStone 0.1 ) : T ( 9 0 0 ) I ( Cube grayStone 0.1 )
`);
  const output = runtime.runAll();
  assert.strictEqual(output.length, 1);
  assert.deepStrictEqual(Array.from(output[0].state.T), [1, 0, 0]);
});

runTest('axis primitives advance the local transform by one unit after instancing', () => {
  const runtime = createRuntime(`
Start -> I ( CubeY grayStone 0.1 ) I ( CubeY grayStone 0.1 ) [ A ( 90 1 ) I ( CubeX grayStone 0.1 ) I ( CubeX grayStone 0.1 ) ]
`);
  const output = runtime.runAll();
  assert.strictEqual(output.length, 4);
  approxEqual(output[0].state.M[13], 0, 1e-6, 'first CubeY y');
  approxEqual(output[1].state.M[13], 1, 1e-6, 'second CubeY y');
  approxEqual(output[2].state.M[12], 0, 1e-6, 'first CubeX x');
  approxEqual(output[3].state.M[14], -1, 1e-6, 'second rotated CubeX z');
});

runTest('ordered matrix multiplication keeps translation independent from later scale', () => {
  const runtime = createRuntime('Start -> T ( 0 1 0 ) S ( 2 2 2 ) I ( Cube grayStone 0.1 )');
  const output = runtime.runAll();
  assert.strictEqual(output.length, 1);
  const matrix = output[0].state.M;
  approxEqual(matrix[0], 2, 1e-6, 'scale x');
  approxEqual(matrix[5], 2, 1e-6, 'scale y');
  approxEqual(matrix[10], 2, 1e-6, 'scale z');
  approxEqual(matrix[13], 1, 1e-6, 'translate y');
});

runTest('transform args accept unary minus on later whitespace-separated positions', () => {
  const runtime = createRuntime('Start -> T ( 1 -2 -3 ) I ( Cube grayStone 0.1 )');
  const output = runtime.runAll();
  assert.strictEqual(output.length, 1);
  assert.deepStrictEqual(Array.from(output[0].state.T), [1, -2, -3]);
});

runTest('transform args accept parenthesized third expressions after bare variables', () => {
  const runtime = createRuntime(`
Start ->
R depth ( 2 2 )
R slabH ( 3 3 )
R bays ( 4 4 )
S ( ( bays * 1.2 ) + 0.8 slabH ( depth * 1.2 ) + 0.8 )
I ( Cube grayStone 0.1 )
`, { seed: 5 });
  const output = runtime.runAll();
  assert.strictEqual(output.length, 1);
  assert.deepStrictEqual(Array.from(output[0].state.S), [5.6, 3, 3.2]);
});

runTest('transform args accept parenthesized third expressions without spacing after the second term', () => {
  const runtime = createRuntime(`
Start ->
R depth ( 2 2 )
R slabH ( 3 3 )
R bays ( 4 4 )
S ( ( bays * 1.2 ) + 0.8 slabH(( depth * 1.2 ) + 0.8) )
I ( Cube grayStone 0.1 )
`, { seed: 5 });
  const output = runtime.runAll();
  assert.strictEqual(output.length, 1);
  assert.deepStrictEqual(Array.from(output[0].state.S), [5.6, 3, 3.2]);
});

runTest('expressions can span newlines inside transform arguments', () => {
  const runtime = createRuntime(`
Start ->
T (
  1 +
  2
  3 *
  2
  0
)
I ( Cube grayStone 0.1 )
`);
  const output = runtime.runAll();
  assert.strictEqual(output.length, 1);
  assert.deepStrictEqual(Array.from(output[0].state.T), [3, 6, 0]);
});

runTest('conditional expressions can span newlines', () => {
  const runtime = createRuntime(`
Start -> ?(
  1 +
  1
  ==
  2
) T ( 4 0 0 ) I ( Cube grayStone 0.1 ) : T ( 9 0 0 ) I ( Cube grayStone 0.1 )
`);
  const output = runtime.runAll();
  assert.strictEqual(output.length, 1);
  assert.deepStrictEqual(Array.from(output[0].state.T), [4, 0, 0]);
});

runTest('expressions accept spaces tabs carriage returns and newlines between tokens', () => {
  const runtime = createRuntime('Start -> T (\r\n\t1 \t+\r\n 2\t\r 3 \n +\t4\r\n 0\r\n) I ( Cube grayStone 0.1 )');
  const output = runtime.runAll();
  assert.strictEqual(output.length, 1);
  assert.deepStrictEqual(Array.from(output[0].state.T), [3, 7, 0]);
});

runTest('parser tolerates redundant closing parens in continued multiplication chains', () => {
  const grammarAst = parseGrammar(`
Start -> UpperStrip( 0 28 1.2 0.12 )
UpperStrip(i n chord thick) ->
[
  S(chord/n thick*(0.2969*sqrt((i+0.5)/n)-0.1260*((i+0.5)/n)-0.3516*((i+0.5)/n)*((i+0.5)/n)+0.2843*((i+0.5)/n)*((i+0.5)/n)*((i+0.5)/n)-0.1015*((i+0.5)/n)*i+0.5)/n)*((i+0.5)/n)*((i+0.5)/n)) 0.03)
  I ( CubeX grayStone 0.1 )
]
`);
  assert.strictEqual(grammarAst.entry, 'Start');
  assert.ok(grammarAst.rules.has('UpperStrip'));
});

runTest('parseGrammar keeps Start rule available in the rule map', () => {
  const grammarAst = parseGrammar(`
Start -> Base
Base -> I ( Cube grayStone 0.1 )
`);
  assert.strictEqual(grammarAst.entry, 'Start');
  assert.ok(grammarAst.rules.has('Start'));
  assert.ok(grammarAst.rules.has('Base'));
});

console.log('All grammar smoke tests passed.');

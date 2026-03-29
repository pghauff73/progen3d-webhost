(function () {
  'use strict';

  const STORAGE_KEY = 'p3d_writer_draft_v1';
  const MAX_ERROR_RETRIES = 10;
  const REGENERATE_DELAY_MS = 10000;
  const resultsEl = document.getElementById('writerResults');
  const seedInput = document.getElementById('writerSeed');
  const countInput = document.getElementById('writerCount');
  const depthInput = document.getElementById('writerDepth');
  const overlapInput = document.getElementById('writerOverlap');
  const joinStrategyInput = document.getElementById('writerJoinStrategy');
  const symmetryInput = document.getElementById('writerSymmetry');
  const densityInput = document.getElementById('writerDensity');
  const motifInput = document.getElementById('writerMotif');
  const generateBtn = document.getElementById('writerGenerateBtn');
  const randomSeedBtn = document.getElementById('writerRandomSeedBtn');
  if (!resultsEl || !seedInput || !countInput || !depthInput || !generateBtn || !randomSeedBtn) return;

  const texturePool = [
    'roughConcrete', 'smoothConcrete', 'redBrickWall', 'whiteTiles', 'blueCeramicTile',
    'shinySteel', 'brushedAluminum', 'oxidizedCopper', 'agedBronze', 'rawIron',
    'clearGlass', 'frostedGlass', 'tintedGreenGlass', 'grayStone', 'darkBasalt',
    'oakPlanks', 'darkWalnut', 'pineWood', 'mahoganyWood', 'carbonFiber',
    'steelGrid', 'chromeSurface', 'glowingPanel', 'greenMarble', 'whiteMarble'
  ];
  const overlapMap = { loose: 0.08, joined: 0.18, fused: 0.30 };
  const overlapLabels = { loose: 'Loose', joined: 'Joined', fused: 'Fused' };
  const joinLabels = { socket: 'Socket core', collar: 'Collar band', spine: 'Spine strut', hybrid: 'Hybrid join' };
  const densityMap = { sparse: 0.82, medium: 1.0, dense: 1.24 };
  const densityLabels = { sparse: 'Sparse', medium: 'Medium', dense: 'Dense' };
  const symmetryLabels = { balanced: 'Balanced', radial: 'Radial', bilateral: 'Bilateral', asymmetric: 'Asymmetric' };
  const motifFamilies = {
    foundational: ['Stack', 'Ring', 'Spokes', 'Band', 'Grid'],
    derived: ['RingStack', 'Spiral', 'Fork', 'RadialGrid', 'Ribbon'],
    architectural: ['TerracedStack', 'FacadeBandGrid', 'VaultedRingGrid', 'RadialCanopy'],
    fractal: ['RecursiveRing'],
    symmetry: ['Dihedral']
  };
  const familyWeights = {
    foundational: 1.0,
    derived: 0.95,
    architectural: 0.9,
    fractal: 0.6,
    symmetry: 0.55
  };
  const motifTitleLeads = {
    Stack: ['Tower', 'Column', 'Pagoda', 'Spire'],
    Ring: ['Halo', 'Orbit', 'Collar', 'Wheel'],
    Spokes: ['Canopy', 'Star', 'Petal', 'Ribbed'],
    Band: ['Bridge', 'Span', 'Track', 'Rib'],
    Grid: ['Matrix', 'Field', 'Lattice', 'Array'],
    RingStack: ['Concentric', 'Tiered', 'Cage', 'Amphi'],
    Spiral: ['Helix', 'Spiral', 'Ramp', 'Twist'],
    Fork: ['Forked', 'Branching', 'Arbor', 'Split'],
    RadialGrid: ['Plaza', 'Stadium', 'Solar', 'Polar'],
    Ribbon: ['Ribbon', 'Sweep', 'Skin', 'Stream'],
    TerracedStack: ['Terraced', 'Setback', 'Ziggurat', 'Stepped'],
    FacadeBandGrid: ['Facade', 'Curtain', 'Window', 'Panel'],
    VaultedRingGrid: ['Vaulted', 'Hall', 'Arch', 'Canopy'],
    RadialCanopy: ['Umbrella', 'Canopy', 'Shelter', 'Bloom'],
    RecursiveRing: ['Filigree', 'Recursive', 'Nested', 'Lace'],
    Dihedral: ['Dihedral', 'Paired', 'Bilateral', 'Lobed']
  };
  const titleTails = ['Lantern', 'Pavilion', 'Crown', 'Grove', 'Lattice', 'Bloom', 'Vault', 'Shelter'];

  const draftOrder = [];
  const draftStore = new Map();
  let generationSerial = 0;

  function snapshotDraft(draft) {
    if (!draft) return null;
    return {
      id: draft.id,
      title: draft.title,
      grammar: draft.grammar,
      motifs: Array.isArray(draft.motifs) ? draft.motifs.slice() : [],
      forks: Array.isArray(draft.forks) ? draft.forks.slice() : [],
      depth: draft.depth,
      seed: draft.seed,
      textureSet: draft.textureSet,
      overlapLabel: draft.overlapLabel,
      overlapRatio: draft.overlapRatio,
      joinStrategyLabel: draft.joinStrategyLabel,
      symmetryLabel: draft.symmetryLabel,
      densityLabel: draft.densityLabel,
      primaryArchetype: draft.primaryArchetype,
      secondaryArchetype: draft.secondaryArchetype,
      familySignature: draft.familySignature,
      cubeCount: draft.cubeCount,
      status: draft.status,
      validationMessage: draft.validationMessage,
      validationRuns: draft.validationRuns,
      errorCount: draft.errorCount
    };
  }

  function updateWriterBridge() {
    const primaryDraft = draftOrder.length ? draftStore.get(draftOrder[0]) : null;
    const snapshot = snapshotDraft(primaryDraft);
    window.PG3DWriterState = window.PG3DWriterState || {};
    window.PG3DWriterState.getPrimaryDraft = function () {
      return snapshotDraft(draftOrder.length ? draftStore.get(draftOrder[0]) : null);
    };
    window.PG3DWriterState.latestDraft = snapshot;
    if (snapshot) {
      window.dispatchEvent(new CustomEvent('pg3d-writer-draft', {
        detail: snapshot
      }));
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] || ch;
    });
  }

  function formatNum(value) {
    return Number(value).toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  }

  function nextSeed(base, offset) {
    return (((base >>> 0) || 1) + (((offset + 1) * 2654435761) >>> 0)) >>> 0;
  }

  function clearValidationState() {
    if (typeof variable_list !== 'undefined' && Array.isArray(variable_list)) variable_list.length = 0;
    if (typeof full_variable_list !== 'undefined' && Array.isArray(full_variable_list)) full_variable_list.length = 0;
  }

  function countGeneratedCubes(grammar) {
    const visualTokens = Array.isArray(grammar?.visualTokens) ? grammar.visualTokens : null;
    if (!visualTokens) return 0;
    let total = 0;
    for (const tok of visualTokens) {
      if (!tok || tok.token_name !== 'I') continue;
      if (String(tok.instance_type || '').indexOf('Cube') === 0) {
        total += Math.max(1, Number(tok.instance_count || 1));
      }
    }
    return total;
  }

  function validateGrammarWithParser(grammarText) {
    const trimmed = String(grammarText || '').trim();
    if (!trimmed) return { ok: false, message: 'Empty grammar draft.', cubes: 0 };
    if (typeof Grammar !== 'function') {
      return { ok: false, message: 'Grammar parser is not available on this page.', cubes: 0 };
    }
    try {
      clearValidationState();
      if (typeof RNG !== 'undefined' && RNG && typeof RNG.setSeed === 'function') {
        RNG.setSeed(Date.now() >>> 0);
      }
      const grammar = new Grammar(trimmed);
      return { ok: true, message: 'Parser check passed.', cubes: countGeneratedCubes(grammar) };
    } catch (err) {
      return {
        ok: false,
        message: err && err.message ? err.message : 'Unknown grammar parser error.',
        cubes: 0
      };
    }
  }

  function statusLabel(status) {
    switch (status) {
      case 'valid': return '✓ Error free';
      case 'invalid': return 'Parser error';
      case 'retrying': return 'Retry queued';
      case 'halted': return 'Stopped';
      default: return 'Checking';
    }
  }

  function clearDraftTimers() {
    draftStore.forEach(function (draft) {
      if (draft.retryTimer) {
        clearTimeout(draft.retryTimer);
        draft.retryTimer = null;
      }
    });
  }

  function renderScripts() {
    resultsEl.innerHTML = draftOrder.map(function (id, index) {
      const item = draftStore.get(id);
      if (!item) return '';
      const motifTags = item.motifs.map(function (motif) {
        return '<span class="example-tag">' + escapeHtml(motif) + '</span>';
      }).join('');
      const openDisabled = item.status !== 'valid';
      const cubeSummary = item.status === 'valid' ? ' · cubes ' + escapeHtml(item.cubeCount) : '';
      const errorSummary = item.errorCount > 0 ? ' · parser errors ' + escapeHtml(item.errorCount) + '/' + MAX_ERROR_RETRIES : '';
      const retrySummary = item.status === 'retrying' ? ' · regenerating in 10 seconds' : '';
      return [
        '<article class="writer-card panel">',
        '  <div class="writer-card__head">',
        '    <div>',
        '      <span class="page-kicker">Draft ' + (index + 1) + '</span>',
        '      <h3>' + escapeHtml(item.title) + '</h3>',
        '      <p>Seed ' + escapeHtml(item.seed) + ' · motif ' + escapeHtml(item.primaryArchetype) + ' · family ' + escapeHtml(item.familySignature) + ' · join ' + escapeHtml(item.overlapLabel || 'Joined') + ' / ' + escapeHtml(item.joinStrategyLabel || 'Socket') + ' · symmetry ' + escapeHtml(item.symmetryLabel || 'Balanced') + ' · density ' + escapeHtml(item.densityLabel || 'Medium') + '</p>',
        '    </div>',
        '    <div class="writer-card__actions">',
        '      <button class="btn btn-secondary btn-sm js-copy-writer" type="button" data-copy-label="Copy grammar" data-grammar="' + escapeHtml(item.grammar) + '">Copy grammar</button>',
        '      <a class="btn btn-primary btn-sm js-open-writer' + (openDisabled ? ' is-disabled' : '') + '" href="editor.php"' + (openDisabled ? ' aria-disabled="true" tabindex="-1"' : '') + ' data-title="' + escapeHtml(item.title) + '" data-grammar="' + escapeHtml(item.grammar) + '">Open in editor</a>',
        '    </div>',
        '  </div>',
        '  <div class="writer-card__validation">',
        '    <span class="writer-status writer-status--' + escapeHtml(item.status) + '">' + escapeHtml(statusLabel(item.status)) + '</span>',
        '    <p class="writer-validation-message">' + escapeHtml(item.validationMessage || 'Waiting for parser check...') + '</p>',
        '    <p class="writer-validation-detail">Checks run ' + escapeHtml(item.validationRuns) + cubeSummary + errorSummary + retrySummary + '</p>',
        '  </div>',
        '  <div class="writer-card__meta">' + motifTags + '<span class="example-tag">' + escapeHtml(item.familySignature) + '</span><span class="example-tag">' + escapeHtml(item.textureSet) + '</span></div>',
        '  <pre class="example-code writer-code"><code>' + escapeHtml(item.grammar) + '</code></pre>',
        '</article>'
      ].join('');
    }).join('');
    updateWriterBridge();
  }

  class SingleMotifGrammarWriter {
    constructor(seed, options = {}) {
      this.seed = (seed >>> 0) || 1;
      this.initialSeed = this.seed;
      this.options = options;
    }

    rand() {
      let x = this.seed >>> 0;
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      this.seed = x >>> 0;
      return (this.seed >>> 0) / 4294967296;
    }

    randInt(min, max) {
      return Math.floor(this.rand() * (max - min + 1)) + min;
    }

    randFloat(min, max) {
      return min + (max - min) * this.rand();
    }

    pick(arr) {
      return arr[this.randInt(0, arr.length - 1)];
    }

    weightedPick(items, weightFn) {
      const total = items.reduce((sum, item) => sum + Math.max(0.0001, weightFn(item)), 0);
      let r = this.rand() * total;
      for (const item of items) {
        r -= Math.max(0.0001, weightFn(item));
        if (r <= 0) return item;
      }
      return items[items.length - 1];
    }

    archetypeFamily(name) {
      for (const family of Object.keys(motifFamilies)) {
        if (motifFamilies[family].indexOf(name) >= 0) return family;
      }
      return 'foundational';
    }

    pickOverlapMode() {
      const raw = String(this.options.overlap || 'joined').toLowerCase();
      return overlapMap[raw] != null ? raw : 'joined';
    }

    pickOverlapRatio() {
      return overlapMap[this.pickOverlapMode()] ?? overlapMap.joined;
    }

    pickJoinStrategy() {
      const raw = String(this.options.joinStrategy || 'socket').toLowerCase();
      return joinLabels[raw] ? raw : 'socket';
    }

    pickSymmetryBias() {
      const raw = String(this.options.symmetry || 'balanced').toLowerCase();
      return symmetryLabels[raw] ? raw : 'balanced';
    }

    pickDensityMode() {
      const raw = String(this.options.density || 'medium').toLowerCase();
      return densityLabels[raw] ? raw : 'medium';
    }

    pickDensityScale() {
      return densityMap[this.pickDensityMode()] ?? densityMap.medium;
    }

    pickMotif() {
      const requested = String(this.options.motif || 'random');
      const all = Object.values(motifFamilies).flat();
      if (requested && requested !== 'random' && all.indexOf(requested) >= 0) {
        return requested;
      }
      return this.weightedPick(all, (name) => {
        const family = this.archetypeFamily(name);
        return familyWeights[family] || 1;
      });
    }

    makeTitle(motif) {
      const lead = this.pick(motifTitleLeads[motif] || motifTitleLeads.Stack);
      const tail = this.pick(titleTails);
      return [lead, tail].join(' ');
    }

    buildRule(header, lines, repeatExpr = '') {
      const repeatSuffix = repeatExpr ? (' ' + repeatExpr) : '';
      return [header + repeatSuffix + ' ->'].concat(lines).join('\n');
    }

    pushBlock(lines, bodyLines) {
      lines.push('[');
      bodyLines.forEach((entry) => lines.push('  ' + entry));
      lines.push(']');
    }

    pushConnector(lines, y, radius, height, texture, mode, axisName) {
      const r = Math.max(0.12, radius);
      const h = Math.max(0.12, height);
      if (mode === 'hybrid') {
        this.pushBlock(lines, [
          'T ( 0 ' + formatNum(y) + ' 0 )',
          'S ( ' + formatNum(r * 0.70) + ' ' + formatNum(h * 1.05) + ' ' + formatNum(r * 0.70) + ' )',
          'I ( CubeY ' + texture + ' ' + formatNum(Math.max(0.10, r * 0.18)) + ' )'
        ]);
        this.pushBlock(lines, [
          'T ( 0 ' + formatNum(y) + ' 0 )',
          'S ( ' + formatNum(r * 1.18) + ' ' + formatNum(h * 0.34) + ' ' + formatNum(r * 1.18) + ' )',
          'I ( Cube ' + texture + ' ' + formatNum(Math.max(0.10, r * 0.22)) + ' )'
        ]);
        return;
      }
      if (mode === 'collar') {
        this.pushBlock(lines, [
          'T ( 0 ' + formatNum(y) + ' 0 )',
          'S ( ' + formatNum(r * 1.16) + ' ' + formatNum(h * 0.42) + ' ' + formatNum(r * 1.16) + ' )',
          'I ( Cube ' + texture + ' ' + formatNum(Math.max(0.10, r * 0.22)) + ' )'
        ]);
        return;
      }
      if (mode === 'spine') {
        const primitive = axisName === 'x' ? 'CubeX' : axisName === 'z' ? 'CubeZ' : 'CubeY';
        const sx = axisName === 'x' ? h : r * 0.44;
        const sy = axisName === 'y' ? h : r * 0.44;
        const sz = axisName === 'z' ? h : r * 0.44;
        this.pushBlock(lines, [
          'T ( 0 ' + formatNum(y) + ' 0 )',
          'S ( ' + formatNum(sx) + ' ' + formatNum(sy) + ' ' + formatNum(sz) + ' )',
          'I ( ' + primitive + ' ' + texture + ' ' + formatNum(Math.max(0.10, r * 0.20)) + ' )'
        ]);
        return;
      }
      this.pushBlock(lines, [
        'T ( 0 ' + formatNum(y) + ' 0 )',
        'S ( ' + formatNum(r * 0.94) + ' ' + formatNum(h) + ' ' + formatNum(r * 0.94) + ' )',
        'I ( CubeY ' + texture + ' ' + formatNum(Math.max(0.10, r * 0.20)) + ' )'
      ]);
    }

    buildMotifRule(motif, spec, ruleName = 'MotifBody') {
      const lines = [];
      const helperRules = [];
      const r = spec.radius;
      const h = spec.height;
      const overlap = spec.overlap;
      const accent = spec.accentTexture;
      const densityScale = spec.densityScale;
      const symmetry = spec.symmetryBias;
      const joinStrategy = spec.joinStrategy;
      const pushRuleWithRepeat = (header, repeatExpr, bodyLines) => {
        helperRules.push(this.buildRule(header, bodyLines, repeatExpr));
      };
      const addRing = (count, ringRadius, y, scale) => {
        for (let k = 0; k < count; k += 1) {
          this.pushBlock(lines, [
            'A ( ' + formatNum((360 * k) / count) + ' 1 )',
            'T ( ' + formatNum(ringRadius) + ' ' + formatNum(y) + ' 0 )',
            'S ( ' + formatNum(scale) + ' ' + formatNum(scale * 0.42) + ' ' + formatNum(scale) + ' )',
            'I ( Cube ' + accent + ' ' + formatNum(Math.max(0.10, scale * 0.42)) + ' )'
          ]);
        }
      };
      const addSpokes = (count, spokeRadius, y, xScale, zScale) => {
        for (let k = 0; k < count; k += 1) {
          this.pushBlock(lines, [
            'A ( ' + formatNum((360 * k) / count) + ' 1 )',
            'T ( ' + formatNum(spokeRadius) + ' ' + formatNum(y) + ' 0 )',
            'S ( ' + formatNum(xScale) + ' ' + formatNum(r * 0.16) + ' ' + formatNum(zScale) + ' )',
            'I ( CubeX ' + accent + ' ' + formatNum(Math.max(0.10, zScale * 0.42)) + ' )'
          ]);
        }
      };
      const motifRadius = r * (2.35 - overlap * 0.45);
      const countScale = Math.max(1, densityScale);
      this.pushConnector(lines, 0, r * 0.70, Math.max(r * 0.18, h * 0.06), accent, joinStrategy, 'y');

      switch (motif) {
        case 'Stack': {
          const count = Math.max(2, Math.min(10, Math.round((3 + this.randInt(0, 4)) * countScale)));
          const step = r * (0.58 - overlap * 0.14);
          lines.push('StackRun( ' + count + ' ' + formatNum(step) + ' )');
          pushRuleWithRepeat('StackRun( count step )', 'count', [
            '[',
            '  T ( 0 ri * step 0 )',
            '  S ( ' + formatNum(r * 0.78) + ' ' + formatNum(r * 0.34) + ' ' + formatNum(r * 0.78) + ' )',
            '  I ( CubeY ' + accent + ' ' + formatNum(Math.max(0.12, r * 0.28)) + ' )',
            ']'
          ]);
          break;
        }
        case 'Ring': {
          const count = Math.max(6, Math.min(20, Math.round((8 + this.randInt(0, 5)) * countScale)));
          lines.push('RingArc( ' + count + ' ' + formatNum(motifRadius) + ' ' + formatNum(h * 0.06) + ' ' + formatNum(r * 0.56) + ' )');
          pushRuleWithRepeat('RingArc( count rr yy ss )', 'count', [
            '[',
            '  A ( ri * ( 360 / count ) 1 )',
            '  T ( rr yy 0 )',
            '  S ( ss ss * 0.42 ss )',
            '  I ( Cube ' + accent + ' ' + formatNum(Math.max(0.10, r * 0.24)) + ' )',
            ']'
          ]);
          break;
        }
        case 'Spokes': {
          const count = Math.max(4, Math.min(18, Math.round((6 + this.randInt(0, 4)) * countScale)));
          lines.push('SpokeArc( ' + count + ' ' + formatNum(motifRadius) + ' 0 ' + formatNum(r * 1.45) + ' ' + formatNum(r * 0.34) + ' )');
          pushRuleWithRepeat('SpokeArc( count rr yy sx sz )', 'count', [
            '[',
            '  A ( ri * ( 360 / count ) 1 )',
            '  T ( rr yy 0 )',
            '  S ( sx ' + formatNum(r * 0.16) + ' sz )',
            '  I ( CubeX ' + accent + ' ' + formatNum(Math.max(0.10, r * 0.22)) + ' )',
            ']'
          ]);
          break;
        }
        case 'Band': {
          const count = Math.max(3, Math.min(14, Math.round((4 + this.randInt(0, 4)) * countScale)));
          const span = motifRadius * 1.35;
          const step = count > 1 ? span / (count - 1) : 0;
          lines.push('BandRun( ' + count + ' ' + formatNum(span) + ' ' + formatNum(step) + ' )');
          pushRuleWithRepeat('BandRun( count span step )', 'count', [
            '[',
            '  T ( -span * 0.5 + ri * step 0 0 )',
            '  S ( ' + formatNum(r * 0.74) + ' ' + formatNum(r * 0.18) + ' ' + formatNum(r * 0.46) + ' )',
            '  I ( CubeX ' + accent + ' ' + formatNum(Math.max(0.10, r * 0.22)) + ' )',
            ']'
          ]);
          break;
        }
        case 'Grid': {
          const gridN = Math.max(2, Math.min(6, Math.round((2 + this.randInt(0, 2)) * countScale)));
          const span = r * 1.02;
          const half = (gridN - 1) * 0.5;
          lines.push('GridRows( ' + gridN + ' ' + formatNum(span) + ' ' + formatNum(half) + ' )');
          pushRuleWithRepeat('GridRows( n span half )', 'n', [
            '[ GridCols( n span half ri ) ]'
          ]);
          pushRuleWithRepeat('GridCols( n span half gx )', 'n', [
            '[',
            '  T ( ( gx - half ) * span 0 ( ri - half ) * span )',
            '  S ( ' + formatNum(r * 0.48) + ' ' + formatNum(r * 0.16) + ' ' + formatNum(r * 0.48) + ' )',
            '  I ( Cube ' + accent + ' ' + formatNum(Math.max(0.10, r * 0.22)) + ' )',
            ']'
          ]);
          break;
        }
        case 'RingStack': {
          const layers = Math.max(2, Math.min(5, Math.round((2 + this.randInt(0, 2)) * countScale)));
          for (let layer = 0; layer < layers; layer += 1) {
            addRing(Math.max(6, Math.min(20, Math.round((7 + layer + this.randInt(0, 3)) * countScale))), motifRadius * (1 - layer * 0.08), layer * r * 0.46, r * (0.52 - layer * 0.05));
          }
          break;
        }
        case 'Spiral': {
          const segs = Math.max(8, Math.min(24, Math.round((10 + this.randInt(0, 6)) * countScale)));
          const turns = symmetry === 'asymmetric' ? 1.8 : 1.25;
          for (let k = 0; k < segs; k += 1) {
            const t = segs > 1 ? k / (segs - 1) : 0;
            this.pushBlock(lines, [
              'A ( ' + formatNum(360 * turns * t) + ' 1 )',
              'T ( ' + formatNum(motifRadius * (0.64 + t * 0.22)) + ' ' + formatNum(t * h * 0.62) + ' 0 )',
              'S ( ' + formatNum(r * 0.54) + ' ' + formatNum(r * 0.16) + ' ' + formatNum(r * 0.30) + ' )',
              'I ( CubeX ' + accent + ' ' + formatNum(Math.max(0.10, r * 0.20)) + ' )'
            ]);
          }
          break;
        }
        case 'Fork': {
          const branchAngles = symmetry === 'bilateral' ? [-22, 22] : [-28, 0, 28];
          branchAngles.forEach((ang) => {
            this.pushBlock(lines, [
              'A ( ' + formatNum(ang) + ' 2 )',
              'T ( 0 ' + formatNum(h * 0.12) + ' 0 )',
              'S ( ' + formatNum(r * 0.48) + ' ' + formatNum(r * 1.06) + ' ' + formatNum(r * 0.48) + ' )',
              'I ( CubeY ' + accent + ' ' + formatNum(Math.max(0.12, r * 0.24)) + ' )'
            ]);
          });
          break;
        }
        case 'RadialGrid': {
          const count = Math.max(6, Math.min(18, Math.round((7 + this.randInt(0, 4)) * countScale)));
          lines.push('RadialSpokeArc( ' + count + ' ' + formatNum(motifRadius * 0.96) + ' 0 ' + formatNum(r * 1.48) + ' ' + formatNum(r * 0.28) + ' )');
          lines.push('RadialRingArc( ' + count + ' ' + formatNum(motifRadius * 0.52) + ' ' + formatNum(h * 0.10) + ' ' + formatNum(r * 0.26) + ' )');
          lines.push('RadialRingArc( ' + count + ' ' + formatNum(motifRadius * 0.82) + ' ' + formatNum(h * 0.18) + ' ' + formatNum(r * 0.22) + ' )');
          pushRuleWithRepeat('RadialSpokeArc( count rr yy sx sz )', 'count', [
            '[',
            '  A ( ri * ( 360 / count ) 1 )',
            '  T ( rr yy 0 )',
            '  S ( sx ' + formatNum(r * 0.16) + ' sz )',
            '  I ( CubeX ' + accent + ' ' + formatNum(Math.max(0.10, r * 0.22)) + ' )',
            ']'
          ]);
          pushRuleWithRepeat('RadialRingArc( count rr yy ss )', 'count', [
            '[',
            '  A ( ri * ( 360 / count ) 1 )',
            '  T ( rr yy 0 )',
            '  S ( ss ss * 0.42 ss )',
            '  I ( Cube ' + accent + ' ' + formatNum(Math.max(0.10, r * 0.20)) + ' )',
            ']'
          ]);
          break;
        }
        case 'Ribbon': {
          const segs = Math.max(5, Math.min(16, Math.round((7 + this.randInt(0, 4)) * countScale)));
          const span = motifRadius * 1.75;
          const step = segs > 1 ? span / (segs - 1) : 0;
          for (let k = 0; k < segs; k += 1) {
            const x = (-span * 0.5) + (k * step);
            const y = Math.sin((k / Math.max(1, segs - 1)) * Math.PI) * h * 0.20;
            const z = Math.cos((k / Math.max(1, segs - 1)) * Math.PI) * r * 0.36;
            this.pushBlock(lines, [
              'A ( ' + formatNum(-18 + k * (36 / Math.max(1, segs - 1))) + ' 1 )',
              'T ( ' + formatNum(x) + ' ' + formatNum(y) + ' ' + formatNum(z) + ' )',
              'S ( ' + formatNum(r * 0.76) + ' ' + formatNum(r * 0.16) + ' ' + formatNum(r * 0.28) + ' )',
              'I ( CubeX ' + accent + ' ' + formatNum(Math.max(0.10, r * 0.20)) + ' )'
            ]);
          }
          break;
        }
        case 'TerracedStack': {
          const floors = Math.max(3, Math.min(9, Math.round((4 + this.randInt(0, 3)) * countScale)));
          lines.push('TerraceRun( ' + floors + ' )');
          pushRuleWithRepeat('TerraceRun( floors )', 'floors', [
            '[',
            '  S ( 0.90 ^ ri 1 0.90 ^ ri )',
            '  T ( 0 ri * ' + formatNum(r * 0.52) + ' 0 )',
            '  S ( ' + formatNum(r * 1.16) + ' ' + formatNum(r * 0.30) + ' ' + formatNum(r * 1.16) + ' )',
            '  I ( Cube ' + accent + ' ' + formatNum(Math.max(0.12, r * 0.22)) + ' )',
            ']'
          ]);
          break;
        }
        case 'FacadeBandGrid': {
          const rows = Math.max(2, Math.min(6, Math.round((3 + this.randInt(0, 2)) * countScale)));
          const cols = Math.max(3, Math.min(10, Math.round((4 + this.randInt(0, 4)) * countScale)));
          const colStep = r * 0.94;
          const rowStep = r * 0.50;
          lines.push('FacadeRows( ' + rows + ' ' + cols + ' )');
          pushRuleWithRepeat('FacadeRows( rows cols )', 'rows', [
            '[ FacadeCols( rows cols ri ) ]'
          ]);
          pushRuleWithRepeat('FacadeCols( rows cols rowIndex )', 'cols', [
            '[',
            '  T ( ( ri - ( cols - 1 ) * 0.5 ) * ' + formatNum(colStep) + ' rowIndex * ' + formatNum(rowStep) + ' 0 )',
            '  S ( ' + formatNum(r * 0.38) + ' ' + formatNum(r * 0.24) + ' ' + formatNum(r * 0.16) + ' )',
            '  I ( CubeZ ' + accent + ' ' + formatNum(Math.max(0.10, r * 0.18)) + ' )',
            ']'
          ]);
          break;
        }
        case 'VaultedRingGrid': {
          const cols = Math.max(4, Math.min(12, Math.round((6 + this.randInt(0, 4)) * countScale)));
          const span = motifRadius * 1.44;
          const step = cols > 1 ? span / (cols - 1) : 0;
          for (let k = 0; k < cols; k += 1) {
            const t = cols > 1 ? k / (cols - 1) : 0.5;
            const x = (-span * 0.5) + (k * step);
            const y = (1 - Math.pow((t - 0.5) * 2, 2)) * h * 0.24;
            this.pushBlock(lines, [
              'T ( ' + formatNum(x) + ' ' + formatNum(y) + ' 0 )',
              'S ( ' + formatNum(r * 0.34) + ' ' + formatNum(r * 0.22) + ' ' + formatNum(r * 0.34) + ' )',
              'I ( Cube ' + accent + ' ' + formatNum(Math.max(0.10, r * 0.16)) + ' )'
            ]);
          }
          addRing(Math.max(8, Math.min(22, Math.round((9 + this.randInt(0, 4)) * countScale))), motifRadius * 0.76, h * 0.16, r * 0.24);
          break;
        }
        case 'RadialCanopy': {
          const rings = Math.max(2, Math.min(4, Math.round((2 + this.randInt(0, 2)) * countScale)));
          for (let layer = 0; layer < rings; layer += 1) {
            const count = Math.max(6, Math.min(20, Math.round((7 + layer + this.randInt(0, 3)) * countScale)));
            lines.push('CanopyRingArc( ' + count + ' ' + formatNum(motifRadius * (0.60 + layer * 0.18)) + ' ' + formatNum(layer * r * 0.24) + ' ' + formatNum(r * (0.36 - layer * 0.04)) + ' )');
          }
          lines.push('CanopySpokeArc( ' + Math.max(5, Math.min(18, Math.round((6 + this.randInt(0, 4)) * countScale))) + ' ' + formatNum(motifRadius * 0.88) + ' ' + formatNum(h * 0.18) + ' ' + formatNum(r * 1.28) + ' ' + formatNum(r * 0.24) + ' )');
          pushRuleWithRepeat('CanopyRingArc( count rr yy ss )', 'count', [
            '[',
            '  A ( ri * ( 360 / count ) 1 )',
            '  T ( rr yy 0 )',
            '  S ( ss ss * 0.42 ss )',
            '  I ( Cube ' + accent + ' ' + formatNum(Math.max(0.10, r * 0.18)) + ' )',
            ']'
          ]);
          pushRuleWithRepeat('CanopySpokeArc( count rr yy sx sz )', 'count', [
            '[',
            '  A ( ri * ( 360 / count ) 1 )',
            '  T ( rr yy 0 )',
            '  S ( sx ' + formatNum(r * 0.16) + ' sz )',
            '  I ( CubeX ' + accent + ' ' + formatNum(Math.max(0.10, r * 0.20)) + ' )',
            ']'
          ]);
          break;
        }
        case 'RecursiveRing': {
          addRing(Math.max(6, Math.min(20, Math.round((8 + this.randInt(0, 4)) * countScale))), motifRadius, 0, r * 0.46);
          addRing(Math.max(5, Math.min(16, Math.round((6 + this.randInt(0, 3)) * countScale))), motifRadius * 0.54, h * 0.12, r * 0.28);
          addRing(Math.max(4, Math.min(12, Math.round((5 + this.randInt(0, 2)) * countScale))), motifRadius * 0.28, h * 0.24, r * 0.16);
          break;
        }
        case 'Dihedral': {
          const lobes = Math.max(2, Math.min(7, Math.round((3 + this.randInt(0, 2)) * countScale)));
          lines.push('DihedralRun( ' + lobes + ' )');
          pushRuleWithRepeat('DihedralRun( lobes )', 'lobes', [
            '[',
            '  A ( ri * ( 360 / lobes ) 1 )',
            '  T ( ' + formatNum(motifRadius * 0.72) + ' 0 0 )',
            '  S ( ' + formatNum(r * 0.92) + ' ' + formatNum(r * 0.18) + ' ' + formatNum(r * 0.30) + ' )',
            '  I ( CubeX ' + accent + ' ' + formatNum(Math.max(0.10, r * 0.22)) + ' )',
            ']',
            '[',
            '  A ( ri * ( 360 / lobes ) + 180 / lobes 1 )',
            '  T ( ' + formatNum(-motifRadius * 0.56) + ' 0 0 )',
            '  S ( ' + formatNum(r * 0.72) + ' ' + formatNum(r * 0.16) + ' ' + formatNum(r * 0.24) + ' )',
            '  I ( CubeX ' + accent + ' ' + formatNum(Math.max(0.10, r * 0.18)) + ' )',
            ']'
          ]);
          break;
        }
        default: {
          this.pushBlock(lines, [
            'S ( ' + formatNum(r * 0.60) + ' ' + formatNum(r * 0.22) + ' ' + formatNum(r * 0.60) + ' )',
            'I ( Cube ' + accent + ' ' + formatNum(Math.max(0.10, r * 0.20)) + ' )'
          ]);
        }
      }

      return [this.buildRule(ruleName, lines)].concat(helperRules).join('\n\n');
    }

    generate() {
      const overlapMode = this.pickOverlapMode();
      const overlapRatio = this.pickOverlapRatio();
      const joinStrategy = this.pickJoinStrategy();
      const symmetryBias = this.pickSymmetryBias();
      const densityMode = this.pickDensityMode();
      const densityScale = this.pickDensityScale();
      const motif = this.pickMotif();
      const family = this.archetypeFamily(motif);
      const title = this.makeTitle(motif);
      const baseHeight = this.randFloat(2.8, 4.8);
      const baseRadius = this.randFloat(0.38, 0.72);
      const accentTexture = this.pick(texturePool);
      const textureSet = accentTexture;
      const out = [];
      const line = function (s) { out.push(s); };

      line('// ProGen3D single-motif grammar');
      line('// Title: ' + title);
      line('// Seed: ' + this.initialSeed);
      line('// Motif: ' + motif);
      line('// Family: ' + family);
      line('// Cube join: ' + overlapLabels[overlapMode] + ' (' + formatNum(overlapRatio) + ' overlap ratio)');
      line('// Join strategy: ' + (joinLabels[joinStrategy] || 'Socket core'));
      line('// Symmetry bias: ' + (symmetryLabels[symmetryBias] || 'Balanced'));
      line('// Density: ' + (densityLabels[densityMode] || 'Medium'));
      line('// Motif only: no base, no trunk, no crown.');
      line('');
      line('Start -> MotifBody');
      line('');

      line(this.buildMotifRule(motif, {
        radius: baseRadius,
        height: baseHeight,
        overlap: overlapRatio,
        accentTexture: accentTexture,
        densityScale: densityScale,
        symmetryBias: symmetryBias,
        joinStrategy: joinStrategy
      }, 'MotifBody'));
      line('');

      return {
        title: title,
        grammar: out.join('\n'),
        motifs: [motif],
        forks: [],
        depth: 1,
        seed: this.initialSeed,
        textureSet: textureSet,
        overlapLabel: overlapLabels[overlapMode] || 'Joined',
        overlapRatio: overlapRatio,
        joinStrategyLabel: joinLabels[joinStrategy] || 'Socket core',
        symmetryLabel: symmetryLabels[symmetryBias] || 'Balanced',
        densityLabel: densityLabels[densityMode] || 'Medium',
        primaryArchetype: motif,
        secondaryArchetype: motif,
        familySignature: family
      };
    }
  }

  function scheduleValidation(draftId, delayMs) {
    window.setTimeout(function () {
      const draft = draftStore.get(draftId);
      if (!draft) return;
      draft.status = 'checking';
      draft.validationMessage = 'Running parser check...';
      renderScripts();
      const result = validateGrammarWithParser(draft.grammar);
      draft.validationRuns += 1;
      if (result.ok) {
        draft.status = 'valid';
        draft.validationMessage = result.message;
        draft.cubeCount = result.cubes;
        draft.retryTimer = null;
        renderScripts();
        return;
      }
      draft.cubeCount = 0;
      draft.errorCount += 1;
      draft.validationMessage = result.message;
      if (draft.errorCount >= MAX_ERROR_RETRIES) {
        draft.status = 'halted';
        renderScripts();
        return;
      }
      draft.status = 'retrying';
      renderScripts();
      draft.retryTimer = window.setTimeout(function () {
        regenerateDraft(draftId);
      }, REGENERATE_DELAY_MS);
    }, delayMs);
  }

  function regenerateDraft(draftId) {
    const draft = draftStore.get(draftId);
    if (!draft || draft.errorCount >= MAX_ERROR_RETRIES) return;
    if (draft.retryTimer) {
      clearTimeout(draft.retryTimer);
      draft.retryTimer = null;
    }
    draft.regenerationIndex += 1;
    const writer = new SingleMotifGrammarWriter(nextSeed(draft.baseSeed, draft.regenerationIndex), {
      overlap: draft.requestedOverlap,
      joinStrategy: draft.requestedJoinStrategy,
      symmetry: draft.requestedSymmetry,
      density: draft.requestedDensity,
      motif: draft.requestedMotif
    });
    const updated = writer.generate();
    draft.title = updated.title;
    draft.grammar = updated.grammar;
    draft.motifs = updated.motifs;
    draft.forks = updated.forks;
    draft.depth = updated.depth;
    draft.seed = updated.seed;
    draft.textureSet = updated.textureSet;
    draft.overlapLabel = updated.overlapLabel;
    draft.overlapRatio = updated.overlapRatio;
    draft.joinStrategyLabel = updated.joinStrategyLabel;
    draft.symmetryLabel = updated.symmetryLabel;
    draft.densityLabel = updated.densityLabel;
    draft.primaryArchetype = updated.primaryArchetype;
    draft.secondaryArchetype = updated.secondaryArchetype;
    draft.familySignature = updated.familySignature;
    draft.status = 'checking';
    draft.validationMessage = 'Regenerated after parser error. Rechecking...';
    renderScripts();
    scheduleValidation(draftId, 60);
  }

  function makeDraft(seed, requestedDepth, requestedOverlap, requestedJoinStrategy, requestedSymmetry, requestedDensity, requestedMotif) {
    const writer = new SingleMotifGrammarWriter(seed, {
      overlap: requestedOverlap,
      joinStrategy: requestedJoinStrategy,
      symmetry: requestedSymmetry,
      density: requestedDensity,
      motif: requestedMotif
    });
    const generated = writer.generate();
    return Object.assign({
      id: 'writer-draft-' + generationSerial + '-' + draftOrder.length,
      baseSeed: seed,
      requestedDepth: requestedDepth,
      requestedOverlap: requestedOverlap,
      requestedJoinStrategy: requestedJoinStrategy,
      requestedSymmetry: requestedSymmetry,
      requestedDensity: requestedDensity,
      requestedMotif: requestedMotif,
      regenerationIndex: 0,
      validationRuns: 0,
      errorCount: 0,
      cubeCount: 0,
      status: 'checking',
      validationMessage: 'Queued for parser check...',
      retryTimer: null
    }, generated);
  }

  function generateSet() {
    generationSerial += 1;
    clearDraftTimers();
    draftOrder.length = 0;
    draftStore.clear();
    const baseSeed = Number(seedInput.value || Date.now()) >>> 0;
    const count = Math.max(1, Number(countInput.value || 4));
    const requestedDepth = depthInput.value || 'random';
    const requestedOverlap = overlapInput ? (overlapInput.value || 'joined') : 'joined';
    const requestedJoinStrategy = joinStrategyInput ? (joinStrategyInput.value || 'socket') : 'socket';
    const requestedSymmetry = symmetryInput ? (symmetryInput.value || 'balanced') : 'balanced';
    const requestedDensity = densityInput ? (densityInput.value || 'medium') : 'medium';
    const requestedMotif = motifInput ? (motifInput.value || 'random') : 'random';
    for (let i = 0; i < count; i += 1) {
      const draft = makeDraft(nextSeed(baseSeed, i), requestedDepth, requestedOverlap, requestedJoinStrategy, requestedSymmetry, requestedDensity, requestedMotif);
      draftOrder.push(draft.id);
      draftStore.set(draft.id, draft);
    }
    renderScripts();
    draftOrder.forEach(function (id, idx) {
      scheduleValidation(id, 80 + idx * 40);
    });
  }

  function copyGrammar(button) {
    const text = button.getAttribute('data-grammar') || '';
    const original = button.getAttribute('data-copy-label') || button.textContent;
    const done = function () {
      button.textContent = 'Copied';
      window.setTimeout(function () { button.textContent = original; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {});
      return;
    }
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    done();
  }

  generateBtn.addEventListener('click', generateSet);
  randomSeedBtn.addEventListener('click', function () {
    seedInput.value = String((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
    generateSet();
  });

  resultsEl.addEventListener('click', function (event) {
    const copyBtn = event.target.closest('.js-copy-writer');
    if (copyBtn) {
      copyGrammar(copyBtn);
      return;
    }
    const openLink = event.target.closest('.js-open-writer');
    if (openLink && openLink.classList.contains('is-disabled')) {
      event.preventDefault();
      return;
    }
    if (openLink) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
          title: openLink.getAttribute('data-title') || 'Generated grammar',
          content: openLink.getAttribute('data-grammar') || ''
        }));
      } catch (error) {}
    }
  });

  seedInput.value = String((Date.now() >>> 0));
  generateSet();
})();

(function () {
  'use strict';

  const BUILDING_TYPES = ['tower', 'stepped', 'slab', 'bridge', 'courtyard', 'frame'];
  const BUILDING_PROGRAMS = ['office', 'residential', 'civic'];
  const SHELL_MATERIALS = ['grayStone', 'darkBasalt', 'whiteTiles', 'brushedAluminum', 'chromeSurface'];
  const ACCENT_MATERIALS = ['frostedGlass', 'glowingPanel', 'blueCeramicTile', 'whiteTiles', 'chromeSurface'];

  function makeSeededRng(seed) {
    let value = (Number(seed) >>> 0) || 1;
    return function () {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randFloatRange(rng, min, max) {
    return min + (max - min) * rng();
  }

  function randIntRange(rng, min, max) {
    return Math.floor(randFloatRange(rng, min, max + 1));
  }

  function pickOne(rng, list) {
    return list[Math.floor(rng() * list.length)] || list[0];
  }

  function formatNumber(value) {
    return Number(value).toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function hasOverride(overrides, key) {
    return !!(overrides && Object.prototype.hasOwnProperty.call(overrides, key) && overrides[key] !== '' && overrides[key] != null);
  }

  function numberOverride(overrides, key, fallback, min, max) {
    const numeric = hasOverride(overrides, key) ? Number(overrides[key]) : fallback;
    if (!Number.isFinite(numeric)) return fallback;
    return clamp(numeric, min, max);
  }

  function intOverride(overrides, key, fallback, min, max) {
    return Math.round(numberOverride(overrides, key, fallback, min, max));
  }

  function materialOverride(overrides, key, fallback, allowed) {
    const value = hasOverride(overrides, key) ? String(overrides[key]) : fallback;
    return allowed.indexOf(value) >= 0 ? value : fallback;
  }

  function programOverride(overrides, fallback) {
    return materialOverride(overrides, 'program', fallback, BUILDING_PROGRAMS);
  }

  function resolveRequestedType(seed, requestedType) {
    if (requestedType && requestedType !== 'random') return requestedType;
    const rng = makeSeededRng(seed);
    return pickOne(rng, BUILDING_TYPES);
  }

  function programDefaults(program) {
    switch (program) {
      case 'residential':
        return {
          shell: 'whiteTiles',
          accent: 'blueCeramicTile',
          towerFloorHeight: [0.32, 0.46],
          steppedFloorHeight: [0.3, 0.42],
          slabFloorHeight: [0.3, 0.42],
          podiumHeight: 0.24,
          roofHeight: 0.12
        };
      case 'civic':
        return {
          shell: 'grayStone',
          accent: 'chromeSurface',
          towerFloorHeight: [0.52, 0.74],
          steppedFloorHeight: [0.44, 0.6],
          slabFloorHeight: [0.44, 0.62],
          podiumHeight: 0.52,
          roofHeight: 0.24
        };
      default:
        return {
          shell: 'brushedAluminum',
          accent: 'frostedGlass',
          towerFloorHeight: [0.42, 0.62],
          steppedFloorHeight: [0.36, 0.52],
          slabFloorHeight: [0.38, 0.55],
          podiumHeight: 0.38,
          roofHeight: 0.18
        };
    }
  }

  function makeBaseSpec(seed, type, overrides) {
    const rng = makeSeededRng(seed);
    const program = programOverride(overrides, pickOne(rng, BUILDING_PROGRAMS));
    const defaults = programDefaults(program);
    const shell = materialOverride(overrides, 'shell', defaults.shell || pickOne(rng, SHELL_MATERIALS), SHELL_MATERIALS);
    const accent = materialOverride(overrides, 'accent', defaults.accent || pickOne(rng, ACCENT_MATERIALS), ACCENT_MATERIALS);
    return {
      seed: seed >>> 0,
      type,
      program,
      rng,
      shell,
      accent,
      overrides: overrides || {},
      title: 'Building',
      primary: 'Building',
      secondary: program.charAt(0).toUpperCase() + program.slice(1),
      metrics: {},
      massing: {},
      structure: {},
      envelope: {},
      defaults: defaults
    };
  }

  function buildTowerSpec(seed, overrides) {
    const spec = makeBaseSpec(seed, 'tower', overrides);
    const floors = intOverride(overrides, 'floors', randIntRange(spec.rng, 8, 18), 3, 40);
    const width = numberOverride(overrides, 'width', randFloatRange(spec.rng, 0.8, 1.6), 0.4, 6);
    const depth = numberOverride(overrides, 'depth', randFloatRange(spec.rng, 0.8, 1.6), 0.4, 6);
    const floorHeight = numberOverride(overrides, 'floorHeight', randFloatRange(spec.rng, spec.defaults.towerFloorHeight[0], spec.defaults.towerFloorHeight[1]), 0.2, 1.5);
    spec.title = 'Tower block';
    spec.primary = 'Tower';
    spec.secondary = spec.program.charAt(0).toUpperCase() + spec.program.slice(1);
    spec.massing = { floors, width, depth, floorHeight };
    spec.structure = {
      podiumHeight: numberOverride(overrides, 'podiumHeight', spec.defaults.podiumHeight, 0.1, 1.5),
      roofHeight: numberOverride(overrides, 'roofHeight', spec.defaults.roofHeight, 0.08, 0.8)
    };
    spec.envelope = {
      trimHeight: clamp(floorHeight * 0.25, 0.08, 0.4)
    };
    spec.metrics = {
      floors,
      footprint: formatNumber(width) + ' x ' + formatNumber(depth),
      heightClass: formatNumber(floors * floorHeight + spec.structure.podiumHeight),
      slenderness: formatNumber((floors * floorHeight) / Math.max(width, depth)),
      program: spec.program
    };
    return spec;
  }

  function buildSteppedSpec(seed, overrides) {
    const spec = makeBaseSpec(seed, 'stepped', overrides);
    const floors = intOverride(overrides, 'floors', randIntRange(spec.rng, 4, 7), 2, 16);
    const width = numberOverride(overrides, 'width', randFloatRange(spec.rng, 1.6, 2.6), 0.8, 6);
    const depth = hasOverride(overrides, 'depth') ? numberOverride(overrides, 'depth', width, 0.8, 6) : width;
    const floorHeight = numberOverride(overrides, 'floorHeight', randFloatRange(spec.rng, spec.defaults.steppedFloorHeight[0], spec.defaults.steppedFloorHeight[1]), 0.2, 1.2);
    const shrink = numberOverride(overrides, 'setback', randFloatRange(spec.rng, 0.18, 0.28), 0.05, Math.min(width, depth) * 0.3);
    spec.title = 'Stepped tower';
    spec.primary = 'Stepped';
    spec.secondary = spec.program.charAt(0).toUpperCase() + spec.program.slice(1);
    spec.massing = { floors, width, depth, floorHeight };
    spec.structure = { shrink };
    spec.metrics = {
      floors,
      footprint: formatNumber(width) + ' x ' + formatNumber(depth),
      heightClass: formatNumber(floors * floorHeight),
      setback: formatNumber(shrink),
      program: spec.program
    };
    return spec;
  }

  function buildSlabSpec(seed, overrides) {
    const spec = makeBaseSpec(seed, 'slab', overrides);
    const floors = intOverride(overrides, 'floors', randIntRange(spec.rng, 5, 11), 3, 24);
    const bays = intOverride(overrides, 'bays', randIntRange(spec.rng, 5, 10), 2, 24);
    const requestedWidth = hasOverride(overrides, 'width') ? numberOverride(overrides, 'width', randFloatRange(spec.rng, 2.2, 4.8), 0.36, 12) : null;
    const bay = requestedWidth != null
      ? Math.max(0.18, requestedWidth / bays)
      : numberOverride(overrides, 'bayWidth', randFloatRange(spec.rng, 0.38, 0.6), 0.18, 1.2);
    const depth = numberOverride(overrides, 'depth', randFloatRange(spec.rng, 0.9, 1.4), 0.3, 6);
    const floorHeight = numberOverride(overrides, 'floorHeight', randFloatRange(spec.rng, spec.defaults.slabFloorHeight[0], spec.defaults.slabFloorHeight[1]), 0.2, 1.5);
    const width = requestedWidth != null ? requestedWidth : (bays * bay);
    spec.title = 'Slab block';
    spec.primary = 'Slab';
    spec.secondary = spec.program.charAt(0).toUpperCase() + spec.program.slice(1);
    spec.massing = { floors, width, depth, floorHeight };
    spec.structure = { bays, bay };
    spec.metrics = {
      floors,
      footprint: formatNumber(width) + ' x ' + formatNumber(depth),
      heightClass: formatNumber(floors * floorHeight),
      bays: bays,
      program: spec.program
    };
    return spec;
  }

  function buildBridgeSpec(seed, overrides) {
    const spec = makeBaseSpec(seed, 'bridge', overrides);
    const floors = intOverride(overrides, 'floors', 2, 1, 6);
    const towerHeight = numberOverride(overrides, 'height', randFloatRange(spec.rng, 2.4, 4.2), 0.8, 8);
    const towerWidth = numberOverride(overrides, 'width', randFloatRange(spec.rng, 0.7, 1.1), 0.3, 3);
    const span = numberOverride(overrides, 'span', randFloatRange(spec.rng, 2.8, 5.2), 0.8, 10);
    const deckHeight = numberOverride(overrides, 'floorHeight', randFloatRange(spec.rng, 0.22, 0.34), 0.12, 1);
    spec.title = 'Skybridge';
    spec.primary = 'Bridge';
    spec.secondary = spec.program.charAt(0).toUpperCase() + spec.program.slice(1);
    spec.massing = { floors, width: span + towerWidth, depth: towerWidth * 0.7, floorHeight: deckHeight };
    spec.structure = { towerHeight, towerWidth, span, deckHeight };
    spec.metrics = {
      floors,
      footprint: formatNumber(span + towerWidth) + ' span',
      heightClass: formatNumber(towerHeight),
      supportSpan: formatNumber(span),
      program: spec.program
    };
    return spec;
  }

  function buildCourtyardSpec(seed, overrides) {
    const spec = makeBaseSpec(seed, 'courtyard', overrides);
    const floors = intOverride(overrides, 'floors', 1, 1, 8);
    const width = numberOverride(overrides, 'width', randFloatRange(spec.rng, 2.8, 4.2), 1, 8);
    const depth = numberOverride(overrides, 'depth', randFloatRange(spec.rng, 2.8, 4.4), 1, 8);
    const wall = numberOverride(overrides, 'frameThickness', randFloatRange(spec.rng, 0.34, 0.58), 0.12, Math.min(width, depth) * 0.45);
    const height = numberOverride(overrides, 'height', randFloatRange(spec.rng, 1.3, 2.2), 0.5, 6);
    spec.title = 'Courtyard block';
    spec.primary = 'Courtyard';
    spec.secondary = spec.program.charAt(0).toUpperCase() + spec.program.slice(1);
    spec.massing = { floors, width, depth, floorHeight: height };
    spec.structure = { wall, height };
    spec.metrics = {
      floors,
      footprint: formatNumber(width) + ' x ' + formatNumber(depth),
      heightClass: formatNumber(height),
      voidSize: formatNumber(Math.max(0, width - wall * 2)) + ' x ' + formatNumber(Math.max(0, depth - wall * 2)),
      program: spec.program
    };
    return spec;
  }

  function buildFrameSpec(seed, overrides) {
    const spec = makeBaseSpec(seed, 'frame', overrides);
    const floors = intOverride(overrides, 'floors', 1, 1, 8);
    const width = numberOverride(overrides, 'width', randFloatRange(spec.rng, 2.2, 3.8), 0.8, 8);
    const depth = numberOverride(overrides, 'depth', randFloatRange(spec.rng, 1.8, 3.0), 0.8, 8);
    const height = numberOverride(overrides, 'height', randFloatRange(spec.rng, 2.6, 4.0), 0.6, 8);
    const frame = numberOverride(overrides, 'frameThickness', randFloatRange(spec.rng, 0.22, 0.34), 0.08, Math.min(width, depth) * 0.45);
    spec.title = 'Frame atrium';
    spec.primary = 'Frame';
    spec.secondary = spec.program.charAt(0).toUpperCase() + spec.program.slice(1);
    spec.massing = { floors, width, depth, floorHeight: height };
    spec.structure = { height, frame };
    spec.metrics = {
      floors,
      footprint: formatNumber(width) + ' x ' + formatNumber(depth),
      heightClass: formatNumber(height),
      frameThickness: formatNumber(frame),
      program: spec.program
    };
    return spec;
  }

  function validateSpec(spec) {
    const errors = [];
    if (!spec || !spec.type) errors.push('Missing building type.');
    if (!spec || !spec.massing) return { ok: false, errors };
    if (spec.massing.width != null && spec.massing.width <= 0) errors.push('Width must be positive.');
    if (spec.massing.depth != null && spec.massing.depth <= 0) errors.push('Depth must be positive.');
    if (spec.massing.floors != null && spec.massing.floors < 1) errors.push('Floors must be at least 1.');
    if (spec.massing.floorHeight != null && spec.massing.floorHeight <= 0) errors.push('Floor height must be positive.');
    if (spec.type === 'courtyard') {
      const wall = spec.structure.wall;
      if (wall * 2 >= spec.massing.width || wall * 2 >= spec.massing.depth) {
        errors.push('Courtyard wall thickness leaves no interior void.');
      }
    }
    if (spec.type === 'bridge' && spec.structure.span <= spec.structure.towerWidth * 0.5) {
      errors.push('Bridge span must exceed tower width.');
    }
    return { ok: errors.length === 0, errors };
  }

  function specToDraftContext(spec) {
    const lines = [
      '// ProGen3D building grammar',
      '// Seed: ' + spec.seed,
      '// Building type: ' + spec.type,
      ''
    ];
    return {
      spec,
      lines,
      line: function (value) { lines.push(value); }
    };
  }

  function facadeProfile(spec) {
    switch (spec.program) {
      case 'residential':
        return {
          podiumScale: 0.96,
          towerBandWidth: 0.92,
          towerBandDepth: 0.06,
          steppedInset: 0.9,
          slabMullionScale: 0.18,
          slabFloorBandScale: 0.1,
          crownScale: 0.68
        };
      case 'civic':
        return {
          podiumScale: 0.88,
          towerBandWidth: 0.82,
          towerBandDepth: 0.11,
          steppedInset: 0.78,
          slabMullionScale: 0.3,
          slabFloorBandScale: 0.15,
          crownScale: 0.86
        };
      default:
        return {
          podiumScale: 0.92,
          towerBandWidth: 0.88,
          towerBandDepth: 0.08,
          steppedInset: 0.84,
          slabMullionScale: 0.22,
          slabFloorBandScale: 0.12,
          crownScale: 0.78
        };
    }
  }

  function emitTower(ctx) {
    const spec = ctx.spec;
    const profile = facadeProfile(spec);
    const width = spec.massing.width;
    const depth = spec.massing.depth;
    const floors = spec.massing.floors;
    const floorHeight = spec.massing.floorHeight;
    const podiumHeight = spec.structure.podiumHeight;
    const roofHeight = spec.structure.roofHeight;
    const trimHeight = spec.envelope.trimHeight;
    const podiumWidth = width * 1.25;
    const podiumDepth = depth * 1.25;
    const shaftInset = Math.max(0.08, Math.min(width, depth) * 0.08);
    const shaftWidth = Math.max(0.24, width - shaftInset);
    const shaftDepth = Math.max(0.24, depth - shaftInset);
    const crownWidth = shaftWidth * 1.08;
    const crownDepth = shaftDepth * 1.08;
    const crownHeight = Math.max(roofHeight, floorHeight * 0.36);
    ctx.line('Start -> BuildingBody');
    ctx.line('');
    ctx.line('BuildingBody ->');
    ctx.line('  Podium( ' + formatNumber(podiumWidth) + ' ' + formatNumber(podiumDepth) + ' )');
    ctx.line('  ShaftStack( ' + floors + ' ' + formatNumber(shaftWidth) + ' ' + formatNumber(shaftDepth) + ' ' + formatNumber(floorHeight) + ' )');
    ctx.line('  [ T ( 0 ' + formatNumber(podiumHeight + floors * floorHeight) + ' 0 ) Crown( ' + formatNumber(crownWidth) + ' ' + formatNumber(crownDepth) + ' ' + formatNumber(crownHeight) + ' ) ]');
    ctx.line('');
    ctx.line('Podium( w d ) ->');
    ctx.line('  [ S ( w ' + formatNumber(podiumHeight) + ' d ) I ( Cube ' + spec.shell + ' 0.18 ) ]');
    ctx.line('  [ T ( 0 ' + formatNumber(podiumHeight * 0.62) + ' 0 ) S ( w * ' + formatNumber(profile.podiumScale) + ' ' + formatNumber(Math.max(trimHeight, podiumHeight * 0.16)) + ' d * ' + formatNumber(profile.podiumScale) + ' ) I ( Cube ' + spec.accent + ' 0.1 ) ]');
    ctx.line('ShaftStack( floors w d h ) floors -> [ T ( 0 ' + formatNumber(podiumHeight) + ' + ri * h 0 ) TowerFloor( ri floors w d h ) ]');
    ctx.line('TowerFloor( ri floors w d h ) ->');
    ctx.line('  [ S ( w h d ) I ( Cube ' + spec.shell + ' 0.14 ) ]');
    ctx.line('  [ T ( 0 ' + formatNumber(trimHeight) + ' ' + formatNumber(shaftDepth * 0.505) + ' ) S ( w * ' + formatNumber(profile.towerBandWidth) + ' ' + formatNumber(Math.max(0.08, floorHeight * 0.16)) + ' ' + formatNumber(Math.max(0.08, shaftDepth * profile.towerBandDepth)) + ' ) I ( Cube ' + spec.accent + ' 0.1 ) ]');
    ctx.line('  [ T ( 0 ' + formatNumber(trimHeight) + ' ' + formatNumber(-(shaftDepth * 0.505)) + ' ) S ( w * ' + formatNumber(profile.towerBandWidth) + ' ' + formatNumber(Math.max(0.08, floorHeight * 0.16)) + ' ' + formatNumber(Math.max(0.08, shaftDepth * profile.towerBandDepth)) + ' ) I ( Cube ' + spec.accent + ' 0.1 ) ]');
    ctx.line('Crown( w d h ) -> [ S ( w h d ) I ( Cube ' + spec.accent + ' 0.16 ) ] [ T ( 0 h 0 ) S ( w * ' + formatNumber(profile.crownScale) + ' ' + formatNumber(Math.max(roofHeight * 0.72, 0.08)) + ' d * ' + formatNumber(profile.crownScale) + ' ) I ( Cube ' + spec.shell + ' 0.12 ) ]');
  }

  function emitStepped(ctx) {
    const spec = ctx.spec;
    const profile = facadeProfile(spec);
    const floors = spec.massing.floors;
    const baseWidth = spec.massing.width;
    const baseDepth = spec.massing.depth;
    const floorHeight = spec.massing.floorHeight;
    const shrink = spec.structure.shrink;
    const podiumHeight = Math.max(0.14, floorHeight * 0.75);
    const trimHeight = Math.max(0.08, floorHeight * 0.18);
    const crownHeight = Math.max(0.08, floorHeight * 0.34);
    ctx.line('Start -> BuildingBody');
    ctx.line('');
    ctx.line('BuildingBody ->');
    ctx.line('  SteppedPodium( ' + formatNumber(baseWidth * 1.12) + ' ' + formatNumber(baseDepth * 1.12) + ' ' + formatNumber(podiumHeight) + ' )');
    ctx.line('  TierStack( ' + floors + ' ' + formatNumber(baseWidth) + ' ' + formatNumber(baseDepth) + ' ' + formatNumber(floorHeight) + ' ' + formatNumber(shrink) + ' )');
    ctx.line('  [ T ( 0 ' + formatNumber(podiumHeight + floors * floorHeight) + ' 0 ) SteppedTop( ' + formatNumber(Math.max(baseWidth * 0.56, baseWidth - Math.max(0, floors - 1) * shrink)) + ' ' + formatNumber(Math.max(baseDepth * 0.56, baseDepth - Math.max(0, floors - 1) * shrink)) + ' ' + formatNumber(crownHeight) + ' ) ]');
    ctx.line('');
    ctx.line('SteppedPodium( w d h ) -> [ S ( w h d ) I ( Cube ' + spec.shell + ' 0.18 ) ]');
    ctx.line('TierStack( floors baseW baseD h shrink ) floors -> [ T ( 0 ' + formatNumber(podiumHeight) + ' + ri * h 0 ) Tier( ri floors baseW - ri * shrink baseD - ri * shrink h ) ]');
    ctx.line('Tier( ri floors spanW spanD h ) ->');
    ctx.line('  [ S ( spanW h spanD ) I ( Cube ' + spec.shell + ' 0.18 ) ]');
    ctx.line('  [ T ( 0 ' + formatNumber(trimHeight) + ' 0 ) S ( spanW * ' + formatNumber(profile.steppedInset) + ' ' + formatNumber(Math.max(0.08, floorHeight * 0.2)) + ' spanD * ' + formatNumber(profile.steppedInset) + ' ) I ( Cube ' + spec.accent + ' 0.1 ) ]');
    ctx.line('SteppedTop( w d h ) -> [ S ( w h d ) I ( Cube ' + spec.accent + ' 0.14 ) ] [ T ( 0 h 0 ) S ( w * ' + formatNumber(profile.crownScale) + ' ' + formatNumber(Math.max(0.08, crownHeight * 0.72)) + ' d * ' + formatNumber(profile.crownScale) + ' ) I ( Cube ' + spec.shell + ' 0.1 ) ]');
  }

  function emitSlab(ctx) {
    const spec = ctx.spec;
    const profile = facadeProfile(spec);
    const bay = spec.structure.bay;
    const bays = spec.structure.bays;
    const floors = spec.massing.floors;
    const floorHeight = spec.massing.floorHeight;
    const depth = spec.massing.depth;
    const width = bays * bay;
    const podiumHeight = Math.max(0.16, floorHeight * 0.9);
    const roofHeight = Math.max(0.1, floorHeight * 0.28);
    const mullionWidth = Math.max(0.12, bay * profile.slabMullionScale);
    const accentDepth = Math.max(0.08, depth * 0.08);
    ctx.line('Start -> BuildingBody');
    ctx.line('');
    ctx.line('BuildingBody ->');
    ctx.line('  SlabPodium( ' + formatNumber(width * 1.02) + ' ' + formatNumber(depth * 1.06) + ' )');
    ctx.line('  SlabShaft( ' + floors + ' ' + bays + ' ' + formatNumber(bay) + ' ' + formatNumber(floorHeight) + ' ' + formatNumber(depth) + ' )');
    ctx.line('  [ T ( 0 ' + formatNumber(podiumHeight + floors * floorHeight) + ' 0 ) SlabRoof( ' + formatNumber(width) + ' ' + formatNumber(depth) + ' ) ]');
    ctx.line('');
    ctx.line('SlabPodium( w d ) -> [ S ( w ' + formatNumber(podiumHeight) + ' d ) I ( Cube ' + spec.shell + ' 0.18 ) ]');
    ctx.line('SlabShaft( floors bays bay h d ) ->');
    ctx.line('  [ T ( 0 ' + formatNumber(podiumHeight) + ' 0 ) S ( bays * bay floors * h d ) I ( Cube ' + spec.shell + ' 0.16 ) ]');
    ctx.line('  BayBands( bays bay floors h d )');
    ctx.line('  FloorBands( floors bays * bay h d )');
    ctx.line('BayBands( bays bay floors h d ) bays -> [ T ( ' + formatNumber(-((bays - 1) * bay) * 0.5) + ' + ri * bay ' + formatNumber(podiumHeight) + ' ' + formatNumber(depth * 0.51) + ' ) VerticalStrip( floors h ) ]');
    ctx.line('VerticalStrip( floors h ) -> [ S ( ' + formatNumber(mullionWidth) + ' floors * h ' + formatNumber(accentDepth) + ' ) I ( Cube ' + spec.accent + ' 0.1 ) ]');
    ctx.line('FloorBands( floors w h d ) floors -> [ T ( 0 ' + formatNumber(podiumHeight) + ' + ri * h + h * 0.58 ' + formatNumber(depth * 0.505) + ' ) S ( w * 0.94 ' + formatNumber(Math.max(0.08, floorHeight * profile.slabFloorBandScale)) + ' ' + formatNumber(accentDepth) + ' ) I ( Cube ' + spec.accent + ' 0.08 ) ]');
    ctx.line('SlabRoof( w d ) -> [ S ( w ' + formatNumber(roofHeight) + ' d ) I ( Cube ' + spec.accent + ' 0.12 ) ] [ T ( 0 ' + formatNumber(roofHeight) + ' 0 ) S ( w * ' + formatNumber(profile.crownScale) + ' ' + formatNumber(Math.max(0.08, roofHeight * 0.7)) + ' d * ' + formatNumber(profile.crownScale) + ' ) I ( Cube ' + spec.shell + ' 0.08 ) ]');
  }

  function emitBridge(ctx) {
    const spec = ctx.spec;
    const towerHeight = spec.structure.towerHeight;
    const towerWidth = spec.structure.towerWidth;
    const span = spec.structure.span;
    const deckHeight = spec.structure.deckHeight;
    ctx.line('Start -> BuildingBody');
    ctx.line('');
    ctx.line('BuildingBody ->');
    ctx.line('  [ T ( ' + formatNumber(-(span * 0.5)) + ' 0 0 ) TowerLeg( ' + formatNumber(towerWidth) + ' ' + formatNumber(towerHeight) + ' ) ]');
    ctx.line('  [ T ( ' + formatNumber(span * 0.5) + ' 0 0 ) TowerLeg( ' + formatNumber(towerWidth) + ' ' + formatNumber(towerHeight) + ' ) ]');
    ctx.line('  [ T ( 0 ' + formatNumber(towerHeight * 0.62) + ' 0 ) SkyDeck( ' + formatNumber(span + towerWidth) + ' ' + formatNumber(deckHeight) + ' ) ]');
    ctx.line('');
    ctx.line('TowerLeg( w h ) -> [ S ( w h w ) I ( CubeY ' + spec.shell + ' 0.16 ) ]');
    ctx.line('SkyDeck( span h ) -> [ S ( span h ' + formatNumber(towerWidth * 0.7) + ' ) I ( CubeX ' + spec.accent + ' 0.12 ) ]');
  }

  function emitCourtyard(ctx) {
    const spec = ctx.spec;
    const width = spec.massing.width;
    const depth = spec.massing.depth;
    const wall = spec.structure.wall;
    const height = spec.structure.height;
    ctx.line('Start -> BuildingBody');
    ctx.line('');
    ctx.line('BuildingBody ->');
    ctx.line('  [ T ( 0 0 ' + formatNumber(depth * 0.5 - wall * 0.5) + ' ) WallX( ' + formatNumber(width) + ' ' + formatNumber(height) + ' ' + formatNumber(wall) + ' ) ]');
    ctx.line('  [ T ( 0 0 ' + formatNumber(-(depth * 0.5 - wall * 0.5)) + ' ) WallX( ' + formatNumber(width) + ' ' + formatNumber(height) + ' ' + formatNumber(wall) + ' ) ]');
    ctx.line('  [ T ( ' + formatNumber(width * 0.5 - wall * 0.5) + ' 0 0 ) WallZ( ' + formatNumber(depth) + ' ' + formatNumber(height) + ' ' + formatNumber(wall) + ' ) ]');
    ctx.line('  [ T ( ' + formatNumber(-(width * 0.5 - wall * 0.5)) + ' 0 0 ) WallZ( ' + formatNumber(depth) + ' ' + formatNumber(height) + ' ' + formatNumber(wall) + ' ) ]');
    ctx.line('');
    ctx.line('WallX( span h w ) -> [ S ( span h w ) I ( CubeX ' + spec.shell + ' 0.16 ) ]');
    ctx.line('WallZ( span h w ) -> [ S ( w h span ) I ( CubeZ ' + spec.accent + ' 0.12 ) ]');
  }

  function emitFrame(ctx) {
    const spec = ctx.spec;
    const width = spec.massing.width;
    const depth = spec.massing.depth;
    const height = spec.structure.height;
    const frame = spec.structure.frame;
    ctx.line('Start -> BuildingBody');
    ctx.line('');
    ctx.line('BuildingBody ->');
    ctx.line('  CornerFrames( ' + formatNumber(width) + ' ' + formatNumber(depth) + ' ' + formatNumber(height) + ' ' + formatNumber(frame) + ' )');
    ctx.line('  [ T ( 0 ' + formatNumber(height * 0.42) + ' 0 ) S ( ' + formatNumber(width * 0.88) + ' ' + formatNumber(frame * 0.8) + ' ' + formatNumber(depth * 0.88) + ' ) I ( Cube ' + spec.accent + ' 0.1 ) ]');
    ctx.line('');
    ctx.line('CornerFrames( w d h f ) ->');
    ctx.line('  [ T ( ( f * 0.5 + w * -0.5 ) 0 ( f * 0.5 + d * -0.5 ) ) S ( f h f ) I ( CubeY ' + spec.shell + ' 0.16 ) ]');
    ctx.line('  [ T ( ( w * 0.5 + f * -0.5 ) 0 ( f * 0.5 + d * -0.5 ) ) S ( f h f ) I ( CubeY ' + spec.shell + ' 0.16 ) ]');
    ctx.line('  [ T ( ( f * 0.5 + w * -0.5 ) 0 ( d * 0.5 + f * -0.5 ) ) S ( f h f ) I ( CubeY ' + spec.shell + ' 0.16 ) ]');
    ctx.line('  [ T ( ( w * 0.5 + f * -0.5 ) 0 ( d * 0.5 + f * -0.5 ) ) S ( f h f ) I ( CubeY ' + spec.shell + ' 0.16 ) ]');
    ctx.line('  [ T ( 0 h * 0.5 0 ) S ( w f d ) I ( Cube ' + spec.accent + ' 0.1 ) ]');
  }

  function emitDraftFromSpec(spec) {
    const validation = validateSpec(spec);
    if (!validation.ok) {
      throw new Error(validation.errors.join(' '));
    }
    const ctx = specToDraftContext(spec);
    switch (spec.type) {
      case 'tower': emitTower(ctx); break;
      case 'stepped': emitStepped(ctx); break;
      case 'slab': emitSlab(ctx); break;
      case 'bridge': emitBridge(ctx); break;
      case 'courtyard': emitCourtyard(ctx); break;
      default: emitFrame(ctx); break;
    }
    return {
      title: spec.title,
      primary: spec.primary,
      secondary: spec.secondary,
      mode: 'building',
      buildingType: spec.type,
      grammar: ctx.lines.join('\n'),
      metrics: spec.metrics,
      spec: spec
    };
  }

  function buildBuildingSpec(seed, requestedType, overrides) {
    const type = resolveRequestedType(seed, requestedType);
    switch (type) {
      case 'tower': return buildTowerSpec(seed, overrides);
      case 'stepped': return buildSteppedSpec(seed, overrides);
      case 'slab': return buildSlabSpec(seed, overrides);
      case 'bridge': return buildBridgeSpec(seed, overrides);
      case 'courtyard': return buildCourtyardSpec(seed, overrides);
      default: return buildFrameSpec(seed, overrides);
    }
  }

  function buildBuildingDraft(seed, requestedType, overrides) {
    return emitDraftFromSpec(buildBuildingSpec(seed, requestedType, overrides));
  }

  window.PG3DBuildingGenerator = {
    buildDraft: buildBuildingDraft,
    buildSpec: buildBuildingSpec,
    types: BUILDING_TYPES.slice()
  };
})();

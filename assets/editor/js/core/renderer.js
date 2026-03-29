// Extracted from original file lines 2624-3377
            // WebGL Scene Renderer with High-Res Textures, Correct UVs, and Improved Lighting
// ==============================================================================

(() => {
  // ---- Geometry index buffers (vertex order 0..7) ----
  const TRI_IDX = new Uint16Array([
    0,2,1, 0,3,2,  // back
    4,5,6, 4,6,7,  // front
    0,4,7, 0,7,3,  // left
    1,2,6, 1,6,5,  // right
    3,7,6, 3,6,2,  // top
    0,1,5, 0,5,4   // bottom
  ]);
  const EDGE_IDX = new Uint16Array([
    0,1, 1,2, 2,3, 3,0,
    4,5, 5,6, 6,7, 7,4,
    0,4, 1,5, 2,6, 3,7
  ]);

  // ---- Per-triangle UVs aligned 1:1 with TRI_IDX (pre-flattened) ----
  // Each face gets a clean [0,0]-[1,1] mapping (2 tris per face).
  const CUBE_TRI_UVS = new Float32Array([
    // back
    0,0,  1,1,  1,0,
    0,0,  0,1,  1,1,
    // front
    0,0,  1,0,  1,1,
    0,0,  1,1,  0,1,
    // left
    0,0,  1,0,  1,1,
    0,0,  1,1,  0,1,
    // right
    0,0,  1,0,  1,1,
    0,0,  1,1,  0,1,
    // top
    0,0,  1,0,  1,1,
    0,0,  1,1,  0,1,
    // bottom
    0,0,  1,0,  1,1,
    0,0,  1,1,  0,1
  ]);

  // ---- Texture presets (unchanged names; higher-res generators below) ----
  const TEXTURE_PRESETS = {
    // Structural / Building
    roughConcrete:   { fn:"noise",  c1:[0.6,0.6,0.6,1], c2:[0.4,0.4,0.4,1] },
    smoothConcrete:  { fn:"solid",  c1:[0.7,0.7,0.7,1] },
    crackedAsphalt:  { fn:"noise",  c1:[0.1,0.1,0.1,1], c2:[0.2,0.2,0.2,1] },
    redBrickWall:    { fn:"checker",c1:[0.6,0.2,0.2,1], c2:[0.45,0.15,0.15,1] },
    whiteTiles:      { fn:"checker",c1:[0.95,0.95,0.95,1], c2:[0.85,0.85,0.85,1] },
    blueCeramicTile: { fn:"checker",c1:[0.2,0.4,0.8,1], c2:[0.1,0.2,0.5,1] },

    // Metals
    shinySteel:      { fn:"solid",  c1:[0.75,0.75,0.8,1] },
    brushedAluminum: { fn:"noise",  c1:[0.8,0.8,0.85,1], c2:[0.7,0.7,0.75,1] },
    oxidizedCopper:  { fn:"noise",  c1:[0.7,0.3,0.2,1], c2:[0.2,0.5,0.4,1] },
    agedBronze:      { fn:"noise",  c1:[0.5,0.35,0.2,1], c2:[0.25,0.15,0.05,1] },
    shinyGold:       { fn:"solid",  c1:[0.9,0.8,0.25,1] },
    tarnishedSilver: { fn:"noise",  c1:[0.9,0.9,0.9,1], c2:[0.6,0.6,0.65,1] },
    rawIron:         { fn:"solid",  c1:[0.35,0.35,0.4,1] },
    polishedTitanium:{ fn:"solid",  c1:[0.75,0.75,0.85,1] },

    // Glass
    clearGlass:      { fn:"solid",  c1:[0.7,0.9,1,0.2] },
    frostedGlass:    { fn:"noise",  c1:[0.8,0.9,1,0.3], c2:[0.6,0.7,0.8,0.3] },
    tintedGreenGlass:{ fn:"solid",  c1:[0.4,0.7,0.5,0.3] },
    stainedBlueGlass:{ fn:"solid",  c1:[0.2,0.3,0.8,0.4] },

    // Plastics
    glossyWhitePlastic:{ fn:"solid", c1:[0.95,0.95,0.95,1] },
    matteBlackPlastic: { fn:"solid", c1:[0.05,0.05,0.05,1] },
    redABS:            { fn:"solid", c1:[0.9,0.1,0.1,1] },
    bluePVC:           { fn:"solid", c1:[0.1,0.1,0.9,1] },
    translucentPoly:   { fn:"solid", c1:[0.9,0.9,0.9,0.5] },

    // Natural / Ground
    freshGrass:     { fn:"checker",c1:[0.1,0.6,0.1,1], c2:[0.2,0.8,0.2,1] },
    dryGrass:       { fn:"checker",c1:[0.7,0.6,0.2,1], c2:[0.6,0.5,0.15,1] },
    desertSand:     { fn:"noise",  c1:[0.9,0.85,0.6,1], c2:[0.8,0.75,0.5,1] },
    muddySoil:      { fn:"noise",  c1:[0.4,0.25,0.15,1], c2:[0.3,0.2,0.1,1] },
    grayStone:      { fn:"noise",  c1:[0.5,0.5,0.5,1], c2:[0.3,0.3,0.3,1] },
    darkBasalt:     { fn:"noise",  c1:[0.2,0.2,0.2,1], c2:[0.1,0.1,0.1,1] },
    whiteMarble:    { fn:"noise",  c1:[0.95,0.95,0.95,1], c2:[0.75,0.75,0.75,1] },
    greenMarble:    { fn:"noise",  c1:[0.1,0.3,0.2,1], c2:[0.05,0.2,0.1,1] },

    // Wood
    oakPlanks:      { fn:"checker",c1:[0.65,0.45,0.25,1], c2:[0.55,0.35,0.2,1] },
    darkWalnut:     { fn:"checker",c1:[0.35,0.2,0.1,1], c2:[0.25,0.15,0.05,1] },
    pineWood:       { fn:"checker",c1:[0.8,0.65,0.4,1], c2:[0.7,0.55,0.3,1] },
    mahoganyWood:   { fn:"checker",c1:[0.55,0.25,0.15,1], c2:[0.45,0.2,0.1,1] },
    cherryWood:     { fn:"checker",c1:[0.6,0.2,0.2,1], c2:[0.5,0.15,0.15,1] },
    mapleWood:      { fn:"checker",c1:[0.9,0.8,0.6,1], c2:[0.8,0.7,0.5,1] },

    // Elements & FX
    iceBlock:       { fn:"solid",  c1:[0.8,0.9,1,0.5] },
    moltenLava:     { fn:"noise",  c1:[0.9,0.2,0.05,1], c2:[0.2,0.05,0.05,1] },
    deepWater:      { fn:"solid",  c1:[0.1,0.3,0.9,0.5] },
    snowPowder:     { fn:"solid",  c1:[0.98,0.98,1.0,1] },
    fluffyCloud:    { fn:"noise",  c1:[0.95,0.95,0.95,1], c2:[0.8,0.8,0.85,1] },
    mossPatch:      { fn:"noise",  c1:[0.2,0.4,0.2,1], c2:[0.1,0.3,0.1,1] },
    claySoil:       { fn:"solid",  c1:[0.6,0.3,0.2,1] },
    rustyMetal:     { fn:"noise",  c1:[0.6,0.25,0.1,1], c2:[0.4,0.15,0.05,1] },

    // Sci-Fi / Industrial
    carbonFiber:    { fn:"checker",c1:[0.05,0.05,0.05,1], c2:[0.15,0.15,0.15,1] },
    circuitBoard:   { fn:"checker",c1:[0.0,0.4,0.0,1], c2:[0.0,0.6,0.0,1] },
    glowingPanel:   { fn:"solid",  c1:[0.1,0.8,1,0.8] },
    hazardStripe:   { fn:"checker",c1:[0.9,0.8,0.1,1], c2:[0.05,0.05,0.05,1] },
    steelGrid:      { fn:"checker",c1:[0.5,0.5,0.55,1], c2:[0.3,0.3,0.35,1] },
    chromeSurface:  { fn:"solid",  c1:[0.9,0.9,0.95,1] },
  };
  const TEXTURE_NAMES = Object.keys(TEXTURE_PRESETS);

  const COMPOSITE_TEXTURE_PARTS = {
    surface: [
      "polished", "brushed", "frosted", "cracked", "smooth", "rough", "glossy", "matte",
      "rusty", "aged", "clear"
    ],
    color: [
      "silver", "orange", "yellow", "purple", "bronze", "copper", "white", "black",
      "green", "brown", "gray", "grey", "blue", "gold", "cyan", "teal", "red", "tan"
    ],
    reflectance: [
      "reflective", "metallic", "shiny", "satin", "dull", "matte"
    ],
    opacity: [
      "semitransparent", "transparent", "translucent", "opaque"
    ],
    type: [
      "concrete", "ceramic", "plastic", "asphalt", "basalt", "chrome", "marble",
      "metal", "glass", "stone", "brick", "panel", "board", "grass", "water",
      "cloud", "fiber", "steel", "wood", "tile", "sand", "soil", "lava", "iron",
      "grid", "ice"
    ]
  };

  const COMPOSITE_TEXTURE_TYPE_DEFAULTS = {
    metal:    { fn: "solid",   c1: [0.73, 0.75, 0.80, 1.00], c2: [0.58, 0.60, 0.66, 1.00] },
    steel:    { fn: "solid",   c1: [0.72, 0.74, 0.79, 1.00], c2: [0.56, 0.58, 0.64, 1.00] },
    iron:     { fn: "solid",   c1: [0.42, 0.43, 0.48, 1.00], c2: [0.28, 0.30, 0.34, 1.00] },
    chrome:   { fn: "solid",   c1: [0.90, 0.92, 0.98, 1.00], c2: [0.70, 0.74, 0.82, 1.00] },
    glass:    { fn: "solid",   c1: [0.72, 0.86, 0.98, 0.28], c2: [0.56, 0.70, 0.82, 0.28] },
    plastic:  { fn: "solid",   c1: [0.82, 0.84, 0.88, 1.00], c2: [0.72, 0.74, 0.79, 1.00] },
    concrete: { fn: "noise",   c1: [0.66, 0.66, 0.68, 1.00], c2: [0.45, 0.45, 0.48, 1.00] },
    stone:    { fn: "noise",   c1: [0.58, 0.58, 0.60, 1.00], c2: [0.36, 0.36, 0.38, 1.00] },
    basalt:   { fn: "noise",   c1: [0.24, 0.24, 0.26, 1.00], c2: [0.11, 0.11, 0.12, 1.00] },
    marble:   { fn: "noise",   c1: [0.90, 0.90, 0.92, 1.00], c2: [0.72, 0.72, 0.76, 1.00] },
    ceramic:  { fn: "checker", c1: [0.84, 0.84, 0.88, 1.00], c2: [0.68, 0.68, 0.74, 1.00] },
    tile:     { fn: "checker", c1: [0.90, 0.90, 0.94, 1.00], c2: [0.76, 0.76, 0.80, 1.00] },
    brick:    { fn: "checker", c1: [0.62, 0.28, 0.24, 1.00], c2: [0.48, 0.18, 0.16, 1.00] },
    wood:     { fn: "checker", c1: [0.62, 0.42, 0.24, 1.00], c2: [0.50, 0.32, 0.17, 1.00] },
    fiber:    { fn: "checker", c1: [0.09, 0.09, 0.10, 1.00], c2: [0.16, 0.16, 0.18, 1.00] },
    board:    { fn: "checker", c1: [0.08, 0.30, 0.08, 1.00], c2: [0.04, 0.18, 0.04, 1.00] },
    panel:    { fn: "solid",   c1: [0.18, 0.58, 0.82, 0.82], c2: [0.10, 0.32, 0.46, 0.82] },
    grid:     { fn: "checker", c1: [0.56, 0.56, 0.60, 1.00], c2: [0.26, 0.26, 0.30, 1.00] },
    asphalt:  { fn: "noise",   c1: [0.18, 0.18, 0.19, 1.00], c2: [0.09, 0.09, 0.10, 1.00] },
    sand:     { fn: "noise",   c1: [0.88, 0.82, 0.60, 1.00], c2: [0.76, 0.70, 0.48, 1.00] },
    soil:     { fn: "noise",   c1: [0.42, 0.28, 0.18, 1.00], c2: [0.28, 0.18, 0.10, 1.00] },
    grass:    { fn: "checker", c1: [0.18, 0.62, 0.18, 1.00], c2: [0.10, 0.44, 0.10, 1.00] },
    water:    { fn: "solid",   c1: [0.16, 0.38, 0.84, 0.48], c2: [0.08, 0.22, 0.52, 0.48] },
    lava:     { fn: "noise",   c1: [0.92, 0.24, 0.05, 1.00], c2: [0.24, 0.06, 0.04, 1.00] },
    cloud:    { fn: "noise",   c1: [0.96, 0.96, 0.98, 0.90], c2: [0.78, 0.80, 0.86, 0.90] },
    ice:      { fn: "solid",   c1: [0.80, 0.90, 1.00, 0.55], c2: [0.62, 0.76, 0.88, 0.55] }
  };

  const COMPOSITE_TEXTURE_COLOR_TINTS = {
    white:  [0.96, 0.96, 0.98],
    black:  [0.08, 0.08, 0.09],
    gray:   [0.55, 0.57, 0.60],
    grey:   [0.55, 0.57, 0.60],
    red:    [0.84, 0.18, 0.18],
    blue:   [0.22, 0.42, 0.88],
    green:  [0.20, 0.60, 0.28],
    yellow: [0.90, 0.80, 0.20],
    orange: [0.92, 0.48, 0.16],
    purple: [0.56, 0.32, 0.78],
    cyan:   [0.18, 0.72, 0.84],
    teal:   [0.16, 0.56, 0.58],
    gold:   [0.88, 0.76, 0.24],
    silver: [0.80, 0.82, 0.88],
    bronze: [0.62, 0.42, 0.22],
    copper: [0.72, 0.40, 0.24],
    brown:  [0.46, 0.28, 0.16],
    tan:    [0.74, 0.64, 0.44]
  };

  function _clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  function _matchCompositePart(text, options) {
    for (const option of options) {
      if (text.startsWith(option)) return option;
    }
    return null;
  }

  function _parseCompositeTextureName(name) {
    const raw = String(name || "");
    const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!normalized || TEXTURE_PRESETS[raw] || TEXTURE_PRESETS[normalized]) return null;

    let cursor = normalized;
    const result = {
      surface: null,
      color: null,
      reflectance: null,
      opacity: null,
      type: null
    };

    for (const key of ["surface", "color", "reflectance", "opacity", "type"]) {
      const match = _matchCompositePart(cursor, COMPOSITE_TEXTURE_PARTS[key]);
      if (match) {
        result[key] = match;
        cursor = cursor.slice(match.length);
      }
    }

    if (cursor.length > 0) return null;
    if (!result.surface && !result.color && !result.reflectance && !result.opacity && !result.type) return null;
    return result;
  }

  function _blendColor(base, tint, amount) {
    return [
      base[0] * (1 - amount) + tint[0] * amount,
      base[1] * (1 - amount) + tint[1] * amount,
      base[2] * (1 - amount) + tint[2] * amount,
      base[3]
    ];
  }

  function _scaleColor(color, scale) {
    return [
      _clamp01(color[0] * scale),
      _clamp01(color[1] * scale),
      _clamp01(color[2] * scale),
      color[3]
    ];
  }

  function _withAlpha(color, alpha) {
    return [color[0], color[1], color[2], alpha];
  }

  function _buildCompositeTexturePreset(name) {
    const parsed = _parseCompositeTextureName(name);
    if (!parsed) return null;

    const base = COMPOSITE_TEXTURE_TYPE_DEFAULTS[parsed.type || "metal"] || COMPOSITE_TEXTURE_TYPE_DEFAULTS.metal;
    const preset = {
      fn: base.fn,
      c1: base.c1.slice(),
      c2: base.c2.slice()
    };

    if (parsed.color && COMPOSITE_TEXTURE_COLOR_TINTS[parsed.color]) {
      const tint = COMPOSITE_TEXTURE_COLOR_TINTS[parsed.color];
      const tintAmount = (parsed.type === "metal" || parsed.type === "steel" || parsed.type === "iron" || parsed.type === "chrome") ? 0.45 : 0.72;
      preset.c1 = _blendColor(preset.c1, tint, tintAmount);
      preset.c2 = _blendColor(preset.c2, tint, tintAmount * 0.82);
    }

    if (parsed.surface) {
      if (["rough", "brushed", "frosted", "cracked", "rusty", "aged"].includes(parsed.surface)) preset.fn = "noise";
      if (parsed.surface === "smooth" || parsed.surface === "clear" || parsed.surface === "polished" || parsed.surface === "glossy") preset.fn = "solid";
      if (parsed.surface === "matte") preset.fn = parsed.type === "tile" || parsed.type === "ceramic" || parsed.type === "brick" || parsed.type === "wood" ? "checker" : "solid";
      if (parsed.surface === "cracked") preset.c2 = _scaleColor(preset.c2, 0.72);
      if (parsed.surface === "frosted") preset.c2 = _blendColor(preset.c2, [0.92, 0.96, 1.00], 0.25);
      if (parsed.surface === "polished") {
        preset.c1 = _scaleColor(preset.c1, 1.10);
        preset.c2 = _scaleColor(preset.c2, 1.05);
      }
      if (parsed.surface === "rough") {
        preset.c1 = _scaleColor(preset.c1, 0.96);
        preset.c2 = _scaleColor(preset.c2, 0.84);
      }
    }

    if (parsed.reflectance) {
      if (parsed.reflectance === "shiny" || parsed.reflectance === "reflective") {
        preset.c1 = _scaleColor(preset.c1, 1.12);
        preset.c2 = _scaleColor(preset.c2, 1.04);
        if (preset.fn !== "checker") preset.fn = "solid";
      } else if (parsed.reflectance === "metallic") {
        preset.c1 = _blendColor(preset.c1, [0.86, 0.88, 0.92], 0.22);
        preset.c2 = _blendColor(preset.c2, [0.62, 0.64, 0.70], 0.18);
      } else if (parsed.reflectance === "satin") {
        preset.c1 = _scaleColor(preset.c1, 1.04);
      } else if (parsed.reflectance === "dull" || parsed.reflectance === "matte") {
        preset.c1 = _scaleColor(preset.c1, 0.90);
        preset.c2 = _scaleColor(preset.c2, 0.88);
        if (preset.fn === "solid") preset.fn = "noise";
      }
    }

    let alpha = Math.min(preset.c1[3] ?? 1, preset.c2[3] ?? 1);
    if (parsed.opacity === "opaque") alpha = 1.0;
    if (parsed.opacity === "translucent") alpha = 0.60;
    if (parsed.opacity === "semitransparent") alpha = 0.42;
    if (parsed.opacity === "transparent") alpha = 0.22;
    if (parsed.type === "glass" && !parsed.opacity) alpha = 0.28;
    if (parsed.type === "water" && !parsed.opacity) alpha = 0.48;
    if (parsed.type === "cloud" && !parsed.opacity) alpha = 0.88;
    preset.c1 = _withAlpha(preset.c1, alpha);
    preset.c2 = _withAlpha(preset.c2, alpha);

    if (parsed.type === "tile" || parsed.type === "ceramic" || parsed.type === "brick" || parsed.type === "wood" || parsed.type === "grid" || parsed.type === "fiber" || parsed.type === "board") {
      if (!parsed.surface || (parsed.surface !== "smooth" && parsed.surface !== "polished")) preset.fn = "checker";
    }

    return preset;
  }

  function _cloneVec3List(verts) {
    return Array.isArray(verts) ? verts.map((v) => [v[0], v[1], v[2]]) : [];
  }

  function _computeBoundsFromVertsCollection(items) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let found = false;

    for (const item of items) {
      const verts = item && Array.isArray(item.verts) ? item.verts : [];
      for (const v of verts) {
        if (!Array.isArray(v) || v.length < 3) continue;
        found = true;
        if (v[0] < minX) minX = v[0];
        if (v[1] < minY) minY = v[1];
        if (v[2] < minZ) minZ = v[2];
        if (v[0] > maxX) maxX = v[0];
        if (v[1] > maxY) maxY = v[1];
        if (v[2] > maxZ) maxZ = v[2];
      }
    }

    if (!found) return null;

    const center = [
      (minX + maxX) * 0.5,
      (minY + maxY) * 0.5,
      (minZ + maxZ) * 0.5
    ];
    const half = [
      Math.max((maxX - minX) * 0.5, 1e-6),
      Math.max((maxY - minY) * 0.5, 1e-6),
      Math.max((maxZ - minZ) * 0.5, 1e-6)
    ];

    return { minX, minY, minZ, maxX, maxY, maxZ, center, half };
  }

  function _applyAffineToNormalizedPoint(point, scale, translate) {
    const s = Array.isArray(scale) ? scale : [1, 1, 1];
    const t = Array.isArray(translate) ? translate : [0, 0, 0];
    return [
      s[0] * point[0] + t[0],
      s[1] * point[1] + t[1],
      s[2] * point[2] + t[2]
    ];
  }

  function _applyGlobalAxisDeform(verts, axisDeform, bounds) {
    if (!axisDeform || !axisDeform.active || !bounds || !Array.isArray(verts)) return _cloneVec3List(verts);

    const center = bounds.center;
    const half = bounds.half;
    const dsx = axisDeform.dsx || [1, 1, 1];
    const dsy = axisDeform.dsy || [1, 1, 1];
    const dsz = axisDeform.dsz || [1, 1, 1];
    const dtx = axisDeform.dtx || [0, 0, 0];
    const dty = axisDeform.dty || [0, 0, 0];
    const dtz = axisDeform.dtz || [0, 0, 0];

    return verts.map((v) => {
      let p = [
        (v[0] - center[0]) / half[0],
        (v[1] - center[1]) / half[1],
        (v[2] - center[2]) / half[2]
      ];

      if (p[0] > 0) p = _applyAffineToNormalizedPoint(p, dsx, dtx);
      if (p[1] > 0) p = _applyAffineToNormalizedPoint(p, dsy, dty);
      if (p[2] > 0) p = _applyAffineToNormalizedPoint(p, dsz, dtz);

      return [
        center[0] + p[0] * half[0],
        center[1] + p[1] * half[1],
        center[2] + p[2] * half[2]
      ];
    });
  }

  // ---- Minimal mat4 helpers (same API, kept) ----
  const Mat4 = {
    ident() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); },
    multiply(a,b,out=new Float32Array(16)) {
      const o=out;
      const a00=a[0],a01=a[1],a02=a[2],a03=a[3];
      const a10=a[4],a11=a[5],a12=a[6],a13=a[7];
      const a20=a[8],a21=a[9],a22=a[10],a23=a[11];
      const a30=a[12],a31=a[13],a32=a[14],a33=a[15];
      const b00=b[0],b01=b[1],b02=b[2],b03=b[3];
      const b10=b[4],b11=b[5],b12=b[6],b13=b[7];
      const b20=b[8],b21=b[9],b22=b[10],b23=b[11];
      const b30=b[12],b31=b[13],b32=b[14],b33=b[15];
      o[0]=a00*b00+a10*b01+a20*b02+a30*b03;
      o[1]=a01*b00+a11*b01+a21*b02+a31*b03;
      o[2]=a02*b00+a12*b01+a22*b02+a32*b03;
      o[3]=a03*b00+a13*b01+a23*b02+a33*b03;
      o[4]=a00*b10+a10*b11+a20*b12+a30*b13;
      o[5]=a01*b10+a11*b11+a21*b12+a31*b13;
      o[6]=a02*b10+a12*b11+a22*b12+a32*b13;
      o[7]=a03*b10+a13*b11+a23*b12+a33*b13;
      o[8]=a00*b20+a10*b21+a20*b22+a30*b23;
      o[9]=a01*b20+a11*b21+a21*b22+a31*b23;
      o[10]=a02*b20+a12*b21+a22*b22+a32*b23;
      o[11]=a03*b20+a13*b21+a23*b22+a33*b23;
      o[12]=a00*b30+a10*b31+a20*b32+a30*b33;
      o[13]=a01*b30+a11*b31+a21*b32+a31*b33;
      o[14]=a02*b30+a12*b31+a22*b32+a32*b33;
      o[15]=a03*b30+a13*b31+a23*b32+a33*b33;
      return o;
    },
    perspective(fovyRad, aspect, near, far) {
      const f = 1 / Math.tan(fovyRad/2), nf = 1/(near - far);
      const out = new Float32Array(16);
      out[0]=f/aspect; out[5]=f; out[11]=-1;
      out[10]=(far+near)*nf; out[14]=(2*far*near)*nf;
      return out;
    },
    lookAt(eye, target, up=[0,1,0]) {
      const [ex,ey,ez]=eye,[tx,ty,tz]=target;
      const zx=ex-tx, zy=ey-ty, zz=ez-tz;
      let rl = 1/Math.hypot(zx,zy,zz);
      const zxN=zx*rl, zyN=zy*rl, zzN=zz*rl;
      let xx = up[1]*zzN - up[2]*zyN;
      let xy = up[2]*zxN - up[0]*zzN;
      let xz = up[0]*zyN - up[1]*zxN;
      rl = 1/Math.hypot(xx,xy,xz); xx*=rl; xy*=rl; xz*=rl;
      const yx = zyN*xz - zzN*xy;
      const yy = zzN*xx - zxN*xz;
      const yz = zxN*xy - zyN*xx;
      const out = new Float32Array(16);
      out[0]=xx; out[1]=yx; out[2]=zxN; out[3]=0;
      out[4]=xy; out[5]=yy; out[6]=zyN; out[7]=0;
      out[8]=xz; out[9]=yz; out[10]=zzN; out[11]=0;
      out[12]=-(xx*ex+xy*ey+xz*ez);
      out[13]=-(yx*ex+yy*ey+yz*ez);
      out[14]=-(zxN*ex+zyN*ey+zzN*ez);
      out[15]=1;
      return out;
    }
  };

  // ---- Improved shaders: textured + Blinn-Phong lighting (view space) ----
  const VS_LIT = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aUV;
    uniform mat4 uMVP;
    uniform mat4 uMV;
    uniform mat3 uNormalMatrix;
    varying vec2 vUV;
    varying vec3 vN;
    varying vec3 vPosVS;
    void main() {
      vUV = aUV;
      vec4 posVS = uMV * vec4(aPosition, 1.0);
      vPosVS = posVS.xyz;
      vN = normalize(uNormalMatrix * aNormal);
      gl_Position = uMVP * vec4(aPosition, 1.0);
    }
  `;
  const FS_LIT = `
    precision mediump float;
    varying vec2 vUV;
    varying vec3 vN;
    varying vec3 vPosVS;
    uniform sampler2D uTex;
    uniform vec3 uLightDirVS;      // key light direction toward the surface in view space
    uniform vec3 uFillLightDirVS;  // softer opposing fill light in view space
    uniform vec3 uLightColor;
    uniform vec3 uFillLightColor;
    uniform vec3 uAmbient;
    uniform vec3 uHemiSky;
    uniform vec3 uHemiGround;
    uniform vec3 uRimColor;
    uniform float uSpecPower;
    uniform float uSpecIntensity;
    uniform float uFillSpecIntensity;
    uniform float uRimStrength;
    uniform float uGamma;

    void main(){
      vec4 albedo = texture2D(uTex, vUV);

      vec3 N = normalize(vN);
      vec3 L0 = normalize(uLightDirVS);
      vec3 L1 = normalize(uFillLightDirVS);
      vec3 V = normalize(-vPosVS);
      vec3 H0 = normalize(L0 + V);
      vec3 H1 = normalize(L1 + V);

      float NdotL0 = max(dot(N, L0), 0.0);
      float NdotL1 = max(dot(N, L1), 0.0);
      float NdotH0 = max(dot(N, H0), 0.0);
      float NdotH1 = max(dot(N, H1), 0.0);
      float hemi = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 hemiLight = mix(uHemiGround, uHemiSky, hemi);

      vec3 diffuse = albedo.rgb * ((uLightColor * NdotL0) + (uFillLightColor * NdotL1));
      vec3 specular =
        (uLightColor * pow(NdotH0, uSpecPower) * uSpecIntensity) +
        (uFillLightColor * pow(NdotH1, max(8.0, uSpecPower * 0.65)) * uFillSpecIntensity);

      float rim = pow(clamp(1.0 - max(dot(N, V), 0.0), 0.0, 1.0), 2.2) * uRimStrength;
      vec3 colorLin = (albedo.rgb * (uAmbient + hemiLight)) + diffuse + specular + (uRimColor * rim);

      vec3 color = pow(max(colorLin, 0.0), vec3(1.0 / uGamma));
      gl_FragColor = vec4(color, albedo.a);
    }
  `;

  const VS_LINE = `
    attribute vec3 aPosition;
    uniform mat4 uMVP;
    void main() {
      gl_Position = uMVP * vec4(aPosition, 1.0);
    }
  `;
  const FS_LINE = `
    precision mediump float;
    uniform vec4 uColor;
    void main() {
      gl_FragColor = uColor;
    }
  `;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error("Shader compile failed:\n" + info);
    }
    return s;
  }
  function program(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error("Program link failed:\n" + info);
    }
    return p;
  }

  class WebGLSceneRenderer {
    constructor(canvasOrSelector, opts={}) {
      this.canvas = (typeof canvasOrSelector === "string")
        ? document.querySelector(canvasOrSelector)
        : canvasOrSelector;
      if (!this.canvas) throw new Error("Canvas not found.");

      this.dpr = Math.max(1, Math.min(window.devicePixelRatio||1, 2));
      const gl = this.canvas.getContext("webgl", {
        antialias:true, depth:true, alpha:false, premultipliedAlpha:false
      });
      if (!gl) throw new Error("WebGL not supported.");
      this.gl = gl;

      // Programs + locations
      this.litProg = program(gl, VS_LIT, FS_LIT);
      this.lineProg = program(gl, VS_LINE, FS_LINE);
      this.litLoc = {
        aPosition: gl.getAttribLocation(this.litProg, "aPosition"),
        aNormal:   gl.getAttribLocation(this.litProg, "aNormal"),
        aUV:       gl.getAttribLocation(this.litProg, "aUV"),
        uMVP:      gl.getUniformLocation(this.litProg, "uMVP"),
        uMV:       gl.getUniformLocation(this.litProg, "uMV"),
        uNormalMatrix: gl.getUniformLocation(this.litProg, "uNormalMatrix"),
        uTex:      gl.getUniformLocation(this.litProg, "uTex"),
        uLightDirVS:   gl.getUniformLocation(this.litProg, "uLightDirVS"),
        uFillLightDirVS: gl.getUniformLocation(this.litProg, "uFillLightDirVS"),
        uLightColor:   gl.getUniformLocation(this.litProg, "uLightColor"),
        uFillLightColor: gl.getUniformLocation(this.litProg, "uFillLightColor"),
        uAmbient:      gl.getUniformLocation(this.litProg, "uAmbient"),
        uHemiSky:      gl.getUniformLocation(this.litProg, "uHemiSky"),
        uHemiGround:   gl.getUniformLocation(this.litProg, "uHemiGround"),
        uRimColor:     gl.getUniformLocation(this.litProg, "uRimColor"),
        uSpecPower:    gl.getUniformLocation(this.litProg, "uSpecPower"),
        uSpecIntensity:gl.getUniformLocation(this.litProg, "uSpecIntensity"),
        uFillSpecIntensity: gl.getUniformLocation(this.litProg, "uFillSpecIntensity"),
        uRimStrength:  gl.getUniformLocation(this.litProg, "uRimStrength"),
        uGamma:        gl.getUniformLocation(this.litProg, "uGamma"),
      };
      this.lineLoc = {
        aPosition: gl.getAttribLocation(this.lineProg, "aPosition"),
        uMVP: gl.getUniformLocation(this.lineProg, "uMVP"),
        uColor: gl.getUniformLocation(this.lineProg, "uColor"),
      };

      // Buffers
      this.triPosBuf = gl.createBuffer();
      this.triUVBuf  = gl.createBuffer();
      this.triNrmBuf = gl.createBuffer();
      this.linePosBuf = gl.createBuffer();
      this.gridPosBuf = gl.createBuffer();

      // Draw-call batching
      this.drawCalls = []; // [{ tex, first, count, alpha }]
      this.opaqueCalls = [];
      this.transpCalls = [];

      // State
      this.wireframe = (opts.wireframe !== false);
      this.lineColor = new Float32Array((opts.lineColor||[0,0,0,0.3]));
      this.gridColor = new Float32Array((opts.gridColor||[0.34,0.46,0.60,0.32]));
      this.gridLineCount = 0;
      this.gridHalfSpan = 10;
      this.showGrid = (opts.showGrid !== false);
      this.showAxisWidget = (opts.showAxisWidget !== false);
      this.axisWidgetCanvas = null;
      this.axisWidgetCtx = null;
      this.axisWidgetCssSize = opts.axisWidgetSize || 100;
      this.target = [0,0,0];
      this.radius = 6; this.phi = Math.PI/3.6; this.theta = Math.PI/4.8;
      this.worldUp = [0, 1, 0];
      this.X = [1, 0, 0];
      this.Y = [0, 1, 0];
      this.Z = [0, 0, 1];
      this.SVEC = [0, 0, 1];
      this.svec = [0, 0, 1];
      this.svec3 = [1, 0, 0];
      this.svec5 = [0, 1, 0];
      this.viewDir = [0, 0, 1];
      this.viewRight = [1, 0, 0];
      this.viewUp = [0, 1, 0];
      this.dragScale = 0.0035;
      this.homeOrbitState = null;
      this.sceneCenter = [0, 0, 0];
      this.sceneRadius = 1;
      this.hasSceneBounds = false;
      this.hasUserView = false;
      this.useViewVectorCamera = true;
      this.proj = Mat4.perspective(60*Math.PI/180, 1, 0.01, 100);
      this.view = Mat4.lookAt([0,0,this.radius], this.target, [0,1,0]);
      this.mvp  = Mat4.ident();
      this.mv   = Mat4.ident();
      this.resetSVECOrbit(true);
      this.updateGridGeometry();
      this.attachAxisWidget();

      // Textures
      this.textures = Object.create(null);
      this.textureAlpha = Object.create(null);
      this.createAllPresetTextures();

      // Controls + GL state
      this.#initControls();
      this.resize();
      window.addEventListener("resize", () => this.resize());
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      gl.clearColor(0.035,0.05,0.075,1);

      // Scene
      this.scene = null;
      this.triCount = 0;
      this.lineCount = 0;

      // Animation loop
      this.needsRedraw = true;
      const loop = () => {
        if (this.needsRedraw) { this.render(); this.needsRedraw = false; }
        requestAnimationFrame(loop);
      };
      loop();
    }

    // ---------------- Public API ----------------
    setWireframe(on=true){ this.wireframe = !!on; this.invalidate(); }
    setLineColor(r=0,g=0,b=0,a=0.3){ this.lineColor.set([r,g,b,a]); this.invalidate(); }
    clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    clone3(v) { return [v[0] || 0, v[1] || 0, v[2] || 0]; }
    length3(v) { return Math.hypot(v[0] || 0, v[1] || 0, v[2] || 0); }
    normalize3(v) {
      const len = this.length3(v) || 1;
      return [v[0] / len, v[1] / len, v[2] / len];
    }
    normalizeSafe3(v, fallback = [0, 0, 1]) {
      if (this.length3(v) < 1e-12) return this.clone3(fallback);
      return this.normalize3(v);
    }
    cross3(a, b) {
      return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
      ];
    }
    dot3(a, b) {
      return (a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]);
    }
    sub3(a, b) {
      return [
        (a[0] || 0) - (b[0] || 0),
        (a[1] || 0) - (b[1] || 0),
        (a[2] || 0) - (b[2] || 0)
      ];
    }
    addScaled3(v, add, scale) {
      return [
        v[0] + add[0] * scale,
        v[1] + add[1] * scale,
        v[2] + add[2] * scale
      ];
    }
    safeTangentBasis(dir) {
      const forward = this.normalizeSafe3(dir || [0, 0, 1], [0, 0, 1]);
      let tempUp = this.worldUp.slice();
      if (Math.abs(this.dot3(forward, tempUp)) > 0.98) tempUp = [1, 0, 0];
      const right = this.normalizeSafe3(this.cross3(tempUp, forward), [1, 0, 0]);
      const up = this.normalizeSafe3(this.cross3(forward, right), [0, 1, 0]);
      return { right, up, forward };
    }
    localToWorld(localVec) {
      return [
        localVec[0] * this.X[0] + localVec[1] * this.Y[0] + localVec[2] * this.Z[0],
        localVec[0] * this.X[1] + localVec[1] * this.Y[1] + localVec[2] * this.Z[1],
        localVec[0] * this.X[2] + localVec[1] * this.Y[2] + localVec[2] * this.Z[2]
      ];
    }
    captureOrbitState() {
      return {
        X: this.clone3(this.X),
        Y: this.clone3(this.Y),
        Z: this.clone3(this.Z),
        SVEC: this.clone3(this.SVEC),
        radius: this.radius
      };
    }
    restoreOrbitState(state) {
      if (!state) return;
      this.X = this.clone3(state.X || [1, 0, 0]);
      this.Y = this.clone3(state.Y || [0, 1, 0]);
      this.Z = this.clone3(state.Z || [0, 0, 1]);
      this.SVEC = this.normalizeSafe3(state.SVEC || [0, 0, 1], [0, 0, 1]);
      if (Number.isFinite(state.radius)) this.radius = Math.max(0.02, state.radius);
      this.updateDerivedVectors();
      this.updateViewCamera();
    }
    resetSVECOrbit(captureHome = false) {
      this.X = [1, 0, 0];
      this.Y = [0, 1, 0];
      this.Z = [0, 0, 1];
      this.SVEC = this.normalizeSafe3([0.78, 0.46, 1.14], [0, 0, 1]);
      this.updateDerivedVectors();
      this.updateViewCamera();
      if (captureHome || !this.homeOrbitState) this.homeOrbitState = this.captureOrbitState();
    }
    rebaseIfNeeded() {
      if (Math.abs(this.SVEC[1]) <= 0.207) return;
      const z = this.normalizeSafe3(this.SVEC, [0, 0, 1]);
      let y;
      if (this.SVEC[1] > 0.0) {
        y = [
          -this.SVEC[0],
          (this.SVEC[0] * this.SVEC[0] + this.SVEC[2] * this.SVEC[2]) / this.SVEC[1],
          -this.SVEC[2]
        ];
      } else {
        y = [
          this.SVEC[0],
          -((this.SVEC[0] * this.SVEC[0] + this.SVEC[2] * this.SVEC[2]) / this.SVEC[1]),
          this.SVEC[2]
        ];
      }
      y = this.normalizeSafe3(y, [0, 1, 0]);
      const x = this.normalizeSafe3(this.cross3(y, z), [1, 0, 0]);
      this.X = this.normalizeSafe3(this.localToWorld(x), [1, 0, 0]);
      this.Y = this.normalizeSafe3(this.localToWorld(y), [0, 1, 0]);
      this.Z = this.normalizeSafe3(this.localToWorld(z), [0, 0, 1]);
      this.SVEC = [0, 0, 1];
    }
    updateDerivedVectors() {
      let svec2 = this.sub3(this.SVEC, [0, 1, 0]);
      if (this.length3(svec2) < 1e-12) svec2 = [0.0001, 0.0, 0.0];
      svec2 = this.normalizeSafe3(svec2, [1, 0, 0]);
      const localSvec3 = this.normalizeSafe3(this.cross3(this.SVEC, svec2), [1, 0, 0]);
      const localSvec5 = this.normalizeSafe3(this.cross3(this.SVEC, localSvec3), [0, 1, 0]);
      this.svec = this.normalizeSafe3(this.localToWorld(this.SVEC), [0, 0, 1]);
      this.svec3 = this.normalizeSafe3(this.localToWorld(localSvec3), [1, 0, 0]);
      this.svec5 = this.normalizeSafe3(this.localToWorld(localSvec5), [0, 1, 0]);
      this.viewDir = this.clone3(this.svec);
      this.viewRight = this.clone3(this.svec3);
      this.viewUp = this.clone3(this.svec5);
    }
    syncViewDirFromAngles() {
      const dir = this.normalizeSafe3([
        Math.sin(this.phi) * Math.cos(this.theta),
        Math.cos(this.phi),
        Math.sin(this.phi) * Math.sin(this.theta)
      ], [0, 0, 1]);
      this.X = [1, 0, 0];
      this.Y = [0, 1, 0];
      this.Z = [0, 0, 1];
      this.SVEC = dir;
      this.updateDerivedVectors();
      return this.viewDir;
    }
    syncAnglesFromViewDir() {
      const dir = this.normalizeSafe3(this.svec || this.viewDir || [0, 0, 1], [0, 0, 1]);
      this.viewDir = dir;
      this.phi = Math.acos(this.clamp(dir[1], -1, 1));
      this.theta = Math.atan2(dir[2], dir[0]);
      this.viewRight = this.clone3(this.svec3 || [1, 0, 0]);
      this.viewUp = this.clone3(this.svec5 || [0, 1, 0]);
      return dir;
    }
    getCameraEye() {
      return [
        this.target[0] + this.svec[0] * this.radius,
        this.target[1] + this.svec[1] * this.radius,
        this.target[2] + this.svec[2] * this.radius
      ];
    }
    updateViewCamera() {
      this.updateDerivedVectors();
      this.syncAnglesFromViewDir();
      const eye = this.getCameraEye();
      const up = this.normalizeSafe3(this.svec5, [0, 1, 0]);
      this.view = Mat4.lookAt(eye, this.target, up);
      return { eye, basis: { right: this.svec3, up: this.svec5, forward: this.svec } };
    }
    refreshSceneBounds() {
      const items = this.scene && typeof this.scene.getAll === "function" ? this.scene.getAll() : [];
      if (!Array.isArray(items) || !items.length) {
        this.sceneCenter = [0, 0, 0];
        this.sceneRadius = 1;
        this.hasSceneBounds = false;
        this.updateGridGeometry();
        return null;
      }
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      let found = false;
      for (const item of items) {
        if (!item || !Array.isArray(item.verts)) continue;
        for (const v of item.verts) {
          if (!Array.isArray(v) || v.length < 3) continue;
          found = true;
          if (v[0] < minX) minX = v[0];
          if (v[1] < minY) minY = v[1];
          if (v[2] < minZ) minZ = v[2];
          if (v[0] > maxX) maxX = v[0];
          if (v[1] > maxY) maxY = v[1];
          if (v[2] > maxZ) maxZ = v[2];
        }
      }
      if (!found) {
        this.sceneCenter = [0, 0, 0];
        this.sceneRadius = 1;
        this.hasSceneBounds = false;
        this.updateGridGeometry();
        return null;
      }
      const center = [
        (minX + maxX) * 0.5,
        (minY + maxY) * 0.5,
        (minZ + maxZ) * 0.5
      ];
      let radius = 0.5;
      for (const item of items) {
        if (!item || !Array.isArray(item.verts)) continue;
        for (const v of item.verts) {
          if (!Array.isArray(v) || v.length < 3) continue;
          const dx = v[0] - center[0];
          const dy = v[1] - center[1];
          const dz = v[2] - center[2];
          radius = Math.max(radius, Math.hypot(dx, dy, dz));
        }
      }
      this.sceneCenter = center;
      this.sceneRadius = Math.max(radius, 0.5);
      this.hasSceneBounds = true;
      this.updateGridGeometry();
      return { center: this.sceneCenter.slice(), radius: this.sceneRadius };
    }
    fitScene(preserveDirection = true) {
      const bounds = this.refreshSceneBounds();
      if (!bounds) {
        this.target = [0, 0, 0];
        this.radius = 6;
        if (!preserveDirection && this.homeOrbitState) this.restoreOrbitState({ ...this.homeOrbitState, radius: this.radius });
        else this.updateViewCamera();
        this.invalidate();
        return;
      }
      const fov = 60 * Math.PI / 180;
      const fitDist = (bounds.radius / Math.sin(fov / 2)) * 1.15;
      this.target = bounds.center.slice();
      this.radius = Math.max(fitDist, bounds.radius * 2.2, 0.1);
      if (!preserveDirection && this.homeOrbitState) this.restoreOrbitState({ ...this.homeOrbitState, radius: this.radius });
      else this.updateViewCamera();
      this.invalidate();
    }
    resetView() {
      this.refreshSceneBounds();
      this.target = this.hasSceneBounds ? this.sceneCenter.slice() : [0, 0, 0];
      this.radius = Math.max(this.sceneRadius * 3.0, 3.0);
      if (this.homeOrbitState) this.restoreOrbitState({ ...this.homeOrbitState, radius: this.radius });
      else this.resetSVECOrbit(true);
      this.hasUserView = false;
      this.invalidate();
    }
    orbitByMouseDelta(dx, dy) {
      this.updateSVECOrbitFromDrag(dx, dy);
    }
    updateSVECOrbitFromDrag(dx, dy) {
      this.rebaseIfNeeded();
      let localSvec2 = this.sub3(this.SVEC, [0, 1, 0]);
      if (this.length3(localSvec2) < 1e-12) localSvec2 = [0.0001, 0.0, 0.0];
      localSvec2 = this.normalizeSafe3(localSvec2, [1, 0, 0]);
      const localSvec3 = this.normalizeSafe3(this.cross3(this.SVEC, localSvec2), [1, 0, 0]);
      const localSvec5 = this.normalizeSafe3(this.cross3(this.SVEC, localSvec3), [0, 1, 0]);
      const dsx = -dx * this.dragScale;
      const dsy = -dy * this.dragScale;
      const nextSVEC = this.normalizeSafe3(
        this.addScaled3(
          this.addScaled3(this.SVEC, localSvec3, dsx),
          localSvec5,
          dsy
        ),
        [0, 0, 1]
      );
      this.SVEC = nextSVEC;
      this.hasUserView = true;
      this.updateDerivedVectors();
      this.updateViewCamera();
      this.invalidate();
    }
    panByMouseDelta(dx, dy) {
      const panScale = this.radius * 0.0015;
      this.target = this.addScaled3(this.addScaled3(this.target, this.svec3, -dx * panScale), this.svec5, dy * panScale);
      this.hasUserView = true;
      this.updateViewCamera();
      this.invalidate();
    }
    zoomByWheel(deltaY) {
      const zoomFactor = Math.exp(deltaY * 0.001);
      const minDist = Math.max(this.sceneRadius * 0.25, 0.02);
      const maxDist = Math.max(this.sceneRadius * 50.0, 50.0);
      this.radius = this.clamp(this.radius * zoomFactor, minDist, maxDist);
      this.hasUserView = true;
      this.updateViewCamera();
      this.invalidate();
    }
    stepAutoOrbit(amount = 0.0022) {
      this.rebaseIfNeeded();
      let svec2 = this.sub3(this.SVEC, [0, 1, 0]);
      if (this.length3(svec2) < 1e-12) svec2 = [0.0001, 0.0, 0.0];
      svec2 = this.normalizeSafe3(svec2, [1, 0, 0]);
      const localSvec3 = this.normalizeSafe3(this.cross3(this.SVEC, svec2), [1, 0, 0]);
      this.SVEC = this.normalizeSafe3(this.addScaled3(this.SVEC, localSvec3, -amount), [0, 0, 1]);
      this.updateViewCamera();
      this.invalidate();
    }
    stepAutoOrbitXZ(amount = 0.0022) {
      const currentDir = this.normalizeSafe3(this.svec || this.viewDir || this.localToWorld(this.SVEC), [0, 0, 1]);
      let planar = Math.hypot(currentDir[0], currentDir[2]);
      let y = this.clamp(currentDir[1], -0.985, 0.985);
      if (planar < 1e-6) {
        planar = Math.sqrt(Math.max(1e-6, 1 - y * y));
      }
      const nextTheta = Math.atan2(currentDir[2], currentDir[0]) + amount;
      const nextPlanar = Math.sqrt(Math.max(1e-6, 1 - y * y));
      const dir = this.normalizeSafe3([
        Math.cos(nextTheta) * nextPlanar,
        y,
        Math.sin(nextTheta) * nextPlanar
      ], [0, 0, 1]);
      this.X = [1, 0, 0];
      this.Y = [0, 1, 0];
      this.Z = [0, 0, 1];
      this.SVEC = dir;
      this.updateViewCamera();
      this.invalidate();
    }
    setScene(scene) {
      if (!scene || typeof scene.getAll !== "function")
        throw new Error("setScene expects a Scene instance with getAll().");
      this.scene = scene;
      this.#rebuildBuffers();
      const bounds = this.refreshSceneBounds();
      if (bounds && !this.hasUserView) {
        this.fitScene(true);
        return;
      }
      this.invalidate();
    }
    invalidate(){ this.needsRedraw = true; }

    setTexture(name, texData /* {w,h,data:Uint8Array} */){
      this.textures[name] = this.#uploadTexture(texData); // generates mipmaps
      this.textureAlpha[name] = 1.0;
      this.invalidate();
    }

    createRandomTexturePattern(name=null){
      const t = this.#uploadTexture(this.#makeRandomPattern());
      if (name) this.textures[name] = t;
      return t;
    }

    createAllPresetTextures() {
      for (const [name, preset] of Object.entries(TEXTURE_PRESETS)) {
       log2(`Adding texture ${name}.`);
//        if (this.textures[name]) continue;
        let data;
        switch (preset.fn) {
          case "solid":   data = this.#makeSolid(preset.c1); break;
          case "checker": data = this.#makeChecker(preset.c1, preset.c2); break;
          case "noise":   data = this.#makeNoise(preset.c1, preset.c2); break;
          default:        data = this.#makeRandomPattern();
        }
        this.textures[name] = this.#uploadTexture(data);
        const a1 = (preset.c1 && preset.c1[3] != null) ? preset.c1[3] : 1.0;
        const a2 = (preset.c2 && preset.c2[3] != null) ? preset.c2[3] : a1;
        this.textureAlpha[name] = (a1 + a2) * 0.5;
      }
    }

    // ---------------- Internals ----------------
    resize() {
      const {canvas, gl, dpr} = this;
      const w = Math.floor((canvas.clientWidth||canvas.width) * dpr);
      const h = Math.floor((canvas.clientHeight||canvas.height) * dpr);
      if (w && h && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0,0,w,h);
        this.proj = Mat4.perspective(60*Math.PI/180, w/Math.max(1,h), 0.01, 100);
        this.resizeAxisWidget();
        this.invalidate();
      }
    }

    updateGridGeometry() {
      const gl = this.gl;
      const halfSpan = Math.max(10, Math.min(160, Math.ceil((this.sceneRadius || 1) * 2.5)));
      if (halfSpan === this.gridHalfSpan && this.gridLineCount > 0) return;
      this.gridHalfSpan = halfSpan;
      const positions = [];
      const y = 0;
      for (let i = -halfSpan; i <= halfSpan; i += 1) {
        positions.push(-halfSpan, y, i, halfSpan, y, i);
        positions.push(i, y, -halfSpan, i, y, halfSpan);
      }
      this.gridLineCount = positions.length / 3;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.gridPosBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    }

    attachAxisWidget() {
      if (!this.showAxisWidget || this.axisWidgetCanvas) return;
      const host = this.canvas && this.canvas.parentElement;
      if (!host) return;
      const widget = document.createElement('canvas');
      widget.className = 'viewer-axis-widget';
      widget.setAttribute('aria-hidden', 'true');
      host.appendChild(widget);
      this.axisWidgetCanvas = widget;
      this.axisWidgetCtx = widget.getContext('2d');
      this.resizeAxisWidget();
    }

    resizeAxisWidget() {
      const widget = this.axisWidgetCanvas;
      if (!widget) return;
      const size = Math.max(72, this.axisWidgetCssSize | 0);
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      widget.style.width = `${size}px`;
      widget.style.height = `${size}px`;
      widget.width = Math.round(size * dpr);
      widget.height = Math.round(size * dpr);
      const ctx = this.axisWidgetCtx;
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    cameraSpaceDirection(worldVec) {
      return [
        this.view[0] * worldVec[0] + this.view[4] * worldVec[1] + this.view[8] * worldVec[2],
        this.view[1] * worldVec[0] + this.view[5] * worldVec[1] + this.view[9] * worldVec[2],
        this.view[2] * worldVec[0] + this.view[6] * worldVec[1] + this.view[10] * worldVec[2],
      ];
    }

    drawAxisWidget() {
      const ctx = this.axisWidgetCtx;
      const widget = this.axisWidgetCanvas;
      if (!this.showAxisWidget || !ctx || !widget) return;
      const size = parseFloat(widget.style.width) || this.axisWidgetCssSize;
      const half = size * 0.5;
      const radius = size * 0.34;
      ctx.clearRect(0, 0, size, size);

      ctx.beginPath();
      ctx.arc(half, half, size * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(6, 10, 18, 0.72)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(150, 173, 201, 0.24)';
      ctx.stroke();

      const axes = [
        { label: 'X', color: '#ff6b6b', vec: this.cameraSpaceDirection([1, 0, 0]) },
        { label: 'Y', color: '#53e28a', vec: this.cameraSpaceDirection([0, 1, 0]) },
        { label: 'Z', color: '#59a6ff', vec: this.cameraSpaceDirection([0, 0, 1]) },
      ].sort((a, b) => a.vec[2] - b.vec[2]);

      for (const axis of axes) {
        const endX = half + axis.vec[0] * radius;
        const endY = half - axis.vec[1] * radius;
        ctx.beginPath();
        ctx.moveTo(half, half);
        ctx.lineTo(endX, endY);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = axis.color;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(endX, endY, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = axis.color;
        ctx.fill();

        ctx.font = '600 11px Inter, Arial, sans-serif';
        ctx.fillStyle = '#ecf5ff';
        ctx.fillText(axis.label, endX + (axis.vec[0] >= 0 ? 6 : -12), endY + (axis.vec[1] <= 0 ? -6 : 14));
      }

      ctx.beginPath();
      ctx.arc(half, half, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = '#dbe8ff';
      ctx.fill();
    }

    drawLineBuffer(buffer, count, color) {
      if (!count) return;
      const gl = this.gl;
      gl.useProgram(this.lineProg);
      gl.uniformMatrix4fv(this.lineLoc.uMVP, false, this.mvp);
      gl.uniform4fv(this.lineLoc.uColor, color);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(this.lineLoc.aPosition);
      gl.vertexAttribPointer(this.lineLoc.aPosition, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.LINES, 0, count);
    }

    #initControls() {
      const canvas = this.canvas;
      let dragging = false;
      let panMode = false;
      let moved = false;
      let lastX = 0;
      let lastY = 0;
      canvas.addEventListener("pointerdown", (e) => {
        dragging = true;
        moved = false;
        panMode = (e.button === 2 || e.ctrlKey || e.metaKey);
        lastX = e.clientX;
        lastY = e.clientY;
        if (typeof canvas.focus === "function") canvas.focus({ preventScroll: true });
        if (typeof canvas.setPointerCapture === "function") canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      canvas.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        if (!moved && (Math.abs(dx) > 0 || Math.abs(dy) > 0)) {
          moved = true;
          this.isPointerDragging = true;
          canvas.dispatchEvent(new CustomEvent("progen3d:viewdragstart", {
            detail: { panMode: !!panMode }
          }));
        }
        if (panMode) this.panByMouseDelta(dx, dy);
        else this.updateSVECOrbitFromDrag(dx, dy);
        e.preventDefault();
      }, { passive: false });
      const stopDrag = () => {
        const hadMoved = moved;
        dragging = false;
        panMode = false;
        moved = false;
        if (hadMoved) {
          this.isPointerDragging = false;
          canvas.dispatchEvent(new CustomEvent("progen3d:viewdragend"));
        }
      };
      canvas.addEventListener("pointerup", stopDrag);
      canvas.addEventListener("pointercancel", stopDrag);
      canvas.addEventListener("contextmenu", (e) => e.preventDefault());
      canvas.addEventListener("wheel", (e) => {
        this.zoomByWheel(e.deltaY);
        e.preventDefault();
      }, { passive: false });
      canvas.addEventListener("keydown", (e) => {
        if (e.key === "r" || e.key === "R") {
          this.resetView();
          e.preventDefault();
        }
      });
      if (!canvas.hasAttribute("tabindex")) canvas.tabIndex = 0;
    }

    // ---- High-res procedural textures (power-of-two + mipmaps) ----
    #mixColor(cA, cB, t) {
      return [
        cA[0] * (1 - t) + cB[0] * t,
        cA[1] * (1 - t) + cB[1] * t,
        cA[2] * (1 - t) + cB[2] * t,
        ((cA[3] ?? 1) * (1 - t)) + ((cB[3] ?? (cA[3] ?? 1)) * t),
      ];
    }
    #clamp01(v) {
      return Math.max(0, Math.min(1, v));
    }
    #hashNoise2D(x, y) {
      const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
      return s - Math.floor(s);
    }
    #smoothNoise2D(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf);
      const v = yf * yf * (3 - 2 * yf);
      const n00 = this.#hashNoise2D(xi, yi);
      const n10 = this.#hashNoise2D(xi + 1, yi);
      const n01 = this.#hashNoise2D(xi, yi + 1);
      const n11 = this.#hashNoise2D(xi + 1, yi + 1);
      const nx0 = n00 * (1 - u) + n10 * u;
      const nx1 = n01 * (1 - u) + n11 * u;
      return nx0 * (1 - v) + nx1 * v;
    }
    #fbm2D(x, y, octaves = 4) {
      let total = 0;
      let amplitude = 0.5;
      let frequency = 1;
      let norm = 0;
      for (let i = 0; i < octaves; i += 1) {
        total += this.#smoothNoise2D(x * frequency, y * frequency) * amplitude;
        norm += amplitude;
        amplitude *= 0.5;
        frequency *= 2.03;
      }
      return norm > 0 ? total / norm : 0;
    }
    #makeSolid([r,g,b,a]){
      const w=64,h=64, arr=new Uint8Array(w*h*4);
      for (let y=0;y<h;y++){
        for (let x=0;x<w;x++){
          const n = this.#fbm2D(x/18, y/18, 3);
          const shade = 0.965 + (n - 0.5) * 0.08;
          const i=(y*w+x)*4;
          arr[i]=this.#clamp01(r * shade) * 255;
          arr[i+1]=this.#clamp01(g * shade) * 255;
          arr[i+2]=this.#clamp01(b * shade) * 255;
          arr[i+3]=(a ?? 1) * 255;
        }
      }
      return {w,h,data:arr};
    }
    #makeChecker(c1,c2,texSize=256,cells=8){
      const w=texSize,h=texSize, arr=new Uint8Array(w*h*4);
      const cw = w/cells, ch = h/cells;
      for (let y=0;y<h;y++){
        for (let x=0;x<w;x++){
          const cx=(x/cw)|0, cy=(y/ch)|0;
          const tileMix = this.#fbm2D((cx + 1) * 0.7, (cy + 1) * 0.7, 2);
          let c = this.#mixColor(((cx+cy)&1) ? c1 : c2, ((cx+cy)&1) ? c2 : c1, tileMix * 0.12);
          const localX = (x % cw) / cw;
          const localY = (y % ch) / ch;
          const grout = Math.min(Math.min(localX, 1 - localX), Math.min(localY, 1 - localY));
          const groutMask = grout < 0.045 ? 1 - (grout / 0.045) : 0;
          const grain = this.#fbm2D(x / 26, y / 26, 4);
          const shade = 0.92 + (grain - 0.5) * 0.20 - groutMask * 0.16;
          const i=(y*w+x)*4;
          arr[i]=this.#clamp01(c[0] * shade) * 255;
          arr[i+1]=this.#clamp01(c[1] * shade) * 255;
          arr[i+2]=this.#clamp01(c[2] * shade) * 255;
          arr[i+3]=(c[3] ?? 1) * 255;
        }
      }
      return {w,h,data:arr};
    }
    #makeNoise(cA,cB=[1,1,1,1],texSize=256){
      const w=texSize,h=texSize, arr=new Uint8Array(w*h*4);
      for (let y=0;y<h;y++){
        for (let x=0;x<w;x++){
          const n0 = this.#fbm2D(x / 34, y / 34, 5);
          const n1 = this.#fbm2D((x + 37) / 12, (y + 19) / 12, 3);
          const veins = Math.abs(Math.sin((x * 0.055) + n1 * 6.283));
          const t = this.#clamp01((n0 * 0.78) + (n1 * 0.16) + ((1 - veins) * 0.06));
          const c = this.#mixColor(cA, cB, t);
          const shade = 0.88 + (n1 - 0.5) * 0.24;
          const i=(y*w+x)*4;
          arr[i]=this.#clamp01(c[0] * shade) * 255;
          arr[i+1]=this.#clamp01(c[1] * shade) * 255;
          arr[i+2]=this.#clamp01(c[2] * shade) * 255;
          arr[i+3]=(c[3] ?? 1) * 255;
        }
      }
      return {w,h,data:arr};
    }
    #makeLinearGradient(top,bot,texSize=128){
      const w=texSize,h=texSize, arr=new Uint8Array(w*h*4);
      for (let y=0;y<h;y++){
        const t=y/(h-1);
        const r=top[0]*(1-t)+bot[0]*t, g=top[1]*(1-t)+bot[1]*t, b=top[2]*(1-t)+bot[2]*t, a=top[3]*(1-t)+bot[3]*t;
        for (let x=0;x<w;x++){
          const i=(y*w+x)*4;
          arr[i]=r*255; arr[i+1]=g*255; arr[i+2]=b*255; arr[i+3]=a*255;
        }
      }
      return {w,h,data:arr};
    }
    #makeRandomPattern(){
      const choice = Math.floor(Math.random()*4);
      if (choice===0) return this.#makeNoise([Math.random(),Math.random(),Math.random(),1],[1,1,1,1],256);
      if (choice===1) return this.#makeChecker([Math.random(),Math.random(),Math.random(),1],[Math.random(),Math.random(),Math.random(),1],256,8);
      if (choice===2) return this.#makeLinearGradient([Math.random(),Math.random(),Math.random(),1],[Math.random(),Math.random(),Math.random(),1],256);
      return this.#makeNoise([0.5,0.5,0.5,1],[0.2,0.2,0.2,1],256);
    }
    #uploadTexture({w,h,data}){
      const gl=this.gl, tex=gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,data);

      // High quality sampling + mipmaps (requires power-of-two)
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);

      gl.bindTexture(gl.TEXTURE_2D,null);
      return tex;
    }

    getTexture(name) {
      if (!this.textures[name]) {
        const p = TEXTURE_PRESETS[name] || _buildCompositeTexturePreset(name);
        if (p) {
          let data;
          if (p.fn==="solid")   data = this.#makeSolid(p.c1);
          if (p.fn==="checker") data = this.#makeChecker(p.c1,p.c2);
          if (p.fn==="noise")   data = this.#makeNoise(p.c1,p.c2);
          this.textures[name] = this.#uploadTexture(data);
          const a1 = (p.c1?.[3] ?? 1.0), a2 = (p.c2?.[3] ?? a1);
          this.textureAlpha[name] = (a1 + a2) * 0.5;
        } else {
          console.warn(`Unknown texture "${name}", using random pattern.`);
          this.textures[name] = this.createRandomTexturePattern(name);
          this.textureAlpha[name] = 1.0;
        }
      }
     else {
       //  log2(`Found texture ${name}.`);
      }
      return this.textures[name];
    }

    // ---- Build GPU buffers (positions, UVs, FLAT normals) + batches ----
    #rebuildBuffers() {
      const items = this.scene ? this.scene.getAll() : [];
      const triPositions = [];
      const triUVs = [];
      const triNormals = [];
      const linePositions = [];
      this.drawCalls.length = 0;
      this.opaqueCalls.length = 0;
      this.transpCalls.length = 0;

      if (!items.length) {
        this.triCount = 0; this.lineCount = 0;
        this.#uploadAll(new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0));
        return;
      }

      let vtxCount = 0;

      for (const it of items) {
        // Map numeric index → preset name, else treat as string
        const texName = (typeof it.texIndex === "number")
          ? TEXTURE_NAMES[it.texIndex % TEXTURE_NAMES.length]
          : String(it.texIndex);
        const tex = this.getTexture(texName);
        const repeat = Math.max(1, it.texRepeat|0 || 1);

        const start = vtxCount;

        // For each triangle: push pos/uv, compute flat normal and push 3 times
        for (let tri=0; tri<TRI_IDX.length; tri+=3) {
          const i0 = TRI_IDX[tri], i1 = TRI_IDX[tri+1], i2 = TRI_IDX[tri+2];
          const v0 = it.verts[i0], v1 = it.verts[i1], v2 = it.verts[i2];

          // positions
          triPositions.push(v0[0],v0[1],v0[2], v1[0],v1[1],v1[2], v2[0],v2[1],v2[2]);

          // UVs (pre-baked): index directly
          const u0 = CUBE_TRI_UVS[(tri+0)*2], v0u = CUBE_TRI_UVS[(tri+0)*2+1];
          const u1 = CUBE_TRI_UVS[(tri+1)*2], v1u = CUBE_TRI_UVS[(tri+1)*2+1];
          const u2 = CUBE_TRI_UVS[(tri+2)*2], v2u = CUBE_TRI_UVS[(tri+2)*2+1];
          triUVs.push(u0*repeat, v0u*repeat, u1*repeat, v1u*repeat, u2*repeat, v2u*repeat);

          // flat normal per triangle
          const ax=v1[0]-v0[0], ay=v1[1]-v0[1], az=v1[2]-v0[2];
          const bx=v2[0]-v0[0], by=v2[1]-v0[1], bz=v2[2]-v0[2];
          let nx = ay*bz - az*by;
          let ny = az*bx - ax*bz;
          let nz = ax*by - ay*bx;
          const invLen = 1/Math.hypot(nx,ny,nz);
          nx*=invLen; ny*=invLen; nz*=invLen;
          triNormals.push(nx,ny,nz, nx,ny,nz, nx,ny,nz);
        }

        vtxCount += TRI_IDX.length;

        // Lines
        for (let i=0;i<EDGE_IDX.length;i++){
          const v = it.verts[EDGE_IDX[i]];
          linePositions.push(v[0],v[1],v[2]);
        }

        const alphaHint = (this.textureAlpha && this.textureAlpha[texName] != null)
          ? this.textureAlpha[texName]
          : 1.0;

        const dc = { tex, first: start, count: TRI_IDX.length, alpha: alphaHint };
        this.drawCalls.push(dc);
        if (alphaHint < 1.0) this.transpCalls.push(dc); else this.opaqueCalls.push(dc);
      }

      this.triCount  = triPositions.length / 3;
      this.lineCount = linePositions.length / 3;

      this.#uploadAll(
        new Float32Array(triPositions),
        new Float32Array(triUVs),
        new Float32Array(triNormals),
        new Float32Array(linePositions)
      );
    }

    #uploadAll(posArray, uvArray, nrmArray, lineArray){
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.triPosBuf);
      gl.bufferData(gl.ARRAY_BUFFER, posArray, gl.STATIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.triUVBuf);
      gl.bufferData(gl.ARRAY_BUFFER, uvArray, gl.STATIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.triNrmBuf);
      gl.bufferData(gl.ARRAY_BUFFER, nrmArray, gl.STATIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.linePosBuf);
      gl.bufferData(gl.ARRAY_BUFFER, lineArray, gl.STATIC_DRAW);
    }

    render() {
      const gl = this.gl;
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

      // camera
      if (this.useViewVectorCamera) {
        this.updateViewCamera();
      } else {
        const x = this.target[0] + this.radius*Math.sin(this.phi)*Math.cos(this.theta);
        const y = this.target[1] + this.radius*Math.cos(this.phi);
        const z = this.target[2] + this.radius*Math.sin(this.phi)*Math.sin(this.theta);
        this.view = Mat4.lookAt([x,y,z], this.target, this.svec5 || [0,1,0]);
      }
      // model is identity => MV = view
      this.mv = this.view;
      this.mvp = Mat4.multiply(this.proj, this.view, this.mvp);

      if (!this.triCount && !this.lineCount && !this.gridLineCount) {
        this.drawAxisWidget();
        return;
      }

      // derive normal matrix (upper-left 3x3 of MV; MV is orthonormal here)
      const nm = new Float32Array([
        this.mv[0], this.mv[1], this.mv[2],
        this.mv[4], this.mv[5], this.mv[6],
        this.mv[8], this.mv[9], this.mv[10],
      ]);

      if (this.showGrid && this.gridLineCount) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        this.drawLineBuffer(this.gridPosBuf, this.gridLineCount, this.gridColor);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }

      // lighting setup (view space): warmer key, cooler fill, stronger sky/ground contrast
      const normalizeVec3 = (v) => {
        const len = Math.hypot(v[0], v[1], v[2]) || 1;
        return new Float32Array([v[0] / len, v[1] / len, v[2] / len]);
      };
      const lightDirVS = normalizeVec3([0.48, 0.86, 0.22]);
      const fillLightDirVS = normalizeVec3([-0.62, 0.28, 0.73]);

      // --- Opaque geometry ---
      gl.useProgram(this.litProg);
      gl.uniformMatrix4fv(this.litLoc.uMVP,false,this.mvp);
      gl.uniformMatrix4fv(this.litLoc.uMV,false,this.mv);
      gl.uniformMatrix3fv(this.litLoc.uNormalMatrix,false,nm);
      gl.uniform3f(this.litLoc.uLightDirVS, lightDirVS[0], lightDirVS[1], lightDirVS[2]);
      gl.uniform3f(this.litLoc.uFillLightDirVS, fillLightDirVS[0], fillLightDirVS[1], fillLightDirVS[2]);
      gl.uniform3f(this.litLoc.uLightColor, 1.08, 1.01, 0.96);
      gl.uniform3f(this.litLoc.uFillLightColor, 0.46, 0.56, 0.70);
      gl.uniform3f(this.litLoc.uAmbient, 0.09, 0.10, 0.12);
      gl.uniform3f(this.litLoc.uHemiSky, 0.14, 0.18, 0.24);
      gl.uniform3f(this.litLoc.uHemiGround, 0.045, 0.038, 0.032);
      gl.uniform3f(this.litLoc.uRimColor, 0.22, 0.30, 0.42);
      gl.uniform1f(this.litLoc.uSpecPower, 42.0);
      gl.uniform1f(this.litLoc.uSpecIntensity, 0.42);
      gl.uniform1f(this.litLoc.uFillSpecIntensity, 0.12);
      gl.uniform1f(this.litLoc.uRimStrength, 0.13);
      gl.uniform1f(this.litLoc.uGamma, 2.2);

      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(this.litLoc.uTex,0);

      // bind attribs
      gl.bindBuffer(gl.ARRAY_BUFFER,this.triPosBuf);
      gl.enableVertexAttribArray(this.litLoc.aPosition);
      gl.vertexAttribPointer(this.litLoc.aPosition,3,gl.FLOAT,false,0,0);

      gl.bindBuffer(gl.ARRAY_BUFFER,this.triUVBuf);
      gl.enableVertexAttribArray(this.litLoc.aUV);
      gl.vertexAttribPointer(this.litLoc.aUV,2,gl.FLOAT,false,0,0);

      gl.bindBuffer(gl.ARRAY_BUFFER,this.triNrmBuf);
      gl.enableVertexAttribArray(this.litLoc.aNormal);
      gl.vertexAttribPointer(this.litLoc.aNormal,3,gl.FLOAT,false,0,0);

      gl.disable(gl.BLEND);
      gl.depthMask(true);
      for (const dc of this.opaqueCalls){
        gl.bindTexture(gl.TEXTURE_2D, dc.tex);
        gl.drawArrays(gl.TRIANGLES, dc.first, dc.count);
      }

      // --- Transparent geometry ---
      if (this.transpCalls.length){
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        for (const dc of this.transpCalls){
          gl.bindTexture(gl.TEXTURE_2D, dc.tex);
          gl.drawArrays(gl.TRIANGLES, dc.first, dc.count);
        }
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }

      if (this.wireframe && this.lineCount) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        this.drawLineBuffer(this.linePosBuf, this.lineCount, this.lineColor);
        gl.depthMask(true);
        gl.disable(gl.BLEND);
      }

      this.drawAxisWidget();
    }
// ---------------- STL Export ----------------
exportSTL(filename = "scene.stl") {
  if (!this.scene || typeof this.scene.getAll !== "function") {
    console.error("STLExporter: No valid scene set.");
    return;
  }

  const items = this.scene.getAll();
  if (!Array.isArray(items) || items.length === 0) {
    console.warn("STLExporter: Scene is empty");
    const empty = "solid empty\nendsolid empty";
    this.#downloadSTL(empty, filename);
    return;
  }

  let stl = "solid scene\n";
  for (const it of items) {
    const verts = it.verts;
    // walk through triangles
    for (let t = 0; t < verts.length; t += 3) {
      const v0 = verts[TRI_IDX[0]]; // but better use TRI_IDX loop like render
    }

    for (let tri = 0; tri < TRI_IDX.length; tri += 3) {
      const i0 = TRI_IDX[tri], i1 = TRI_IDX[tri+1], i2 = TRI_IDX[tri+2];
      const v0 = verts[i0], v1 = verts[i1], v2 = verts[i2];

      // normal (flat)
      const ax = v1[0]-v0[0], ay = v1[1]-v0[1], az = v1[2]-v0[2];
      const bx = v2[0]-v0[0], by = v2[1]-v0[1], bz = v2[2]-v0[2];
      let nx = ay*bz - az*by;
      let ny = az*bx - ax*bz;
      let nz = ax*by - ay*bx;
      const invLen = 1/Math.hypot(nx, ny, nz);
      nx*=invLen; ny*=invLen; nz*=invLen;

      // write STL facet
      stl += `facet normal ${nx} ${ny} ${nz}\n`;
      stl += `  outer loop\n`;
      stl += `    vertex ${v0[0]} ${v0[1]} ${v0[2]}\n`;
      stl += `    vertex ${v1[0]} ${v1[1]} ${v1[2]}\n`;
      stl += `    vertex ${v2[0]} ${v2[1]} ${v2[2]}\n`;
      stl += `  endloop\n`;
      stl += `endfacet\n`;
    }
  }
  stl += "endsolid scene";
  this.#downloadSTL(stl, filename);
}

// private helper
#downloadSTL(stlText, filename) {
  const blob = new Blob([stlText], { type: "model/stl" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

  }


  // Expose
  window.WebGLSceneRenderer = WebGLSceneRenderer;
})();

// Extracted from original file lines 3379-3515
            // Axis Scene items
"use strict";

// --- Cube vertices (unit cube centered at origin) ---
const cubeVerts = [
  [-0.5, -0.5, -0.5],
  [ 0.5, -0.5, -0.5],
  [ 0.5,  0.5, -0.5],
  [-0.5,  0.5, -0.5],
  [-0.5, -0.5,  0.5],
  [ 0.5, -0.5,  0.5],
  [ 0.5,  0.5,  0.5],
  [-0.5,  0.5,  0.5],
];

// --- Multiply a point by a column-major 4x4 (v' = M * [x y z 1]^T) ---
function transformPoint(M, v, w = 1) {
  const x = v[0], y = v[1], z = v[2];
  const xp = M[0]*x + M[4]*y + M[8]*z  + M[12]*w;
  const yp = M[1]*x + M[5]*y + M[9]*z  + M[13]*w;
  const zp = M[2]*x + M[6]*y + M[10]*z + M[14]*w;
  const wp = M[3]*x + M[7]*y + M[11]*z + M[15]*w; // stays 1 for affine
  return (wp !== 0 && wp !== 1) ? [xp/wp, yp/wp, zp/wp] : [xp, yp, zp];
}

function axisDeformIdentity() {
  return {
    active: false,
    dsx: [1, 1, 1],
    dsy: [1, 1, 1],
    dsz: [1, 1, 1],
    dtx: [0, 0, 0],
    dty: [0, 0, 0],
    dtz: [0, 0, 0],
  };
}

function makeAffineMat4(scale, translate) {
  const sx = Array.isArray(scale) ? scale[0] : 1;
  const sy = Array.isArray(scale) ? scale[1] : 1;
  const sz = Array.isArray(scale) ? scale[2] : 1;
  const tx = Array.isArray(translate) ? translate[0] : 0;
  const ty = Array.isArray(translate) ? translate[1] : 0;
  const tz = Array.isArray(translate) ? translate[2] : 0;
  return new Float32Array([
    sx, 0,  0,  0,
    0,  sy, 0,  0,
    0,  0,  sz, 0,
    tx, ty, tz, 1,
  ]);
}

function cubeTypeConfig(type) {
  if (type === "CubeX") return { Xneg: 0.0,  Xpos: 1.0,  Yneg: -0.5, Ypos: 0.5,  Zneg: -0.5, Zpos: 0.5, axisName: "x" };
  if (type === "CubeY") return { Xneg: -0.5, Xpos: 0.5,  Yneg: 0.0,  Ypos: 1.0,  Zneg: -0.5, Zpos: 0.5, axisName: "y" };
  if (type === "CubeZ") return { Xneg: -0.5, Xpos: 0.5,  Yneg: -0.5, Ypos: 0.5,  Zneg: 0.0,  Zpos: 1.0, axisName: "z" };
  return                    { Xneg: -0.5, Xpos: 0.5,  Yneg: -0.5, Ypos: 0.5,  Zneg: -0.5, Zpos: 0.5, axisName: "z" };
}

function buildAxisDeformedVerts(type, axisDeform) {
  const cfg = cubeTypeConfig(type);
  const spec = Object.assign(axisDeformIdentity(), axisDeform || {});
  const mx = makeAffineMat4(spec.dsx, spec.dtx);
  const my = makeAffineMat4(spec.dsy, spec.dty);
  const mz = makeAffineMat4(spec.dsz, spec.dtz);
  const baseVerts = [
    { p: [cfg.Xneg, cfg.Yneg, cfg.Zneg], posX: false, posY: false, posZ: false }, // v0
    { p: [cfg.Xpos, cfg.Yneg, cfg.Zneg], posX: true,  posY: false, posZ: false }, // v1
    { p: [cfg.Xpos, cfg.Ypos, cfg.Zneg], posX: true,  posY: true,  posZ: false }, // v2
    { p: [cfg.Xneg, cfg.Ypos, cfg.Zneg], posX: false, posY: true,  posZ: false }, // v3
    { p: [cfg.Xneg, cfg.Yneg, cfg.Zpos], posX: false, posY: false, posZ: true  }, // v4
    { p: [cfg.Xpos, cfg.Yneg, cfg.Zpos], posX: true,  posY: false, posZ: true  }, // v5
    { p: [cfg.Xpos, cfg.Ypos, cfg.Zpos], posX: true,  posY: true,  posZ: true  }, // v6
    { p: [cfg.Xneg, cfg.Ypos, cfg.Zpos], posX: false, posY: true,  posZ: true  }, // v7
  ];

  return baseVerts.map((entry) => {
    let p = [entry.p[0], entry.p[1], entry.p[2]];
    if (entry.posX) p = transformPoint(mx, p);
    if (entry.posY) p = transformPoint(my, p);
    if (entry.posZ) p = transformPoint(mz, p);
    return p;
  });
}

/* ======================= Axis ======================= */
class Axis {
  /**
   * @param {"x"|"y"|"z"} kind
   * x → [[ 0.5, 0,   0],[ -0.5, 0,   0]]
   * y → [[ 0,   0.5, 0],[  0,  -0.5, 0]]
   * z → [[ 0,   0,   0.5],[ 0,   0,  -0.5]]
   */
  constructor(kind = "z") {
    this.kind = (kind === "x" || kind === "y" || kind === "z") ? kind : "z";
    if (this.kind === "x") {
      this.verts = [[ 0.5, 0, 0], [-0.5, 0, 0]];
    } else if (this.kind === "y") {
      this.verts = [[0, 0.5, 0], [0, -0.5, 0]];
    } else {
      this.verts = [[0, 0, 0.5], [0, 0, -0.5]];
    }
  }

  /** Multiply both vertices by a 4x4 column-major matrix */
  applyTransform(M) {
    this.verts = this.verts.map(v => transformPoint(M, v, 1));
    return this;
  }

  toFlat32() {
    return new Float32Array(this.verts.flat());
  }
}

/* ======================= Scene ======================= */
class Scene {
  constructor() { this.items = []; }

  static #computeBounds(items) {
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
    return {
      center: [
        (minX + maxX) * 0.5,
        (minY + maxY) * 0.5,
        (minZ + maxZ) * 0.5
      ],
      half: [
        Math.max((maxX - minX) * 0.5, 1e-6),
        Math.max((maxY - minY) * 0.5, 1e-6),
        Math.max((maxZ - minZ) * 0.5, 1e-6)
      ]
    };
  }

  static #applyAffineToNormalizedPoint(point, scale, translate) {
    return [
      scale[0] * point[0] + translate[0],
      scale[1] * point[1] + translate[1],
      scale[2] * point[2] + translate[2],
    ];
  }

  static #globalDeformIdentity() {
    return {
      active: false,
      dsx: [1, 1, 1],
      dsy: [1, 1, 1],
      dsz: [1, 1, 1],
      dtx: [0, 0, 0],
      dty: [0, 0, 0],
      dtz: [0, 0, 0],
      scopeId: null,
    };
  }

  static #normalizeGlobalAxisDeform(axisDeform = null) {
    const spec = Object.assign(Scene.#globalDeformIdentity(), axisDeform || {});
    const isIdentity =
      spec.dsx[0] === 1 && spec.dsx[1] === 1 && spec.dsx[2] === 1 &&
      spec.dsy[0] === 1 && spec.dsy[1] === 1 && spec.dsy[2] === 1 &&
      spec.dsz[0] === 1 && spec.dsz[1] === 1 && spec.dsz[2] === 1 &&
      spec.dtx[0] === 0 && spec.dtx[1] === 0 && spec.dtx[2] === 0 &&
      spec.dty[0] === 0 && spec.dty[1] === 0 && spec.dty[2] === 0 &&
      spec.dtz[0] === 0 && spec.dtz[1] === 0 && spec.dtz[2] === 0;
    spec.active = !!spec.active && !isIdentity;
    return spec;
  }

  static #globalAxisDeformKey(axisDeform = null) {
    const spec = Scene.#normalizeGlobalAxisDeform(axisDeform);
    if (!spec.active) return "";
    return JSON.stringify([
      spec.scopeId,
      spec.dsx, spec.dsy, spec.dsz,
      spec.dtx, spec.dty, spec.dtz
    ]);
  }

  /**
   * Add a cube-like primitive with two/three-stage transform.
   * Also attaches an axis (default "z") transformed by transform1.
   *
   * @param {"Cube"|"CubeX"|"CubeY"|"CubeZ"} type
   * @param {Float32Array|number[]}  transform1
   * @param {Float32Array|number[]}  transform2
   * @param {Float32Array|number[]}  transform3
   * @param {number}                 texIndex
   * @param {number}                 arg
   * @param {number}                 val
   * @param {"x"|"y"|"z"}            axisName  (optional; default "z")
   */
  add(type, transform1, transform2, transform3, texIndex, arg, val, axisName = "z", axisDeform = null, globalAxisDeform = null) {
    let baseVerts = cubeVerts;

    if (axisDeform && axisDeform.active) {
      const explicitVerts = buildAxisDeformedVerts(type, axisDeform);
      const finalVerts = explicitVerts.map(v => transformPoint(transform1, v));
      const flat = new Float32Array(finalVerts.flat());
      const axisrot = new Axis(cubeTypeConfig(type).axisName).applyTransform(transform1);
      return this.#pushItem(type, transform1, transform2, transform3, finalVerts, flat, texIndex, arg, val, axisrot, globalAxisDeform);

    } else if (type === "CubeZ") {
      const explicitVerts = buildAxisDeformedVerts(type, axisDeformIdentity());
      const finalVerts = explicitVerts.map(v => transformPoint(transform1, v));
      const flat = new Float32Array(finalVerts.flat());
      const axisrot = new Axis(cubeTypeConfig(type).axisName).applyTransform(transform1);
      return this.#pushItem(type, transform1, transform2, transform3, finalVerts, flat, texIndex, arg, val, axisrot, globalAxisDeform);

    } else if (type === "Cube") {
      let transformVerts = baseVerts.map(v => (v[2] > 0) ? transformPoint(transform2, v) : v);
      transformVerts = transformVerts.map(v => (v[1] > 0) ? transformPoint(transform3, v) : v);
      const finalVerts = transformVerts.map(v => transformPoint(transform1, v));

      const flat = new Float32Array(finalVerts.flat());
      // Build & transform axis by transform1 before storing
      const axisrot = new Axis("z").applyTransform(transform1);

      return this.#pushItem(type, transform1, transform2, transform3, finalVerts, flat, texIndex, arg, val, axisrot, globalAxisDeform);

    } else if (type === "CubeX") {
      const shiftedVerts = baseVerts.map(([x, y, z]) => [x + 0.5, y, z]);
      const transformVerts = shiftedVerts.map(v => (v[0] > 0.5) ? transformPoint(transform2, v) : v);
      const finalVerts = transformVerts.map(v => transformPoint(transform1, v));

      const flat = new Float32Array(finalVerts.flat());
      const axisrot = new Axis("x").applyTransform(transform1);

      return this.#pushItem(type, transform1, transform2, transform3, finalVerts, flat, texIndex, arg, val, axisrot, globalAxisDeform);

    } else if (type === "CubeY") {
      const shiftedVerts = baseVerts.map(([x, y, z]) => [x, y + 0.5, z]);
      const transformVerts = shiftedVerts.map(v => (v[1] > 0.5) ? transformPoint(transform2, v) : v);
      const finalVerts = transformVerts.map(v => transformPoint(transform1, v));

      const flat = new Float32Array(finalVerts.flat());
      const axisrot = new Axis("y").applyTransform(transform1);

      return this.#pushItem(type, transform1, transform2, transform3, finalVerts, flat, texIndex, arg, val, axisrot, globalAxisDeform);

    } else {
      throw new Error(`Scene.add: unknown type "${type}"`);
    }
  }

  #pushItem(type, transform1, transform2, transform3, verts, flat, texIndex, arg, val, axisrot, globalAxisDeform = null) {
    const item = {
      type,
      transform1,
      transform2,
      transform3,
      verts,                 // array of 8 [x,y,z]
      flat,                  // Float32Array(24)
      globalAxisDeform: Scene.#normalizeGlobalAxisDeform(globalAxisDeform),
      texIndex,
      arg: (Number(arg) || 0) | 0,
      val: Number.isFinite(val) ? Number(val) : 0,
      axisrot: {
        kind: axisrot.kind,
        verts: axisrot.verts,           // [[xtop,ytop,ztop],[xbottom,ybottom,zbottom]]
        flat: axisrot.toFlat32()
      }
    };
    this.items.push(item);
    return item;
  }

  applyGlobalAxisDeform() {
    if (!this.items.length) return;

    const groups = new Map();
    for (const item of this.items) {
      if (!item) continue;
      const key = Scene.#globalAxisDeformKey(item.globalAxisDeform);
      if (!key) continue;
      const list = groups.get(key) || [];
      list.push(item);
      groups.set(key, list);
    }

    groups.forEach((items, key) => {
      if (!items.length) return;
      const spec = Scene.#normalizeGlobalAxisDeform(items[0].globalAxisDeform);
      if (!spec.active) return;
      const bounds = Scene.#computeBounds(items);
      if (!bounds) return;

      const applyToVerts = (verts) => verts.map((v) => {
        let p = [
          (v[0] - bounds.center[0]) / bounds.half[0],
          (v[1] - bounds.center[1]) / bounds.half[1],
          (v[2] - bounds.center[2]) / bounds.half[2],
        ];

        if (p[0] > 0) p = Scene.#applyAffineToNormalizedPoint(p, spec.dsx, spec.dtx);
        if (p[1] > 0) p = Scene.#applyAffineToNormalizedPoint(p, spec.dsy, spec.dty);
        if (p[2] > 0) p = Scene.#applyAffineToNormalizedPoint(p, spec.dsz, spec.dtz);

        return [
          bounds.center[0] + p[0] * bounds.half[0],
          bounds.center[1] + p[1] * bounds.half[1],
          bounds.center[2] + p[2] * bounds.half[2],
        ];
      });

      for (const item of items) {
        if (!Array.isArray(item.verts)) continue;
        item.verts = applyToVerts(item.verts);
        item.flat = new Float32Array(item.verts.flat());
        if (item.axisrot && Array.isArray(item.axisrot.verts)) {
          item.axisrot.verts = applyToVerts(item.axisrot.verts);
          item.axisrot.flat = new Float32Array(item.axisrot.verts.flat());
        }
      }
    });
  }

  clear() { this.items.length = 0; }
  getAll() { return this.items.slice(); }
}

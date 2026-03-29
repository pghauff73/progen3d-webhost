"use strict";

/* Legacy standalone overlap/deformation utility used by testoverlap.html. */

/* ============================================================
   Vector helpers
============================================================ */
function v3(x=0,y=0,z=0){ return {x,y,z}; }
function add(a,b){ return {x:a.x+b.x, y:a.y+b.y, z:a.z+b.z}; }
function sub(a,b){ return {x:a.x-b.x, y:a.y-b.y, z:a.z-b.z}; }
function mul(a,s){ return {x:a.x*s, y:a.y*s, z:a.z*s}; }
function dot(a,b){ return a.x*b.x + a.y*b.y + a.z*b.z; }
function cross(a,b){
  return {
    x:a.y*b.z - a.z*b.y,
    y:a.z*b.x - a.x*b.z,
    z:a.x*b.y - a.y*b.x
  };
}
function lengthSq(a){ return dot(a,a); }
function length(a){ return Math.sqrt(lengthSq(a)); }
function normalize(a){
  const len = length(a);
  if(len < 1e-12) return {x:0,y:0,z:0};
  return {x:a.x/len, y:a.y/len, z:a.z/len};
}
function min3(a,b){ return {x:Math.min(a.x,b.x), y:Math.min(a.y,b.y), z:Math.min(a.z,b.z)}; }
function max3(a,b){ return {x:Math.max(a.x,b.x), y:Math.max(a.y,b.y), z:Math.max(a.z,b.z)}; }
function centroid(points){
  let c = v3(0,0,0);
  for(const p of points) c = add(c,p);
  return mul(c, 1/points.length);
}

/* ============================================================
   Random helpers
============================================================ */
function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function normalizeNumericRange(min, max, fallbackMin=0, fallbackMax=0){
  const resolvedMin = Number.isFinite(min) ? min : fallbackMin;
  const resolvedMax = Number.isFinite(max) ? max : fallbackMax;
  if(resolvedMin <= resolvedMax) return {min:resolvedMin, max:resolvedMax};
  return {min:resolvedMax, max:resolvedMin};
}
function randomInRangeFromFn(min,max,randomFn){
  const range = normalizeNumericRange(min, max, min, max);
  if(range.min === range.max) return range.min;
  return range.min + randomFn() * (range.max - range.min);
}
function randomUnitVectorFromFn(randomFn){
  let x=0,y=0,z=0,lsq=0;
  do{
    x = randomInRangeFromFn(-1,1,randomFn);
    y = randomInRangeFromFn(-1,1,randomFn);
    z = randomInRangeFromFn(-1,1,randomFn);
    lsq = x*x + y*y + z*z;
  }while(lsq < 1e-12 || lsq > 1.0);
  const inv = 1/Math.sqrt(lsq);
  return {x:x*inv, y:y*inv, z:z*inv};
}

/* ============================================================
   Geometry topology
============================================================ */
const CUBE_FACES = [
  [0,1,2,3],
  [4,5,6,7],
  [0,4,7,3],
  [1,2,6,5],
  [3,7,6,2],
  [0,1,5,4]
];
const CUBE_EDGES = [
  [0,1],[1,2],[2,3],[3,0],
  [4,5],[5,6],[6,7],[7,4],
  [0,4],[1,5],[2,6],[3,7]
];

/* ============================================================
   Cube deformation helpers
============================================================ */
function getCubeExtents(cubeType="Cube"){
  switch(cubeType){
    case "CubeX":
      return {Xneg:0.0, Xpos:1.0, Yneg:-0.5, Ypos:0.5, Zneg:-0.5, Zpos:0.5};
    case "CubeY":
      return {Xneg:-0.5, Xpos:0.5, Yneg:0.0, Ypos:1.0, Zneg:-0.5, Zpos:0.5};
    case "CubeZ":
      return {Xneg:-0.5, Xpos:0.5, Yneg:-0.5, Ypos:0.5, Zneg:0.0, Zpos:1.0};
    default:
      return {Xneg:-0.5, Xpos:0.5, Yneg:-0.5, Ypos:0.5, Zneg:-0.5, Zpos:0.5};
  }
}

function faceNormal(vertices, face){
  const a = vertices[face[0]];
  const b = vertices[face[1]];
  const c = vertices[face[2]];
  return cross(sub(b,a), sub(c,a));
}

function orientFacesOutward(vertices, faces, c){
  for(const face of faces){
    const a = vertices[face[0]];
    const n = faceNormal(vertices, face);
    if(dot(n, sub(c,a)) > 0) face.reverse();
  }
}

function buildDeformedCube(params={}, cubeType="Cube"){
  const Scale = params.Scale || [1,1,1];
  const DSX = params.DSX || [1,1,1];
  const DSY = params.DSY || [1,1,1];
  const DSZ = params.DSZ || [1,1,1];
  const DTX = params.DTX || [0,0,0];
  const DTY = params.DTY || [0,0,0];
  const DTZ = params.DTZ || [0,0,0];

  const dsxx=DSX[0], dsxy=DSX[1], dsxz=DSX[2];
  const dsyx=DSY[0], dsyy=DSY[1], dsyz=DSY[2];
  const dszx=DSZ[0], dszy=DSZ[1], dszz=DSZ[2];

  const dtxx=DTX[0], dtxy=DTX[1], dtxz=DTX[2];
  const dtyx=DTY[0], dtyy=DTY[1], dtyz=DTY[2];
  const dtzx=DTZ[0], dtzy=DTZ[1], dtzz=DTZ[2];

  const {Xneg,Xpos,Yneg,Ypos,Zneg,Zpos} = getCubeExtents(cubeType);
  const scaleX = Number.isFinite(Scale[0]) ? Scale[0] : 1;
  const scaleY = Number.isFinite(Scale[1]) ? Scale[1] : 1;
  const scaleZ = Number.isFinite(Scale[2]) ? Scale[2] : 1;

  const v0 = v3(
    dszx*(dsyx*(dsxx*(Xneg)+dtxx)+dtyx)+dtzx,
    dszy*(dsyy*(dsxy*(Yneg)+dtxy)+dtyy)+dtzy,
    dszz*(dsyz*(dsxz*(Zneg)+dtxz)+dtyz)+dtzz
  );
  const v1 = v3(
    dszx*(dsyx*(Xpos)+dtyx)+dtzx,
    dszy*(dsyy*(Yneg)+dtyy)+dtzy,
    dszz*(dsyz*(Zneg)+dtyz)+dtzz
  );
  const v2 = v3(
    dszx*(Xpos)+dtzx,
    dszy*(Ypos)+dtzy,
    dszz*(Zneg)+dtzz
  );
  const v3p = v3(
    dszx*(dsxx*(Xneg)+dtxx)+dtzx,
    dszy*(dsxy*(Ypos)+dtxy)+dtzy,
    dszz*(dsxz*(Zneg)+dtxz)+dtzz
  );
  const v4 = v3(
    dsyx*(dsxx*(Xneg)+dtxx)+dtyx,
    dsyy*(dsxy*(Yneg)+dtxy)+dtyy,
    dsyz*(dsxz*(Zpos)+dtxz)+dtyz
  );
  const v5 = v3(
    dsyx*(Xpos)+dtyx,
    dsyy*(Yneg)+dtyy,
    dsyz*(Zpos)+dtyz
  );
  const v6 = v3(Xpos, Ypos, Zpos);
  const v7 = v3(
    dsxx*(Xneg)+dtxx,
    dsxy*(Ypos)+dtxy,
    dsxz*(Zpos)+dtxz
  );

  const vertices = [v0,v1,v2,v3p,v4,v5,v6,v7].map((vertex) => v3(
    vertex.x * scaleX,
    vertex.y * scaleY,
    vertex.z * scaleZ
  ));
  const faces = CUBE_FACES.map(f=>f.slice());
  const c = centroid(vertices);
  orientFacesOutward(vertices, faces, c);

  return {
    vertices,
    faces,
    edges: CUBE_EDGES.map(e=>e.slice()),
    centroid:c
  };
}

/* ============================================================
   Rotations and transforms
============================================================ */
function rotateXVec(v, angle){
  const c = Math.cos(angle), s = Math.sin(angle);
  return {x:v.x, y:c*v.y - s*v.z, z:s*v.y + c*v.z};
}
function rotateYVec(v, angle){
  const c = Math.cos(angle), s = Math.sin(angle);
  return {x:c*v.x + s*v.z, y:v.y, z:-s*v.x + c*v.z};
}
function rotateZVec(v, angle){
  const c = Math.cos(angle), s = Math.sin(angle);
  return {x:c*v.x - s*v.y, y:s*v.x + c*v.y, z:v.z};
}
function rotateVecThetaPhiPsi(v, theta, phi, psi){
  return rotateZVec(rotateYVec(rotateXVec(v, psi), phi), theta);
}
function rotatePointAroundThetaPhiPsi(point, center, theta, phi, psi){
  const local = sub(point, center);
  const rotated = rotateVecThetaPhiPsi(local, theta, phi, psi);
  return add(center, rotated);
}
function rotatePolyhedronThetaPhiPsi(poly, theta=0, phi=0, psi=0, center=poly.centroid){
  const vertices = poly.vertices.map(v=>rotatePointAroundThetaPhiPsi(v, center, theta, phi, psi));
  const c = rotatePointAroundThetaPhiPsi(poly.centroid, center, theta, phi, psi);
  return {
    vertices,
    faces: poly.faces.map(f=>f.slice()),
    edges: poly.edges.map(e=>e.slice()),
    centroid: c
  };
}
function translatePolyhedron(poly, offset){
  return {
    vertices: poly.vertices.map(v=>({x:v.x+offset.x, y:v.y+offset.y, z:v.z+offset.z})),
    faces: poly.faces.map(f=>f.slice()),
    edges: poly.edges.map(e=>e.slice()),
    centroid: {x:poly.centroid.x+offset.x, y:poly.centroid.y+offset.y, z:poly.centroid.z+offset.z}
  };
}

/* ============================================================
   SAT overlap
============================================================ */
function projectVertices(vertices, axis){
  let mn = dot(vertices[0], axis);
  let mx = mn;
  for(let i=1;i<vertices.length;i++){
    const d = dot(vertices[i], axis);
    if(d < mn) mn = d;
    if(d > mx) mx = d;
  }
  return [mn, mx];
}
function intervalsOverlap(a,b,eps=1e-9){
  return !(a[1] < b[0] + eps || b[1] < a[0] + eps);
}
function getFaceAxes(poly){
  const axes = [];
  for(const face of poly.faces){
    const n = faceNormal(poly.vertices, face);
    if(lengthSq(n) > 1e-18) axes.push(normalize(n));
  }
  return axes;
}
function getEdgeAxes(polyA, polyB){
  const axes = [];
  for(const ea of polyA.edges){
    const da = sub(polyA.vertices[ea[1]], polyA.vertices[ea[0]]);
    for(const eb of polyB.edges){
      const db = sub(polyB.vertices[eb[1]], polyB.vertices[eb[0]]);
      const c = cross(da, db);
      if(lengthSq(c) > 1e-18) axes.push(normalize(c));
    }
  }
  return axes;
}
function satOverlap(polyA, polyB, eps=1e-9){
  const axes = [...getFaceAxes(polyA), ...getFaceAxes(polyB), ...getEdgeAxes(polyA, polyB)];
  for(const axis of axes){
    const a = projectVertices(polyA.vertices, axis);
    const b = projectVertices(polyB.vertices, axis);
    if(!intervalsOverlap(a,b,eps)) return false;
  }
  return true;
}

/* ============================================================
   Point-inside convex polyhedron
============================================================ */
function pointInsideConvexPolyhedron(point, poly, eps=1e-9){
  for(const face of poly.faces){
    const a = poly.vertices[face[0]];
    const n = faceNormal(poly.vertices, face);
    if(dot(n, sub(point,a)) > eps) return false;
  }
  return true;
}

/* ============================================================
   AABB and sampled overlap volume / surface
============================================================ */
function computeAABB(vertices){
  let mn = {...vertices[0]}, mx = {...vertices[0]};
  for(let i=1;i<vertices.length;i++){
    mn = min3(mn, vertices[i]);
    mx = max3(mx, vertices[i]);
  }
  return {min:mn, max:mx};
}
function unionAABB(a,b){
  return {min:min3(a.min,b.min), max:max3(a.max,b.max)};
}

function sampleOverlapVolumesAndSurface(polyA, polyB, gridResolution=32){
  const aabbA = computeAABB(polyA.vertices);
  const aabbB = computeAABB(polyB.vertices);
  const unionBox = unionAABB(aabbA, aabbB);

  const sx = gridResolution, sy = gridResolution, sz = gridResolution;
  const dx = (unionBox.max.x - unionBox.min.x) / sx;
  const dy = (unionBox.max.y - unionBox.min.y) / sy;
  const dz = (unionBox.max.z - unionBox.min.z) / sz;
  const cellVolume = dx*dy*dz;

  const occ = new Uint8Array(sx*sy*sz);
  const idx = (ix,iy,iz) => iz*(sx*sy) + iy*sx + ix;

  let countA = 0;
  let countB = 0;
  let countBoth = 0;

  for(let iz=0; iz<sz; iz++){
    const z = unionBox.min.z + (iz+0.5)*dz;
    for(let iy=0; iy<sy; iy++){
      const y = unionBox.min.y + (iy+0.5)*dy;
      for(let ix=0; ix<sx; ix++){
        const x = unionBox.min.x + (ix+0.5)*dx;
        const p = {x,y,z};
        const inA = pointInsideConvexPolyhedron(p, polyA);
        const inB = pointInsideConvexPolyhedron(p, polyB);
        if(inA) countA++;
        if(inB) countB++;
        if(inA && inB){
          occ[idx(ix,iy,iz)] = 1;
          countBoth++;
        }
      }
    }
  }

  const areaX = dy*dz;
  const areaY = dx*dz;
  const areaZ = dx*dy;

  function filled(ix,iy,iz){
    if(ix < 0 || iy < 0 || iz < 0 || ix >= sx || iy >= sy || iz >= sz) return false;
    return occ[idx(ix,iy,iz)] !== 0;
  }

  let overlapSurfaceArea = 0;
  for(let iz=0; iz<sz; iz++){
    for(let iy=0; iy<sy; iy++){
      for(let ix=0; ix<sx; ix++){
        if(!filled(ix,iy,iz)) continue;
        if(!filled(ix-1,iy,iz)) overlapSurfaceArea += areaX;
        if(!filled(ix+1,iy,iz)) overlapSurfaceArea += areaX;
        if(!filled(ix,iy-1,iz)) overlapSurfaceArea += areaY;
        if(!filled(ix,iy+1,iz)) overlapSurfaceArea += areaY;
        if(!filled(ix,iy,iz-1)) overlapSurfaceArea += areaZ;
        if(!filled(ix,iy,iz+1)) overlapSurfaceArea += areaZ;
      }
    }
  }

  const volumeA = countA * cellVolume;
  const volumeB = countB * cellVolume;
  const intersectionVolume = countBoth * cellVolume;
  const smaller = Math.min(volumeA, volumeB);
  const union = volumeA + volumeB - intersectionVolume;

  return {
    overlaps: intersectionVolume > 1e-9,
    volumeA,
    volumeB,
    intersectionVolume,
    overlapSurfaceArea,
    percentOfA: volumeA > 1e-9 ? 100*intersectionVolume/volumeA : 0,
    percentOfB: volumeB > 1e-9 ? 100*intersectionVolume/volumeB : 0,
    percentOfSmaller: smaller > 1e-9 ? 100*intersectionVolume/smaller : 0,
    iouPercent: union > 1e-9 ? 100*intersectionVolume/union : 0
  };
}
function getOverlapMetric(result, name){
  switch(name){
    case "percentOfA": return result.percentOfA || 0;
    case "percentOfB": return result.percentOfB || 0;
    case "percentOfSmaller": return result.percentOfSmaller || 0;
    default: return result.iouPercent || 0;
  }
}

/* ============================================================
   Random parameter + orientation generation
============================================================ */
function randomDeformedCubeParamsFromFn(options={}, randomFn=Math.random){
  const range = (minKey, maxKey, fallbackMin, fallbackMax) => normalizeNumericRange(
    options[minKey],
    options[maxKey],
    fallbackMin,
    fallbackMax
  );
  const dsx = range('dsxMin', 'dsxMax', 0.8, 1.2);
  const dsy = range('dsyMin', 'dsyMax', 0.8, 1.2);
  const dsz = range('dszMin', 'dszMax', 0.8, 1.2);
  const dtx = range('dtxMin', 'dtxMax', -0.15, 0.15);
  const dty = range('dtyMin', 'dtyMax', -0.15, 0.15);
  const dtz = range('dtzMin', 'dtzMax', -0.15, 0.15);

  return {
    DSX: [
      randomInRangeFromFn(dsx.min, dsx.max, randomFn),
      randomInRangeFromFn(dsx.min, dsx.max, randomFn),
      randomInRangeFromFn(dsx.min, dsx.max, randomFn)
    ],
    DSY: [
      randomInRangeFromFn(dsy.min, dsy.max, randomFn),
      randomInRangeFromFn(dsy.min, dsy.max, randomFn),
      randomInRangeFromFn(dsy.min, dsy.max, randomFn)
    ],
    DSZ: [
      randomInRangeFromFn(dsz.min, dsz.max, randomFn),
      randomInRangeFromFn(dsz.min, dsz.max, randomFn),
      randomInRangeFromFn(dsz.min, dsz.max, randomFn)
    ],
    DTX: [
      randomInRangeFromFn(dtx.min, dtx.max, randomFn),
      randomInRangeFromFn(dtx.min, dtx.max, randomFn),
      randomInRangeFromFn(dtx.min, dtx.max, randomFn)
    ],
    DTY: [
      randomInRangeFromFn(dty.min, dty.max, randomFn),
      randomInRangeFromFn(dty.min, dty.max, randomFn),
      randomInRangeFromFn(dty.min, dty.max, randomFn)
    ],
    DTZ: [
      randomInRangeFromFn(dtz.min, dtz.max, randomFn),
      randomInRangeFromFn(dtz.min, dtz.max, randomFn),
      randomInRangeFromFn(dtz.min, dtz.max, randomFn)
    ]
  };
}

function randomThetaPhiPsiOrientationFromFn(options={}, randomFn=Math.random){
  const thetaMin = Number.isFinite(options.thetaMin) ? options.thetaMin : 0;
  const thetaMax = Number.isFinite(options.thetaMax) ? options.thetaMax : Math.PI*2;
  const phiMin = Number.isFinite(options.phiMin) ? options.phiMin : -Math.PI*0.5;
  const phiMax = Number.isFinite(options.phiMax) ? options.phiMax :  Math.PI*0.5;
  const psiMin = Number.isFinite(options.psiMin) ? options.psiMin : 0;
  const psiMax = Number.isFinite(options.psiMax) ? options.psiMax : Math.PI*2;
  const uniformSphere = options.uniformSphere === true;

  const theta = randomInRangeFromFn(thetaMin, thetaMax, randomFn);
  const psi = randomInRangeFromFn(psiMin, psiMax, randomFn);

  let phi;
  if(uniformSphere){
    const sMin = Math.sin(phiMin);
    const sMax = Math.sin(phiMax);
    const s = randomInRangeFromFn(Math.min(sMin,sMax), Math.max(sMin,sMax), randomFn);
    phi = Math.asin(Math.max(-1, Math.min(1, s)));
  } else {
    phi = randomInRangeFromFn(phiMin, phiMax, randomFn);
  }

  return {theta, phi, psi};
}

/* ============================================================
   DeformedCube class
============================================================ */
class DeformedCube {
  constructor(options={}){
    this.cubeType = options.cubeType || "Cube";
    this.Scale = Array.isArray(options.Scale) ? options.Scale.slice() : [1,1,1];
    this.DSX = Array.isArray(options.DSX) ? options.DSX.slice() : [1,1,1];
    this.DSY = Array.isArray(options.DSY) ? options.DSY.slice() : [1,1,1];
    this.DSZ = Array.isArray(options.DSZ) ? options.DSZ.slice() : [1,1,1];
    this.DTX = Array.isArray(options.DTX) ? options.DTX.slice() : [0,0,0];
    this.DTY = Array.isArray(options.DTY) ? options.DTY.slice() : [0,0,0];
    this.DTZ = Array.isArray(options.DTZ) ? options.DTZ.slice() : [0,0,0];
    this.position = options.position ? {x:options.position.x||0, y:options.position.y||0, z:options.position.z||0} : {x:0,y:0,z:0};
    this.theta = Number.isFinite(options.theta) ? options.theta : 0;
    this.phi = Number.isFinite(options.phi) ? options.phi : 0;
    this.psi = Number.isFinite(options.psi) ? options.psi : 0;
    this.name = options.name || "";
  }

  clone(){ return new DeformedCube(this.toJSON()); }

  toJSON(){
    return {
      cubeType:this.cubeType,
      Scale:this.Scale.slice(),
      DSX:this.DSX.slice(), DSY:this.DSY.slice(), DSZ:this.DSZ.slice(),
      DTX:this.DTX.slice(), DTY:this.DTY.slice(), DTZ:this.DTZ.slice(),
      position:{...this.position},
      theta:this.theta, phi:this.phi, psi:this.psi, name:this.name
    };
  }

  toParams(){
    return {
      Scale:this.Scale.slice(),
      DSX:this.DSX.slice(), DSY:this.DSY.slice(), DSZ:this.DSZ.slice(),
      DTX:this.DTX.slice(), DTY:this.DTY.slice(), DTZ:this.DTZ.slice()
    };
  }

  setPosition(x,y,z){ this.position = {x,y,z}; return this; }
  setOrientation(theta,phi,psi){ this.theta=theta; this.phi=phi; this.psi=psi; return this; }

  buildBasePolyhedron(){ return buildDeformedCube(this.toParams(), this.cubeType); }
  buildOrientedPolyhedron(){
    const base = this.buildBasePolyhedron();
    return rotatePolyhedronThetaPhiPsi(base, this.theta, this.phi, this.psi, base.centroid);
  }
  buildPolyhedron(){
    const oriented = this.buildOrientedPolyhedron();
    return translatePolyhedron(oriented, this.position);
  }

  overlapWith(other, options={}){
    const gridResolution = Number.isFinite(options.gridResolution) ? options.gridResolution : 32;
    const polyA = this.buildPolyhedron();
    const polyB = other.buildPolyhedron();
    const overlapsSAT = satOverlap(polyA, polyB);
    if(!overlapsSAT){
      return {
        overlaps:false,
        volumeA:0, volumeB:0, intersectionVolume:0, overlapSurfaceArea:0,
        percentOfA:0, percentOfB:0, percentOfSmaller:0, iouPercent:0,
        cubeA:polyA, cubeB:polyB
      };
    }
    const r = sampleOverlapVolumesAndSurface(polyA, polyB, gridResolution);
    r.cubeA = polyA;
    r.cubeB = polyB;
    return r;
  }

  static random(options={}){
    const randomFn = options.randomFn || Math.random;
    const params = options.params || randomDeformedCubeParamsFromFn(options.randomDeformationOptions || {}, randomFn);
    const orient = randomThetaPhiPsiOrientationFromFn(options.orientationOptions || {}, randomFn);
    return new DeformedCube({
      cubeType:options.cubeType || "Cube",
      Scale:Array.isArray(options.Scale) ? options.Scale.slice() : [1,1,1],
      ...params,
      position:options.position || {x:0,y:0,z:0},
      theta:Number.isFinite(options.theta) ? options.theta : orient.theta,
      phi:Number.isFinite(options.phi) ? options.phi : orient.phi,
      psi:Number.isFinite(options.psi) ? options.psi : orient.psi,
      name:options.name || ""
    });
  }

  static searchToTargetOverlap(cubeA, cubeB, options={}){
    const randomFn = options.randomFn || Math.random;
    const targetOverlapPercent = Number.isFinite(options.targetOverlapPercent) ? options.targetOverlapPercent : 30;
    const overlapMetric = options.overlapMetric || "iouPercent";
    const gridResolution = Number.isFinite(options.gridResolution) ? options.gridResolution : 32;
    const maxIterations = Number.isFinite(options.maxIterations) ? options.maxIterations : 26;
    const epsPercent = Number.isFinite(options.epsPercent) ? options.epsPercent : 0.25;
    const startDistanceMin = Number.isFinite(options.startDistanceMin) ? options.startDistanceMin : 2.5;
    const startDistanceMax = Number.isFinite(options.startDistanceMax) ? options.startDistanceMax : 6.0;
    const minDistance = Number.isFinite(options.minDistance) ? options.minDistance : 0.0;

    const direction = options.direction || randomUnitVectorFromFn(randomFn);

    const baseA = cubeA.clone();
    const baseB = cubeB.clone();
    baseA.setPosition(baseA.position.x, baseA.position.y, baseA.position.z);

    let farDistance = randomInRangeFromFn(startDistanceMin, startDistanceMax, randomFn);

    function placeBAtDistance(dist){
      const b = baseB.clone();
      b.setPosition(
        baseA.position.x + direction.x * dist,
        baseA.position.y + direction.y * dist,
        baseA.position.z + direction.z * dist
      );
      return b;
    }

    let farB = placeBAtDistance(farDistance);
    let farResult = baseA.overlapWith(farB, {gridResolution});

    let farExpandCount = 0;
    while(getOverlapMetric(farResult, overlapMetric) > 0 && farExpandCount < 16){
      farDistance *= 1.5;
      farB = placeBAtDistance(farDistance);
      farResult = baseA.overlapWith(farB, {gridResolution});
      farExpandCount++;
    }

    let lowDistance = minDistance;
    let lowB = placeBAtDistance(lowDistance);
    let lowResult = baseA.overlapWith(lowB, {gridResolution});
    let lowMetric = getOverlapMetric(lowResult, overlapMetric);

    if(lowMetric < targetOverlapPercent){
      return {
        success:false,
        reason:"target overlap not reachable with generated cubes and search range",
        targetOverlapPercent,
        overlapMetric,
        direction,
        startDistance:farDistance,
        finalDistance:lowDistance,
        cubeA:baseA,
        cubeB:lowB,
        result:lowResult
      };
    }

    let highDistance = farDistance;
    let bestDistance = lowDistance;
    let bestB = lowB;
    let bestResult = lowResult;
    let bestError = Math.abs(lowMetric - targetOverlapPercent);

    for(let i=0;i<maxIterations;i++){
      const midDistance = 0.5 * (lowDistance + highDistance);
      const midB = placeBAtDistance(midDistance);
      const midResult = baseA.overlapWith(midB, {gridResolution});
      const midMetric = getOverlapMetric(midResult, overlapMetric);
      const err = Math.abs(midMetric - targetOverlapPercent);

      if(err < bestError){
        bestError = err;
        bestDistance = midDistance;
        bestB = midB;
        bestResult = midResult;
      }

      if(err <= epsPercent) break;

      if(midMetric >= targetOverlapPercent){
        lowDistance = midDistance;
      } else {
        highDistance = midDistance;
      }
    }

    return {
      success:true,
      targetOverlapPercent,
      overlapMetric,
      direction,
      startDistance:farDistance,
      finalDistance:bestDistance,
      cubeA:baseA,
      cubeB:bestB,
      result:bestResult
    };
  }

  static randomTargetOverlapTest(options={}){
    const randomFn = options.randomFn || Math.random;
    const sharedDeformationOptions = options.randomDeformationOptions || options.randomDeformationOptionsA || options.randomDeformationOptionsB || {};
    const baseCenterA = options.baseCenterA || {
      x:randomInRangeFromFn(-1,1,randomFn),
      y:randomInRangeFromFn(-1,1,randomFn),
      z:randomInRangeFromFn(-1,1,randomFn)
    };

    const cubeA = DeformedCube.random({
      randomFn,
      cubeType: options.cubeTypeA || "Cube",
      Scale: options.scaleA,
      position: baseCenterA,
      name: "A",
      randomDeformationOptions: sharedDeformationOptions,
      orientationOptions: options.orientationOptions || {}
    });

    const cubeB = DeformedCube.random({
      randomFn,
      cubeType: options.cubeTypeB || "Cube",
      Scale: options.scaleB,
      position: {x:0,y:0,z:0},
      name: "B",
      randomDeformationOptions: sharedDeformationOptions,
      orientationOptions: options.orientationOptions || {}
    });

    return DeformedCube.searchToTargetOverlap(cubeA, cubeB, {
      ...options,
      randomFn
    });
  }
}

/* ============================================================
   Viewer
============================================================ */
const canvas = document.getElementById("viewerCanvas");
const ctx = canvas.getContext("2d");

const viewerState = {
  yaw: 0.65,
  pitch: -0.45,
  zoom: 6.2,
  dragging: false,
  lastX: 0,
  lastY: 0,
  result: null,
  runCount: 0,
  lastRunLabel: ""
};

function resizeCanvas(){
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  drawScene();
}
window.addEventListener("resize", resizeCanvas);

canvas.addEventListener("mousedown", (e)=>{
  viewerState.dragging = true;
  viewerState.lastX = e.clientX;
  viewerState.lastY = e.clientY;
});
window.addEventListener("mouseup", ()=> viewerState.dragging = false);
window.addEventListener("mousemove", (e)=>{
  if(!viewerState.dragging) return;
  const dx = e.clientX - viewerState.lastX;
  const dy = e.clientY - viewerState.lastY;
  viewerState.lastX = e.clientX;
  viewerState.lastY = e.clientY;
  viewerState.yaw += dx * 0.01;
  viewerState.pitch += dy * 0.01;
  document.getElementById("viewYaw").value = viewerState.yaw.toFixed(3);
  document.getElementById("viewPitch").value = viewerState.pitch.toFixed(3);
  drawScene();
});
canvas.addEventListener("wheel", (e)=>{
  e.preventDefault();
  viewerState.zoom *= (e.deltaY > 0 ? 1.08 : 0.92);
  viewerState.zoom = Math.min(20, Math.max(1.2, viewerState.zoom));
  document.getElementById("viewZoom").value = viewerState.zoom.toFixed(3);
  drawScene();
}, {passive:false});

function worldToCamera(p){
  let q = {...p};
  q = rotateYVec(q, -viewerState.yaw);
  q = rotateXVec(q, -viewerState.pitch);
  q.z += viewerState.zoom;
  return q;
}

function projectPoint(p, width, height, sceneScale){
  const cam = worldToCamera(p);
  const f = 420 / Math.max(0.2, cam.z);
  return {
    x: width*0.5 + cam.x * f * sceneScale,
    y: height*0.5 - cam.y * f * sceneScale,
    z: cam.z
  };
}

function drawLine3D(a,b,color,width=1,alpha=1,sceneScale=1){
  const rect = canvas.getBoundingClientRect();
  const pa = projectPoint(a, rect.width, rect.height, sceneScale);
  const pb = projectPoint(b, rect.width, rect.height, sceneScale);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.stroke();
  ctx.restore();
}

function drawPoint3D(p,color,size=4,sceneScale=1){
  const rect = canvas.getBoundingClientRect();
  const pp = projectPoint(p, rect.width, rect.height, sceneScale);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(pp.x, pp.y, size, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function collectScenePoints(result){
  if(!result || !result.result || !result.result.cubeA || !result.result.cubeB) return [v3(-1,-1,-1), v3(1,1,1)];
  return [...result.result.cubeA.vertices, ...result.result.cubeB.vertices];
}

function computeSceneScale(result){
  const pts = collectScenePoints(result);
  let aabb = computeAABB(pts);
  const size = sub(aabb.max, aabb.min);
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  return 2.6 / maxDim;
}

function drawAxes(sceneScale){
  drawLine3D(v3(-2,0,0), v3(2,0,0), "#a855f7", 1, 0.55, sceneScale);
  drawLine3D(v3(0,-2,0), v3(0,2,0), "#22c55e", 1, 0.55, sceneScale);
  drawLine3D(v3(0,0,-2), v3(0,0,2), "#38bdf8", 1, 0.55, sceneScale);
}

function drawPolyhedron(poly, edgeColor, pointColor, sceneScale){
  for(const e of poly.edges){
    drawLine3D(poly.vertices[e[0]], poly.vertices[e[1]], edgeColor, 2, 0.95, sceneScale);
  }
  drawPoint3D(poly.centroid, pointColor, 4, sceneScale);
}

function drawScene(){
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0,0,rect.width,rect.height);

  const g = ctx.createLinearGradient(0,0,0,rect.height);
  g.addColorStop(0,"#081022");
  g.addColorStop(1,"#060a14");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,rect.width,rect.height);

  const sceneScale = computeSceneScale(viewerState.result);
  drawAxes(sceneScale);

  if(!viewerState.result || !viewerState.result.result){
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "14px Inter, sans-serif";
    ctx.fillText("Press Go to generate and display the deformed cube overlap result.", 18, 28);
    return;
  }

  const result = viewerState.result.result;
  drawPolyhedron(result.cubeA, "#77b0ff", "#77b0ff", sceneScale);
  drawPolyhedron(result.cubeB, "#ffb86c", "#ffb86c", sceneScale);
  drawLine3D(result.cubeA.centroid, result.cubeB.centroid, "#ffffff", 1.5, 0.5, sceneScale);
}

/* ============================================================
   UI
============================================================ */
function num(id){
  return parseFloat(document.getElementById(id).value);
}
function intval(id){
  return parseInt(document.getElementById(id).value, 10);
}
function val(id){
  return document.getElementById(id).value;
}
function checked(id){
  return !!document.getElementById(id).checked;
}
function logText(text){
  document.getElementById("consoleOut").value = text;
}
function setHud(summary){
  document.getElementById("hudStatus").textContent = summary.status;
  document.getElementById("hudMetric").textContent = summary.metric;
  document.getElementById("hudTarget").textContent = summary.target;
  document.getElementById("hudActual").textContent = summary.actual;
  document.getElementById("hudSurface").textContent = summary.surface;
  document.getElementById("hudDistance").textContent = summary.distance;
}

function makeOptionsFromUI(){
  const sharedDeformationOptions = {
    dsxMin: num("sharedDsxMin"),
    dsxMax: num("sharedDsxMax"),
    dsyMin: num("sharedDsyMin"),
    dsyMax: num("sharedDsyMax"),
    dszMin: num("sharedDszMin"),
    dszMax: num("sharedDszMax"),
    dtxMin: num("sharedDtxMin"),
    dtxMax: num("sharedDtxMax"),
    dtyMin: num("sharedDtyMin"),
    dtyMax: num("sharedDtyMax"),
    dtzMin: num("sharedDtzMin"),
    dtzMax: num("sharedDtzMax")
  };
  return {
    seed: intval("seed"),
    targetOverlapPercent: num("targetOverlap"),
    overlapMetric: val("metric"),
    cubeTypeA: val("cubeType"),
    cubeTypeB: val("cubeType"),
    scaleA: [num("aScaleX"), num("aScaleY"), num("aScaleZ")],
    scaleB: [num("bScaleX"), num("bScaleY"), num("bScaleZ")],
    gridResolution: intval("gridResolution"),
    maxIterations: intval("maxIterations"),
    epsPercent: num("epsPercent"),
    startDistanceMin: num("startDistanceMin"),
    startDistanceMax: num("startDistanceMax"),
    randomDeformationOptions: sharedDeformationOptions,
    orientationOptions: {
      thetaMin: num("thetaMin"),
      thetaMax: num("thetaMax"),
      phiMin: num("phiMin"),
      phiMax: num("phiMax"),
      psiMin: num("psiMin"),
      psiMax: num("psiMax"),
      uniformSphere: checked("uniformSphere")
    }
  };
}

function formatVec(v){
  return `(${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)})`;
}
function formatArr(a){
  return `[${a.map(x=>Number(x).toFixed(4)).join(", ")}]`;
}
function generateRandomSeed(){
  return String((Math.random() * 0xFFFFFFFF) >>> 0);
}

function runExample(options={}){
  const goButton = document.getElementById("goBtn");
  const newSeedButton = document.getElementById("newSeedBtn");
  const shouldRerollSeed = options.rerollSeed !== false;
  if(shouldRerollSeed){
    document.getElementById("seed").value = generateRandomSeed();
  }
  viewerState.runCount += 1;
  viewerState.lastRunLabel = `Run ${viewerState.runCount} @ ${new Date().toLocaleTimeString()}`;
  if(goButton) goButton.disabled = true;
  if(newSeedButton) newSeedButton.disabled = true;

  try {
    viewerState.yaw = num("viewYaw");
    viewerState.pitch = num("viewPitch");
    viewerState.zoom = num("viewZoom");

    const options = makeOptionsFromUI();
    const rng = mulberry32(options.seed >>> 0);
    options.randomFn = rng;

    const test = DeformedCube.randomTargetOverlapTest(options);
    viewerState.result = test;

    drawScene();

    if(!test.success){
      setHud({
        status: "No target",
        metric: options.overlapMetric,
        target: options.targetOverlapPercent.toFixed(3),
        actual: getOverlapMetric(test.result, options.overlapMetric).toFixed(3),
        surface: (test.result.overlapSurfaceArea || 0).toFixed(6),
        distance: Number(test.finalDistance || 0).toFixed(6)
      });

      logText(
`${viewerState.lastRunLabel}
Run failed: ${test.reason}

Target metric: ${options.overlapMetric}
Target overlap %: ${options.targetOverlapPercent.toFixed(6)}
Achieved overlap %: ${getOverlapMetric(test.result, options.overlapMetric).toFixed(6)}
Distance: ${(test.finalDistance || 0).toFixed(6)}

Cube A position: ${formatVec(test.cubeA.position)}
Cube B position: ${formatVec(test.cubeB.position)}

Result:
${JSON.stringify(test.result, null, 2)}`
      );
      return;
    }

    const actual = getOverlapMetric(test.result, options.overlapMetric);

    setHud({
      status: test.result.overlaps ? "Overlap" : "Separated",
      metric: options.overlapMetric,
      target: options.targetOverlapPercent.toFixed(3),
      actual: actual.toFixed(3),
      surface: test.result.overlapSurfaceArea.toFixed(6),
      distance: test.finalDistance.toFixed(6)
    });

    const a = test.cubeA;
    const b = test.cubeB;
    const shared = options.randomDeformationOptions || {};

    const consoleText =
`${viewerState.lastRunLabel}
Deformed Cube Overlap Viewer Result
===================================

Seed: ${options.seed}
Cube type: ${options.cubeTypeA}
Target metric: ${options.overlapMetric}
Target overlap %: ${options.targetOverlapPercent.toFixed(6)}
Achieved overlap %: ${actual.toFixed(6)}
Search success: ${test.success}
Final distance: ${test.finalDistance.toFixed(6)}
Direction: ${formatVec(test.direction)}

Shared deformation ranges
-------------------------
DSX: [${Number(shared.dsxMin ?? 1).toFixed(4)}, ${Number(shared.dsxMax ?? 1).toFixed(4)}]
DSY: [${Number(shared.dsyMin ?? 1).toFixed(4)}, ${Number(shared.dsyMax ?? 1).toFixed(4)}]
DSZ: [${Number(shared.dszMin ?? 1).toFixed(4)}, ${Number(shared.dszMax ?? 1).toFixed(4)}]
DTX: [${Number(shared.dtxMin ?? 0).toFixed(4)}, ${Number(shared.dtxMax ?? 0).toFixed(4)}]
DTY: [${Number(shared.dtyMin ?? 0).toFixed(4)}, ${Number(shared.dtyMax ?? 0).toFixed(4)}]
DTZ: [${Number(shared.dtzMin ?? 0).toFixed(4)}, ${Number(shared.dtzMax ?? 0).toFixed(4)}]

Overlap result
--------------
overlaps: ${test.result.overlaps}
intersectionVolume: ${test.result.intersectionVolume.toFixed(6)}
overlapSurfaceArea: ${test.result.overlapSurfaceArea.toFixed(6)}
percentOfA: ${test.result.percentOfA.toFixed(6)}
percentOfB: ${test.result.percentOfB.toFixed(6)}
percentOfSmaller: ${test.result.percentOfSmaller.toFixed(6)}
iouPercent: ${test.result.iouPercent.toFixed(6)}

Cube A
------
position: ${formatVec(a.position)}
theta: ${a.theta.toFixed(6)}
phi:   ${a.phi.toFixed(6)}
psi:   ${a.psi.toFixed(6)}
Scale: ${formatArr(a.Scale)}
DSX: ${formatArr(a.DSX)}
DSY: ${formatArr(a.DSY)}
DSZ: ${formatArr(a.DSZ)}
DTX: ${formatArr(a.DTX)}
DTY: ${formatArr(a.DTY)}
DTZ: ${formatArr(a.DTZ)}

Cube B
------
position: ${formatVec(b.position)}
theta: ${b.theta.toFixed(6)}
phi:   ${b.phi.toFixed(6)}
psi:   ${b.psi.toFixed(6)}
Scale: ${formatArr(b.Scale)}
DSX: ${formatArr(b.DSX)}
DSY: ${formatArr(b.DSY)}
DSZ: ${formatArr(b.DSZ)}
DTX: ${formatArr(b.DTX)}
DTY: ${formatArr(b.DTY)}
DTZ: ${formatArr(b.DTZ)}

Raw result JSON
---------------
${JSON.stringify(test, null, 2)}`;

    logText(consoleText);
  } catch (error) {
    viewerState.result = null;
    drawScene();
    setHud({
      status: "Error",
      metric: "-",
      target: "-",
      actual: "-",
      surface: "-",
      distance: "-"
    });
    logText(`${viewerState.lastRunLabel}\nRun error: ${error && error.message ? error.message : String(error)}`);
    console.error(error);
  } finally {
    if(goButton) goButton.disabled = false;
    if(newSeedButton) newSeedButton.disabled = false;
  }
}

/* ============================================================
   Buttons and viewer inputs
============================================================ */
function initDesignerPage() {
  const goButton = document.getElementById("goBtn");
  const newSeedButton = document.getElementById("newSeedBtn");
  if (!goButton || !newSeedButton) return;

  goButton.addEventListener("click", runExample);
  newSeedButton.addEventListener("click", ()=>{
    runExample();
  });

  ["viewYaw","viewPitch","viewZoom"].forEach(id=>{
    document.getElementById(id).addEventListener("input", ()=>{
      viewerState.yaw = num("viewYaw");
      viewerState.pitch = num("viewPitch");
      viewerState.zoom = num("viewZoom");
      drawScene();
    });
  });

  /* ============================================================
     Initial draw
  ============================================================ */
  setHud({
    status: "Idle",
    metric: "-",
    target: "-",
    actual: "-",
    surface: "-",
    distance: "-"
  });
  logText("Press Go to generate two random deformed cubes, search for the requested overlap percentage, and display the result.");
  resizeCanvas();
  runExample({ rerollSeed: false });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDesignerPage, { once: true });
} else {
  initDesignerPage();
}

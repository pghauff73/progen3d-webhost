// Extracted from original file lines 3517-3685
            /*Scope================================================= */

//                                               Scope Class 
//         (C++ port)
/* ======================================================= */
class Scope {
  constructor(other = null) {
    if (other instanceof Scope) {
      this.position   = Vec3.make(other.position.x, other.position.y, other.position.z);
      this.size       = Vec3.make(other.size.x, other.size.y, other.size.z);
      this.secondarySize = Vec3.make(other.secondarySize.x, other.secondarySize.y, other.secondarySize.z);
      this.x          = Vec3.make(other.x.x, other.x.y, other.x.z);
      this.y          = Vec3.make(other.y.x, other.y.y, other.y.z);
      this.z          = Vec3.make(other.z.x, other.z.y, other.z.z);
      this.anglex     = other.anglex; 
      this.angley     = other.angley; 
      this.anglez     = other.anglez;
      this.primaryMatrix = new Float32Array(other.primaryMatrix);
      this.secondaryScaleMatrix = new Float32Array(other.secondaryScaleMatrix);
      this.secondaryTranslateMatrix = new Float32Array(other.secondaryTranslateMatrix);
      this.deformScaleX = Vec3.make(other.deformScaleX.x, other.deformScaleX.y, other.deformScaleX.z);
      this.deformScaleY = Vec3.make(other.deformScaleY.x, other.deformScaleY.y, other.deformScaleY.z);
      this.deformScaleZ = Vec3.make(other.deformScaleZ.x, other.deformScaleZ.y, other.deformScaleZ.z);
      this.deformTranslateX = Vec3.make(other.deformTranslateX.x, other.deformTranslateX.y, other.deformTranslateX.z);
      this.deformTranslateY = Vec3.make(other.deformTranslateY.x, other.deformTranslateY.y, other.deformTranslateY.z);
      this.deformTranslateZ = Vec3.make(other.deformTranslateZ.x, other.deformTranslateZ.y, other.deformTranslateZ.z);
      this.axisDeformActive = !!other.axisDeformActive;
    } else {
      this.position   = Vec3.make(0, 0, 0);
      this.size       = Vec3.make(1, 1, 1);
      this.secondarySize = Vec3.make(1, 1, 1);
      this.x          = Vec3.make(1, 0, 0);
      this.y          = Vec3.make(0, 1, 0);
      this.z          = Vec3.make(0, 0, 1);
      this.anglex = 0; this.angley = 0; this.anglez = 0;
      this.primaryMatrix = Mat4.identity();
      this.secondaryScaleMatrix = Mat4.identity();
      this.secondaryTranslateMatrix = Mat4.identity();
      this.deformScaleX = Vec3.make(1, 1, 1);
      this.deformScaleY = Vec3.make(1, 1, 1);
      this.deformScaleZ = Vec3.make(1, 1, 1);
      this.deformTranslateX = Vec3.make(0, 0, 0);
      this.deformTranslateY = Vec3.make(0, 0, 0);
      this.deformTranslateZ = Vec3.make(0, 0, 0);
      this.axisDeformActive = false;
    }
  }

  static #degToRad(deg){ return (deg * Math.PI) / 180.0; }
  static #wrap360(deg){ let d = deg % 360; return d < 0 ? d + 360 : d; }

  /* ----- Primary transforms (accumulate) ----- */
  T(v){
    const M = Mat4.translation(v.x, v.y, v.z);
    this.primaryMatrix = Mat4.multiply(this.primaryMatrix, M);
    this.position  = Vec3.add(this.position, v);
    return this;
  }
  S(v){
    const M = Mat4.scale(v.x, v.y, v.z);
    this.primaryMatrix = Mat4.multiply(this.primaryMatrix, M);
    this.size = Vec3.mul(this.size, v);
    return this;
  }

  /* ----- Secondary transforms (accumulate; do not overwrite) ----- */
  DS(v){                // secondary scale
    const M = Mat4.scale(v.x, v.y, v.z);
    this.secondaryScaleMatrix = Mat4.multiply(this.secondaryScaleMatrix, M);
    this.secondarySize = Vec3.mul(this.secondarySize, v);
    return this;
  }
  DT(v){                // secondary translate
    const M = Mat4.translation(v.x, v.y, v.z);
    this.secondaryTranslateMatrix = Mat4.multiply(this.secondaryTranslateMatrix, M);
    return this;
  }

  /* ----- Axis-partitioned deformation transforms (component affine) ----- */
  static #mulVec(a, b){ return Vec3.make(a.x * b.x, a.y * b.y, a.z * b.z); }
  static #addVec(a, b){ return Vec3.make(a.x + b.x, a.y + b.y, a.z + b.z); }

  DSX(v){
    this.axisDeformActive = true;
    this.deformScaleX = Scope.#mulVec(this.deformScaleX, v);
    this.deformTranslateX = Scope.#mulVec(this.deformTranslateX, v);
    return this;
  }
  DSY(v){
    this.axisDeformActive = true;
    this.deformScaleY = Scope.#mulVec(this.deformScaleY, v);
    this.deformTranslateY = Scope.#mulVec(this.deformTranslateY, v);
    return this;
  }
  DSZ(v){
    this.axisDeformActive = true;
    this.deformScaleZ = Scope.#mulVec(this.deformScaleZ, v);
    this.deformTranslateZ = Scope.#mulVec(this.deformTranslateZ, v);
    return this;
  }
  DTX(v){
    this.axisDeformActive = true;
    this.deformTranslateX = Scope.#addVec(this.deformTranslateX, v);
    return this;
  }
  DTY(v){
    this.axisDeformActive = true;
    this.deformTranslateY = Scope.#addVec(this.deformTranslateY, v);
    return this;
  }
  DTZ(v){
    this.axisDeformActive = true;
    this.deformTranslateZ = Scope.#addVec(this.deformTranslateZ, v);
    return this;
  }

  /* ----- Rotations (primary) ----- */
  Rx(angleDeg){
    this.anglex = Scope.#wrap360(angleDeg);
    const r = Scope.#degToRad(this.anglex);
    this.primaryMatrix = Mat4.multiply(this.primaryMatrix, Mat4.rotX(r));
    const c = Math.cos(r), s = Math.sin(r);
    this.x = Vec3.make(1, 0, 0);
    this.y = Vec3.make(0,  c, s);
    this.z = Vec3.make(0, -s, c);
    return this;
  }
  Ry(angleDeg){
    this.angley = Scope.#wrap360(angleDeg);
    const r = Scope.#degToRad(this.angley);
    this.primaryMatrix = Mat4.multiply(this.primaryMatrix, Mat4.rotY(r));
    const c = Math.cos(r), s = Math.sin(r);
    this.x = Vec3.make( c, 0, -s);
    this.y = Vec3.make( 0, 1,  0);
    this.z = Vec3.make( s, 0,  c);
    return this;
  }
  Rz(angleDeg){
    this.anglez = Scope.#wrap360(angleDeg);
    const r = Scope.#degToRad(this.anglez);
    this.primaryMatrix = Mat4.multiply(this.primaryMatrix, Mat4.rotZ(r));
    const c = Math.cos(r), s = Math.sin(r);
    this.x = Vec3.make( c, s, 0);
    this.y = Vec3.make(-s, c, 0);
    this.z = Vec3.make( 0, 0, 1);
    return this;
  }

  /* ----- Accessors / utils ----- */
  apply(M){ this.primaryMatrix = Mat4.multiply(this.primaryMatrix, M); return this; }
  resetPrimary(){ this.primaryMatrix = Mat4.identity(); return this; }
  resetSecondary(){
    this.secondaryScaleMatrix = Mat4.identity();
    this.secondaryTranslateMatrix = Mat4.identity();
    this.deformScaleX = Vec3.make(1, 1, 1);
    this.deformScaleY = Vec3.make(1, 1, 1);
    this.deformScaleZ = Vec3.make(1, 1, 1);
    this.deformTranslateX = Vec3.make(0, 0, 0);
    this.deformTranslateY = Vec3.make(0, 0, 0);
    this.deformTranslateZ = Vec3.make(0, 0, 0);
    this.axisDeformActive = false;
    return this;
  }

  getPrimaryMatrix(){ return this.primaryMatrix; }
  getSecondaryScaleMatrix(){ return this.secondaryScaleMatrix; }
  getSecondaryTranslateMatrix(){ return this.secondaryTranslateMatrix; }
  getAxisDeform(){
    return {
      active: !!this.axisDeformActive,
      dsx: [this.deformScaleX.x, this.deformScaleX.y, this.deformScaleX.z],
      dsy: [this.deformScaleY.x, this.deformScaleY.y, this.deformScaleY.z],
      dsz: [this.deformScaleZ.x, this.deformScaleZ.y, this.deformScaleZ.z],
      dtx: [this.deformTranslateX.x, this.deformTranslateX.y, this.deformTranslateX.z],
      dty: [this.deformTranslateY.x, this.deformTranslateY.y, this.deformTranslateY.z],
      dtz: [this.deformTranslateZ.x, this.deformTranslateZ.y, this.deformTranslateZ.z],
    };
  }
  getAxisDeformState(){ return this.getAxisDeform(); }

  getPosition(){ return Vec3.make(this.position.x, this.position.y, this.position.z); }
  setPosition(pos){ this.position = Vec3.make(pos.x, pos.y, pos.z); return this.getPosition(); }

  getSize(){  return Vec3.make(this.size.x, this.size.y, this.size.z); }
  getSecondarySize(){ return Vec3.make(this.secondarySize.x, this.secondarySize.y, this.secondarySize.z); }

  clone(){ return new Scope(this); }
}

/* ======================================================= */


//                                        Context Class(scope stack) 


/* ======================================================= */
class Context {
  constructor() { this.stack = [ new Scope() ]; }
  current() { return this.stack[this.stack.length - 1]; }
  getCurrentScope() { return this.current(); }
  push() { this.stack.push(new Scope(this.current())); return this.current(); }
  pop()  { if (this.stack.length > 1) this.stack.pop(); return this.current(); }
  pushScope() { return this.push(); }
  popScope()  { return this.pop(); }
  newScope()  { this.stack.push(new Scope()); return this.current(); } // fresh identity
}



/* ======================================================= */

//                                         Error Functions

/* ======================================================= */


class SolutionError extends Error {
  constructor(message, idx = -1, expr = "") {
    const where = (idx >= 0 && expr)
      ? ` at col ${idx + 1}:\n${expr}\n${" ".repeat(idx)}^`
      : "";
    super(`${message}${where}`); this.name = "SolutionError";
  }
}
class ParseError extends Error {
  constructor(message, line = 0, col = 0, snippet = "") {
    super(message); this.name = "ParseError"; this.line = line; this.col = col; this.snippet = snippet;
  }
}
class RuntimeGrammarError extends Error { constructor(message){ super(message); this.name="RuntimeGrammarError"; } }
const ErrorReporter = {
  caret(line, col) { return `${line}\n${" ".repeat(Math.max(0, col))}^`; },
  fromToken(msg, tok) { return new ParseError(msg, tok.line, tok.col, this.caret(tok.sourceLine, tok.col)); }
};
function errorout(e) {
  const hasConsole = typeof console !== "undefined";
  if (e instanceof ParseError) {
    if (hasConsole && console.warn) console.warn(`[ParseError] ${e.message} (line ${e.line}, col ${e.col})\n${e.snippet}`);
  } else {
    if (hasConsole && console.warn) console.warn(String(e));
  }
}

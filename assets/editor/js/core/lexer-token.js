// Extracted from original file lines 4023-4459
            // Grammar Lexer (keeps WS & NL) — MATH + strict '->', no RegExp anywhere
class GrammarLexer {
  constructor(text){
    this.src = String(text ?? "");
    this.tokens = [];
    this._lex();
  }

_push(type, value, line, col, lineStart){
  const lineEnd = this.src.indexOf("\n", lineStart);
  const sourceLine = this.src.slice(lineStart, lineEnd === -1 ? this.src.length : lineEnd);
  const start = lineStart + col;                 // absolute byte/char offset
  const end   = start + value.length;            // absolute end (exclusive)
  this.tokens.push({ type, value, line, col, sourceLine, start, end });
}

  // ===== Char helpers (no regex) =====
  _isSpace(c){ return c===" "||c==="\t"||c==="\r"||c==="\v"||c==="\f"; } // NOT \n
  _isDigit(c){ return c>="0" && c<="9"; }
  _isLetter(c){ return (c>="A"&&c<="Z")||(c>="a"&&c<="z")||c==="_"; }
  _isIdentC(c){ return this._isLetter(c)||this._isDigit(c); }

  // Unsigned number: 123 .5 1.23 1e+3 1.0E-2
  _readNumber(s, i, end){
    let j = i, has = false;
    while (j < end && this._isDigit(s[j])) { j++; has = true; }
    if (j < end && s[j] === "."){
      let k = j + 1, any = false;
      while (k < end && this._isDigit(s[k])) { k++; any = true; }
      if (any){ j = k; has = true; }
    }
    if (!has) return i;
    if (j < end && (s[j] === "e" || s[j] === "E")){
      let k = j + 1;
      if (k < end && (s[k] === "+" || s[k] === "-")) k++;
      let any = false;
      while (k < end && this._isDigit(s[k])) { k++; any = true; }
      if (!any) return i;
      j = k;
    }
    return j;
  }

  // Signed number (+/- optional)
  _readSignedNumber(s, i, end){
    let p = i;
    if (p < end && (s[p] === "+" || s[p] === "-")) p++;
    const j = this._readNumber(s, p, end);
    return (j > p) ? j : i;
  }

  // Identifier: optional & then optional +/- then [A-Za-z_][A-Za-z0-9_]*
  _readIdentifier(s, i, end){
    let j = i;
    if (j < end && s[j] === "&") j++;
    if (j < end && (s[j] === "+" || s[j] === "-")) j++;
    if (!(j < end && this._isLetter(s[j]))) return i;
    j++;
    while (j < end && this._isIdentC(s[j])) j++;
    return j;
  }





  // Self-contained MATH span (no spaces/newlines once begun)
  _matchMath(start){
    const s = this.src, len = s.length;
    let pos = start;

    const isSpace  = this._isSpace.bind(this);
    const isDigit  = this._isDigit.bind(this);
    const isLetter = this._isLetter.bind(this);
    const isIdentC = this._isIdentC.bind(this);
    const isOpOrPar = c => c==="("||c===")"||c==="+"||c==="-"||c==="*"||c==="/"||c==="^";

    // skip leading spaces before the span
    while (pos < len && isSpace(s[pos])) pos++;

 const mathStart = pos;                          // <-- real start (after spaces)


    let sawToken = false;
    let paren = 0;
    let hasBinaryOp = false;
    let hasFuncCall = false;
    let lastWasOperand = false; // number | identifier | ')'

    while (pos < len){
      const ch = s[pos];

      // hard stops
      if (ch === "\n" || ch === "#") break;

      // once started, any space ends the math span
      if (isSpace(ch)){
        if (!sawToken) { pos++; continue; } // before first token
        break;
      }

      const tStart = pos;

      // 1) operators / parens
      if (isOpOrPar(ch)){
        pos++; sawToken = true;

        if (ch === "("){ paren++; lastWasOperand = false; continue; }
        if (ch === ")"){
          if (paren === 0){ pos = tStart; break; }
          paren--; lastWasOperand = true; continue;
        }
        if (ch === "-"){
          const unary = !lastWasOperand;
          if (!unary) hasBinaryOp = true;
          lastWasOperand = false; continue;
        }
        // + * / ^ → binary iff preceded by operand
        if (lastWasOperand) hasBinaryOp = true;
        lastWasOperand = false; continue;
      }

      // 2) number (supports .5)
      if (isDigit(ch) || (ch === "." && isDigit(s[pos+1]||""))){
        const j = this._readNumber(s, pos, len);
        if (j > pos){ pos = j; sawToken = true; lastWasOperand = true; continue; }
      }

      // 3) identifier (var/func). No spaces allowed to func '('.
      if (isLetter(ch)){
        let j = pos + 1;
        while (j < len && isIdentC(s[j])) j++;
        const name = s.slice(pos, j);

        const isFunc = (name === "sin" || name === "cos"); // extend if needed
        const isVar  = (typeof findVariableForward === "function")
          ? (findVariableForward(name) !== -1) : true;

        if (!(isFunc || isVar)) break;

        if (isFunc){
          if (s[j] === "("){ hasFuncCall = true; }
          else { break; } // function must be immediately followed by '(' in span
        }

        pos = j; sawToken = true; lastWasOperand = true; continue;
      }

      // anything else ends the span
      break;
    }


 if (!sawToken) return null;
  const end = pos;
  const raw = s.slice(mathStart, end);           // <-- slice from mathStart

    // validity checks
    if (paren !== 0) return null;

    // reject pure signed number
    const isPureSignedNumber = (str)=>{
      let a = 0, b = str.length;
      while (a < b && isSpace(str[a])) a++;
      while (b > a && isSpace(str[b-1])) b--;
      if (a >= b) return false;
      let p = a;
      if (str[p] === "+" || str[p] === "-") p++;
      const q = this._readNumber(str, p, b);
      // if any space inside, earlier loop would have broken; here must be tight
      return (q > p && q === b);
    };
    if (isPureSignedNumber(raw)) return null;

    if (!lastWasOperand) return null;
    if (!(hasBinaryOp || hasFuncCall)) return null;


return { start: mathStart, end, text: raw };
  }

  // Strict '->' (no spaces inside). We DO NOT consume a following newline here,
  // because we now emit NL tokens explicitly.
  _matchArrow(i){
    const s = this.src;
    if (i + 1 < s.length && s[i] === "-" && s[i + 1] === ">"){
      return { end: i + 2 };
    }
    return null;
  }

  _lex(){
    const s = this.src;
    let i = 0, line = 1, col = 0, lineStart = 0;

    // single-char operators/delims outside MATH
    const singles = new Set(["(",")","[","]","{","}","|",";","*",",","/"]);

    while (i < s.length){
      const c = s[i];

      // --- Newline: emit NL, then advance line counters
      if (c === "\n"){
        this._push("NL", "\n", line, col, lineStart);
        i++; line++; col = 0; lineStart = i;
        continue;
      }

      // --- Whitespace run (no \n): keep WS
      if (this._isSpace(c)){
        let j = i + 1;
        while (j < s.length && this._isSpace(s[j]) && s[j] !== "\n") j++;
        this._push("WS", s.slice(i, j), line, col, lineStart);
        col += (j - i); i = j;
        continue;
      }

      // --- Comments
      if (c === "#"){ // shell to end of line
        const j = s.indexOf("\n", i);
        const end = j === -1 ? s.length : j;
        this._push("CMT", s.slice(i, end), line, col, lineStart);
        col += (end - i); i = end; continue;
      }
      if (c === "/" && s[i+1] === "/"){ // C++ line
        let j = i + 2;
        while (j < s.length && s[j] !== "\n") j++;
        this._push("CMT", s.slice(i, j), line, col, lineStart);
        col += (j - i); i = j; continue;
      }
  if (c === "/" && s[i+1] === "*"){ // C block
  let j = i + 2, closed = false;
  const l0 = line, c0 = col, ls0 = lineStart;  // <-- snapshot start-of-comment
  while (j < s.length){
    if (s[j] === "\n"){ line++; col = 0; lineStart = j + 1; }
    if (s[j] === "*" && s[j+1] === "/"){ j += 2; closed = true; break; }
    j++;
  }
  if (!closed){
    const lineEnd = s.indexOf("\n", lineStart);
    const errLine = s.slice(lineStart, lineEnd === -1 ? s.length : lineEnd);
    throw new ParseError("Unterminated block comment", l0, c0, ErrorReporter.caret(errLine, c0));
  }
  // value between i..j; but push with the *start* snapshot
  this._push("CMT", s.slice(i, j), l0, c0, ls0);
  i = j; col = i - lineStart; continue;
}

      // --- Arrow
      const arr = this._matchArrow(i);
      if (arr){
        this._push("OP", "->", line, col, lineStart);
        col += (arr.end - i); i = arr.end;
        // NOTE: a newline directly after '->' is fine; it'll be tokenized as NL on next loop
        continue;
      }

// --- MATH (before other tokens)
const math = this._matchMath(i);
if (math){
  // Advance col by (math.end - i) because i hasn’t moved yet
  this._push("MATH", math.text, line, col + (math.start - i), lineStart);
  col += (math.end - i);
  i = math.end;
  continue;
}


      // --- Single-char ops / delims (includes () [] {} and also comma for args)
      if (singles.has(c)){
        this._push("OP", c, line, col, lineStart);
        i++; col++; continue;
      }

      // --- Identifier
      {
        const end = this._readIdentifier(s, i, s.length);
        if (end > i){
          this._push("ID", s.slice(i, end), line, col, lineStart);
          col += (end - i); i = end; continue;
        }
      }

      // --- Number
      {
        const end = this._readSignedNumber(s, i, s.length);
        if (end > i){
          this._push("NUM", s.slice(i, end), line, col, lineStart);
          col += (end - i); i = end; continue;
        }
      }

      // --- Unexpected char
      const lineEnd = s.indexOf("\n", lineStart);
      const errLine = s.slice(lineStart, lineEnd === -1 ? s.length : lineEnd);
      throw new ParseError(`***Unexpected character '${c}'`, line, col, ErrorReporter.caret(errLine, col));
    }
  }
}


/* ==================================================== */

//                                                   Token Class

/* ===================================================== */
class GrammarActionToken {
  static fromToken(t){ const nt=new GrammarActionToken(t.token_name);
    nt.arguments=[...t.arguments]; nt.var_names=[...t.var_names];
    nt.var_name=t.var_name; nt.instance_type=t.instance_type;
    nt.instance_count=t.instance_count|0; nt.integer=!!t.integer; return nt;
  }
  constructor(name, instCount=0){
    this.token_name=name||""; this.arguments=[]; this.instance_type=""; this.instance_count=instCount|0;
    this.var_name=""; this.var_names=["","",""]; this.integer=false;
  }
  addArgument(v){ const n=+v; if (!Number.isFinite(n)) throw new RuntimeGrammarError(`Non-finite token argument for ${this.token_name}`); this.arguments.push(n); }
  addInstanceType(s){ this.instance_type=String(s); }
  isRule(){
    if (this.token_name!=="{" && this.token_name!=="}" && this.token_name!=="+" &&
        this.token_name!=="*" && this.token_name!=="[" && this.token_name!=="]" &&
        this.instance_type==="" && this.arguments.length===0) return this.token_name;
    return "";
  }
  setVarName(s) { this.var_name = String(s); }
  print(){
    const fmt=v=>{ let s=Number(v).toFixed(5); if (s.endsWith(".00000")) s=s.slice(0,-6); return s+" "; };
    let ss=(this.token_name==="R" && this.integer) ? "R* " : (this.token_name+" ");
    if (this.token_name==="[" || this.token_name==="]" || this.isRule()!=="") return ss;
    if (this.var_name) ss+=this.var_name+" ";
    ss+="( "; if (this.instance_type) ss+=this.instance_type+" ";
    ss+= (this.var_names[0] || fmt(this.arguments[0] ?? 0));
    ss+= (this.var_names[1] || fmt(this.arguments[1] ?? 0));
    if (this.arguments.length>2 || this.var_names[2]) ss+= (this.var_names[2] || fmt(this.arguments[2] ?? 0));
    ss+=") "; return ss;
  }
//======================================================

//                                         Perform Action
  /* ---------- Execute token against context + scene (now uses MathS2_js) ---------- */

//=======================================================
  performAction(context, scene, deps = {}) {
    const { addVariable = () => {} } = deps;
    const numArg = (i) => Number(this.arguments[i] ?? 0);
    const evalMaybe = (name, fallback) => (name ? Number(MathS2_js(name)) : Number(fallback));

    switch (this.token_name) {
     /* case "R": {
        addVariable(this.var_name, numArg(0), numArg(1), !!this.integer);
        addVariableInstance(this.var_name, numArg(0), numArg(1), !!this.integer);
        return;
      }*/
      case "S":
      case "DT":
      case "DS":
      case "T":
      case "DSX":
      case "DSY":
      case "DSZ":
      case "DTX":
      case "DTY":
      case "DTZ": {
        const s = context.getCurrentScope();
        const v = {
          x: evalMaybe(this.var_names[0], numArg(0)),
          y: evalMaybe(this.var_names[1], numArg(1)),
          z: evalMaybe(this.var_names[2], numArg(2)),
        };
        if (this.token_name === "S") s.S(v);
        else if (this.token_name === "DS") s.DS(v);
        else if (this.token_name === "DT") s.DT(v);
        else if (this.token_name === "DSX") s.DSX(v);
        else if (this.token_name === "DSY") s.DSY(v);
        else if (this.token_name === "DSZ") s.DSZ(v);
        else if (this.token_name === "DTX") s.DTX(v);
        else if (this.token_name === "DTY") s.DTY(v);
        else if (this.token_name === "DTZ") s.DTZ(v);
        else s.T(v);
        return;
      }
      case "A": {
        const s = context.getCurrentScope();
        const angle = evalMaybe(this.var_names[0], numArg(0));
        const axis  = (evalMaybe(this.var_names[1], numArg(1))|0);
        if (axis === 0) s.Rx(angle); else if (axis === 1) s.Ry(angle); else s.Rz(angle);
        return;
      }
      case "I": {
        const primaryMatrix = context.getCurrentScope().getPrimaryMatrix();
        const secondaryScaleMatrix = context.getCurrentScope().getSecondaryScaleMatrix();
        const secondaryTranslateMatrix = context.getCurrentScope().getSecondaryTranslateMatrix();
        const _texIndex = this.var_names[0];
        const axisDeform = context.getCurrentScope().getAxisDeformState
          ? context.getCurrentScope().getAxisDeformState()
          : (context.getCurrentScope().getAxisDeform ? context.getCurrentScope().getAxisDeform() : null);

        const arg = (this.arguments.length > 1) ? (this.arguments[1] | 0) : 0;
        const val = (this.arguments.length > 2) ? Number(this.arguments[2]) : 0.125;


//////////////////////////////////////////////////////////
        scene.add(this.instance_type, primaryMatrix, secondaryScaleMatrix, secondaryTranslateMatrix, _texIndex, arg, val, undefined, axisDeform);  ////////////SCENE
        

        return;
      }
      case "[": context.pushScope(); return;
      case "]": context.popScope();  return;
      case "{": context.newScope();  return;
      case "}": context.popScope();  return;
      default:  return; // rule name, no-op here
    }
  }
}
const Token = GrammarActionToken;
/* ======================================================= */

//                                    Rule Class

/* ======================================================= */
class GrammarRule {
  constructor(name, repeat){
    this.rule_name=name; this.repeat=repeat; this.count=0;
    this.tokens=[]; this.section_tokens=[[],[],[]];
    this.var_name=""; this.var_names=Array.from({length:20},()=>"" );
    this.var_counter=0; this.probability=1.0; this.alternate=null;
  }
  addToken(tok, sec){
    if (!Array.isArray(this.section_tokens[sec])) this.section_tokens[sec]=[];
    this.section_tokens[sec].push(tok);
    if (sec===1) this.tokens.push(tok);
  }
  print(){
    let ss=this.rule_name+" ";
    ss+= (this.var_name!=="") ? (this.var_name+" ") : (this.repeat+" ");
    for (let i=0;i<this.var_counter;i++) if (this.var_names[i] !== "") ss+=this.var_names[i]+" ";
    if (this.probability<1.0) ss+= "; "+this.probability+" ";
    ss+="-> ";
    for (let k=0;k<3;k++){
      for (const t of this.section_tokens[k]) ss+=t.print();
      if (k===0 && this.section_tokens[0].length) ss+="| ";
      if (k===1 && this.section_tokens[2].length) ss+="| ";
    }
    if (this.alternate){
      ss+="-> ";
      for (const t of this.alternate.section_tokens[1]) ss+=t.print();
    }
    return ss;
  }
}
const Rule = GrammarRule;

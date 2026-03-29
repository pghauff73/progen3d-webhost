// Extracted from original file lines 3810-4021
            /* RNG (guard zero state) ====================== */
const RNG = (() => {
  const UINT32 = 0x100000000;
  const GOLDEN = 0x9e3779b9 | 0;
  let state = ((0x12345678 ^ Date.now()) | 0) ^ GOLDEN;
  const nz = x => ((x|0) === 0 ? GOLDEN : (x|0));
  state = nz(state);
  function xorshift32() {
    let x = state | 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    state = nz(x);
    return (x >>> 0) / UINT32;
  }
  return {
    random() { return xorshift32(); },
    setSeed(seed) { const s = Number.isFinite(seed) ? (seed >>> 0) : (Date.now() >>> 0); state = nz(((s ^ GOLDEN) | 0)); }
  };
})();

/* ====================== Math evaluator ====================== */
class Solution {
  constructor() {
    this.precedence = { "+":1, "-":1, "*":2, "/":2, "^":3 };
    this.rightAssoc = { "^": true };
    this.functions = new Set(["sin","cos"]);
    this.eps = 1e-6;
  }
  Process(input) {
    const expr = String(input ?? "").trim();
    if (!expr) return 0;
    try {
      const tokens = this.#tokenize(expr);
      const rpn = this.#toRPN(tokens, expr);
      let value = this.#evalRPN(rpn, expr);
      if (Math.abs(value) < this.eps) value = 0;
   //  log2(`process( ${input} )=${value}`);
      return value;
    } catch (e) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(e instanceof SolutionError ? e.message : String(e));
      }
      return 0;
    }
  }
  #tokenize(expr) {
  const out = [],
        isD = c => c >= "0" && c <= "9",
        isA = c => /[A-Za-z_]/.test(c),
        isAB= c => /[A-Za-z0-9_]/.test(c);

  let i = 0, prev = "START";
  const n = expr.length;

  while (i < n) {
    const ch = expr[i];

    // whitespace
    if (/\s/.test(ch)) { i++; continue; }



    // numbers (incl. .5)
    if (isD(ch) || (ch === "." && isD(expr[i+1] || ""))) {
      const s = i;
      i = this.#readNum(expr, i);
      const v = Number(expr.slice(s, i));
      if (!Number.isFinite(v)) throw new SolutionError("Non-finite numeric literal", s, expr);
      out.push({ type:"num", value:v, idx:s });
      prev = "num";
      continue;
    }

    // identifiers
    if (isA(ch)) {
      const s = i;
      i++;
      while (i < n && isAB(expr[i])) i++;
      out.push({ type:"id", value:expr.slice(s, i), idx:s });
      prev = "id";
      continue;
    }

    // parens
    if (ch === "(" || ch === ")") {
      out.push({ type:"paren", value:ch, idx:i });
      i++;
      prev = (ch === "(") ? "lparen" : "rparen";
      continue;
    }

    // operators
    if (ch==="+" || ch==="-" ||  ch==="*" || ch==="/" || ch==="^" ){
      const s = i;
      const unary = ((ch === "+" || ch === "-") && (prev === "START" || prev === "op" || prev === "lparen"));
      if (unary) {
        const sign = ch, next = expr[i+1] || "";
        // signed number
        if (isD(next) || (next === "." && isD(expr[i+2] || ""))) {
          i++;
          const ns = i;
          i = this.#readNum(expr, i);
          const v = Number(sign + expr.slice(ns, i));
          if (!Number.isFinite(v)) throw new SolutionError("Malformed signed number", s, expr);
          out.push({ type:"num", value:v, idx:s });
          prev = "num";
          continue;
        }
        // unary +/- before ( or id  => rewrite as 0 +/- <expr>
        if (next === "(" || /[A-Za-z_]/.test(next)) {
          out.push({ type:"num", value:0, idx:s });
          out.push({ type:"op", value:(sign === '-') ? '-' : '+', idx:s });
          i++;
          prev = "op";
          continue;
        }
        throw new SolutionError(`Dangling unary '${ch}'`, s, expr);
      }
      // binary operator
      out.push({ type:"op", value:ch, idx:s });
      i++;
      prev = "op";
      continue;
    }

    // otherwise
    throw new SolutionError(`+++Unexpected character '${ch}'`, i, expr);
  }

  // Turn id + '(' into func
  for (let k = 0; k < out.length - 1; k++) {
    if (out[k].type === "id" && out[k+1].type === "paren" && out[k+1].value === "(") {
      if (!this.functions.has(out[k].value)) {
        throw new SolutionError(`Unknown function '${out[k].value}'`, out[k].idx, expr);
      }
      out[k].type = "func";
    }
  }

  return out;
}
  #readNum(expr,i){
    const isD=c=>c>="0"&&c<="9"; let j=i; while(isD(expr[j])) j++;
    if (expr[j]==="."){ j++; while(isD(expr[j])) j++; }
    if (expr[j]==="e"||expr[j]==="E"){ j++; if (expr[j]==="+"||expr[j]==="-") j++; if (!isD(expr[j])) throw new SolutionError("Malformed exponent", j, expr); while(isD(expr[j])) j++; }
    return j;
  }
  #toRPN(tokens,expr){
    const out=[], st=[];
    for (const t of tokens){
      if (t.type==="num") { out.push(t); continue; }
      if (t.type==="id") { t.type="num"; t.value=Number(replacevars(t.value));out.push(t); continue;} //  throw new SolutionError(`Unknown identifier '${t.value}'`, t.idx, expr);
      if (t.type==="func"){ st.push(t); continue; }
      if (t.type==="op") {
        const p1=this.precedence[t.value]??-1, right=!!this.rightAssoc[t.value];
        while(st.length&&st[st.length-1].type==="op"){
          const p2=this.precedence[st[st.length-1].value]??-1;
          if ((right&&p1<p2)||(!right&&p1<=p2)) out.push(st.pop()); else break;
        }
        st.push(t); continue;
      }
      if (t.type==="paren" && t.value==="(") { st.push(t); continue; }
      if (t.type==="paren" && t.value===")") {
        let ok=false; while(st.length){ const top=st.pop(); if (top.type==="paren"&&top.value==="("){ ok=true; break; } out.push(top); }
        if (!ok) throw new SolutionError("Mismatched ')'", t.idx, expr);
        if (st.length && st[st.length-1].type==="func") out.push(st.pop()); continue;
      }
      throw new SolutionError(`Unknown token '${t.value}'`, t.idx, expr);
    }
    while(st.length){ const top=st.pop(); if (top.type==="paren") throw new SolutionError("Mismatched '('", top.idx, expr); out.push(top); }
    return out;
  }



  #evalRPN(rpn, expr){
    const st=[], need=(n,idx,what)=>{ if (st.length<n) throw new SolutionError(`Not enough operands for ${what}`, idx, expr); };
    for (const t of rpn){
      if (t.type==="num"){ st.push(t.value); continue; }
      if (t.type==="op"){
        need(2, t.idx, `'${t.value}'`);
        const b=st.pop(), a=st.pop();
        let v; switch(t.value){
          case "+": v=a+b; break;
          case "-": v=a-b; break;
          case "*": v=a*b; break;
          case "/": if (b===0) throw new SolutionError("Division by zero", t.idx, expr); v=a/b; break;
          case "^": v=Math.pow(a,b); break; default: throw new SolutionError(`Unknown operator '${t.value}'`, t.idx, expr);
        }
        if (!Number.isFinite(v)) throw new SolutionError(`Non-finite result v=${v}=${a} '${t.value}' ${b}`, t.idx, expr);
        st.push(v); continue;
      }
      if (t.type==="func"){
        need(1, t.idx, t.value); const x=st.pop();
        let v = (t.value==="sin") ? Math.sin(x) : Math.cos(x);
        if (!Number.isFinite(v)) throw new SolutionError(`Non-finite result for ${t.value}`, t.idx, expr);
        st.push(v); continue;
      }
      throw new SolutionError(`Bad RPN token '${t.value}'`, t.idx, expr);
    }
    if (st.length!==1) throw new SolutionError("Expression did not reduce to a single value");
    return st[0];
  }
}

/* ====================== Utilities ====================== */
function breakup(input, delimiter) {
  const out=[]; let s=String(input); let pos;
  while ((pos=s.indexOf(delimiter))!==-1) { out.push(s.substring(0,pos)); s=s.substring(pos+delimiter.length); }
  out.push(s); return out;
}

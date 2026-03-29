// Extracted from original file lines 3744-3808
            /* Substitution (instrumented) 

/* ================================================== */
function replacevars(s) {

  s = String(s);

  for (let i = variable_list.length - 1; i >= 0; i--) {
    const v = variable_list[i];

      const name = v.var_name;
      const pos = s.indexOf(name);

      if (pos !== -1) {
        const before = s;
        s = s.slice(0, pos) + String(v.value) + s.slice(pos + name.length);

        break;
      }
    
  }

  return s;
}


function replacevars_ampersand(s) {
  s = String(s);
 // ReplaceVarsDebug.group(`replacevars_ampersand IN="${s}"`);
  for (let i = 0; i < variable_list.length; i++) {
    const v = variable_list[i];
    const name = v.var_name;
    const tag = "&" + name;
    const pos = s.indexOf(tag);
//    ReplaceVarsDebug.log(`scan[${i}] tag=${tag} pos=${pos}`);
    if (pos !== -1) {
      const rnd = v.getRandom();
      const before = s;
      s = s.slice(0, pos) + String(rnd) + s.slice(pos + tag.length);
   //   ReplaceVarsDebug.log(`replaced "${tag}" at ${pos} with ${rnd}:`, `before="${before}"`, `after="${s}"`);
      break;
    }
  }
//  ReplaceVarsDebug.groupEnd();
  return s;
}

/* -------- Robust evaluation that replaces ALL identifiers with boundaries -------- */
function MathS2_js(input){
  const X = new Solution();
  let s = String(input);

s=replacevars(replacevars(replacevars(replacevars(replacevars(replacevars( replacevars(s)))))));

  const out = X.Process(s);
  if (!Number.isFinite(out)) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("[MathS2_js] Non-finite evaluation:", { input, substituted: s, out });
    }
    return 0;
  }
  return out; // return NUMBER
}

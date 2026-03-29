// Extracted from original file lines 5004-5025
            /* Pretty printers ====================== */
function formatMat4(m){
  const r = (a,b,c,d)=>`${a.toFixed(3)} ${b.toFixed(3)} ${c.toFixed(3)} ${d.toFixed(3)}`;
  return [
    r(m[0], m[4], m[8],  m[12]),
    r(m[1], m[5], m[9],  m[13]),
    r(m[2], m[6], m[10], m[14]),
    r(m[3], m[7], m[11], m[15]),
  ].join("\n");
}
function printScene(scene){
  const items = scene.getAll();
  if (!items.length) return "(scene empty)";
  let out = `Scene items: ${items.length}\n`;
  for (let i=0;i<items.length;i++){
    const it = items[i];
    out += `\n#${i} arg=${it.arg} val=${it.val}\n${formatMat4(it.transform)}\n`;
  }
  return out;
}

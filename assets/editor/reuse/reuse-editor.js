/* Browser integration shared by the original ProGen3D editors. */
window.ProGenReuse = (() => {
  'use strict';
  const records = new Map(ProGenReuseData.entries.map(item => [item.ref, item]));
  const assetRoot = new URL(document.currentScript.dataset.nativeBase || '.', document.currentScript.src || location.href);
  const active = new WeakMap();
  let factory;
  const colors = [
    ['black',[48,47,46]], ['charcoal',[72,75,76]], ['gold',[202,156,77]], ['bronze',[157,111,65]], ['copper',[179,108,71]],
    ['silver',[188,198,203]], ['steel',[133,151,161]], ['wood',[155,108,70]], ['green',[97,147,101]], ['sage',[135,158,122]],
    ['blue',[101,149,177]], ['amber',[205,144,66]], ['red',[171,77,78]], ['white',[224,220,210]], ['stone',[141,144,139]]];
  function handles(source) {
    return /^\s*@use\b/m.test(source) || /^\s*Start\s*->\s+[RG][a-f0-9]{20}\w*\b/m.test(source);
  }
  function engine() {
    if (!factory) {
      const opts={locateFile:name=>new URL(name,assetRoot).href,print(){},printErr(){}};
      factory=(async()=>{
        if(window.ProGenReuseWasmGzip){
          if(typeof DecompressionStream==='undefined')throw Error('Open this offline editor in a browser that supports gzip decompression.');
          const bytes=Uint8Array.from(atob(window.ProGenReuseWasmGzip),c=>c.charCodeAt(0));
          const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
          opts.wasmBinary=new Uint8Array(await new Response(stream).arrayBuffer());
        }
        return createProgenNative(opts);
      })().catch(err=>{factory=null;throw err;});
    }
    return factory;
  }
  async function compile(source) {
    const expanded=await ReuseLanguage.expand(source,async ref=>{
      const record=records.get(ref);
      if(!record)throw Error('Unknown reuse reference');
      return record;
    });
    const bytes=new TextEncoder().encode(expanded?.source??source);
    if(bytes.length>2*1024*1024)throw Error('The grammar exceeds the 2 MiB import limit.');
    const core=await engine();
    const pointer=core._malloc(bytes.length);
    let model;
    try {
      core.HEAPU8.set(bytes,pointer);
      model=JSON.parse(core.UTF8ToString(core._scene_compile(pointer,bytes.length,7,0)));
    } finally {core._free(pointer);}
    if(expanded)ReuseLanguage.remap(model,expanded.ranges);
    if(!model.ok || model.issues?.length) {
      const issue=model.issues?.[0];
      throw Error((issue?.span ? 'Line '+(issue.span[0]+1)+' · ' : '')+(issue?.message||'Native compile failed.'));
    }
    if(!model.floats) throw Error('No drawable geometry. Check the bearing dimensions or grammar parameters.');
    const first=core._scene_vertices()>>>2;
    const vertices=core.HEAPF32.slice(first,first+model.floats);
    return {vertices,parts:model.parts,triangles:vertices.length/24};
  }
  function cancel(renderer){active.delete(renderer);}
  async function render(source,input,scene,renderer) {
    const token={};active.set(renderer,token);
    const status=document.querySelector('#reusePicker small');
    try {
      const mesh=await compile(source);
      if(active.get(renderer)!==token || input.value.trim()!==source.trim())return null;
      scene.reuseMesh=mesh;
      renderer.setScene(scene);
      if(status)status.textContent=mesh.parts.length+' primitives · '+mesh.triangles+' triangles';
      return mesh;
    } catch(err) {
      if(active.get(renderer)!==token || input.value.trim()!==source.trim())return null;
      if(status)status.textContent='Grammar error · '+err.message;
      throw err;
    }
  }
  // The three original WebGL renderers share the same position, normal and UV buffers.
  // Normalise only the display vertices to fit their legacy camera near/far planes.
  // STL uses the original metre coordinates in mesh.vertices.
  function display(renderer,mesh,upload) {
    const {vertices:data,parts}=mesh,n=data.length/8;
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<data.length;i+=8) for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],data[i+k]);hi[k]=Math.max(hi[k],data[i+k]);}
    const center=lo.map((v,i)=>(v+hi[i])/2),scale=2.4/(Math.max(...hi.map((v,i)=>v-lo[i]))||1);
    const xyz=new Float32Array(n*3),normals=new Float32Array(n*3),uv=new Float32Array(n*2);
    for(let v=0;v<n;v++){
      for(let k=0;k<3;k++){xyz[3*v+k]=(data[8*v+k]-center[k])*scale;normals[3*v+k]=data[8*v+k+3];}
      uv[2*v]=data[8*v+6];uv[2*v+1]=data[8*v+7];
    }
    renderer.drawCalls.length=renderer.opaqueCalls.length=renderer.transpCalls.length=0;
    for(const part of parts) {
      const name=String(part.material).toLowerCase();
      const rgb=colors.find(([word])=>name.includes(word))?.[1]??[162,162,151];
      const key='reuse-'+rgb.join('-');
      if(!renderer.textures[key])renderer.setTexture(key,{w:1,h:1,data:new Uint8Array([...rgb,255])});
      const batch={tex:renderer.textures[key],first:part.first,count:part.count,alpha:1};
      renderer.drawCalls.push(batch);renderer.opaqueCalls.push(batch);
    }
    renderer.triCount=n;renderer.lineCount=0;
    upload(xyz,uv,normals,new Float32Array(0));
    renderer.target=[0,0,0];renderer.sceneCenter=[0,0,0];renderer.sceneRadius=1.8;renderer.radius=4.4;
    renderer.hasSceneBounds=true;
    renderer.updateViewCamera?.();renderer.updateGridGeometry?.();renderer.invalidate();
  }
  function exportSTL(mesh,filename) {
    const data=mesh.vertices,buf=new ArrayBuffer(84+50*mesh.triangles),view=new DataView(buf);
    view.setUint32(80,mesh.triangles,true);
    for(let t=0;t<mesh.triangles;t++){
      const i=t*24;let offset=84+50*t;
      const ax=data[i+8]-data[i],ay=data[i+9]-data[i+1],az=data[i+10]-data[i+2];
      const bx=data[i+16]-data[i],by=data[i+17]-data[i+1],bz=data[i+18]-data[i+2];
      const x=ay*bz-az*by,y=az*bx-ax*bz,z=ax*by-ay*bx,len=Math.hypot(x,y,z)||1;
      for(const value of [x/len,y/len,z/len]){view.setFloat32(offset,value,true);offset+=4;}
      for(let v=0;v<3;v++) for(let k=0;k<3;k++){view.setFloat32(offset,data[i+v*8+k],true);offset+=4;}
    }
    const a=document.createElement('a'),url=URL.createObjectURL(new Blob([buf],{type:'model/stl'}));
    a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function mount() {
    if(document.getElementById('reusePicker'))return;
    const txt=document.getElementById('src')||document.getElementById('editorSourceInput');
    const go=document.getElementById('go')||document.getElementById('editorRunBtn');
    if(!txt||!go)return;
    const panel=document.createElement('details');panel.id='reusePicker';
    panel.innerHTML='<summary>Reuse database · '+records.size+' grammars</summary><div class="reuseFields"><label>Search<input type="search" placeholder="Name, part code or reference"></label><label>Grammar<select></select></label><div class="reuseParameters"></div><div class="reuseButtons"><button type="button">Load and run</button> <button type="button">Insert import</button> <button type="button">Open full source</button></div><small role="status"></small></div>';
    const style=document.createElement('style');
    style.textContent='#reusePicker{font:14px/1.4 system-ui,sans-serif;margin:.4rem 0;padding:.3rem .6rem;color:inherit;border:1px solid #7f8b92;border-radius:5px;max-width:100%;max-height:40vh;overflow:auto}#reusePicker summary{cursor:pointer;font-weight:600}#reusePicker .reuseFields{display:grid;gap:.38rem;margin-top:.45rem}#reusePicker label{display:grid;gap:.1rem}#reusePicker input,#reusePicker select,#reusePicker button{font:inherit;min-width:0;padding:.18rem .35rem}#reusePicker .reuseParameters{display:flex;flex-wrap:wrap;gap:.35rem}#reusePicker .reuseParameters input{width:6.8em}#reusePicker small{overflow-wrap:anywhere}';
    document.head.append(style);
    const holder=txt.closest('.input-card,.editor-card')||go.closest('.card')||go.parentElement;
    const anchor=holder.querySelector?.('header')||go.parentElement;
    anchor.insertAdjacentElement('afterend',panel);
    const search=panel.querySelector('[type=search]'),select=panel.querySelector('select'),fields=panel.querySelector('.reuseParameters'),status=panel.querySelector('small');
    const buttons=Array.from(panel.querySelectorAll('button'));
    function choose(){
      const entry=records.get(select.value);fields.replaceChildren();
      buttons.forEach(button=>button.disabled=!entry);
      if(!entry){status.textContent='No matching entries.';return;}
      status.textContent=entry.ref;
      for(const param of entry.parameters){
        const label=document.createElement('label'),input=document.createElement('input');
        label.textContent=param.name+' ('+param.unit+')';input.type='number';input.step=param.integer?'1':'any';
        input.min=param.min;input.max=param.max;input.value=param.value;input.dataset.name=param.name;
        label.append(input);fields.append(label);
      }
    }
    function filter(){
      const term=search.value.trim().toLowerCase().split(/\s+/).filter(Boolean),keep=select.value;
      const entries=ProGenReuseData.entries.filter(e=>term.every(word=>(e.title+' '+e.ref+' '+e.search).toLowerCase().includes(word)));
      select.replaceChildren(...entries.map(e=>new Option(e.title+' · '+e.ref,e.ref)));
      if(entries.some(e=>e.ref===keep))select.value=keep;choose();
    }
    function apply(value,run) {
      txt.value=value;txt.dispatchEvent(new Event('input',{bubbles:true}));if(run)go.click();else txt.focus();
    }
    function declaration(alias) {
      const entry=records.get(select.value),values=[];
      for(const input of fields.querySelectorAll('input')){
        if(input.value===''||!input.checkValidity()){input.reportValidity();return null;}
        const param=entry.parameters.find(p=>p.name===input.dataset.name);
        if(input.valueAsNumber!==param.value)values.push(param.name+'='+input.valueAsNumber);
      }
      return '@use '+alias+' = "'+entry.ref+'"'+(values.length?' with '+values.join(' '):'');
    }
    buttons[0].onclick=()=>{const d=declaration('Part');if(d)apply(d+'\nStart -> Part',true);};
    buttons[1].onclick=()=>{
      let alias='Part',idx=1;
      while(new RegExp('\\b'+alias+'\\b').test(txt.value))alias='Part'+(++idx);
      const d=declaration(alias);if(!d)return;
      if(!txt.value.trim())apply(d+'\nStart -> '+alias,false);
      else {apply(d+'\n'+txt.value,false);status.textContent='Use '+alias+' in a rule to place this entry.';}
    };
    buttons[2].onclick=()=>apply(records.get(select.value).grammar,true);
    search.oninput=filter;select.onchange=choose;filter();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else setTimeout(mount,0);
  return {handles,compile,render,cancel,display,exportSTL};
})();

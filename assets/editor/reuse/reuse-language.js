// Android native-grammar import syntax. Catalogue bodies are pinned compiler output.
'use strict';
const ReuseLanguage=(()=>{
  const symbol='[A-Za-z][A-Za-z0-9_]*';
  const pinned='[a-z][a-z0-9-]*(?:/[a-z][a-z0-9-]*)+@[0-9]+\\.[0-9]+\\.[0-9]+#[a-z0-9][a-z0-9-]*';
  const declaration=new RegExp('^\\s*@use\\s+('+symbol+')\\s*=\\s*"('+pinned+')"(?:(?:\\s+with\\s+)(.*?))?\\s*(?://.*|#.*)?$');
  const number=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  const librarySymbol=/\b[RG][0-9a-f]{20}[A-Za-z0-9_]*\b/g;
  const limit=2097152, encoder=new TextEncoder();
  // Alias names also occur on rule right-hand sides, where built-in words have meaning.
  const builtins=new Set(('Start Body T S A R I G V M P X Y Z Object Interface Connect Joint Motor Switch Repeat Light Material Cube Sphere Cylinder Grid Split Time rgb material t seed').split(' '));
  function fail(line,message){const error=Error('Line '+(line+1)+' · '+message);error.reuseLine=line;throw error}
  function declarations(lines){
    const imports=[],names=new Set();
    for(const [line,s] of lines.entries()){
      if(!/^\s*@use\b/.test(s))continue;
      const m=declaration.exec(s);
      if(!m)fail(line,'Use @use Alias = "package/name@1.0.0#export" with optional name=value overrides.');
      const [,alias,ref,overrides]=m;
      if(names.has(alias)||builtins.has(alias)||/^Dbr\d+X/.test(alias))fail(line,'Duplicate or reserved reuse alias '+alias);
      const params=new Map();
      for(const kv of (overrides||'').trim().split(/\s+/).filter(Boolean)){
        const pair=/^([A-Za-z_]\w*)=(.+)$/.exec(kv);
        if(!pair||!number.test(pair[2])||!Number.isFinite(Number(pair[2])))fail(line,'Invalid numeric override '+kv);
        if(params.has(pair[1]))fail(line,'Repeated parameter '+pair[1]);
        params.set(pair[1],Number(pair[2]));
      }
      names.add(alias);imports.push({line,alias,ref,params});
    }
    return imports;
  }
  function entryBody(item,record,prefix){
    const {line,alias,params}=item;
    const [head,...rest]=record.grammar.trimEnd().split(/\r?\n/);
    const root=/^Start -> ([A-Za-z_]\w*)(?:\s*\(\s*[^()]*?\s*\))?$/.exec(head);
    if(!root)fail(line,'This database entry has an unsupported start rule.');
    const keys=new Set(record.parameters.map(p=>p.name));
    for(const name of params.keys())if(!keys.has(name))fail(line,'Unknown parameter '+name+' for '+alias);
    const args=record.parameters.map(p=>{
      const v=params.has(p.name)?params.get(p.name):p.value;
      if(!Number.isFinite(v)||v<p.min||v>p.max||(p.integer&&!Number.isInteger(v)))fail(line,p.name+' requires '+(p.integer?'a whole number':'a number')+' from '+p.min+' to '+p.max+' '+p.unit);
      return v;
    });
    // Database-compiled rules, local Object IDs and repeat counters share these hashed prefixes.
    const rename=s=>s.replace(librarySymbol,token=>prefix+token);
    const call=rename(root[1])+(args.length?' ( '+args.join(' ')+' )':'');
    return [alias+' -> '+call,...rest.map(rename)];
  }
  async function expand(source,lookup){
    if(!/^\s*@use\b/m.test(source))return null;
    if(encoder.encode(source).length>limit)throw Error('Grammar exceeds the 2 MiB mobile limit.');
    const lines=source.split('\n'),imports=declarations(lines);
    // Remove declarations without moving any authored line or column used by the native reader.
    const authored=lines.slice();for(const item of imports)authored[item.line]='';
    const visible=authored.join('\n').replace(/\/\/[^\n]*|#[^\n]*/g,'');
    if(/^\s*@/m.test(visible))fail(imports[0].line,'Database imports require native grammar rules.');
    const heads=Array.from(visible.matchAll(/^[ \t]*([A-Za-z_]\w*)[^\n]*?->/gm),m=>m[1]);
    if(!heads.length)fail(imports[0].line,'Add a native start rule, for example Start -> '+imports[0].alias);
    const ranges=[];let size=encoder.encode(authored.join('\n')).length;
    const loaded=new Map();let nextPrefix=0;
    for(const item of imports){
      if(heads.includes(item.alias))fail(item.line,'Local rule already uses '+item.alias);
      let record=loaded.get(item.ref);
      if(!record){try{record=await lookup(item.ref)}catch(error){fail(item.line,error.message+' · '+item.ref)}loaded.set(item.ref,record)}
      let prefix;do{prefix='Dbr'+(++nextPrefix)+'X'}while(visible.includes(prefix)||imports.some(i=>i.alias.startsWith(prefix)));
      const addition=entryBody(item,record,prefix);
      size+=encoder.encode(addition.join('\n')).length+1;if(size>limit)fail(item.line,'Expanded grammar exceeds the 2 MiB mobile limit.');
      ranges.push({start:authored.length,end:authored.length+addition.length,line:item.line,alias:item.alias,columns:encoder.encode(lines[item.line]).length});
      for(const s of addition)authored.push(s);
    }
    return {source:authored.join('\n'),ranges};
  }
  function remap(result,ranges){
    // Native spans are zero-based UTF-8 byte coordinates. Generated geometry selects its @use declaration.
    for(const group of [result.parts||[],result.issues||[]])for(const item of group){
      if(!Array.isArray(item.span))continue;
      const r=ranges.find(x=>item.span[0]>=x.start&&item.span[0]<x.end);
      if(r){item.span=[r.line,0,r.line,r.columns];item.reuseAlias=r.alias;}
    }
  }
  return {expand,remap};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ReuseLanguage;

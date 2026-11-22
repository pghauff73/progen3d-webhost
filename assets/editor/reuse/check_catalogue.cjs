/* Run from Node.js to compare every default @use instance with the catalogue's native vertices. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const {expand} = require('./reuse-language.js');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const code = name => fs.readFileSync(path.join(__dirname,name),'utf8');

async function main(){
  const {entries} = vm.runInNewContext(code('catalogue.js')+'\nProGenReuseData;');
  const encoded = vm.runInNewContext(code('engine-bytes.js')+'\nwindow.ProGenReuseWasmGzip;',{window:{}});
  const core = await require('./native-engine.js')({wasmBinary:zlib.gunzipSync(Buffer.from(encoded,'base64')),print(){},printErr(){}});
  const byRef = new Map(entries.map(row=>[row.ref,row]));
  assert.equal(byRef.size,entries.length);
  for(const row of entries){
    assert.equal(hash(row.grammar),row.sha256,row.ref);
    const expanded=await expand('@use TestPart = "'+row.ref+'"\nStart -> TestPart',async ref=>byRef.get(ref));
    const source=Buffer.from(expanded.source);
    const ptr=core._malloc(source.length);
    let scene;
    try{
      core.HEAPU8.set(source,ptr);
      scene=JSON.parse(core.UTF8ToString(core._scene_compile(ptr,source.length,7,0)));
    }finally{core._free(ptr);}
    assert(scene.ok && !scene.issues.length && scene.floats>0,row.ref);
    const start=core._scene_vertices();
    assert.equal(hash(core.HEAPU8.subarray(start,start+4*scene.floats)),row.geometry_sha256,row.ref);
  }
  console.log(entries.length+' source files and expanded meshes passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

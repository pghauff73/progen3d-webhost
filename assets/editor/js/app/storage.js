// Local save/load support shared across editor actions
(function(){
  'use strict';

  const getElement = (id) => document.getElementById(id);
  const sourceInput = getElement('editorSourceInput');
  const statusBadge = getElement('status');
  const fileNameInput = getElement('editorFileNameInput');
  const localSaveButton = getElement('editorLocalSaveBtn');
  const fileSelect = getElement('editorFileSelect');

  const SavesAPI = window.PG3DLocalSaves || (window.PG3DLocalSaves = {});

  function loadSaves(){
    try{
      const raw = localStorage.getItem('grammar_saves');
      if(!raw) return {};
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : {};
    }catch(e){
      console.warn('Failed to parse grammar_saves:', e);
      return {};
    }
  }

  function persistSaves(obj){
    try{
      localStorage.setItem('grammar_saves', JSON.stringify(obj, null, 2));
    }catch(e){
      console.warn('Failed to persist grammar_saves:', e);
    }
  }

  function refreshChooser(selectedId){
    if(!fileSelect) return;
    const saves = loadSaves();
    const ids = Object.keys(saves).sort((a,b)=>{
      const da = Date.parse(saves[a]?.saved_at||0) || 0;
      const db = Date.parse(saves[b]?.saved_at||0) || 0;
      return db - da || a.localeCompare(b);
    });

    fileSelect.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = ids.length ? 'Choose saved…' : 'No saved entries';
    opt0.disabled = true;
    opt0.selected = !selectedId;
    fileSelect.appendChild(opt0);

    ids.forEach(id => {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = id;
      if (selectedId && id === selectedId) o.selected = true;
      fileSelect.appendChild(o);
    });
  }

  SavesAPI.loadSaves = loadSaves;
  SavesAPI.persistSaves = persistSaves;
  SavesAPI.refreshChooser = refreshChooser;

  fileSelect?.addEventListener('change', ()=>{
    const id = fileSelect.value;
    const entry = loadSaves()[id];
    if(!entry) return;
    if (fileNameInput) fileNameInput.value = id;
    if (sourceInput){
      sourceInput.value = entry.input_grammar || '';
      sourceInput.dispatchEvent(new Event('input', { bubbles:true }));
    }
    if (statusBadge) statusBadge.textContent = 'Loaded.';
  });

  function sanitizeName(s){
    return String(s||'').toLowerCase().trim()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function genRandomId(){
    return 'id_' + Math.random().toString(36).slice(2,7) + Math.floor(Math.random()*1e6).toString(36);
  }

  function timestampCompact(){
    const d = new Date();
    const p = (n) => String(n).padStart(2,'0');
    return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  function downloadJSON(filename, text){
    const blob = new Blob([text], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
  }

  localSaveButton?.addEventListener('click', ()=>{
    const saves = loadSaves();
    const userName = sanitizeName(fileNameInput?.value);
    const base = userName || genRandomId();
    let id = base;

    if (Object.prototype.hasOwnProperty.call(saves, id)) {
      id = `${base}-${timestampCompact()}`;
    }

    saves[id] = {
      unique_name_identifier: id,
      saved_at: new Date().toISOString(),
      input_grammar: String(sourceInput?.value ?? '')
    };

    persistSaves(saves);
    refreshChooser(id);
    downloadJSON('grammar_saves.json', JSON.stringify(saves, null, 2));

    if (fileNameInput) fileNameInput.value = id;
    if (fileSelect) fileSelect.value = id;
    if (statusBadge) statusBadge.textContent = 'Saved.';
  });

  refreshChooser();
})();

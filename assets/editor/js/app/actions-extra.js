// Added in modular split: wire JSON import/export without duplicating save handlers
(function(){
  'use strict';
  const getElement = (id) => document.getElementById(id);
  const sourceInput = getElement('editorSourceInput');
  const consoleOutput = getElement('editorConsoleOutput');
  const statusBadge = getElement('status');
  const openJsonButton = getElement('editorOpenJsonBtn');
  const exportJsonButton = getElement('editorExportJsonBtn');

  function setStatus(msg) { if (statusBadge) statusBadge.textContent = msg; }
  function logInfo(msg) {
    if (!consoleOutput) return;
    const line = document.createElement('div');
    line.className = 'console-line console-info';
    line.innerHTML = `<span class="console-time">[${new Date().toLocaleTimeString()}]</span><span class="console-msg"></span>`;
    line.querySelector('.console-msg').textContent = String(msg);
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  const saveAPI = window.PG3DLocalSaves || {};
  const loadSaves = () => (typeof saveAPI.loadSaves === 'function' ? saveAPI.loadSaves() : {});
  const persistSaves = (obj) => { if (typeof saveAPI.persistSaves === 'function') saveAPI.persistSaves(obj); };
  const refreshChooser = (selectedId) => { if (typeof saveAPI.refreshChooser === 'function') saveAPI.refreshChooser(selectedId); };

  exportJsonButton?.addEventListener('click', () => {
    const saves = loadSaves();
    const blob = new Blob([JSON.stringify(saves, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'grammar_saves.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setStatus('Exported.');
    logInfo(`Exported ${Object.keys(saves).length} saved entries.`);
  });

  openJsonButton?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const imported = JSON.parse(String(evt.target?.result || '{}'));
          const current = loadSaves();
          const merged = { ...current, ...imported };
          persistSaves(merged);
          refreshChooser();
          setStatus('Imported.');
          logInfo(`Imported ${Object.keys(imported).length} saved entries.`);
        } catch (err) {
          setStatus('Import failed.');
          logInfo('Import failed: invalid JSON file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  refreshChooser();
})();

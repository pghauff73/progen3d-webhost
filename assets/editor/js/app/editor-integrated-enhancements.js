(function () {
  'use strict';

  function createNode(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function installLineGutter() {
    const codePane = document.getElementById('editorCodePane');
    const sourceInput = document.getElementById('editorSourceInput');
    if (!codePane || !sourceInput || document.getElementById('editorLineGutter')) return;

    const lineGutter = createNode('div', 'editor-line-gutter');
    lineGutter.id = 'editorLineGutter';
    codePane.insertBefore(lineGutter, codePane.firstChild);

    const hint = createNode('div', 'editor-run-hint', 'Ctrl+Enter to run');
    codePane.appendChild(hint);

    const syncGutterWidth = (count) => {
      const digits = String(Math.max(1, count)).length;
      const width = Math.max(52, 26 + (digits * 9));
      const px = `${width}px`;
      codePane.style.setProperty('--line-gutter-width', px);
      codePane.style.setProperty('--match-gutter-width', px);
    };

    const render = () => {
      const count = Math.max(1, String(sourceInput.value || '').split(/\r\n|\r|\n/).length);
      syncGutterWidth(count);
      lineGutter.innerHTML = '';
      for (let i = 1; i <= count; i += 1) {
        lineGutter.appendChild(createNode('span', '', String(i)));
      }
      lineGutter.scrollTop = sourceInput.scrollTop;
    };

    sourceInput.addEventListener('input', render);
    sourceInput.addEventListener('scroll', () => {
      lineGutter.scrollTop = sourceInput.scrollTop;
    });
    sourceInput.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        document.getElementById('editorRunBtn')?.click();
      }
    });

    window.addEventListener('resize', render);
    render();
  }

  function init() {
    if (!document.body || !document.body.classList.contains('editor-integrated-page')) return;
    installLineGutter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

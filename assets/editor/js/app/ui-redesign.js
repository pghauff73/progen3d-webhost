(function(){
  'use strict';

  const ICONS = {
    code: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 9 4 12l4 3"/><path d="m16 9 4 3-4 3"/><path d="m14 4-4 16"/></svg>',
    cube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 8 4.5v10L12 22l-8-5.5v-10Z"/><path d="m12 22 0-9.5"/><path d="M20 6.5 12 12 4 6.5"/></svg>',
    terminal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 17 4-4-4-4"/><path d="M12 19h8"/><rect x="2.5" y="4" width="19" height="16" rx="2"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 6 10 6-10 6z"/></svg>',
    dice: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h.01"/><path d="M15 15h.01"/><path d="M9 15h.01"/><path d="M15 9h.01"/></svg>',
    broom: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 4 5 5"/><path d="M6 14 3 21l7-3 10-10-4-4Z"/></svg>',
    folder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/></svg>',
    save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20h14a1 1 0 0 0 1-1V8l-4-4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1Z"/><path d="M8 4v6h8V4"/><path d="M8 20v-6h8v6"/></svg>',
    wrap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h11a4 4 0 1 1 0 8H9"/><path d="m7 13 2 2-2 2"/><path d="M3 17h4"/></svg>',
    export: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
    package: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 8 4-8 4-8-4 8-4Z"/><path d="M4 10l8 4 8-4"/><path d="M4 10v8l8 4 8-4v-8"/></svg>',
    orbit: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.3"/><path d="M6 5.5c2-1.5 10-1.5 12 1 2.1 2.7-1.3 9.1-5.5 11.5"/><path d="M5.3 14c-1.2-2.2-.8-5.1 1.1-7 2.5-2.5 8.7-1.8 12.5 2"/></svg>',
    grid: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="M4 10h16"/><path d="M4 16h16"/><path d="M10 4v16"/><path d="M16 4v16"/></svg>',
    axis: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20 12 12"/><path d="M12 12 20 20"/><path d="M12 12V4"/><path d="m12 4 2 2"/><path d="m12 4-2 2"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12"/><path d="M8 12h12"/><path d="M8 18h12"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10 5"/><path d="M14 11a5 5 0 0 0-7.07 0L4.8 13.12a5 5 0 0 0 7.07 7.07L14 19"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>'
  };

  function icon(name) {
    return ICONS[name] || ICONS.code;
  }

  function decorateButton(id, cfg) {
    const el = document.getElementById(id);
    if (!el) return;
    const label = cfg.label || el.textContent.trim();
    el.innerHTML = '<span class="button-icon">' + icon(cfg.icon) + '</span><span class="btn-label"' + (cfg.compactLabel ? ' data-compact="true"' : '') + '>' + label + '</span>';
    el.setAttribute('aria-label', label);
    el.title = label;
    if (cfg.compact) el.classList.add('compact');
    if (cfg.variant) el.classList.add(cfg.variant);
  }

  function decorateTitles() {
    const mappings = [
      ['.input-card h2', 'code'],
      ['.viewer-card h2', 'cube'],
      ['.output-card h2', 'terminal']
    ];
    mappings.forEach(([selector, iconName]) => {
      const el = document.querySelector(selector);
      if (!el || el.querySelector('.section-icon')) return;
      const badge = document.createElement('span');
      badge.className = 'section-icon';
      badge.innerHTML = icon(iconName);
      el.insertBefore(badge, el.firstChild);
    });
  }

  function init() {
    document.body.classList.add('ui-redesign-active');

    decorateButton('editorLocalSaveBtn', { icon: 'save', label: 'Save', variant: 'secondary', compactLabel: true });
    decorateButton('editorWordWrapBtn', { icon: 'wrap', label: 'Wrap' });
    decorateButton('editorRunBtn', { icon: 'play', label: 'Run' });
    decorateButton('editorClearBtn', { icon: 'broom', label: 'Clear', compactLabel: true });
    decorateButton('editorOpenJsonBtn', { icon: 'folder', label: 'Open', compactLabel: true });
    decorateButton('editorExportJsonBtn', { icon: 'export', label: 'JSON', variant: 'secondary', compactLabel: true });
    decorateButton('editorExportStlBtn', { icon: 'package', label: 'STL' });
    decorateButton('editorOrbitToggleBtn', { icon: 'orbit', label: 'Auto Orbit', compactLabel: true });

    decorateTitles();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

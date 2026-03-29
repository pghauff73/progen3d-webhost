
(function () {
  "use strict";

  const EXAMPLES = {
    "Load Example…": "",
    "Starter cube": "Start -> I ( Cube brushedAluminum 0.5 )",
    "Parameterized tower": "Start -> Tower( 2.2 0.35 )\nTower( h shell ) -> S ( 1 h 1 ) I ( CubeY grayStone shell ) [ T ( 0 h 0 ) Cap( shell 0.18 ) ]\nCap( shell glow ) -> S ( shell * 2 glow shell * 2 ) I ( Cube chromeSurface glow )",
    "Conditional branch": "Start -> Branch( 0.7 )\nBranch( amount ) -> ?( amount > 0.5 ) Tall : Short\nTall -> T ( 0 1 0 ) I ( Cube chromeSurface 0.3 )\nShort -> T ( 0 0.4 0 ) I ( Cube brushedAluminum 0.3 )",
    "Axis deform": "Start -> DSX ( 1.2 1 1 ) DTX ( 0.15 0 0 ) DSY ( 1 0.85 1 ) DTY ( 0 0.2 0 ) DSZ ( 1 1 1.15 ) DTZ ( 0 0 0.18 ) I ( CubeZ brushedAluminum 0.55 )"
  };

  function query(selector, root) {
    return (root || document).querySelector(selector);
  }

  function createNode(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function setControlLabel(button, label) {
    if (!button) return;
    button.textContent = label;
    button.setAttribute("aria-label", label);
    button.title = label;
  }

  function moveNodes(target, nodes) {
    nodes.forEach((node) => {
      if (node && target) target.appendChild(node);
    });
  }

  function buildTopbar() {
    if (query(".match-topbar")) return;

    const appShell = query(".app-shell");
    if (!appShell) return;

    document.body.classList.add("layout-match-active");

    const topbar = createNode("div", "match-topbar");
    const left = createNode("div", "match-topbar__left");
    const right = createNode("div", "match-topbar__right");

    topbar.appendChild(left);
    topbar.appendChild(right);
    document.body.insertBefore(topbar, appShell);

    const runtimeLabel = createNode("div", "match-runtime-label");
    const runtimeTitle = createNode("strong", "", "Inline modular editor");
    const runtimeMeta = createNode("span", "", "BNF examples, viewer controls, export, and the live grammar runtime");
    runtimeLabel.appendChild(runtimeTitle);
    runtimeLabel.appendChild(runtimeMeta);
    left.appendChild(runtimeLabel);

    const wordWrapButton = document.getElementById("editorWordWrapBtn");
    const openJsonButton = document.getElementById("editorOpenJsonBtn");
    const localSaveButton = document.getElementById("editorLocalSaveBtn");
    const utility = createNode("div", "match-topbar__utility");
    moveNodes(utility, [localSaveButton, wordWrapButton, openJsonButton]);
    if (utility.children.length) {
      Array.from(utility.children).forEach((btn) => btn.classList.add("match-icon-btn"));
      right.appendChild(utility);
    }
  }

  function buildEditorToolbar() {
    const toolbar = document.getElementById("toolbar");
    if (!toolbar || toolbar.dataset.layoutTarget === "true") return;

    toolbar.classList.add("match-toolbar");

    const actions = createNode("div", "match-editor-controls");
    const utility = createNode("div", "match-editor-utility");

    const exampleSelect = createNode("select", "select-input match-example-select");
    exampleSelect.id = "matchExampleChooser";

    Object.keys(EXAMPLES).forEach((label, i) => {
      const opt = document.createElement("option");
      opt.value = label;
      opt.textContent = label;
      if (i === 0) opt.selected = true;
      exampleSelect.appendChild(opt);
    });

    exampleSelect.addEventListener("change", () => {
      const sourceInput = document.getElementById("editorSourceInput");
      const value = EXAMPLES[exampleSelect.value];
      if (!sourceInput || !value) return;
      sourceInput.value = value;
      sourceInput.dispatchEvent(new Event("input", { bubbles: true }));
      sourceInput.focus();
    });

    moveNodes(actions, [
      document.getElementById("editorRunBtn"),
      document.getElementById("editorClearBtn")
    ]);

    const fileNameInput = document.getElementById("editorFileNameInput");
    if (fileNameInput) {
      fileNameInput.placeholder = "save_name";
      utility.appendChild(fileNameInput);
    }

    const fileSelect = document.getElementById("editorFileSelect");
    if (fileSelect) {
      const placeholder = fileSelect.querySelector('option[value=""]');
      if (placeholder) placeholder.textContent = "Load Saved…";
      utility.appendChild(fileSelect);
    }

    utility.appendChild(exampleSelect);

    toolbar.innerHTML = "";
    toolbar.appendChild(actions);
    toolbar.appendChild(utility);
    toolbar.dataset.layoutTarget = "true";
  }

  function syncOrbitLabel() {
    const orbitToggle = document.getElementById("editorOrbitToggleBtn");
    if (!orbitToggle) return;

    const raw = String(orbitToggle.textContent || "").toLowerCase();
    const isOn = raw.includes("pause") || raw.includes("on");

    orbitToggle.classList.toggle("is-off", !isOn);
    orbitToggle.innerHTML = "";

    const dot = createNode("span", "match-orbit-dot");
    const label = createNode("span", "", "Auto Orbit: " + (isOn ? "On" : "Off"));

    orbitToggle.appendChild(dot);
    orbitToggle.appendChild(label);
  }

  function buildViewerToolbar() {
    const viewerToolbar = document.querySelector(".editor-viewer-toolbar");
    if (!viewerToolbar || viewerToolbar.dataset.layoutTarget === "true") return;

    viewerToolbar.classList.add("match-viewer-actions");
    viewerToolbar.innerHTML = "";

    const exportJsonBtn = document.getElementById("editorExportJsonBtn");
    const exportStlBtn = document.getElementById("editorExportStlBtn");
    const fitViewBtn = document.getElementById("editorFitViewBtn");
    const resetViewBtn = document.getElementById("editorResetViewBtn");
    const orbitToggle = document.getElementById("editorOrbitToggleBtn");

    if (exportJsonBtn) {
      exportJsonBtn.classList.add("match-softlink");
      setControlLabel(exportJsonBtn, "JSON");
      viewerToolbar.appendChild(exportJsonBtn);
    }

    if (exportStlBtn) {
      exportStlBtn.classList.add("match-softlink");
      setControlLabel(exportStlBtn, "STL");
      viewerToolbar.appendChild(exportStlBtn);
    }

    [fitViewBtn, resetViewBtn].forEach((btn) => {
      if (btn) viewerToolbar.appendChild(btn);
    });

    if (orbitToggle) {
      viewerToolbar.appendChild(orbitToggle);
      syncOrbitLabel();
      orbitToggle.addEventListener("click", () => setTimeout(syncOrbitLabel, 0));
    }

    viewerToolbar.dataset.layoutTarget = "true";
  }

  function simplifyTitles() {
    const map = [
      [".input-card h2", "GRAMMAR INPUT"],
      [".viewer-card h2", "SCENE VIEWER"],
      [".output-card h2", "CONSOLE"]
    ];

    map.forEach(([selector, text]) => {
      const node = query(selector);
      if (node) node.textContent = text;
    });
  }

  function installLineGutter() {
    const codePane = document.getElementById("editorCodePane");
    const sourceInput = document.getElementById("editorSourceInput");
    if (!codePane || !sourceInput || document.getElementById("editorLineGutter")) return;

    const lineGutter = createNode("div", "editor-line-gutter");
    lineGutter.className = "editor-line-gutter";
    lineGutter.id = "editorLineGutter";
    codePane.insertBefore(lineGutter, codePane.firstChild);

    const hint = createNode("div", "editor-run-hint", "Ctrl+Enter to run");
    codePane.appendChild(hint);

    const syncGutterWidth = (count) => {
      const digits = String(Math.max(1, count)).length;
      const width = Math.max(52, 26 + (digits * 9));
      const px = `${width}px`;
      codePane.style.setProperty("--line-gutter-width", px);
      codePane.style.setProperty("--match-gutter-width", px);
    };

    const render = () => {
      const count = Math.max(1, String(sourceInput.value || "").split(/\r\n|\r|\n/).length);
      syncGutterWidth(count);
      lineGutter.innerHTML = "";
      for (let i = 1; i <= count; i += 1) {
        lineGutter.appendChild(createNode("span", "", String(i)));
      }
      lineGutter.scrollTop = sourceInput.scrollTop;
    };

    sourceInput.addEventListener("input", render);
    sourceInput.addEventListener("scroll", () => {
      lineGutter.scrollTop = sourceInput.scrollTop;
    });

    sourceInput.addEventListener("keydown", (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
        ev.preventDefault();
        document.getElementById("editorRunBtn")?.click();
      }
    });

    window.addEventListener("resize", render);
    render();
  }

  function init() {
    buildTopbar();
    simplifyTitles();
    buildEditorToolbar();
    buildViewerToolbar();
    installLineGutter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

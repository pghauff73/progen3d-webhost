(function () {
  "use strict";

  const STORAGE_KEY = "progen3d:resizable-layout:v1";
  const MOBILE_BREAKPOINT = 1100;
  const SPLITTER_SIZE = 10;
  const MIN_LEFT = 420;
  const MIN_RIGHT = 320;
  const MIN_VIEWER = 280;
  const MIN_CONSOLE = 150;

  function px(n) {
    return `${Math.round(n)}px`;
  }

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function getWrapMetrics(wrap) {
    const rect = wrap.getBoundingClientRect();
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const availableHeight = Math.max(320, viewportHeight - rect.top);
    return {
      width: Math.max(300, wrap.clientWidth),
      height: availableHeight
    };
  }

  function applyWorkspaceHeight(wrap) {
    const rect = wrap.getBoundingClientRect();
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const availableHeight = Math.max(320, viewportHeight - rect.top);
    wrap.style.setProperty("--match-workspace-h", px(availableHeight));
    return availableHeight;
  }

  function computeCompactLevel(wrap) {
    const viewportWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const sidebar = document.querySelector(".editor-sidebar");
    const topbar = document.querySelector(".editor-topbar");
    let level = 0;

    if (viewportWidth <= 1500 || viewportHeight <= 940) level = 1;
    if (viewportWidth <= 1280 || viewportHeight <= 820) level = 2;
    if (viewportWidth <= 1040 || viewportHeight <= 700) level = 3;

    if (sidebar && sidebar.scrollHeight > sidebar.clientHeight + 24) {
      level = Math.min(3, level + 1);
    }

    if (topbar && topbar.scrollHeight > topbar.clientHeight + 8) {
      level = Math.min(3, level + 1);
    }

    document.body.setAttribute("data-editor-compact-level", String(level));
    wrap.setAttribute("data-editor-compact-level", String(level));
    return level;
  }

  function setSidebarState(collapsed, open) {
    document.body.setAttribute("data-sidebar-collapsed", collapsed ? "1" : "0");
    document.body.setAttribute("data-sidebar-open", collapsed && open ? "1" : "0");

    const scrim = document.getElementById("editorSidebarScrim");
    if (scrim) {
      scrim.hidden = !(collapsed && open);
    }
  }

  function setSecondarySidebarState(collapsed, open) {
    document.body.setAttribute("data-secondary-collapsed", collapsed ? "1" : "0");
    document.body.setAttribute("data-secondary-open", collapsed && open ? "1" : "0");

    const scrim = document.getElementById("editorSecondaryScrim");
    if (scrim) {
      scrim.hidden = !(collapsed && open);
    }
  }

  function setTopnavState(open) {
    document.body.setAttribute("data-topnav-open", open ? "1" : "0");
    const scrim = document.getElementById("editorTopbarScrim");
    if (scrim) {
      scrim.hidden = !open;
    }
  }

  function syncSidebarMode(wrap) {
    const level = Number(document.body.getAttribute("data-editor-compact-level") || "0");
    const collapsed = level >= 2;
    const previousCollapsed = document.body.getAttribute("data-sidebar-collapsed") === "1";
    const isOpen = document.body.getAttribute("data-sidebar-open") === "1";

    if (!collapsed) {
      setSidebarState(false, true);
      return;
    }

    if (!previousCollapsed) {
      setSidebarState(true, false);
      return;
    }

    setSidebarState(true, isOpen);
  }

  function syncSecondarySidebarMode(wrap) {
    const level = Number(document.body.getAttribute("data-editor-compact-level") || "0");
    const collapsed = level >= 1;
    const previousCollapsed = document.body.getAttribute("data-secondary-collapsed") === "1";
    const isOpen = document.body.getAttribute("data-secondary-open") === "1";

    if (!collapsed) {
      setSecondarySidebarState(false, true);
      return;
    }

    if (!previousCollapsed) {
      setSecondarySidebarState(true, false);
      return;
    }

    setSecondarySidebarState(true, isOpen);
  }

  function applyState(wrap, state, fromResize) {
    const viewportWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const isMobile = viewportWidth <= MOBILE_BREAKPOINT || viewportHeight <= 740;
    wrap.classList.toggle("resizable-layout-mobile", isMobile);
    wrap.classList.toggle("resizable-layout-compact", viewportWidth <= 1380 || viewportHeight <= 900);
    computeCompactLevel(wrap);
    syncSidebarMode(wrap);
    syncSecondarySidebarMode(wrap);

    const metrics = getWrapMetrics(wrap);
    const totalWidth = metrics.width - SPLITTER_SIZE;
    const totalRightHeight = metrics.height - SPLITTER_SIZE;

    if (isMobile) {
      wrap.style.removeProperty("--match-left-pane-w");
      wrap.style.removeProperty("--match-right-pane-w");
      wrap.style.removeProperty("--match-viewer-pane-h");
      wrap.style.removeProperty("--match-console-pane-h");
      return;
    }

    let left = Number(state.leftPx);
    let right = Number(state.rightPx);
    let viewer = Number(state.viewerPx);
    let consoleH = Number(state.consolePx);

    if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0 || !fromResize) {
      left = Math.round(totalWidth * 0.64);
      right = totalWidth - left;
    }

    if (!Number.isFinite(viewer) || !Number.isFinite(consoleH) || viewer <= 0 || consoleH <= 0 || !fromResize) {
      viewer = Math.round(totalRightHeight * 0.72);
      consoleH = totalRightHeight - viewer;
    }

    left = clamp(left, MIN_LEFT, totalWidth - MIN_RIGHT);
    right = totalWidth - left;

    viewer = clamp(viewer, MIN_VIEWER, totalRightHeight - MIN_CONSOLE);
    consoleH = totalRightHeight - viewer;

    wrap.style.setProperty("--match-left-pane-w", px(left));
    wrap.style.setProperty("--match-right-pane-w", px(right));
    wrap.style.setProperty("--match-viewer-pane-h", px(viewer));
    wrap.style.setProperty("--match-console-pane-h", px(consoleH));

    state.leftPx = left;
    state.rightPx = right;
    state.viewerPx = viewer;
    state.consolePx = consoleH;
    saveState(state);
  }

  function installSplitters(wrap) {
    const vSplit = $(".layout-splitter-v", wrap);
    const hSplit = $(".layout-splitter-h", wrap);
    if (!vSplit || !hSplit) return;

    const state = loadState();
    applyWorkspaceHeight(wrap);
    applyState(wrap, state, true);

    function beginDrag(kind, ev) {
      const viewportWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
      const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      if (viewportWidth <= MOBILE_BREAKPOINT || viewportHeight <= 740) return;

      ev.preventDefault();
      const startX = ev.clientX;
      const startY = ev.clientY;
      const startState = loadState();
      const metrics = getWrapMetrics(wrap);

      const startLeft = Number(startState.leftPx) || Math.round((metrics.width - SPLITTER_SIZE) * 0.64);
      const startViewer = Number(startState.viewerPx) || Math.round((metrics.height - SPLITTER_SIZE) * 0.72);

      document.body.classList.add("layout-resizing");

      function onMove(moveEv) {
        if (kind === "vertical") {
          const totalWidth = metrics.width - SPLITTER_SIZE;
          const left = clamp(startLeft + (moveEv.clientX - startX), MIN_LEFT, totalWidth - MIN_RIGHT);
          const right = totalWidth - left;
          state.leftPx = left;
          state.rightPx = right;
        } else {
          const totalHeight = metrics.height - SPLITTER_SIZE;
          const viewer = clamp(startViewer + (moveEv.clientY - startY), MIN_VIEWER, totalHeight - MIN_CONSOLE);
          const consoleH = totalHeight - viewer;
          state.viewerPx = viewer;
          state.consolePx = consoleH;
        }

        applyState(wrap, state, true);
        window.dispatchEvent(new Event("resize"));
      }

      function onUp() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.body.classList.remove("layout-resizing");
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp, { once: true });
    }

    vSplit.addEventListener("pointerdown", (ev) => beginDrag("vertical", ev));
    hSplit.addEventListener("pointerdown", (ev) => beginDrag("horizontal", ev));

    let resizeTimer = null;
    function handleViewportResize() {
      applyWorkspaceHeight(wrap);
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const current = loadState();
        applyState(wrap, current, true);
        window.dispatchEvent(new Event("resize"));
      }, 60);
    }

    window.addEventListener("resize", handleViewportResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportResize);
      window.visualViewport.addEventListener("scroll", handleViewportResize);
    }
  }

  function installSidebarHover(wrap) {
    const rail = document.getElementById("editorSidebarRail");
    const sidebar = document.getElementById("editorSidebar");
    const scrim = document.getElementById("editorSidebarScrim");
    let closeTimer = null;

    function scheduleClose() {
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        if (document.body.getAttribute("data-sidebar-collapsed") === "1") {
          setSidebarState(true, false);
        }
      }, 120);
    }

    function cancelClose() {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
    }

    rail?.addEventListener("mouseenter", () => {
      if (document.body.getAttribute("data-sidebar-collapsed") === "1") {
        cancelClose();
        setSidebarState(true, true);
      }
    });

    rail?.addEventListener("mouseleave", () => {
      if (document.body.getAttribute("data-sidebar-collapsed") === "1") {
        scheduleClose();
      }
    });

    sidebar?.addEventListener("mouseenter", cancelClose);
    sidebar?.addEventListener("mouseleave", () => {
      if (document.body.getAttribute("data-sidebar-collapsed") === "1") {
        scheduleClose();
      }
    });

    scrim?.addEventListener("click", () => {
      if (document.body.getAttribute("data-sidebar-collapsed") === "1") {
        cancelClose();
        setSidebarState(true, false);
      }
    });
  }

  function installSecondarySidebarHover(wrap) {
    const rail = document.getElementById("editorSecondaryRail");
    const sidebar = document.getElementById("editorSecondarySidebar");
    const scrim = document.getElementById("editorSecondaryScrim");
    let closeTimer = null;

    function scheduleClose() {
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        if (document.body.getAttribute("data-secondary-collapsed") === "1") {
          setSecondarySidebarState(true, false);
        }
      }, 120);
    }

    function cancelClose() {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
    }

    rail?.addEventListener("mouseenter", () => {
      if (document.body.getAttribute("data-secondary-collapsed") === "1") {
        cancelClose();
        setSecondarySidebarState(true, true);
      }
    });

    rail?.addEventListener("mouseleave", () => {
      if (document.body.getAttribute("data-secondary-collapsed") === "1") {
        scheduleClose();
      }
    });

    sidebar?.addEventListener("mouseenter", cancelClose);
    sidebar?.addEventListener("mouseleave", () => {
      if (document.body.getAttribute("data-secondary-collapsed") === "1") {
        scheduleClose();
      }
    });

    scrim?.addEventListener("click", () => {
      if (document.body.getAttribute("data-secondary-collapsed") === "1") {
        cancelClose();
        setSecondarySidebarState(true, false);
      }
    });
  }

  function installTopbarHover() {
    const rail = document.getElementById("editorTopbarRail");
    const bar = document.querySelector(".editor-topbar");
    const scrim = document.getElementById("editorTopbarScrim");
    let closeTimer = null;

    function scheduleClose() {
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(() => setTopnavState(false), 120);
    }

    function cancelClose() {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
    }

    rail?.addEventListener("mouseenter", () => {
      cancelClose();
      setTopnavState(true);
    });

    rail?.addEventListener("mouseleave", scheduleClose);
    bar?.addEventListener("mouseenter", cancelClose);
    bar?.addEventListener("mouseleave", scheduleClose);
    scrim?.addEventListener("click", () => {
      cancelClose();
      setTopnavState(false);
    });
  }

  function triggerInitialFit() {
    let tries = 0;
    const maxTries = 30;

    function attempt() {
      tries += 1;
      const btn = document.getElementById("editorFitViewBtn");
      if (btn) {
        btn.click();
        return;
      }
      if (tries < maxTries) {
        setTimeout(attempt, 250);
      }
    }

    setTimeout(attempt, 350);
  }

  function init() {
    const wrap = document.querySelector(".editor-workspace");
    if (!wrap) return;
    setTopnavState(false);
    installSplitters(wrap);
    computeCompactLevel(wrap);
    syncSidebarMode(wrap);
    syncSecondarySidebarMode(wrap);
    installTopbarHover();
    installSidebarHover(wrap);
    installSecondarySidebarHover(wrap);
    triggerInitialFit();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

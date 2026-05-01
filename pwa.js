if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

(function setupMobileFullscreen() {
  const landscapeMobileQuery = matchMedia("(orientation: landscape) and (max-height: 540px)");
  const isLandscapeMobile = () => landscapeMobileQuery.matches;

  const docEl = document.documentElement;
  const requestFn =
    docEl.requestFullscreen ||
    docEl.webkitRequestFullscreen ||
    docEl.msRequestFullscreen ||
    null;
  const exitFn =
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.msExitFullscreen ||
    null;

  const fsElement = () =>
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement ||
    null;

  const enter = () => {
    if (!requestFn) return Promise.reject(new Error("no fullscreen api"));
    if (fsElement()) return Promise.resolve();
    let result;
    try {
      result = requestFn.call(docEl);
    } catch (err) {
      return Promise.reject(err);
    }
    return result && typeof result.then === "function" ? result : Promise.resolve();
  };

  const exit = () => {
    if (!exitFn || !fsElement()) return;
    try {
      const result = exitFn.call(document);
      if (result && typeof result.catch === "function") result.catch(() => {});
    } catch (_) {}
  };

  // Floating fallback button
  let button = null;
  const ensureButton = () => {
    if (button) return button;
    button = document.createElement("button");
    button.id = "fsToggleButton";
    button.type = "button";
    button.setAttribute("aria-label", "切換全螢幕");
    button.textContent = "⛶";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (fsElement()) {
        exit();
      } else {
        enter().catch(() => {});
      }
    });
    (document.body || document.documentElement).appendChild(button);
    return button;
  };

  const refreshButton = () => {
    if (!requestFn) {
      // No fullscreen API (iPhone Safari) — leave button hidden; rely on PWA install.
      if (button) button.hidden = true;
      return;
    }
    const btn = ensureButton();
    if (!isLandscapeMobile()) {
      btn.hidden = true;
      return;
    }
    btn.hidden = false;
    btn.classList.toggle("is-active", !!fsElement());
    btn.textContent = fsElement() ? "⛶" : "⛶";
  };

  const onFirstGesture = () => {
    if (!isLandscapeMobile()) return;
    if (fsElement()) return;
    if (!requestFn) return;
    enter().catch(() => {
      // First-gesture call can still be rejected on some browsers; fall back to button.
      refreshButton();
    });
  };

  // Document-level gesture listeners (will fire even if children don't stop bubbling).
  ["pointerdown", "touchend", "click"].forEach((evt) => {
    document.addEventListener(evt, onFirstGesture, true);
  });

  ["fullscreenchange", "webkitfullscreenchange", "msfullscreenchange"].forEach((evt) => {
    document.addEventListener(evt, refreshButton);
  });

  if (typeof landscapeMobileQuery.addEventListener === "function") {
    landscapeMobileQuery.addEventListener("change", refreshButton);
  } else if (typeof landscapeMobileQuery.addListener === "function") {
    landscapeMobileQuery.addListener(refreshButton);
  }
  window.addEventListener("orientationchange", () => setTimeout(refreshButton, 50));
  window.addEventListener("resize", refreshButton);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshButton);
  } else {
    refreshButton();
  }
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

(function setupMobileFullscreen() {
  const isLandscapeMobile = () =>
    matchMedia("(orientation: landscape) and (max-height: 540px)").matches;

  let requested = false;
  const requestFullscreen = () => {
    if (requested) return;
    if (!isLandscapeMobile()) return;
    if (document.fullscreenElement) {
      requested = true;
      return;
    }
    const target = document.documentElement;
    const fn =
      target.requestFullscreen ||
      target.webkitRequestFullscreen ||
      target.msRequestFullscreen;
    if (!fn) return;
    try {
      const result = fn.call(target);
      if (result && typeof result.catch === "function") {
        result.catch(() => {});
      }
      requested = true;
    } catch (_) {
      /* user gesture required or unsupported — silently ignore */
    }
  };

  const onFirstGesture = () => {
    requestFullscreen();
  };

  ["pointerdown", "touchend", "click", "keydown"].forEach((evt) => {
    document.addEventListener(evt, onFirstGesture, { once: false, passive: true });
  });

  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement) requested = true;
  });
})();

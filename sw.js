const CACHE_NAME = "baseball-duel-v17";
const STATIC_ASSETS = [
  "./",
  "./styles.css",
  "./constants.js",
  "./pitcherLines.js",
  "./voice.js",
  "./gameRules.js",
  "./render.js",
  "./input.js",
  "./pwa.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./voice/manifest.json",
  // voice:begin(由 scripts/sync-voice-sw.mjs 照 voice/ 目錄重生,不要手抄)
  "./voice/11gww7c.mp3",
  "./voice/11s9gc8.mp3",
  "./voice/130cy90.mp3",
  "./voice/146r27s.mp3",
  "./voice/14p2n0.mp3",
  "./voice/14rf3ah.mp3",
  "./voice/156zf1s.mp3",
  "./voice/15h8hz0.mp3",
  "./voice/15ke5xc.mp3",
  "./voice/186pqdc.mp3",
  "./voice/18u9bx8.mp3",
  "./voice/1bj2kob.mp3",
  "./voice/1bs9in8.mp3",
  "./voice/1btdo4w.mp3",
  "./voice/1bxk45c.mp3",
  "./voice/1c3sec3.mp3",
  "./voice/1e07uqc.mp3",
  "./voice/1emwjts.mp3",
  "./voice/1fvckos.mp3",
  "./voice/1j2r6ho.mp3",
  "./voice/1j4l6ec.mp3",
  "./voice/1ng6gv8.mp3",
  "./voice/1q27ug8.mp3",
  "./voice/1rfukvw.mp3",
  "./voice/1ribmwu.mp3",
  "./voice/1ux02s.mp3",
  "./voice/1w90v54.mp3",
  "./voice/1y3y1io.mp3",
  "./voice/2p0y84.mp3",
  "./voice/2thtjg.mp3",
  "./voice/2yw3uo.mp3",
  "./voice/5hzyu0.mp3",
  "./voice/5qrcw.mp3",
  "./voice/8f90ps.mp3",
  "./voice/91ykzk.mp3",
  "./voice/93l8ii.mp3",
  "./voice/9doras.mp3",
  "./voice/fzmew5.mp3",
  "./voice/h3ih3k.mp3",
  "./voice/h7jagc.mp3",
  "./voice/iotvw8.mp3",
  "./voice/lw2zjy.mp3",
  "./voice/lxw9lm.mp3",
  "./voice/mwjzyc.mp3",
  "./voice/mz1ovi.mp3",
  "./voice/n52fug.mp3",
  "./voice/n6o3vw.mp3",
  "./voice/tkofh7.mp3",
  "./voice/xh2fru.mp3",
  "./voice/yukan8.mp3",
  // voice:end
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.all(STATIC_ASSETS.map((u) => cache.add(u).catch(() => null))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

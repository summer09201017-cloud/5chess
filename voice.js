// voice.js —— 投手人聲 runtime(預烤 mp3 優先;缺檔 = 只出字幕、靜默)。
// ★ 播報人聲鐵律(2026-07-10 使用者拍板):一律預烤 mp3 神經人聲,絕不用 Web Speech 機器聲 fallback。
// 全域 VOICE:say(text, unlocked) / setEnabled(v) / isEnabled()。同一句連續只唸一次(renderHUD 每次狀態變動都會叫)。
(function (root) {
  const STORAGE_KEY = "baseballDuel.pitcherVoice";
  let manifest = null;
  let current = null;
  let lastSay = null;
  let enabled = true;
  try {
    enabled = root.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch (error) {
    enabled = true;
  }

  if (typeof fetch === "function") {
    fetch("./voice/manifest.json")
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        manifest = data || {};
      })
      .catch(() => {
        manifest = {};
      });
  } else {
    manifest = {};
  }

  function say(text, unlocked) {
    if (!text) {
      lastSay = null; // 靜默句:重設,下一句就算跟上一句相同也會再唸(例如連續兩次三振)
      return;
    }
    if (text === lastSay) return;
    if (!unlocked || !manifest) return; // 還沒點過畫面(瀏覽器不准播)或 manifest 還沒到:不記,之後補唸
    lastSay = text;
    if (!enabled) return;
    const path = manifest[root.pitcherVoiceKey ? root.pitcherVoiceKey(text) : ""];
    if (!path) return; // 沒烤過的句子 = 只出字幕
    try {
      if (current) current.pause();
      current = new Audio("./" + path);
      current.volume = 0.95;
      const played = current.play();
      if (played && played.catch) played.catch(() => {});
    } catch (error) {
      // 播不出來就算了,畫面文字照出
    }
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled && current) {
      current.pause();
      current = null;
    }
    try {
      root.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    } catch (error) {
      // 私密模式存不了就只管這一次
    }
  }

  root.VOICE = { say, setEnabled, isEnabled: () => enabled };
})(typeof window !== "undefined" ? window : globalThis);

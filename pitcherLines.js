// pitcherLines.js —— 「讓投手說話」詞庫(2026-10-07 使用者拍板:九局熱戰的 AI 播報改成投手第一人稱開口)。
// off = 你進攻(對面的 AI 投手在跟你說話)、def = 你防守(站在投手丘上的是你的投手、你的隊友)。
// 每條 {sub, say}:sub = 畫面文字({n} 會被換成局數或秒數)、say = 唸稿(固定句,預烤 mp3;null = 只出字、不唸)。
// 改台詞 ⇒ 改這裡 → node scripts/gen-voice.mjs 烤 mp3 → node scripts/sync-voice-sw.mjs 更新 sw.js 清單。
// 本檔「script + CJS 兩用」:瀏覽器掛全域 PITCHER_LINES / PITCHER_BANNER_KEYS / PITCHER_REPLAY_KEYS /
// PITCHER_PHRASES / pitcherVoiceKey;node 烤製與檢查用 require。
(function (root) {
  const L = (sub, say) => ({ sub, say: say === undefined ? sub : say });
  const BOTH = (sub, say) => ({ off: L(sub, say), def: L(sub, say) });

  const LINES = {
    gameStart: {
      off: L("比賽開始!看你打不打得到我的球!"),
      def: L("比賽開始!我站上投手丘了,給我暗號吧!", "比賽開始!我站上投手丘了!"),
    },
    gameOver: BOTH("比賽結束!再來一場吧。"),
    manualRunning: BOTH("看你怎麼跑!前方跑者優先,深遠安打可以多衝。", null),
    runJudge: BOTH("看你怎麼跑!", null),

    // 你進攻:對面的投手準備出手
    ready: BOTH("我準備好了,倒數 {n} 秒!", "我準備好了,看球!"),
    idleAdjust: BOTH("讓我調整一下節奏,約 {n} 秒後出手。", null),
    idleThrow: BOTH("出手!", null),
    // 你防守:你的投手等暗號
    idleDefense: BOTH("給我暗號吧!先搶好球數,兩好球後把球投到邊角誘打。", null),
    idleDefenseRunner: BOTH("一壘有人,我會盯著跑者;滑球或指叉壓低可以製造滾地球。", null),
    idleDefenseTired: BOTH("我體力有點不夠了,先用控球好的球種搶好球數吧。", null),
    idleGeneric: BOTH("下一球,來吧。", null),

    // 球在飛
    pitch_fastball: { off: L("看我的直球!"), def: L("直球,出手!") },
    pitch_curve: { off: L("看我的曲球!"), def: L("曲球,出手!") },
    pitch_slider: { off: L("看我的滑球!"), def: L("滑球,出手!") },
    pitch_splitter: { off: L("看我的指叉球!"), def: L("指叉球,出手!") },
    pitch_other: { off: L("看我這一球!"), def: L("出手!") },
    ballInPlay: { off: L("被你打出去了!"), def: L("被打出去了,守備注意!") },

    // 結果
    strikeout: { off: L("三振!你還差一點喔。"), def: L("三振!漂亮!") },
    walk: { off: L("可惡,保送了……"), def: L("保送了……下一個我一定壓住。") },
    stealSuccess: { off: L("被你盜壘成功了!"), def: L("被盜壘了,下次盯緊一點。") },
    stealFail: { off: L("盜壘失敗,抓到你了!"), def: L("盜壘失敗,抓到了!") },
    stealPlan: { off: L("想盜壘?我盯著呢。"), def: L("他想盜壘,我盯著呢。") },
    single: { off: L("一壘安打,讓你上壘了。"), def: L("被打出一壘安打……") },
    double: { off: L("二壘安打,打得好……"), def: L("二壘安打,好痛……") },
    triple: { off: L("三壘安打!你太強了!"), def: L("三壘安打!守備太慢了!") },
    homerun: { off: L("全壘打……被你轟出去了!"), def: L("全壘打……被轟出去了!") },
    flyout: { off: L("高飛球接殺!我們守住了。"), def: L("高飛球接殺!謝啦隊友!") },
    groundout: BOTH("滾地球,出局!"),
    doublePlay: BOTH("雙殺!一次解決兩個!"),
    tagOut: BOTH("本壘觸殺!出局!"),
    forceOut: BOTH("封殺出局!"),
    sacBunt: { off: L("犧牲觸擊,你推進了跑者。"), def: L("犧牲觸擊,他們推進了跑者。") },
    error: BOTH("糟糕,隊友漏接了……"),
    runHome: { off: L("被你跑回本壘了……"), def: L("被跑回本壘了……") },
    safe: BOTH("安全上壘……"),
    backSafe: BOTH("回壘了,沒抓到。"),
    foul: BOTH("界外球,再來!"),

    // 換局
    inningTop: BOTH("第 {n} 局上半,交給我,把對手壓下來!", "交給我,把對手壓下來!"),
    inningBottom: BOTH("第 {n} 局下半,換你打擊,看你打不打得到我的球!", "換你打擊了,看你打不打得到!"),
  };

  // game.banner 原字串 → 台詞 key(動態的「第 N 局上/下半」「比賽開始」在 gameRules.js 用 regex 接)
  const BANNER_KEYS = {
    "保送": "walk",
    "盜壘成功": "stealSuccess",
    "盜壘失敗": "stealFail",
    "戰術盜壘": "stealPlan",
    "三振出局": "strikeout",
    "漂亮三振": "strikeout",
    "揮棒落空": "strikeout", // 只在第三個好球揮空時才設這個 banner
    "你成功三振打者": "strikeout",
    "球被打進場內": "ballInPlay",
    "對手把球掃進場內": "ballInPlay",
    "跑壘判斷": "runJudge",
    "跑回本壘": "runHome",
    "安全上壘": "safe",
    "回壘成功": "backSafe",
    "本壘觸殺": "tagOut",
    "封殺出局": "forceOut",
    "高飛球接殺": "flyout",
    "犧牲觸擊": "sacBunt",
    "雙殺打": "doublePlay",
    "滾地出局": "groundout",
    "守備失誤": "error",
    "一壘安打": "single",
    "二壘安打": "double",
    "三壘安打": "triple",
    "全壘打": "homerun",
  };

  // triggerReplay() 的字串 → 台詞 key(注意原碼用的是全形「！」)
  const REPLAY_KEYS = {
    "投手準備要投球了": "ready",
    "三振出局": "strikeout",
    "三振！": "strikeout",
    "界外球慢動作": "foul",
    "接殺！": "flyout",
    "雙殺慢動作": "doublePlay",
    "滾地出局": "groundout",
    "失誤漏接": "error",
    "全壘打慢動作": "homerun",
    "一壘安打": "single",
    "二壘安打": "double",
    "三壘安打": "triple",
    "全壘打": "homerun",
  };

  // 唸稿清單:從詞庫「算」出來,不手抄 ⇒ 字幕與唸稿不會漂移
  const PHRASES = [];
  Object.values(LINES).forEach((entry) => {
    ["off", "def"].forEach((side) => {
      const say = entry[side] && entry[side].say;
      if (say && !PHRASES.includes(say)) PHRASES.push(say);
    });
  });

  // FNV-1a(去空白),烤製與 runtime 共用
  function voiceKey(text) {
    const s = String(text).replace(/\s+/g, "");
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(36);
  }

  const api = { LINES, BANNER_KEYS, REPLAY_KEYS, PHRASES, voiceKey };
  root.PITCHER_LINES = LINES;
  root.PITCHER_BANNER_KEYS = BANNER_KEYS;
  root.PITCHER_REPLAY_KEYS = REPLAY_KEYS;
  root.PITCHER_PHRASES = PHRASES;
  root.pitcherVoiceKey = voiceKey;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

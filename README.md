# 九局熱戰 Baseball Duel(repo `5chess`)

主審視角的九宮格投打對決,單機 PWA。純靜態、零建置、可安裝、可離線。

## ⚠ 先讀:名字騙人

repo 與網址都叫 **5chess,但這是棒球,不是五子棋**。

- 本 repo 的正版線上網址:**https://3d-5chess.pages.dev**(Cloudflare Pages 專案 `3d-5chess`)。
- 德義作品集卡片:`3d-5chess`「九局熱戰(Baseball Duel)」,分類**遊戲**(不是棋類)。
- 舊址 `3d-5chess.netlify.app` 已是 301 殼,轉到上面的正版(0903 重掛一次)。
  ⚠ 本 repo 連著**兩個** Netlify 站的 GitHub 自動建置:`3d-5chess` 與 `deyi-baseball`(後者網址名字像 3D 棒球對決,內容其實是本 repo 的九局熱戰)。
  0903 推 README 就觸發兩站重建、把 301 殼蓋回完整站;兩站 `build_settings.stop_builds` 已設 true,之後 push 不再觸發 Netlify 建置。
  `deyi-baseball.netlify.app` 要不要也改 301(到 3d-5chess.pages.dev)列在減站清單 D2,等使用者拍板。
- **不是本 repo 的站**(都是德義自己的作品,各有一張作品集卡):`5chess.pages.dev`(決戰房市五子棋,卡 `5chess-housing`;
  源碼在另一顆硬碟、不在這台機的 Cloudflare 帳號 Pages 清單裡,0903 使用者確認)、
  `5-chess.pages.dev`(3D 五子棋,repo 在 `Desktop\chess5`)。

## 玩法

- 投球:直球 / 曲球 / 滑球 / 指叉,選九宮格落點;打擊:上段 / 中段 / 下段揮棒;可盜二壘、盜三壘。
- AI 守方自動投球(投手就位播報後約 10 秒)、AI 逐球播報、結果重播 overlay、戰報標頭、新手模式。
- 手機全螢幕與 iOS 安裝提示(manifest + fallback 鈕)。
- 🗣 **投手說話**(2026-10-07):原本的「AI 播報」改成投手第一人稱台詞(你防守=你的投手、你進攻=對面的 AI 投手),
  畫面文字 + 預烤 mp3 人聲(雲哲);右欄「投手人聲 開/關」可關,記在 localStorage。

## 檔案

| 檔 | 用途 |
|---|---|
| `index.html` / `styles.css` | 殼層與版面(控制欄在右、九宮格放大) |
| `gameRules.js` `constants.js` | 規則與數值(接觸率、AI 接殺率等) |
| `render.js` `input.js` | 畫面與操作 |
| `pitcherLines.js` | 投手台詞表(off=你進攻/def=你防守,每條 sub 畫面字 + say 唸稿);改台詞只改這裡 |
| `voice.js` / `voice/` | 人聲 runtime(全域 `VOICE`,mp3 優先、缺檔靜默、**絕不用 Web Speech**)與 50 支預烤 mp3 + manifest.json |
| `scripts/gen-voice.mjs` | 烤 mp3(借 Desktop/baseball3d 的 msedge-tts ^2.0.7,需網路,累加式) |
| `scripts/sync-voice-sw.mjs` | 把 voice/ 的 mp3 清單寫進 sw.js;`--check` 對賬(唸稿↔mp3↔sw.js、禁 Web Speech) |
| `pwa.js` / `sw.js` | 安裝與 Service Worker,`CACHE_NAME = "baseball-duel-v17"`(改殼層檔必 +1;改台詞烤完要跑 sync-voice-sw) |
| `manifest.webmanifest` / `icons/` | PWA |

沒有 `package.json`、沒有自動測試;改完用真瀏覽器打一局。改台詞的驗法:`node scripts/gen-voice.mjs && node scripts/sync-voice-sw.mjs --check`。

## 跑起來

```bash
npx serve .            # 或任何靜態伺服器;直接雙擊 index.html 會讓 SW 失效
```

## 部署(手動,push 不會上線)

```bash
npx wrangler pages deploy . --project-name 3d-5chess --branch main   # --branch main 必帶,否則進 Preview
curl -s "https://3d-5chess.pages.dev/sw.js?b=$RANDOM" | grep CACHE_NAME   # 要是新版號
```

## 帳本

作品集已收(分類遊戲)、`sites.json` 已登。新功能上線後照 skill `portfolio-ledger-guard` 收尾。

---
GitHub:`summer09201017-cloud/5chess`。本 README 2026-09-03 補(此前文件沒寫網址,作品集對賬只能靠名字猜到本 repo)。

## 現況(2026-10-07)

- 🗣 **讓投手說話**(使用者原話「九局熱戰要改成『讓投手說話』」,破例免規格直接做):`gameRules.js` 的 `aiPlayByPlay()`/`coachAdvice()`
  換成 `pitcherTalk()`,回 `{text, say}`;`render.js` 的 `renderPitcherTalk()` 每幀跑(文字變了才改 DOM、`VOICE.say` 同句只唸一次,
  第一次點畫面前不唸、解鎖後補唸);`input.js` 加「投手人聲 開/關」鈕。50 句唸稿全部預烤(雲哲),sw v17 把 mp3 全進快取。
  未對照到的 banner 會原樣顯示、不唸(不會壞)。驗過:headless 情境 25 條 + 源碼 banner/replay 字串全對照 + 真瀏覽器投一球。

## 現況(2026-09-14)

- 🩹 拔掉「index.html 進 SW 快取 / start_url」地雷(3D-Chess 幻影版同日實錘「裝成 App 打開 ERR_FAILED」:Pages/Workers 把 /index.html 308 到 /,快取存到轉址過的回應,導覽拿到就被瀏覽器拒絕):manifest start_url ./index.html → ./(id 明寫舊值保住 App 身分)、SW 名單拔 index.html、離線退路改 ./、addAll → 逐一 add+catch、CACHE 版號 +1。用 skills repo static-pwa-ship/patches/patch-sw-index.mjs 打的;規矩見該 skill 鐵則。已裝的 App 第一次開若失敗,用瀏覽器開一次首頁或移除重裝。

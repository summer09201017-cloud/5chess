// scripts/gen-voice.mjs —— 把 pitcherLines.js 的唸稿用 msedge-tts(雲哲,男聲轉播感,免費)預烤成 voice/<key>.mp3 + voice/manifest.json。
// 零相依 repo(整個目錄會上傳到 Cloudflare Pages,不能裝 node_modules)⇒ msedge-tts 借別的 repo 的 node_modules,
// createRequire 要給 Windows 路徑(C:/…),給 /c/… 會 Cannot find module。
// 用法:node scripts/gen-voice.mjs(需網路;累加式,已有的檔跳過;偶發「Stream closed」重跑一次即補齊)
// 烤完跑:node scripts/sync-voice-sw.mjs(把 mp3 清單寫進 sw.js)。
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

// msedge-tts 內部的非同步清理會在我們複製走檔案後再 unlink 一次 → 吞掉這個特定錯誤,別讓它炸掉整批
process.on("uncaughtException", (e) => {
  if (e && e.code === "ENOENT" && e.syscall === "unlink") return;
  console.error(e);
  process.exit(1);
});

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { PHRASES, voiceKey } = createRequire(join(root, "noop.js"))(join(root, "pitcherLines.js"));

const HOSTS = [
  "C:/Users/agape250/Desktop/baseball3d/noop.js",
  "C:/Users/agape250/Desktop/airhockey3d/noop.js",
  "C:/Users/HFP/Desktop/baseball3d/noop.js",
  "C:/Users/HFP/Desktop/airhockey3d/noop.js",
];
let lib = null;
for (const host of HOSTS) {
  try {
    const req = createRequire(host);
    try {
      lib = req("msedge-tts");
    } catch (err) {
      if (err && err.code === "ERR_REQUIRE_ESM") lib = await import(pathToFileURL(req.resolve("msedge-tts")).href);
      else throw err;
    }
    console.log("msedge-tts ←", host.replace("/noop.js", ""));
    break;
  } catch (err) {
    /* 下一個候選 */
  }
}
if (!lib) {
  console.error("找不到 msedge-tts:在 HOSTS 任一資料夾 npm i msedge-tts@^2.0.7(版本一定要 ^2.0.7)");
  process.exit(1);
}
const { MsEdgeTTS, OUTPUT_FORMAT } = lib;

const OUT = join(root, "voice");
mkdirSync(OUT, { recursive: true });
const manifestPath = join(OUT, "manifest.json");
let manifest = {};
try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")); } catch { /* 第一次 */ }
const saveManifest = () => writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n", "utf8");

const VOICE = "zh-TW-YunJheNeural"; // 雲哲;一款遊戲一種腔,棒球投手=轉播感男聲

let made = 0, skipped = 0, failed = 0;
for (const text of PHRASES) {
  const key = voiceKey(text);
  const file = `${key}.mp3`;
  const fp = join(OUT, file);
  if (existsSync(fp)) { manifest[key] = `voice/${file}`; saveManifest(); skipped++; continue; }
  const tmpDir = join(OUT, `_tmp_${key}`);
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    mkdirSync(tmpDir, { recursive: true });
    const { audioFilePath } = await tts.toFile(tmpDir, text);
    copyFileSync(audioFilePath, fp); // copy 不 rename:留原檔給 lib 自己清
    try { tts.close && tts.close(); } catch { /* socket 已關 */ }
    manifest[key] = `voice/${file}`;
    saveManifest(); // 逐句落盤:中途死也不丟已完成的
    made++;
    console.log("✓", text);
  } catch (err) {
    failed++;
    console.error("✗", text, String(err).slice(0, 120));
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* noop */ }
  }
}
console.log(`done: made ${made}, skipped ${skipped}, failed ${failed}, total ${readdirSync(OUT).filter((f) => f.endsWith(".mp3")).length} mp3`);
process.exit(failed ? 1 : 0); // 明確收尾(lib 的 WebSocket 會讓 process 掛著)

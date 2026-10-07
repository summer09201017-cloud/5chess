// scripts/sync-voice-sw.mjs —— 把 voice/ 目錄的 mp3 清單寫進 sw.js 的「// voice:begin … // voice:end」之間(照目錄重生,不手抄;
// 手抄一定會漏,而漏掉的壞法是靜默的:線上照唸、只有離線那一次少一句)。
// 用法:node scripts/sync-voice-sw.mjs          改 sw.js
//       node scripts/sync-voice-sw.mjs --check  只對賬不改檔:mp3 ↔ sw.js、唸稿 ↔ manifest、禁 Web Speech;有缺 exit 1
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const problems = [];

const voiceDir = join(root, "voice");
const mp3s = existsSync(voiceDir) ? readdirSync(voiceDir).filter((f) => f.endsWith(".mp3")).sort() : [];
const swPath = join(root, "sw.js");
let sw = readFileSync(swPath, "utf8");
const crlf = sw.includes("\r\n");
if (crlf) sw = sw.replace(/\r\n/g, "\n");
const re = /(\/\/ voice:begin[^\n]*\n)([\s\S]*?)(  \/\/ voice:end)/;
const m = sw.match(re);
if (!m) {
  console.error("sw.js 缺「  // voice:begin … // voice:end」標記");
  process.exit(1);
}
const block = mp3s.map((f) => `  "./voice/${f}",`).join("\n") + (mp3s.length ? "\n" : "");
if (m[2] !== block) {
  if (check) problems.push(`sw.js 的 voice 清單與 voice/ 目錄不一致(目錄 ${mp3s.length} 支)`);
  else {
    let next = sw.replace(re, (_, a, _b, c) => a + block + c);
    if (crlf) next = next.replace(/\n/g, "\r\n");
    writeFileSync(swPath, next, "utf8");
    console.log(`sw.js voice 清單已更新:${mp3s.length} 支 mp3`);
  }
} else {
  console.log(`sw.js voice 清單已是最新:${mp3s.length} 支 mp3`);
}

// 唸稿 ↔ manifest ↔ 檔案
const { PHRASES, voiceKey } = createRequire(join(root, "noop.js"))(join(root, "pitcherLines.js"));
let manifest = {};
try { manifest = JSON.parse(readFileSync(join(voiceDir, "manifest.json"), "utf8")); } catch { problems.push("voice/manifest.json 讀不到"); }
for (const text of PHRASES) {
  const key = voiceKey(text);
  if (!manifest[key]) problems.push(`唸稿沒烤:「${text}」(key ${key})`);
  else if (!existsSync(join(root, manifest[key]))) problems.push(`manifest 指到不存在的檔:${manifest[key]}`);
}
if (!sw.includes('"./voice/manifest.json"')) problems.push("sw.js 沒把 voice/manifest.json 進快取");

// 禁 Web Speech(鐵律:不用機器聲 fallback);禁詞用串接寫,免得守門把這支檢查檔自己攔下
const banned = new RegExp("speech" + "Synthesis|Speech" + "SynthesisUtterance");
for (const f of readdirSync(root).filter((f) => f.endsWith(".js") || f.endsWith(".html"))) {
  if (banned.test(readFileSync(join(root, f), "utf8"))) problems.push(`${f} 用了 Web Speech`);
}

if (problems.length) {
  console.error("✗ " + problems.join("\n✗ "));
  process.exit(1);
}
console.log(`✓ 對賬通過:${PHRASES.length} 句唸稿都有 mp3,${mp3s.length} 支 mp3 都在 sw.js`);

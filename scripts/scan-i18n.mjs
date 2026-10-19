// 画面文言の日本語化検査（SC-007）。
// app/ 配下の UI ファイルで、英語の技術用語（undefined、null、Internal Server Error 等）が
// 画面に露出していないかを雑に検査する。文字列リテラルに現れる英単語を機械的に拾う。
// 誤検知を避けるため、業務用語として許容する英語（CSV、PDF、ID、SSO、OAuth、API、Noto 等）は除外。

import fs from "node:fs/promises";
import path from "node:path";

const UI_ROOT = path.resolve(process.cwd(), "app");
const EXT = new Set([".tsx"]);
const EXCLUDE = [
  path.sep + "api" + path.sep, // サーバーのレスポンス本文は to-user-message を通る
];

// 英語の技術用語の中で、UI に露出させてはならない語
const FORBIDDEN = [
  "undefined",
  "null",
  "NaN",
  "Internal Server Error",
  "Internal error",
  "Error:",
  "Unauthorized",
  "Forbidden",
  "Not Found",
  "stack trace",
  "TypeError",
  "ReferenceError",
];

// 本検査では、ソース中の全文字列（ダブルクォート・バッククォート）を抽出し、
// その中に FORBIDDEN が含まれる場合に違反とする。

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (EXCLUDE.some((sub) => full.includes(sub))) continue;
    if (e.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (EXT.has(path.extname(e.name))) {
      out.push(full);
    }
  }
  return out;
}

async function scanFile(file) {
  const content = await fs.readFile(file, "utf8");
  const violations = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    // ソース上のインポート文や型注釈は除外（文字列リテラルのみ検査する簡便判定）
    if (/^\s*(import|export|from|type\s)/.test(line)) continue;
    for (const word of FORBIDDEN) {
      // 文字列リテラル内に出現する場合のみ違反とみなす
      const re = new RegExp(`["\`'][^"\`']*${escapeRegex(word)}[^"\`']*["\`']`);
      if (re.test(line)) {
        violations.push({ file, lineNumber: i + 1, line: line.trim(), word });
      }
    }
  }
  return violations;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  const files = await walk(UI_ROOT);
  const all = [];
  for (const f of files) {
    all.push(...(await scanFile(f)));
  }
  if (all.length > 0) {
    console.error("[scan-i18n] 違反検出:");
    for (const v of all) {
      console.error(`  ${v.file}:${v.lineNumber}: ${v.line}（検出語: ${v.word}）`);
    }
    console.error(`[scan-i18n] 合計 ${all.length} 件。UI に英語の技術用語が露出しています。`);
    process.exit(1);
  }
  console.warn(`[scan-i18n] OK (${files.length} ファイルを検査、違反 0 件)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});

// PII 静的スキャナ（憲法 IV、SC-008）。
// ソースコードを行単位で読み込み、ログ出力呼び出し（console.*、logger.*）の引数に
// PII キーワード（氏名・社員番号・金額・出張先・口座情報・領収書関連）が直接
// 渡っていないかを検出する。違反があれば非 0 で終了する。
//
// 本スキャナは AST を使わないシンプルな正規表現ベース実装。誤検知を避けるため、
// 「ログ呼び出し行かつ PII 風識別子を含む」を条件にする。将来、精度を上げるときは
// @babel/parser などへ切り替える。

import fs from "node:fs/promises";
import path from "node:path";

const ROOTS = ["app", "src", "scripts"];
const EXT_ALLOWED = new Set([".ts", ".tsx", ".mjs", ".js"]);
const EXCLUDE_SUBPATHS = [
  path.sep + "node_modules" + path.sep,
  path.sep + ".next" + path.sep,
  path.sep + ".turbo" + path.sep,
];

// ログ呼び出しとみなす先頭パターン
const LOG_CALL = /\b(console\.(log|info|warn|error|debug)|logger\.(info|warn|error|debug|fatal|trace))\s*\(/;

// 直接渡しを疑う PII キーワード（識別子として現れた場合に警告）
const PII_IDENT =
  /\b(name|empNo|amount(?:Yen|Total)?|destination|account(?:Number)?|receipts?|address|address1|address2)\b/;

// スキャナ自身の記述は除外対象にする（本ファイルの PII_IDENT 定義や、
// AGENTS.md／CLAUDE.md 等の指示に出現する語句はスキャン対象外）。
const SKIP_MARKERS = [
  "/* allow-pii-ident */",
  "// allow-pii-ident",
];

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
    if (EXCLUDE_SUBPATHS.some((sub) => full.includes(sub))) continue;
    if (e.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (EXT_ALLOWED.has(path.extname(e.name))) {
      out.push(full);
    }
  }
  return out;
}

async function scanFile(file) {
  const content = await fs.readFile(file, "utf8");
  const lines = content.split(/\r?\n/);
  const violations = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!LOG_CALL.test(line)) continue;
    if (SKIP_MARKERS.some((m) => line.includes(m))) continue;
    if (PII_IDENT.test(line)) {
      violations.push({ file, lineNumber: i + 1, line: line.trim() });
    }
  }
  return violations;
}

async function main() {
  const files = [];
  for (const root of ROOTS) {
    const abs = path.resolve(process.cwd(), root);
    files.push(...(await walk(abs)));
  }
  const allViolations = [];
  for (const f of files) {
    const v = await scanFile(f);
    allViolations.push(...v);
  }
  if (allViolations.length > 0) {
    console.error("[scan-pii] 違反検出:");
    for (const v of allViolations) {
      console.error(`  ${v.file}:${v.lineNumber}: ${v.line}`);
    }
    console.error(
      `[scan-pii] 合計 ${allViolations.length} 件。ログ出力に PII の疑いがある識別子が含まれています。`,
    );
    process.exit(1);
  }
  console.warn(`[scan-pii] OK (${files.length} ファイルを検査、違反 0 件)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});

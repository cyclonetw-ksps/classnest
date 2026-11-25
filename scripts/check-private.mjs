// 檢查 repo 裡沒有部署專屬的值：真的信箱、workers.dev 網址、Google 用戶端 ID、Cloudflare 帳號 ID。
// 這些值要放在 GitHub 的 secrets／variables 或本機的 .dev.vars（不進 git），見 docs/self-hosting.md。
// `pnpm test` 第一步就跑這支；找到任何一個就列出檔名與行號並失敗。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;

// 要檢查的檔案與資料夾（相對於 repo 根目錄）；不存在的略過
const TARGETS = [
  "src",
  "test",
  "scripts",
  "docs",
  ".github",
  "README.md",
  "AGENTS.md",
  "PRODUCT.md",
  "DESIGN.md",
  "wrangler.jsonc",
  "package.json",
  "vite.config.ts",
  "vitest.config.ts",
  ".dev.vars.example",
];
const SKIP_DIRS = new Set(["node_modules", "dist", ".wrangler", ".git"]);
const TEXT = /\.(ts|tsx|js|mjs|cjs|json|jsonc|md|yml|yaml|html|css|example|txt)$/;

// 範例用的網域（RFC 2606／6761 保留給文件與測試），不算真的信箱
const SAFE_DOMAIN = /(^|\.)(example\.(com|org|net)|test|example|invalid|localhost)$/i;

const RULES = [
  {
    why: "看起來是真的信箱（範例請用 example.com 或 .test 網域）",
    re: /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g,
    ok: (m) => SAFE_DOMAIN.test(m[1]),
  },
  { why: "workers.dev 網址帶了真的子網域（請寫成 <你的子網域>）", re: /\b[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\b/gi },
  { why: "看起來是真的 Google 用戶端 ID", re: /\b\d{6,}-[a-z0-9]{16,}\.apps\.googleusercontent\.com\b/gi },
  { why: "看起來是 Cloudflare 帳號 ID（32 位十六進位）", re: /(?<![0-9a-f])[0-9a-f]{32}(?![0-9a-f])/g },
];

function files(path) {
  let st;
  try {
    st = statSync(path);
  } catch {
    return [];
  }
  if (st.isFile()) return [path];
  const out = [];
  for (const name of readdirSync(path)) {
    if (SKIP_DIRS.has(name)) continue;
    const child = join(path, name);
    if (statSync(child).isDirectory()) out.push(...files(child));
    else if (TEXT.test(name)) out.push(child);
  }
  return out;
}

const problems = [];
for (const file of TARGETS.flatMap((t) => files(join(root, t)))) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      for (const m of line.matchAll(rule.re)) {
        if (rule.ok?.(m)) continue;
        problems.push(`${relative(root, file)}:${i + 1}: ${rule.why}：${m[0]}`);
      }
    }
  });
}

if (problems.length) {
  console.error("找到部署專屬的值，請改用 secrets／variables 或 .dev.vars：");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log("check-private：沒有找到部署專屬的值");

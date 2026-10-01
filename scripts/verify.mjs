// 公開前の自己検証。1つでも失敗したら exit 1 (=公開しない)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
const errors = [];
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'subsidies.json'), 'utf8'));

for (const f of fs.readdirSync(path.join(root, 'data'))) {
  const mb = fs.statSync(path.join(root, 'data', f)).size / 1048576;
  if (mb > 50) errors.push(`data/${f} が大きすぎる(${mb.toFixed(0)}MB)。GitHubの100MB制限に注意`);
}
const ageH = (Date.now() - new Date(data.fetchedAt)) / 36e5;
if (ageH > 36) errors.push(`データが古い(${ageH.toFixed(0)}時間前)`);
if (data.items.length < 20) errors.push(`件数が少なすぎる(${data.items.length})`);

const BAN = ['必ず採択', '絶対に受給', '100%もらえ', '確実に受け取'];
const pages = fs.readdirSync(path.join(docs, 'p')).filter((f) => f.endsWith('.html'));
if (pages.length < 10) errors.push('個別ページが少なすぎる');
for (const f of pages) {
  const h = fs.readFileSync(path.join(docs, 'p', f), 'utf8');
  if (!/https:\/\/www\.jgrants-portal\.go\.jp\/subsidy\//.test(h)) errors.push(`${f}: 一次情報URLなし`);
  if (!h.includes('最終取得日')) errors.push(`${f}: 取得日なし`);
  if (/undefined|NaN|>null</.test(h.replace(/<style[\s\S]*?<\/style>/g, ''))) errors.push(`${f}: 不正な値(undefined/NaN/null)`);
  for (const b of BAN) if (h.includes(b)) errors.push(`${f}: 禁止表現「${b}」`);
}
for (const f of ['index.html', 'about.html', 'sitemap.xml', 'robots.txt']) {
  if (!fs.existsSync(path.join(docs, f))) errors.push(`${f}がない`);
}
if (errors.length) {
  console.error('検証NG:\n- ' + errors.slice(0, 30).join('\n- '));
  process.exit(1);
}
console.log(`検証OK: 個別ページ${pages.length}件`);

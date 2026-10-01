// jGrants 公開API から公募中の補助金を取得し data/subsidies.json に保存する
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
const API = 'https://api.jgrants-portal.go.jp/exp/v1/public/subsidies';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(2000 * (i + 1));
    }
  }
}

const dataDir = path.join(root, 'data');
const cachePath = path.join(dataDir, 'details-cache.json');
const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};

const list = new Map();
for (const kw of cfg.keywords) {
  const url = `${API}?keyword=${encodeURIComponent(kw)}&sort=acceptance_end_datetime&order=ASC&acceptance=1`;
  const j = await getJson(url);
  for (const r of j.result || []) list.set(r.id, r);
  await sleep(500);
}
if (list.size === 0) throw new Error('APIから0件。公開を止めるため失敗扱いにします');

// サイトに必要な項目だけ残す(添付資料の巨大データ等は捨てる。GitHubの100MB制限対策)
const KEEP = ['id', 'name', 'title', 'subsidy_catch_phrase', 'detail', 'use_purpose', 'industry', 'target_area_search', 'target_number_of_employees', 'subsidy_rate', 'subsidy_max_limit', 'acceptance_start_datetime', 'acceptance_end_datetime', 'front_subsidy_detail_page_url', 'institution_name'];
const slim = (o) => {
  const r = {};
  for (const k of KEEP) if (o[k] !== undefined) r[k] = k === 'detail' ? String(o[k] ?? '').slice(0, 3000) : o[k];
  return r;
};
for (const id of Object.keys(cache)) cache[id] = slim(cache[id]);

const out = [];
for (const [id, r] of list) {
  let d = cache[id];
  if (!d) {
    try {
      const j = await getJson(`${API}/id/${id}`);
      d = j.result?.[0];
      if (d) { d = slim(d); cache[id] = d; }
    } catch (e) {
      console.warn('detail失敗', id, e.message);
    }
    await sleep(300);
  }
  out.push(slim({ ...r, ...(d || {}) }));
}
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(cachePath, JSON.stringify(cache));
fs.writeFileSync(
  path.join(dataDir, 'subsidies.json'),
  JSON.stringify({ fetchedAt: new Date().toISOString(), items: out }, null, 1)
);
console.log(`取得完了: ${out.length}件`);

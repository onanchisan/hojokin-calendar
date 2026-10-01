// data/subsidies.json から静的サイトを docs/ に生成する
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'site.config.json'), 'utf8'));
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'subsidies.json'), 'utf8'));
const out = path.join(root, 'docs');
const BASE = (process.env.SITE_BASE_URL || cfg.baseUrl).replace(/\/$/, '');

const PREFS = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
const areaSlug = (n) => (n === '全国' ? 'all' : PREFS.includes(n) ? 'p' + String(PREFS.indexOf(n) + 1).padStart(2, '0') : 'other');

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const strip = (h) => String(h ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const jst = (iso) => (iso ? new Date(new Date(iso).getTime() + 9 * 3600e3) : null);
const ymd = (d) => (d ? `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日` : '未定');
const yen = (n) => (!n ? '公募要領を確認' : n >= 1e8 ? `${(n / 1e8).toFixed(n % 1e8 ? 1 : 0)}億円` : n >= 1e4 ? `${Math.round(n / 1e4).toLocaleString('ja-JP')}万円` : `${n}円`);
const fetched = jst(data.fetchedAt);
const today = new Date(Date.UTC(fetched.getUTCFullYear(), fetched.getUTCMonth(), fetched.getUTCDate()));
const fetchedStr = ymd(fetched);

const items = data.items
  .map((r) => {
    const end = jst(r.acceptance_end_datetime);
    const start = jst(r.acceptance_start_datetime);
    const area = (r.target_area_search || '全国').split('/')[0].trim();
    return {
      id: r.id, title: r.title || r.name, start, end, area,
      max: r.subsidy_max_limit, rate: r.subsidy_rate || '', emp: r.target_number_of_employees || '',
      purpose: r.use_purpose || '', industry: r.industry || '',
      url: r.front_subsidy_detail_page_url || `https://www.jgrants-portal.go.jp/subsidy/${r.id}`,
      summary: strip(r.detail).slice(0, 220),
      daysLeft: end ? Math.ceil((end - today) / 86400e3) : null,
    };
  })
  .filter((x) => x.end && x.daysLeft >= 0)
  .sort((a, b) => a.end - b.end);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'p'), { recursive: true });
fs.mkdirSync(path.join(out, 'area'), { recursive: true });

const css = `:root{--bg:#f7f8fa;--fg:#1d2733;--mut:#5b6875;--card:#fff;--line:#e2e6ea;--acc:#0b6b4f;--warn:#b42318}
*{box-sizing:border-box}body{margin:0;font:16px/1.75 system-ui,"Hiragino Sans","Yu Gothic",sans-serif;background:var(--bg);color:var(--fg)}
a{color:var(--acc)}header,footer{background:#fff;border-bottom:1px solid var(--line);padding:14px 16px}footer{border-top:1px solid var(--line);border-bottom:0;color:var(--mut);font-size:14px;margin-top:40px}
.w{max-width:860px;margin:0 auto}main.w{padding:0 16px}h1{font-size:1.5rem;line-height:1.4}h2{font-size:1.15rem;margin-top:2rem}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:12px 0}.card h3{margin:0 0 6px;font-size:1.05rem}
.meta{color:var(--mut);font-size:.9rem}.badge{display:inline-block;font-size:.8rem;padding:1px 8px;border-radius:99px;background:#e7f4ee;color:var(--acc);margin-right:6px}.badge.hot{background:#fdeceb;color:var(--warn)}
table{border-collapse:collapse;width:100%;background:#fff}th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}th{background:#f0f3f6;width:9em}
.note{background:#fff8e6;border:1px solid #f0d9a0;border-radius:8px;padding:10px 14px;font-size:.92rem}nav a{margin-right:14px}`;
fs.writeFileSync(path.join(out, 'style.css'), css);
fs.writeFileSync(path.join(out, '.nojekyll'), '');
fs.writeFileSync(path.join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);

const adsScript = cfg.adsenseClient ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(cfg.adsenseClient)}" crossorigin="anonymous"></script>` : '';
const affiliates = (cfg.affiliateBlocks || []).map((b) => `<div class="card"><strong>${esc(b.title)}</strong><div>${b.html}</div></div>`).join('');

const page = ({ title, desc, path: p, body }) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}｜${esc(cfg.siteName)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${BASE}${p}"><link rel="stylesheet" href="${BASE}/style.css">${cfg.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(cfg.googleSiteVerification)}">` : ''}${adsScript}</head>
<body><header><div class="w"><strong><a href="${BASE}/" style="text-decoration:none">${esc(cfg.siteName)}</a></strong> <span class="meta">${esc(cfg.tagline)}</span><nav><a href="${BASE}/">締切順</a><a href="${BASE}/areas.html">地域</a><a href="${BASE}/industries.html">業種</a><a href="${BASE}/deadline.html">月別締切</a><a href="${BASE}/ranking.html">上限額順</a><a href="${BASE}/guide.html">ガイド</a><a href="${BASE}/about.html">このサイトについて</a></nav></div></header>
<main class="w">${body}</main><footer><div class="w">${esc(cfg.contactText)}<br>出典：<a href="https://www.jgrants-portal.go.jp/">Jグランツ</a>。このコンテンツは、政府公式の補助金申請システム jGrants の Web-API 機能を利用して取得した情報をもとに${esc(cfg.operatorName)}にて編集・加工して作成されたものです。コンテンツの内容は日本国政府及び自治体によって保証されたものではありません。最終取得日：${fetchedStr}。<a href="${BASE}/about.html">免責・プライバシー</a></div></footer></body></html>`;

const card = (x) => `<div class="card"><h3><a href="${BASE}/p/${x.id}.html">${esc(x.title)}</a></h3><div class="meta">${x.daysLeft <= 14 ? '<span class="badge hot">締切まで' + x.daysLeft + '日</span>' : ''}<span class="badge">${esc(x.area)}</span>締切：${ymd(x.end)}　上限：${yen(x.max)}</div>${x.summary ? `<p>${esc(x.summary)}…</p>` : ''}</div>`;
const disclaimer = `<p class="note">最終取得日：${fetchedStr}。掲載内容は公開データの自動要約です。金額・締切・要件は変更されることがあるため、申請前に必ず公式ページをご確認ください。</p>`;
const write = (rel, html) => fs.writeFileSync(path.join(out, rel), html);

// トップ
const soon = items.filter((x) => x.daysLeft <= 30);
write('index.html', page({
  title: '補助金・助成金 締切カレンダー', desc: `公募中の補助金・助成金${items.length}件を締切が近い順に掲載。最終取得日${fetchedStr}。`, path: '/',
  body: `<h1>補助金・助成金 締切カレンダー</h1>${disclaimer}<p>公募中：<strong>${items.length}件</strong>（30日以内に締切：${soon.length}件）</p><h2>もうすぐ締切</h2>${soon.map(card).join('') || '<p>該当なし</p>'}${affiliates}<h2>公募中の一覧（締切順）</h2>${items.slice(0, 100).map(card).join('')}`,
}));

// 個別
for (const x of items) {
  const rows = [['対象地域', x.area], ['公募期間', `${ymd(x.start)} 〜 ${ymd(x.end)}（締切まで${x.daysLeft}日）`], ['補助上限額', yen(x.max)], ['補助率', x.rate], ['従業員数', x.emp], ['利用目的', x.purpose], ['対象業種', x.industry]].filter((r) => r[1]);
  write(`p/${x.id}.html`, page({
    title: `${x.title}（締切${ymd(x.end)}）`, desc: `${x.title}の締切は${ymd(x.end)}、上限${yen(x.max)}。対象地域：${x.area}。最終取得日${fetchedStr}。`, path: `/p/${x.id}.html`,
    body: `<h1>${esc(x.title)}</h1>${disclaimer}<table>${rows.map((r) => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('')}</table>${x.summary ? `<h2>概要</h2><p>${esc(x.summary)}…</p>` : ''}<p><a href="${esc(x.url)}" rel="noopener nofollow">▶ 公式情報（Jグランツ）で詳細を確認する</a></p>${affiliates}<p><a href="${BASE}/area/${areaSlug(x.area)}.html">${esc(x.area)}の補助金一覧へ</a></p>`,
  }));
}

// 地域
const byArea = new Map();
for (const x of items) {
  const s = areaSlug(x.area);
  if (!byArea.has(s)) byArea.set(s, { name: s === 'other' ? 'その他' : x.area, list: [] });
  byArea.get(s).list.push(x);
}
for (const [s, a] of byArea) {
  write(`area/${s}.html`, page({ title: `${a.name}の補助金・助成金（公募中${a.list.length}件）`, desc: `${a.name}の公募中の補助金・助成金${a.list.length}件を締切順に掲載。最終取得日${fetchedStr}。`, path: `/area/${s}.html`, body: `<h1>${esc(a.name)}の補助金・助成金</h1>${disclaimer}${a.list.map(card).join('')}` }));
}
write('areas.html', page({ title: '地域から探す', desc: '都道府県別の補助金・助成金一覧', path: '/areas.html', body: `<h1>地域から探す</h1><ul>${[...byArea].sort().map(([s, a]) => `<li><a href="${BASE}/area/${s}.html">${esc(a.name)}</a>（${a.list.length}件）</li>`).join('')}</ul>` }));

// 月別締切
fs.mkdirSync(path.join(out, 'deadline'), { recursive: true });
const byMonth = new Map();
for (const x of items) {
  const k = `${x.end.getUTCFullYear()}-${String(x.end.getUTCMonth() + 1).padStart(2, '0')}`;
  if (!byMonth.has(k)) byMonth.set(k, []);
  byMonth.get(k).push(x);
}
const months = [...byMonth.keys()].sort();
for (const k of months) {
  const [y, m] = k.split('-');
  const l = byMonth.get(k);
  write(`deadline/${k}.html`, page({ title: `${y}年${+m}月が締切の補助金・助成金（${l.length}件）`, desc: `${y}年${+m}月に公募が締め切られる補助金・助成金${l.length}件を、締切日順に掲載。最終取得日${fetchedStr}。`, path: `/deadline/${k}.html`, body: `<h1>${y}年${+m}月が締切の補助金・助成金</h1>${disclaimer}<p>${l.length}件</p>${l.map(card).join('')}` }));
}
write('deadline.html', page({ title: '月別の締切カレンダー', desc: '補助金・助成金の締切を月ごとに確認', path: '/deadline.html', body: `<h1>月別の締切カレンダー</h1><ul>${months.map((k) => `<li><a href="${BASE}/deadline/${k}.html">${k.replace('-', '年')}月</a>（${byMonth.get(k).length}件）</li>`).join('')}</ul>` }));

// 業種別
fs.mkdirSync(path.join(out, 'industry'), { recursive: true });
const slugOf = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
const byInd = new Map();
for (const x of items) for (const n of x.industry.split('/').map((s) => s.trim()).filter(Boolean)) {
  if (!byInd.has(n)) byInd.set(n, []);
  byInd.get(n).push(x);
}
for (const [n, l] of byInd) {
  write(`industry/${slugOf(n)}.html`, page({ title: `${n}向けの補助金・助成金（公募中${l.length}件）`, desc: `${n}が対象に含まれる公募中の補助金・助成金${l.length}件を締切順に掲載。最終取得日${fetchedStr}。`, path: `/industry/${slugOf(n)}.html`, body: `<h1>${esc(n)}向けの補助金・助成金</h1>${disclaimer}${l.map(card).join('')}` }));
}
write('industries.html', page({ title: '業種から探す', desc: '業種別の補助金・助成金一覧', path: '/industries.html', body: `<h1>業種から探す</h1><ul>${[...byInd].sort((a, b) => b[1].length - a[1].length).map(([n, l]) => `<li><a href="${BASE}/industry/${slugOf(n)}.html">${esc(n)}</a>（${l.length}件）</li>`).join('')}</ul>` }));

// 上限額ランキング
const top = items.filter((x) => x.max > 0).sort((a, b) => b.max - a.max).slice(0, 50);
write('ranking.html', page({ title: '補助上限額が大きい補助金ランキング', desc: `公募中の補助金を上限額の大きい順に${top.length}件掲載。最終取得日${fetchedStr}。`, path: '/ranking.html', body: `<h1>補助上限額が大きい補助金ランキング</h1>${disclaimer}<p>上限額は最大値です。実際の交付額は審査・補助率・対象経費で決まります。</p>${top.map(card).join('')}` }));

// ガイド記事
fs.mkdirSync(path.join(out, 'guide'), { recursive: true });
const guides = JSON.parse(fs.readFileSync(path.join(root, 'content', 'guides.json'), 'utf8'));
for (const g of guides) {
  write(`guide/${g.slug}.html`, page({ title: g.title, desc: g.desc, path: `/guide/${g.slug}.html`, body: `<h1>${esc(g.title)}</h1>${g.html.replaceAll('{{BASE}}', BASE)}` }));
}
write('guide.html', page({ title: '補助金ガイド', desc: '補助金・助成金の基礎知識と申請の流れ', path: '/guide.html', body: `<h1>補助金ガイド</h1>${guides.map((g) => `<div class="card"><h3><a href="${BASE}/guide/${g.slug}.html">${esc(g.title)}</a></h3><div class="meta">${esc(g.desc)}</div></div>`).join('')}` }));

// 固定ページ
write('about.html', page({
  title: 'このサイトについて・免責・プライバシー', desc: '運営方針、免責事項、プライバシーポリシー', path: '/about.html',
  body: `<h1>このサイトについて</h1><p>${esc(cfg.contactText)}</p><h2>情報源</h2><p>デジタル庁「Jグランツ」の公開APIの情報を、取得・整理して掲載しています。掲載内容は自動処理で作成しており、正確性・最新性を保証しません。</p><h2>免責事項</h2><p>本サイトの情報により生じた損害について責任を負いません。申請前に必ず公式の公募要領をご確認ください。</p><h2>プライバシーポリシー</h2><p>本サイトは広告配信・アクセス解析のためCookie等を利用する場合があります。広告配信事業者が興味に応じた広告を表示することがあります。詳細は各事業者のポリシーをご確認ください。</p><h2>お問い合わせ</h2><p>誤りのご指摘は、サイトのリポジトリのIssue機能からお願いします。</p>`,
}));

// サイトマップ
const urls = ['/', '/areas.html', '/about.html', '/deadline.html', '/industries.html', '/ranking.html', '/guide.html', ...months.map((k) => `/deadline/${k}.html`), ...[...byInd.keys()].map((n) => `/industry/${slugOf(n)}.html`), ...guides.map((g) => `/guide/${g.slug}.html`),...[...byArea.keys()].map((s) => `/area/${s}.html`), ...items.map((x) => `/p/${x.id}.html`)];
const lastmod = data.fetchedAt.slice(0, 10);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${BASE}${u}</loc><lastmod>${lastmod}</lastmod></url>`).join('')}</urlset>`);
console.log(`生成完了: 公募中${items.length}件 / ページ${urls.length}件`);

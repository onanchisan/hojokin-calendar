// 日次ループ: 取得 → 生成 → 検証 → (OKなら) commit & push
// 失敗時は公開せず終了コード1。ログは logs/ に残す。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logDir = path.join(root, 'logs');
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, new Date().toISOString().slice(0, 10) + '.log');
const log = (s) => { console.log(s); fs.appendFileSync(logFile, s + '\n'); };

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  log(`$ ${cmd} ${args.join(' ')}\n${r.stdout || ''}${r.stderr || ''}`);
  return r.status === 0;
}

for (const step of ['fetch', 'build', 'verify']) {
  if (!run('node', [`scripts/${step}.mjs`])) {
    log(`失敗: ${step}。公開せず終了します`);
    process.exit(1);
  }
}

if (!fs.existsSync(path.join(root, '.git'))) {
  log('gitリポジトリ未設定のため公開(push)はスキップ。手順書フェーズ0を参照');
  process.exit(0);
}
run('git', ['add', '-A']);
const changed = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: root }).status !== 0;
if (!changed) { log('変更なし'); process.exit(0); }
const date = new Date().toISOString().slice(0, 10);
if (!run('git', ['commit', '-m', `daily update ${date}`]) || !run('git', ['push'])) {
  log('git push失敗');
  process.exit(1);
}
log('公開完了');

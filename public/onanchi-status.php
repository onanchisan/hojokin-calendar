<?php
/*
 * onanchi.com サーバー状況チェッカー（さくらのレンタルサーバ用）
 * - 使用中のディスク容量、フォルダ別の内訳、SSL証明書の期限をJSONで返します
 * - 正しいキー付きのURLでアクセスしたときだけ答え、それ以外は「ページなし(404)」を返します
 *   例: https://onanchi.com/onanchi-status.php?key=（ウィジェットに入れたキー）
 * - キーそのものではなく「ハッシュ値」だけを書いているので、このファイルがGitHubで見えてもキーは分かりません
 */

const KEY_HASH = '750d24497a0c3374587a0d7fc277a2c64a4e16e9b485f36aca4208e45c739715'; // ウィジェットのキーのSHA-256
const QUOTA_GB = 300;      // スタンダードプランの容量
const DOMAIN = 'onanchi.com';
const CACHE_MIN = 10;      // 容量計算は重いので10分間は前回の結果を使う

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');

if (!isset($_GET['key']) || !hash_equals(KEY_HASH, hash('sha256', (string)$_GET['key']))) {
    http_response_code(404);
    exit;
}

// ホームディレクトリ（例: /home/ユーザー名）
function homeDir(): string {
    $h = getenv('HOME');
    if ($h && is_dir($h)) return rtrim($h, '/');
    // /home/ユーザー名/www/... から推測
    if (preg_match('#^(/home/[^/]+)#', __DIR__, $m)) return $m[1];
    return dirname($_SERVER['DOCUMENT_ROOT']);
}

function canExec(): bool {
    if (!function_exists('shell_exec')) return false;
    $disabled = array_map('trim', explode(',', (string)ini_get('disable_functions')));
    return !in_array('shell_exec', $disabled, true);
}

// PHPだけで合計サイズを数える（shell_execが使えない場合の予備）
function phpDirSize(string $dir): int {
    $size = 0;
    try {
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY,
            RecursiveIteratorIterator::CATCH_GET_CHILD
        );
        foreach ($it as $f) {
            if (!$f->isLink() && $f->isFile()) $size += $f->getSize();
        }
    } catch (Throwable $e) {}
    return $size;
}

// 指定フォルダの「合計」と「1階層下の内訳」をバイトで返す
function sizes(string $dir): array {
    $total = 0;
    $children = [];
    if (canExec()) {
        $out = (string)shell_exec('du -k -d 1 ' . escapeshellarg($dir) . ' 2>/dev/null');
        foreach (preg_split('/\R/', trim($out)) as $line) {
            if (!preg_match('/^(\d+)\s+(.+)$/', $line, $m)) continue;
            $bytes = (int)$m[1] * 1024;
            $path = rtrim($m[2], '/');
            if ($path === rtrim($dir, '/')) $total = $bytes;
            else $children[basename($path)] = $bytes;
        }
    }
    if ($total === 0) {
        foreach (scandir($dir) ?: [] as $name) {
            if ($name === '.' || $name === '..') continue;
            $p = $dir . '/' . $name;
            if (is_link($p)) continue;
            $children[$name] = is_dir($p) ? phpDirSize($p) : (int)@filesize($p);
        }
        $total = array_sum($children);
    }
    arsort($children);
    return [$total, $children];
}

function sslDaysLeft(string $domain): ?int {
    $ctx = stream_context_create(['ssl' => ['capture_peer_cert' => true, 'SNI_enabled' => true, 'peer_name' => $domain]]);
    $c = @stream_socket_client("ssl://{$domain}:443", $errno, $errstr, 8, STREAM_CLIENT_CONNECT, $ctx);
    if (!$c) return null;
    $params = stream_context_get_params($c);
    fclose($c);
    $cert = $params['options']['ssl']['peer_certificate'] ?? null;
    if (!$cert) return null;
    $info = openssl_x509_parse($cert);
    if (empty($info['validTo_time_t'])) return null;
    return (int)floor(($info['validTo_time_t'] - time()) / 86400);
}

$home = homeDir();
$cacheFile = $home . '/.onanchi_status_cache.json'; // 公開フォルダの外に保存

if (is_file($cacheFile) && time() - filemtime($cacheFile) < CACHE_MIN * 60 && !isset($_GET['fresh'])) {
    echo file_get_contents($cacheFile);
    exit;
}

[$total, $homeChildren] = sizes($home);
$www = $home . '/www';
[, $wwwChildren] = is_dir($www) ? sizes($www) : [0, []];

// 内訳: www の中のフォルダ（サイトごと）＋ www 以外（メール等）
$breakdown = [];
foreach ($wwwChildren as $name => $bytes) {
    $breakdown[] = ['name' => $name, 'bytes' => $bytes];
}
foreach ($homeChildren as $name => $bytes) {
    if ($name === 'www') continue;
    $label = $name === 'MailBox' ? 'メール' : $name;
    $breakdown[] = ['name' => $label, 'bytes' => $bytes];
}
usort($breakdown, fn($a, $b) => $b['bytes'] <=> $a['bytes']);
$breakdown = array_values(array_filter($breakdown, fn($x) => $x['bytes'] > 0));

$result = json_encode([
    'used_bytes'  => $total,
    'quota_bytes' => QUOTA_GB * 1024 ** 3,
    'breakdown'   => array_slice($breakdown, 0, 8),
    'ssl_days'    => sslDaysLeft(DOMAIN),
    'php_version' => PHP_VERSION,
    'checked_at'  => date('c'),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

@file_put_contents($cacheFile, $result);
echo $result;

<?php
/**
 * Приём заявок с сайта → CRM Oktell (+ Telegram / e-mail / CSV-копия).
 *
 * Безопасность (см. README → «Безопасность»):
 *  - только POST в формате application/x-www-form-urlencoded, тело ≤ 4 КБ (multipart/загрузки файлов отклоняются —
 *    это основной путь атаки PHP2Shell; дополнительно режется в .htaccess до запуска PHP)
 *  - проверка Origin/Referer: принимаются заявки только с собственного сайта
 *  - белые списки для модели, типа заявки и языка; имя — только буквы; телефон — 998 + 9 цифр
 *  - лимиты: 1 заявка с IP за N секунд + общий лимит заявок за 10 минут (защита CRM от флуда)
 *  - заявки и журналы хранятся ВНЕ публичной папки сайта (если хостинг позволяет), CSV защищён от формул Excel
 *  - ошибки PHP не показываются посетителю
 * Работает на PHP 7.4+ (рекомендуется 8.2.35+ / 8.3.36+ / 8.4.27+ / 8.5.12+ — исправлен PHP2Shell).
 */
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');

function out(bool $ok, string $err = '', int $code = 200): void {
    http_response_code($code);
    echo json_encode(['ok' => $ok, 'error' => $err]);
    exit;
}
set_exception_handler(function (Throwable $e): void { error_log('[send.php] ' . $e->getMessage()); out(false, 'server', 500); });

// предупреждение в журнал ошибок сервера, если PHP не обновлён после PHP2Shell (CVE-2026-109618/109619)
$patched = ['8.2' => '8.2.35', '8.3' => '8.3.36', '8.4' => '8.4.27', '8.5' => '8.5.12'];
$branch = PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;
if (!isset($patched[$branch]) ? version_compare(PHP_VERSION, '8.2', '<') : version_compare(PHP_VERSION, $patched[$branch], '<')) {
    error_log('[send.php] ВНИМАНИЕ: PHP ' . PHP_VERSION . ' уязвим к PHP2Shell — обновите PHP на хостинге');
}

/* ---------- 0. Тип запроса, размер, источник ---------- */
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { header('Allow: POST'); out(false, 'method', 405); }
$ctype = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
if (strpos($ctype, 'application/x-www-form-urlencoded') !== 0) out(false, 'type', 415);
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 4096 || !empty($_FILES)) out(false, 'size', 413);

// секреты и настройки можно держать вне публичной папки: ../aster-li-config.php
$cfgFile = is_file(dirname(__DIR__) . '/aster-li-config.php') ? dirname(__DIR__) . '/aster-li-config.php' : __DIR__ . '/config.php';
$cfg  = (array)require $cfgFile;
$lead = is_file(__DIR__ . '/lead.php') ? (array)require __DIR__ . '/lead.php' : [];

// заявки принимаются только со страниц собственного сайта
$allowedHosts = array_filter(array_map('strtolower', array_merge(
    (array)($lead['allowedHosts'] ?? []),
    [(string)($_SERVER['HTTP_HOST'] ?? '')]
)));
$srcHost = '';
foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $h) {
    if (!empty($_SERVER[$h])) { $srcHost = strtolower((string)parse_url((string)$_SERVER[$h], PHP_URL_HOST) . (parse_url((string)$_SERVER[$h], PHP_URL_PORT) ? ':' . parse_url((string)$_SERVER[$h], PHP_URL_PORT) : '')); break; }
}
$strip = fn($h) => preg_replace('/^www\./', '', $h);
if ($srcHost === '' || !in_array($strip($srcHost), array_map($strip, $allowedHosts), true)) out(false, 'origin', 403);

/* ---------- 1. Чтение и проверка полей ---------- */
$str = function (string $k, int $max = 200): string {
    $v = $_POST[$k] ?? '';
    if (!is_string($v)) return '';                                   // массивы (field[]=) отбрасываем
    $v = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $v) ?? '';          // управляющие символы и переносы строк
    return mb_substr(trim(strip_tags($v)), 0, $max);
};

if ($str('website') !== '') out(true);                                // ловушка для ботов: поле должно быть пустым
if ((int)$str('el', 12) < 1500) out(true);                            // форма заполнена быстрее 1,5 с или без JS — бот (тихо)

$name   = preg_replace('/\s+/u', ' ', $str('name', 60)) ?? '';
$digits = preg_replace('/\D/', '', $str('phone', 30)) ?? '';
if (mb_strlen($name) < 2 || !preg_match("/^[\\p{L}\\s'ʻʼ‘’`\\-]+$/u", $name)) out(false, 'name', 422);
if (!preg_match('/^998\d{9}$/', $digits)) out(false, 'phone', 422);

$models = (array)($lead['models'] ?? []);
$model  = in_array($str('model', 40), $models, true) ? $str('model', 40) : '';
$type   = in_array($str('type', 20), ['booking', 'price'], true) ? $str('type', 20) : 'price';
$lang   = in_array($str('lang', 5), ['ru', 'uz'], true) ? $str('lang', 5) : 'ru';
$url    = fn($v) => preg_match('~^https?://[^\s"<>]{1,290}$~i', $v) ? $v : '';
$page   = $url($str('page', 300));
$ref    = $url($str('ref', 300));

$u = [];
parse_str($str('utm', 600), $rawUtm);
foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as $k) {
    $v = $rawUtm[$k] ?? '';
    $u[$k] = is_string($v) ? mb_substr(preg_replace('/[^\p{L}\p{N}\s._\-:|\/+%]/u', '', $v) ?? '', 0, 150) : '';
}

$phone    = sprintf('+998 (%s) %s %s %s', substr($digits, 3, 2), substr($digits, 5, 3), substr($digits, 8, 2), substr($digits, 10, 2));
$typeName = $type === 'booking' ? 'Бронирование' : 'Заявка с сайта';
$time     = (new DateTime('now', new DateTimeZone('Asia/Tashkent')))->format('d.m.Y H:i');

/* ---------- 2. Хранилище: вне публичной папки, если можно ---------- */
$dir = (string)($cfg['storage_dir'] ?? '');
if ($dir === '') {
    $parent = dirname(__DIR__);
    if (is_writable($parent)) {
        $dir = $parent . '/aster-li-private';
    } else {
        $secret = is_file(__DIR__ . '/secret.php') ? (string)require __DIR__ . '/secret.php' : hash('sha256', __FILE__ . php_uname());
        $dir = __DIR__ . '/leads_' . substr(hash('sha256', $secret), 0, 20);  // неугадываемое имя папки
    }
}
if (!is_dir($dir)) {
    @mkdir($dir, 0750, true);
    @file_put_contents($dir . '/.htaccess', "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n");
    @file_put_contents($dir . '/index.html', '');
}

/* ---------- 3. Лимиты ---------- */
$ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
if (!empty($cfg['behind_cloudflare']) && !empty($_SERVER['HTTP_CF_CONNECTING_IP'])) $ip = (string)$_SERVER['HTTP_CF_CONNECTING_IP'];
$rl = $dir . '/.rl_' . hash('sha256', $ip);
if (is_file($rl) && time() - (int)filemtime($rl) < (int)($cfg['rate_limit_sec'] ?? 30)) out(false, 'rate', 429);
@touch($rl);

// общий лимит: не больше N заявок за 10 минут со всех адресов
$gl = $dir . '/.global';
$stamps = array_filter(array_map('intval', explode(',', (string)@file_get_contents($gl))), fn($t) => $t > time() - 600);
if (count($stamps) >= (int)($cfg['global_limit_10min'] ?? 40)) out(false, 'rate', 429);
$stamps[] = time();
@file_put_contents($gl, implode(',', $stamps), LOCK_EX);

// уборка старых файлов лимита (раз в ~50 запросов)
if (random_int(1, 50) === 1) foreach ((array)glob($dir . '/.rl_*') as $f) if (time() - (int)@filemtime($f) > 3600) @unlink($f);

/* ---------- 4. CRM Oktell ---------- */
$crm = 'off';
$endpoint = (string)($lead['endpoint'] ?? '');
if ($endpoint !== '' && (strpos($endpoint, 'https://') === 0 || !empty($cfg['allow_http_endpoint']))) {
    $json = json_encode([
        'fio'          => $name,
        'phone'        => ' ' . substr($phone, 1),   // как в образце Oktell: " 998 (97) 521 32 32"
        'comment'      => '',
        'marka'        => (string)($lead['marka'] ?? 'li auto'),
        'model'        => trim((string)preg_replace('/^Li\s+/i', '', $model)),
        'website'      => (string)($lead['website'] ?? ''),
        'city'         => (string)($lead['city'] ?? ''),
        'language'     => strtoupper($lang),
        'utm_source'   => $u['utm_source'],
        'utm_medium'   => $u['utm_medium'],
        'utm_campaign' => $u['utm_campaign'],
        'utm_content'  => $u['utm_content'],
        'utm_term'     => $u['utm_term'],
    ], JSON_UNESCAPED_UNICODE);
    $code = 0; $resp = '';
    if (function_exists('curl_init')) {
        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST => true, CURLOPT_POSTFIELDS => $json, CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json; charset=utf-8', 'Accept: application/json'],
            CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 25, CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $resp = (string)curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($code === 0) $resp = curl_error($ch);
        curl_close($ch);
    } else {
        $ctx = stream_context_create(['http' => ['method' => 'POST', 'timeout' => 25, 'ignore_errors' => true, 'follow_location' => 0,
            'header' => "Content-Type: application/json; charset=utf-8\r\n", 'content' => $json]]);
        $resp = (string)@file_get_contents($endpoint, false, $ctx);
        $hdrs = function_exists('http_get_last_response_headers') ? (array)http_get_last_response_headers() : (array)($http_response_header ?? []);
        if (isset($hdrs[0]) && preg_match('/\s(\d{3})\s/', (string)$hdrs[0], $m)) $code = (int)$m[1];
    }
    $crm = ($code >= 200 && $code < 300) ? 'ok' : "error {$code}";
    $resp = preg_replace('/[\x00-\x1F\x7F]/', ' ', mb_substr($resp, 0, 300));
    @file_put_contents($dir . '/crm.log', "[{$time}] {$crm} → {$json} ← {$resp}\n", FILE_APPEND | LOCK_EX);
}

/* ---------- 5. Telegram / e-mail ---------- */
$e = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
$lines = [($type === 'booking' ? '🔖' : '🚗') . " <b>{$e($typeName)} · Li Auto</b>", '', "👤 {$e($name)}", "📞 <a href=\"tel:+{$digits}\">{$e($phone)}</a>"];
if ($model) $lines[] = "🚙 <b>{$e($model)}</b>";
$lines[] = '';
$lines[] = '🌐 ' . strtoupper($lang) . " · {$time} · CRM: {$crm}";
if ($u['utm_source'] || $u['utm_campaign']) $lines[] = "🏷 {$e($u['utm_source'])} / {$e($u['utm_campaign'])}";
$text = implode("\n", $lines);

$sent = ($crm === 'ok');
if (!empty($cfg['telegram_token']) && !empty($cfg['telegram_chat_id'])) {
    foreach (array_map('trim', explode(',', (string)$cfg['telegram_chat_id'])) as $chat) {
        $ctx = stream_context_create(['http' => ['method' => 'POST', 'timeout' => 8,
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => http_build_query(['chat_id' => $chat, 'text' => $text, 'parse_mode' => 'HTML', 'disable_web_page_preview' => 1])]]);
        $r = @file_get_contents('https://api.telegram.org/bot' . rawurlencode((string)$cfg['telegram_token']) . '/sendMessage', false, $ctx);
        if ($r && (json_decode($r, true)['ok'] ?? false)) $sent = true;
    }
}
if (!empty($cfg['email_to']) && filter_var($cfg['email_to'], FILTER_VALIDATE_EMAIL) && filter_var($cfg['email_from'] ?? '', FILTER_VALIDATE_EMAIL)) {
    $subject = '=?UTF-8?B?' . base64_encode("{$typeName} Li Auto {$model}") . '?=';
    $headers = "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nFrom: {$cfg['email_from']}\r\n";
    if (@mail((string)$cfg['email_to'], $subject, nl2br($text), $headers)) $sent = true;
}

/* ---------- 6. CSV-копия (защита от формул Excel) ---------- */
if (!empty($cfg['save_csv'])) {
    $cell = fn($v) => preg_match('/^[=+\-@\t\r|%]/u', (string)$v) ? "'" . $v : (string)$v;
    $file = $dir . '/leads.csv';
    $new  = !is_file($file);
    if ($fh = @fopen($file, 'a')) {
        flock($fh, LOCK_EX);
        if ($new) { fwrite($fh, "\xEF\xBB\xBF"); fputcsv($fh, ['Дата', 'Имя', 'Телефон', 'Модель', 'Тип', 'Язык', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'Страница', 'Реферер', 'CRM'], ';'); }
        fputcsv($fh, array_map($cell, [$time, $name, substr($phone, 1), $model, $typeName, strtoupper($lang), $u['utm_source'], $u['utm_medium'], $u['utm_campaign'], $u['utm_content'], $u['utm_term'], $page, $ref, $crm]), ';');
        flock($fh, LOCK_UN);
        fclose($fh);
        $sent = true;
    }
}

$sent ? out(true) : out(false, 'delivery', 500);

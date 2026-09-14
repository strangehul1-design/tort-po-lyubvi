<?php
declare(strict_types=1);

// Предупреждение PHP не должно попасть в ответ и сломать JSON
ini_set('display_errors', '0');
ini_set('log_errors', '1');

/* ═══════════════════════════════════════════
   Обработчик заявок на своём хостинге — общие функции.

   Порт api/worker.js + notify.js + store.js с Cloudflare на обычный
   PHP-хостинг в России. Логика та же:
     1. заявка СНАЧАЛА записывается на диск хостинга — в России;
     2. потом уходит в Telegram (и в ВК, если он настроен);
     3. то, что не ушло, досылается при следующей заявке.

   Ключей в этом файле нет и быть не должно. Они лежат в tort-config.php
   на уровень выше папки сайта — открыть его по ссылке нельзя.
   Образец — config.example.php.
   ═══════════════════════════════════════════ */

const MAX_FILES = 6;
const MAX_FILE_BYTES = 9 * 1024 * 1024;     // Telegram sendPhoto не берёт больше 10 МБ
const MAX_PHOTO_STORE = 4 * 1024 * 1024;    // сколько фото держим на диске до доставки
const KEEP_DAYS = 180;                      // срок хранения — тот же, что в политике

/* Подписи должны совпадать с тем, что человек видит в форме. */
const LABELS = [
    'date' => 'Дата свадьбы', 'place' => 'Место проведения', 'guests' => 'Количество гостей',
    'filling' => 'Начинка', 'service' => 'Презентация и нарезка', 'channel' => 'Способ связи',
    'name' => 'Имя', 'phone' => 'Телефон', 'email' => 'Почта', 'time' => 'Удобное время',
    'more' => 'Дополнительно', 'pickup' => 'Как получить сет', 'address' => 'Куда привезти',
];
const LABEL_OVERRIDE = [
    'tasting' => ['date' => 'Когда удобно получить'],
];
const ORDER = [
    'order'    => ['date', 'place', 'guests', 'filling', 'service', 'name', 'phone', 'channel', 'time', 'more'],
    'tasting'  => ['date', 'pickup', 'address', 'name', 'phone', 'channel'],
    'checkout' => ['name', 'phone', 'email', 'channel', 'date', 'more'],
];
const TITLES = [
    'order'    => '🎂 Заявка на торт',
    'tasting'  => '🍰 Запись на дегустацию',
    'checkout' => '🧾 Заказ из корзины',
];

/* ── Настройки ── */

function config(): array
{
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $candidates = [
        (string) getenv('TORT_CONFIG'),
        dirname(__DIR__, 2) . '/tort-config.php',   // на уровень выше папки сайта
        __DIR__ . '/config.php',                    // запасной путь, закрыт в .htaccess
    ];
    foreach ($candidates as $file) {
        if ($file !== '' && is_file($file)) {
            $loaded = require $file;
            $cfg = is_array($loaded) ? $loaded : [];
            return $cfg;
        }
    }
    $cfg = [];
    return $cfg;
}

function storage_dir(): string
{
    $dir = (string) (config()['STORAGE_DIR'] ?? (dirname(__DIR__, 2) . '/tort-requests'));
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    /* Если хостинг всё же положил папку внутрь сайта — закрываем её. */
    if (is_dir($dir) && !is_file($dir . '/.htaccess')) {
        @file_put_contents($dir . '/.htaccess', "Require all denied\nDeny from all\n");
    }
    return $dir;
}

/* ── Ответ и происхождение запроса ── */

function allowed_origins(): array
{
    $list = config()['ALLOWED_ORIGINS'] ?? ['https://asiyatort.ru', 'https://www.asiyatort.ru',
                                              'http://asiyatort.ru', 'http://www.asiyatort.ru'];
    return array_values(array_filter(array_map('trim', (array) $list)));
}

function send_cors(): void
{
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    $allowed = allowed_origins();
    header('Access-Control-Allow-Origin: ' . (in_array($origin, $allowed, true) ? $origin : ($allowed[0] ?? '')));
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Vary: Origin');
}

/** Запрос со своего сайта? Браузер ставит Origin на POST всегда. */
function origin_ok(): bool
{
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    return $origin === '' || in_array($origin, allowed_origins(), true);
}

function respond(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/* ── Текст ── */

function cut_text(string $s, int $n): string
{
    if (function_exists('mb_substr')) return mb_substr($s, 0, $n, 'UTF-8');
    return (string) preg_replace('/^(.{0,' . $n . '}).*$/su', '$1', $s);
}

function esc_html(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function human_date(string $key, string $value): string
{
    if ($key === 'date' && preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m)) {
        return "{$m[3]}.{$m[2]}.{$m[1]}";
    }
    return $value;
}

function now_samara(): string
{
    $d = new DateTime('now', new DateTimeZone('Europe/Samara'));
    return $d->format('d.m.Y, H:i:s');
}

function label_for(string $kind, string $key): string
{
    return LABEL_OVERRIDE[$kind][$key] ?? LABELS[$key] ?? $key;
}

function letter_html(array $letter): string
{
    $lines = ['<b>' . esc_html($letter['title']) . '</b>', ''];
    foreach ($letter['rows'] as [$k, $v]) {
        $lines[] = '<b>' . esc_html((string) $k) . ':</b> ' . esc_html((string) $v);
    }
    if (!empty($letter['footer'])) {
        $lines[] = '';
        $lines[] = '<i>' . esc_html($letter['footer']) . '</i>';
    }
    return implode("\n", $lines);
}

function letter_plain(array $letter): string
{
    $lines = [$letter['title'], ''];
    foreach ($letter['rows'] as [$k, $v]) $lines[] = "$k: $v";
    if (!empty($letter['footer'])) {
        $lines[] = '';
        $lines[] = $letter['footer'];
    }
    return implode("\n", $lines);
}

/* ── Telegram ── */

function tg_call(string $method, array $fields): array
{
    $cfg = config();
    $base = rtrim((string) ($cfg['TELEGRAM_API_BASE'] ?? 'https://api.telegram.org'), '/');
    $ch = curl_init($base . '/bot' . $cfg['TELEGRAM_BOT_TOKEN'] . '/' . $method);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $fields,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 25,
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err = curl_error($ch);
    $data = is_string($body) ? json_decode($body, true) : null;
    return is_array($data) ? $data : ['ok' => false, 'description' => $err !== '' ? $err : "HTTP $code"];
}

function tg_recipients(): array
{
    $raw = (string) (config()['TELEGRAM_CHAT_ID'] ?? '');
    return array_values(array_filter(preg_split('/[,;\s]+/', $raw) ?: []));
}

/**
 * Одна заявка — всем получателям. Доставлено, если принял хоть один:
 * кто-то мог заблокировать бота, это не повод терять заявку для остальных.
 * @param array $files [['path'=>, 'name'=>, 'type'=>], ...]
 */
function send_telegram(string $html, array $files): array
{
    $cfg = config();
    $chats = tg_recipients();
    if (empty($cfg['TELEGRAM_BOT_TOKEN']) || !$chats) return ['skipped' => true];

    $okChats = 0;
    $errors = [];
    foreach ($chats as $chat) {
        $r = tg_call('sendMessage', [
            'chat_id' => $chat,
            'parse_mode' => 'HTML',
            'disable_web_page_preview' => 'true',
            'text' => cut_text($html, 4000),
        ]);
        if (empty($r['ok'])) {
            $errors[] = "чат $chat: " . ($r['description'] ?? 'ошибка');
            continue;
        }
        $okChats++;
        foreach ($files as $f) {
            if (!is_file($f['path'])) continue;
            $caption = cut_text('Референс: ' . $f['name'], 1000);
            $p = tg_call('sendPhoto', [
                'chat_id' => $chat, 'caption' => $caption,
                'photo' => new CURLFile($f['path'], $f['type'], $f['name']),
            ]);
            if (empty($p['ok'])) {
                tg_call('sendDocument', [
                    'chat_id' => $chat, 'caption' => $caption,
                    'document' => new CURLFile($f['path'], $f['type'], $f['name']),
                ]);
            }
        }
    }
    if ($okChats === 0) return ['ok' => false, 'error' => 'telegram: ' . implode('; ', $errors)];
    return ['ok' => true, 'failed' => $errors];
}

/* ── ВКонтакте: если заданы VK_TOKEN и VK_PEER_ID ── */

function send_vk(string $plain): array
{
    $cfg = config();
    if (empty($cfg['VK_TOKEN']) || empty($cfg['VK_PEER_ID'])) return ['skipped' => true];
    $ch = curl_init('https://api.vk.com/method/messages.send');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'peer_id' => $cfg['VK_PEER_ID'],
            'message' => cut_text($plain, 4000),
            'random_id' => (string) (time() % 2147483647),
            'dont_parse_links' => '1',
            'v' => '5.199',
            'access_token' => $cfg['VK_TOKEN'],
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 20,
    ]);
    $body = curl_exec($ch);
    $data = is_string($body) ? json_decode($body, true) : null;
    if (!is_array($data) || isset($data['error'])) {
        return ['ok' => false, 'error' => 'vk: ' . ($data['error']['error_msg'] ?? 'ошибка')];
    }
    return ['ok' => true];
}

/** Во все настроенные каналы. Падение одного не отменяет остальные. */
function notify_all(array $letter, array $files): array
{
    $delivered = [];
    $errors = [];
    foreach (['telegram' => send_telegram(letter_html($letter), $files),
              'vk' => send_vk(letter_plain($letter))] as $name => $r) {
        if (!empty($r['skipped'])) continue;
        if (!empty($r['ok'])) $delivered[] = $name;
        else $errors[] = (string) ($r['error'] ?? $name);
    }
    return ['delivered' => $delivered, 'errors' => $errors];
}

/* ── Хранилище: файлы на диске хостинга, в России ── */

function new_id(): string
{
    return gmdate('Ymd-His') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 4));
}

function record_path(string $id): string
{
    return storage_dir() . '/req-' . preg_replace('/[^A-Za-z0-9-]/', '', $id) . '.json';
}

/**
 * Записывает заявку ДО отправки. Фото кладём, пока влезают в лимит:
 * телефон клиента важнее референса.
 * @param array $uploads [['tmp'=>, 'name'=>, 'type'=>, 'size'=>], ...]
 * @return array|null запись с путями сохранённых фото или null, если не записалось
 */
function store_save(string $id, array $record, array $uploads): ?array
{
    $dir = storage_dir();
    if (!is_dir($dir) || !is_writable($dir)) return null;

    $photos = [];
    $budget = MAX_PHOTO_STORE;
    $photoDir = $dir . '/photos-' . $id;
    foreach ($uploads as $i => $u) {
        $entry = ['name' => $u['name'], 'size' => $u['size'], 'type' => $u['type'], 'saved' => false];
        if ($u['size'] <= $budget) {
            if (!is_dir($photoDir)) @mkdir($photoDir, 0700, true);
            $ext = strtolower(pathinfo($u['name'], PATHINFO_EXTENSION)) ?: 'jpg';
            $target = $photoDir . '/' . $i . '.' . preg_replace('/[^a-z0-9]/', '', $ext);
            if (@copy($u['tmp'], $target)) {
                $entry['saved'] = true;
                $entry['path'] = $target;
                $budget -= $u['size'];
            }
        }
        $photos[] = $entry;
    }

    $value = [
        'id' => $id,
        'created' => gmdate('c'),
        'kind' => $record['kind'],
        'title' => $record['title'],
        'rows' => $record['rows'],
        'text' => $record['text'],
        'photos' => $photos,
        'status' => 'pending',
        'delivered' => [],
        'errors' => [],
        'attempts' => 0,
    ];
    $ok = @file_put_contents(record_path($id), json_encode($value, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    return $ok === false ? null : $value;
}

function store_mark(string $id, array $delivered, array $errors): void
{
    $file = record_path($id);
    if (!is_file($file)) return;
    $v = json_decode((string) file_get_contents($file), true);
    if (!is_array($v)) return;
    $v['attempts'] = (int) ($v['attempts'] ?? 0) + 1;
    $v['delivered'] = $delivered;
    $v['errors'] = $errors;
    $v['status'] = $delivered ? 'delivered' : 'pending';
    if ($v['status'] === 'delivered') {
        /* Доставлено — фото больше не нужны. */
        foreach ($v['photos'] ?? [] as $k => $p) {
            if (!empty($p['path']) && is_file($p['path'])) @unlink($p['path']);
            $v['photos'][$k] = ['name' => $p['name'], 'size' => $p['size'], 'saved' => false];
        }
        @rmdir(storage_dir() . '/photos-' . $v['id']);
    }
    @file_put_contents($file, json_encode($v, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}

function store_list(bool $onlyPending, int $limit): array
{
    $files = glob(storage_dir() . '/req-*.json') ?: [];
    rsort($files);   // имя начинается с даты — новые первыми
    $out = [];
    foreach ($files as $f) {
        if (count($out) >= $limit) break;
        $v = json_decode((string) @file_get_contents($f), true);
        if (!is_array($v)) continue;
        if ($onlyPending && ($v['status'] ?? '') !== 'pending') continue;
        $out[] = $v;
    }
    return $out;
}

/** Старше срока хранения — удаляем: так обещано в политике. */
function store_cleanup(): void
{
    $edge = time() - KEEP_DAYS * 86400;
    foreach (glob(storage_dir() . '/req-*.json') ?: [] as $f) {
        if (@filemtime($f) < $edge) {
            $id = substr(basename($f, '.json'), 4);
            foreach (glob(storage_dir() . '/photos-' . $id . '/*') ?: [] as $p) @unlink($p);
            @rmdir(storage_dir() . '/photos-' . $id);
            @unlink($f);
        }
    }
}

/** Досылает то, что не ушло раньше. Отдельный планировщик не нужен. */
function retry_pending(string $skipId): int
{
    /* Две заявки в одну секунду не должны дослать одно и то же дважды. */
    $lock = @fopen(storage_dir() . '/retry.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) return 0;

    $done = 0;
    foreach (store_list(true, 6) as $rec) {
        if ($rec['id'] === $skipId) continue;
        $files = [];
        foreach ($rec['photos'] ?? [] as $p) {
            if (!empty($p['saved']) && !empty($p['path'])) {
                $files[] = ['path' => $p['path'], 'name' => $p['name'], 'type' => $p['type'] ?? 'image/jpeg'];
            }
        }
        $letter = [
            'title' => $rec['title'],
            'rows' => $rec['rows'] ?? [],
            'footer' => 'Повторная отправка · заявка от ' . $rec['created'],
        ];
        $r = notify_all($letter, $files);
        store_mark($rec['id'], $r['delivered'], $r['errors']);
        if ($r['delivered']) $done++;
        if ($done >= 5) break;
    }
    flock($lock, LOCK_UN);
    fclose($lock);
    return $done;
}

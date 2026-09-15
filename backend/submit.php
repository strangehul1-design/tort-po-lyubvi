<?php
declare(strict_types=1);

/* ═══════════════════════════════════════════
   POST /backend/submit.php — заявки с форм сайта.

   Отвечает тем же JSON, что и прежний сервер на Cloudflare:
     { ok: true, id, delivered }       — ушло
     { ok: true, id, saved: true }     — записано, уведомление дошлём позже
     { ok: false, error }              — сайт покажет запасной путь через ВК
   ═══════════════════════════════════════════ */

require __DIR__ . '/lib.php';

ignore_user_abort(true);
@set_time_limit(120);

send_cors();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($method !== 'POST') respond(['ok' => false, 'error' => 'Метод не поддерживается'], 405);
if (!origin_ok()) respond(['ok' => false, 'error' => 'origin'], 403);

/* Если тело больше post_max_size, PHP молча отдаёт пустые $_POST и $_FILES.
   Без этой проверки ушла бы пустая заявка — отвечаем ошибкой, и сайт
   предложит отправить через сообщество. */
if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0 && !$_POST && !$_FILES) {
    respond(['ok' => false, 'error' => 'Слишком большие вложения'], 413);
}

// Ловушка для ботов: человек это поле не видит и не заполняет
if (trim((string) ($_POST['company'] ?? '')) !== '') respond(['ok' => true]);

$kindRaw = (string) ($_POST['form_type'] ?? 'order');
$kind = isset(ORDER[$kindRaw]) ? $kindRaw : 'order';

$rows = [];
foreach (ORDER[$kind] as $key) {
    $v = $_POST[$key] ?? null;
    if (!is_string($v) || trim($v) === '') continue;
    $rows[] = [label_for($kind, $key), cut_text(human_date($key, trim($v)), 2000)];
}
if ($kind === 'order' && !empty($_POST['decor_later'])) {
    $rows[] = ['Декор', 'референса нет — обсудить индивидуально'];
}
if (!empty($_POST['consent'])) {
    $rows[] = ['Согласие на обработку данных', 'дано'];
}

/* Референсы. Картинку узнаём по содержимому (getimagesize), а не по расширению.
   Снимки HEIC с iPhone PHP прочитать не умеет — их пропускаем по расширению. */
$uploads = [];
if (isset($_FILES['refs']) && is_array($_FILES['refs']['name'] ?? null)) {
    $count = count($_FILES['refs']['name']);
    for ($i = 0; $i < $count && count($uploads) < MAX_FILES; $i++) {
        $err = $_FILES['refs']['error'][$i] ?? UPLOAD_ERR_NO_FILE;
        $size = (int) ($_FILES['refs']['size'][$i] ?? 0);
        $tmp = (string) ($_FILES['refs']['tmp_name'][$i] ?? '');
        if ($err !== UPLOAD_ERR_OK || $size <= 0 || $size > MAX_FILE_BYTES || !is_uploaded_file($tmp)) continue;
        $name = basename((string) $_FILES['refs']['name'][$i]);
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        $info = @getimagesize($tmp);
        if (!$info && !in_array($ext, ['heic', 'heif', 'avif', 'webp'], true)) continue;
        $uploads[] = [
            'tmp' => $tmp,
            'name' => $name,
            'type' => (string) ($info['mime'] ?? ('image/' . $ext)),
            'size' => $size,
        ];
    }
}
if ($uploads) $rows[] = ['Референсы', count($uploads) . ' шт. — ниже'];

$letter = [
    'title' => TITLES[$kind],
    'rows' => $rows,
    'footer' => 'Сайт «ТОРТ по любви» · ' . now_samara(),
];

/* Сначала на диск, потом в Telegram. Если отправка упадёт, имя
   и телефон клиента уже записаны — заявка не потеряется. */
$id = new_id();
$saved = store_save($id, [
    'kind' => $kind,
    'title' => $letter['title'],
    'rows' => $rows,
    'text' => letter_plain($letter),
], $uploads);

/* В Telegram шлём файл, который уже лежит на диске, а если в лимит
   хранения он не влез — временный файл загрузки, он жив до конца запроса. */
$files = [];
foreach ($uploads as $i => $u) {
    $path = $saved['photos'][$i]['path'] ?? $u['tmp'];
    $files[] = ['path' => $path, 'name' => $u['name'], 'type' => $u['type']];
}

$result = notify_all($letter, $files);
if ($saved) store_mark($id, $result['delivered'], $result['errors']);

if ($result['delivered']) {
    [$answer, $status] = [['ok' => true, 'id' => $id, 'delivered' => $result['delivered']], 200];
} elseif ($saved) {
    [$answer, $status] = [['ok' => true, 'id' => $id, 'delivered' => [], 'saved' => true,
                           'note' => 'Заявка сохранена, уведомление отправим позже'], 200];
} else {
    [$answer, $status] = [['ok' => false, 'error' => $result['errors'][0] ?? 'Не удалось доставить заявку'], 502];
}

/* Отвечаем человеку сразу, а старые недоставленные заявки досылаем
   уже после — ждать чужие уведомления ему незачем. */
http_response_code($status);
header('Content-Type: application/json; charset=utf-8');
echo json_encode($answer, JSON_UNESCAPED_UNICODE);
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
} elseif (function_exists('litespeed_finish_request')) {
    litespeed_finish_request();
}

// Если Telegram не ответил и сейчас, досылать старое бессмысленно — попробуем со следующей заявкой
if ($saved && $result['delivered']) retry_pending($id);
store_cleanup();   // старше 180 дней — удаляем, как обещано в политике

<?php
declare(strict_types=1);

/* ═══════════════════════════════════════════
   GET /backend/requests.php?key=ВАШ_КЛЮЧ          — все заявки за полгода
   GET /backend/requests.php?key=ВАШ_КЛЮЧ&pending=1 — только недоставленные

   Ключ — ADMIN_KEY из tort-config.php. Без него отвечаем 404,
   чтобы перебором нельзя было добраться до чужих телефонов.
   ═══════════════════════════════════════════ */

require __DIR__ . '/lib.php';

$key = (string) ($_GET['key'] ?? '');
$admin = (string) (config()['ADMIN_KEY'] ?? '');
if ($admin === '' || !hash_equals($admin, $key)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Not found';
    exit;
}

$items = store_list(!empty($_GET['pending']), 200);
foreach ($items as &$it) {
    // пути к фото на диске наружу не отдаём
    $it['photos'] = array_map(fn($p) => ['name' => $p['name'] ?? '', 'size' => $p['size'] ?? 0,
                                         'saved' => !empty($p['saved'])], $it['photos'] ?? []);
}
unset($it);

respond(['ok' => true, 'count' => count($items), 'items' => $items]);

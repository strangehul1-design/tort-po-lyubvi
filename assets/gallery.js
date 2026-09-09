/* ═══════════════════════════════════════════
   Фотографии сайта. ФАЙЛ СОБИРАЕТСЯ АВТОМАТИЧЕСКИ —
   правки руками затрёт следующий запуск.
   Пересобрать после добавления снимков в assets/photo:
     powershell -ExecutionPolicy Bypass -File tools/gallery-manifest.ps1
   ═══════════════════════════════════════════ */

/* Торты из прайса. Порядок совпадает с порядком позиций
   в assets/catalog.js: первый снимок — первая позиция. */
window.PRICE_PHOTOS = [
  { small: 'assets/photo/web/p01-800.jpg', big: 'assets/photo/web/p01-1600.jpg', w: 901, h: 1600 },
  { small: 'assets/photo/web/p02-800.jpg', big: 'assets/photo/web/p02-1600.jpg', w: 900, h: 1600 },
  { small: 'assets/photo/web/p03-800.jpg', big: 'assets/photo/web/p03-1600.jpg', w: 1200, h: 1600 },
  { small: 'assets/photo/web/p04-800.jpg', big: 'assets/photo/web/p04-1600.jpg', w: 900, h: 1600 },
  { small: 'assets/photo/web/p05-800.jpg', big: 'assets/photo/web/p05-1600.jpg', w: 1254, h: 1254 },
  { small: 'assets/photo/web/p06-800.jpg', big: 'assets/photo/web/p06-1600.jpg', w: 900, h: 1600 },
  { small: 'assets/photo/web/p07-800.jpg', big: 'assets/photo/web/p07-1600.jpg', w: 531, h: 1080 },
  { small: 'assets/photo/web/p08-800.jpg', big: 'assets/photo/web/p08-1600.jpg', w: 854, h: 1268 },
  { small: 'assets/photo/web/p09-800.jpg', big: 'assets/photo/web/p09-1600.jpg', w: 900, h: 1600 },
];

/* Кадры со свадеб под отзывами. */
window.GALLERY = [
  { small: 'assets/photo/web/g01-800.jpg', big: 'assets/photo/web/g01-1600.jpg', w: 1600, h: 1068 },
  { small: 'assets/photo/web/g02-800.jpg', big: 'assets/photo/web/g02-1600.jpg', w: 946, h: 1356 },
  { small: 'assets/photo/web/g03-800.jpg', big: 'assets/photo/web/g03-1600.jpg', w: 1066, h: 1600 },
  { small: 'assets/photo/web/g04-800.jpg', big: 'assets/photo/web/g04-1600.jpg', w: 1067, h: 1600 },
  { small: 'assets/photo/web/g05-800.jpg', big: 'assets/photo/web/g05-1600.jpg', w: 640, h: 916 },
];

/* Скриншоты отзывов — порядок как в assets/photo/reviews. */
window.REVIEW_SHOTS = [
  { small: 'assets/photo/web/r01-800.jpg', big: 'assets/photo/web/r01-1600.jpg', w: 1068, h: 1280 },
  { small: 'assets/photo/web/r02-800.jpg', big: 'assets/photo/web/r02-1600.jpg', w: 1080, h: 1515 },
  { small: 'assets/photo/web/r03-800.jpg', big: 'assets/photo/web/r03-1600.jpg', w: 842, h: 1600 },
  { small: 'assets/photo/web/r04-800.jpg', big: 'assets/photo/web/r04-1600.jpg', w: 900, h: 1600 },
  { small: 'assets/photo/web/r05-800.jpg', big: 'assets/photo/web/r05-1600.jpg', w: 1139, h: 1600 },
  { small: 'assets/photo/web/r06-800.jpg', big: 'assets/photo/web/r06-1600.jpg', w: 1600, h: 1218 },
  { small: 'assets/photo/web/r07-800.jpg', big: 'assets/photo/web/r07-1600.jpg', w: 1319, h: 1600 },
  { small: 'assets/photo/web/r08-800.jpg', big: 'assets/photo/web/r08-1600.jpg', w: 1199, h: 1600 },
];

/* Фото разделов: s01 — годовщина, s02 — кондитер. */
window.SECTION_PHOTOS = [
  { small: 'assets/photo/web/s01-800.jpg', big: 'assets/photo/web/s01-1600.jpg', w: 1200, h: 1600 },
  { small: 'assets/photo/web/s02-800.jpg', big: 'assets/photo/web/s02-1600.jpg', w: 900, h: 1600 },
];

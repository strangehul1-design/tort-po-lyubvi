/* ═══════════════════════════════════════════
   Фотографии сайта. ФАЙЛ СОБИРАЕТСЯ АВТОМАТИЧЕСКИ —
   правки руками затрёт следующий запуск.
   Пересобрать после добавления снимков в assets/photo:
     powershell -ExecutionPolicy Bypass -File tools/gallery-manifest.ps1
   ═══════════════════════════════════════════ */

/* Торты из прайса. Порядок совпадает с порядком позиций
   в assets/catalog.js: первый снимок — первая позиция. */
window.PRICE_PHOTOS = [
  { small: 'assets/photo/web/p01-800.jpg?v=0f917bbd', big: 'assets/photo/web/p01-1600.jpg?v=5d5a20d3', w: 901, h: 1600 },
  { small: 'assets/photo/web/p02-800.jpg?v=0ee091e5', big: 'assets/photo/web/p02-1600.jpg?v=6b89a530', w: 900, h: 1600 },
  { small: 'assets/photo/web/p03-800.jpg?v=378736d5', big: 'assets/photo/web/p03-1600.jpg?v=2c9fba2d', w: 1200, h: 1600 },
  { small: 'assets/photo/web/p04-800.jpg?v=04c54d91', big: 'assets/photo/web/p04-1600.jpg?v=ec992609', w: 900, h: 1600 },
  { small: 'assets/photo/web/p05-800.jpg?v=625e5349', big: 'assets/photo/web/p05-1600.jpg?v=289bd9ff', w: 1254, h: 1254 },
  { small: 'assets/photo/web/p06-800.jpg?v=76927a8b', big: 'assets/photo/web/p06-1600.jpg?v=13a8422a', w: 900, h: 1600 },
  { small: 'assets/photo/web/p07-800.jpg?v=34c88e4f', big: 'assets/photo/web/p07-1600.jpg?v=829886df', w: 531, h: 1080 },
  { small: 'assets/photo/web/p08-800.jpg?v=3a6609ec', big: 'assets/photo/web/p08-1600.jpg?v=87afb90b', w: 854, h: 1268 },
  { small: 'assets/photo/web/p09-800.jpg?v=acf298bf', big: 'assets/photo/web/p09-1600.jpg?v=1e87c6cc', w: 900, h: 1600 },
];

/* Кадры со свадеб под отзывами. */
window.GALLERY = [
  { small: 'assets/photo/web/g01-800.jpg?v=9e2a435d', big: 'assets/photo/web/g01-1600.jpg?v=0c1abcfc', w: 1600, h: 1068 },
  { small: 'assets/photo/web/g02-800.jpg?v=f4a5d7af', big: 'assets/photo/web/g02-1600.jpg?v=41294e4f', w: 946, h: 1356 },
  { small: 'assets/photo/web/g03-800.jpg?v=62ae2c3b', big: 'assets/photo/web/g03-1600.jpg?v=9c858938', w: 1066, h: 1600 },
  { small: 'assets/photo/web/g04-800.jpg?v=b280799b', big: 'assets/photo/web/g04-1600.jpg?v=7cd7bd22', w: 1067, h: 1600 },
  { small: 'assets/photo/web/g05-800.jpg?v=709731bc', big: 'assets/photo/web/g05-1600.jpg?v=d1915b4a', w: 640, h: 916 },
];

/* Фото разделов: s01 — годовщина, s02 — кондитер. */
window.SECTION_PHOTOS = [
  { small: 'assets/photo/web/s01-800.jpg?v=d87d4dcc', big: 'assets/photo/web/s01-1600.jpg?v=58e526ea', w: 1200, h: 1600 },
  { small: 'assets/photo/web/s02-800.jpg?v=20261118', big: 'assets/photo/web/s02-1600.jpg?v=20261118', w: 941, h: 1672 },
];

/* Работы сверх прайса — идут в галерее следом за ним. */
window.WORK_PHOTOS = [
];

/* Срезы начинок в том же порядке, что и в assets/catalog.js. */
window.FILLING_PHOTOS = [
  { small: 'assets/photo/web/f01-800.jpg?v=20261118', big: 'assets/photo/web/f01-1600.jpg?v=20261118', w: 900, h: 1600 },
  { small: 'assets/photo/web/f02-800.jpg?v=20261118', big: 'assets/photo/web/f02-1600.jpg?v=20261118', w: 1080, h: 1080 },
  { small: 'assets/photo/web/f03-800.jpg?v=20261118', big: 'assets/photo/web/f03-1600.jpg?v=20261118', w: 941, h: 1672 },
  { small: 'assets/photo/web/f04-800.jpg?v=20261118', big: 'assets/photo/web/f04-1600.jpg?v=20261118', w: 941, h: 1672 },
  { small: 'assets/photo/web/f05-800.jpg?v=20261118', big: 'assets/photo/web/f05-1600.jpg?v=20261118', w: 941, h: 1672 },
  { small: 'assets/photo/web/f06-800.jpg?v=20261118', big: 'assets/photo/web/f06-1600.jpg?v=20261118', w: 941, h: 1672 },
];

/* Дегустационный набор — над формой записи. */
window.TASTING_PHOTOS = [
];

/* Упаковка и получение торта — в разделе «Доставка». */
window.DELIVERY_PHOTOS = [
];

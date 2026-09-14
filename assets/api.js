/* ═══════════════════════════════════════════
   Адрес серверной части — одно место на весь сайт.

   Пока строка пуста, сайт работает в демо-режиме:
   формы показывают подтверждение, а оплата идёт по
   локальной заглушке. Никаких секретов здесь нет и
   быть не должно — токены живут в секретах Cloudflare.

   После `wrangler deploy` впишите сюда выданный адрес:
   window.API_BASE = 'https://tort-po-lyubvi-api.ВАШ.workers.dev';
   ═══════════════════════════════════════════ */
(function () {
  /* На своём домене заявки принимает обработчик на том же хостинге:
     данные сохраняются в России (backend/submit.php). На старом адресе
     GitHub и при проверке на своём компьютере — прежний сервер Cloudflare. */
  var worker = 'https://tort-po-lyubvi-api.asiyatort.workers.dev';
  var own = location.hostname.replace(/^www\./, '') === 'asiyatort.ru';
  window.API_OWN = own;
  window.API_BASE = own ? '/backend' : worker;
  /* Правки текста через Telegram-бота по-прежнему хранятся на прежнем сервере.
     Туда уходит только вопрос «какие есть правки», данные из форм — нет. */
  window.CMS_BASE = worker;
  /** Полный адрес действия: apiUrl('submit') */
  window.apiUrl = function (name) {
    var base = String(window.API_BASE || '').replace(/\/+$/, '');
    return own ? base + '/' + name + '.php' : base + '/' + name;
  };
})();

/** Куда возвращается человек после оплаты. Абсолютный адрес нужен ЮKassa. */
window.SITE_BASE = location.origin + location.pathname.replace(/\/[^\/]*$/, '/').replace(/\/(checkout|demo-checkout|success|fail)\/$/, '/');

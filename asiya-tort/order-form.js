/* ============================================================
   Форма заявки — самостоятельный виджет.

   Подключение: <div data-order-form></div> + <script src="order-form.js">
   Всё остальное — ниже в CONFIG.
   ============================================================ */

(function () {
  'use strict';

  var CONFIG = {
    /* через сколько отвечаем — попадёт в экран «заявка получена» */
    responseHours: 2,
    worksUntil: '18:00',

    /* контакты для запасного режима «открыть мессенджер» */
    whatsapp: '79083677951',
    vkGroup: 'asiyatort',
    telegramPublic: '',            /* @ник кондитера, если появится */

    /* ── куда уходит заявка ───────────────────────────────────
       Заполните ОДИН из блоков — виджет сам выберет режим:
       1) telegram — заявка уходит боту сразу, вместе с фото.
          token  — от @BotFather
          chatId — ваш id (узнать у @userinfobot) или id группы (-100…)
          ВАЖНО: токен виден в коде страницы. Для личного бота это
          терпимо, для рабочего — лучше webhook (пункт 2).
       2) webhook — POST multipart на ваш адрес (Cloudflare Worker,
          Vercel, простой PHP). Токен остаётся на сервере, и только
          так заявку можно доставить во ВКонтакте.
       3) ничего не заполнено — форма собирает текст, копирует его
          в буфер и открывает нужный мессенджер.
       ───────────────────────────────────────────────────────── */
    transport: {
      telegram: { token: '', chatId: '' },
      webhook: { url: '' }
    },

    /* ── МАРШРУТЫ ПО КАНАЛАМ ─────────────────────────────────
       Ключ — что выбрал клиент в поле «Как связаться».
       Значение — куда уходит заявка: 'vk', 'whatsapp', 'telegram'.
       По умолчанию «Телефон» ведёт во ВКонтакте.

       Само, без участия клиента, уходит только Telegram или
       webhook. ВК и WhatsApp из браузера так не умеют: форма
       откроет нужный диалог с готовым текстом, клиенту
       останется нажать «отправить».
       ──────────────────────────────────────────────────────── */
    routes: {
      'Телефон': 'vk',
      'Telegram': 'telegram',
      'WhatsApp': 'whatsapp',
      'ВКонтакте': 'vk'
    },

    /* true  — если Telegram-бот настроен, ВСЕ заявки уходят ему
               автоматически, какой бы канал клиент ни выбрал.
       false — заявка идёт по routes выше.                      */
    alwaysToBot: true,

    /* ассортимент начинок — ЗАМЕНИТЬ на актуальный список */
    fillings: [
      'Шоколадная',
      'Ванильная с кремом-чиз',
      'Ягодная (клубника / малина)',
      'Красный бархат',
      'Медовик',
      'Сникерс: арахис и карамель',
      'Фисташка с малиной',
      'Три шоколада',
      'Манго — маракуйя',
      'Не могу выбрать — нужен совет'
    ],

    budgets: [
      'до 3 000 ₽',
      '3 000 — 6 000 ₽',
      '6 000 — 10 000 ₽',
      'от 10 000 ₽',
      'Пока не решил(а)'
    ],

    /* варианты объёма под каждый тип изделия */
    sizes: {
      'Торт': [
        { value: '1—2 кг', hint: '6—11 гостей' },
        { value: '2—3 кг', hint: '11—17 гостей' },
        { value: '3—5 кг', hint: '17—28 гостей' }
      ],
      'Капкейки': [
        { value: '6 шт.', hint: 'коробка' },
        { value: '12 шт.', hint: 'две коробки' },
        { value: '24 шт.', hint: 'на компанию' }
      ],
      'Десерты': [
        { value: '10 шт.', hint: 'попробовать' },
        { value: '20 шт.', hint: 'на стол' },
        { value: '50 шт.', hint: 'кэнди-бар' }
      ]
    },

    maxFiles: 3,
    maxFileMb: 8
  };

  var GRAMS_PER_GUEST = 180;

  /* ── утилиты ─────────────────────────────────────────────── */

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Telegram понимает только эти три сущности */
  function escTg(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }

  /* короткий номер заявки: день-месяц — часы-минуты */
  function orderNumber() {
    var d = new Date();
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    return p(d.getDate()) + p(d.getMonth() + 1) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  /* подпись кнопки «связаться» под заявкой в боте */
  var CHANNEL_BUTTON = {
    'WhatsApp': '💬 Написать в WhatsApp',
    'Telegram': '💬 Написать в Telegram',
    'ВКонтакте': '💬 Открыть страницу ВК'
  };

  function todayISO() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  function ruDate(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p[2] + '.' + p[1] + '.' + p[0];
  }

  function daysLeft(iso) {
    var t = new Date(todayISO()).getTime();
    return Math.round((new Date(iso).getTime() - t) / 86400000);
  }

  /* ссылка «ответить клиенту» в том канале, который он выбрал */
  function replyLink(channel, contact) {
    if (!contact) return '';
    var digits = contact.replace(/\D/g, '');
    if (channel === 'Telegram') {
      return 'https://t.me/' + contact.replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '');
    }
    if (channel === 'ВКонтакте') {
      return /^https?:/.test(contact) ? contact : 'https://' + contact.replace(/^\/+/, '');
    }
    if (digits.length >= 10) {
      return channel === 'WhatsApp' ? 'https://wa.me/' + digits : 'tel:+' + digits;
    }
    return '';
  }

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  function optionsMarkup(name, list, cols) {
    return '<div class="opts opts--' + cols + '">' + list.map(function (o, i) {
      var val = typeof o === 'string' ? o : o.value;
      var hint = typeof o === 'string' ? '' : o.hint;
      var id = name + '-' + i;
      return '<label class="opt" for="' + id + '">' +
        '<input type="radio" id="' + id + '" name="' + name + '" value="' + esc(val) + '">' +
        '<span class="opt__box"><b>' + esc(val) + '</b>' +
        (hint ? '<i>' + esc(hint) + '</i>' : '') + '</span></label>';
    }).join('') + '</div>';
  }

  /* ── разметка ────────────────────────────────────────────── */

  function markup() {
    return '' +
    '<form class="oform" novalidate>' +

      '<div class="oform__top">' +
        '<p class="oform__lead">Опишите заказ один раз — и мне не придётся уточнять детали в переписке.</p>' +
        '<p class="oform__counter"><b data-count>0</b> из 9 полей</p>' +
      '</div>' +

      '<div class="oform__pick" data-pick hidden>' +
        '<span>Из каталога</span><b data-pick-name></b>' +
        '<button type="button" data-pick-clear aria-label="Убрать позицию">×</button>' +
      '</div>' +

      '<fieldset class="ofield" data-step="1">' +
        '<legend><i>01</i>Что печём<em>обязательно</em></legend>' +
        optionsMarkup('kind', ['Торт', 'Капкейки', 'Десерты'], 3) +
      '</fieldset>' +

      '<fieldset class="ofield" data-step="2">' +
        '<legend><i>02</i>Повод</legend>' +
        optionsMarkup('reason', ['День рождения', 'Свадьба', 'Корпоратив', 'Просто так', 'Другое'], 2) +
        '<input class="ocustom" type="text" name="reasonOther" placeholder="Какой повод" hidden>' +
      '</fieldset>' +

      '<fieldset class="ofield" data-step="3">' +
        '<legend><i>03</i>Начинка</legend>' +
        '<select class="oinput" name="filling">' +
          '<option value="">Выберите начинку</option>' +
          CONFIG.fillings.map(function (f) { return '<option>' + esc(f) + '</option>'; }).join('') +
        '</select>' +
      '</fieldset>' +

      '<fieldset class="ofield" data-step="4">' +
        '<legend><i>04</i>Размер<em data-size-note>из расчёта 180 г на гостя</em></legend>' +
        '<div data-sizes>' + optionsMarkup('size', CONFIG.sizes['Торт'].concat([{ value: 'Свой вариант', hint: 'напишу сам(а)' }]), 2) + '</div>' +
        '<input class="ocustom" type="text" name="sizeOther" placeholder="Например: 4,5 кг или 18 гостей" hidden>' +
      '</fieldset>' +

      '<fieldset class="ofield" data-step="5">' +
        '<legend><i>05</i>Когда нужен<em>обязательно</em></legend>' +
        '<input class="oinput oinput--date" type="date" name="date" min="' + todayISO() + '">' +
        '<p class="ohint" data-date-hint hidden></p>' +
      '</fieldset>' +

      '<fieldset class="ofield" data-step="6">' +
        '<legend><i>06</i>Пожелания по дизайну</legend>' +
        '<textarea class="oinput" name="design" rows="3" placeholder="Цвет, надпись на торте, стиль оформления, что точно не нравится"></textarea>' +
      '</fieldset>' +

      '<fieldset class="ofield" data-step="7">' +
        '<legend><i>07</i>Референсы<em>до ' + CONFIG.maxFiles + ' фото</em></legend>' +
        '<label class="odrop" data-drop>' +
          '<input type="file" name="refs" accept="image/*" multiple hidden>' +
          '<b>Перетащите фото или нажмите, чтобы выбрать</b>' +
          '<i>JPG, PNG или HEIC, до ' + CONFIG.maxFileMb + ' МБ каждое</i>' +
        '</label>' +
        '<div class="othumbs" data-thumbs></div>' +
      '</fieldset>' +

      '<fieldset class="ofield" data-step="8">' +
        '<legend><i>08</i>Бюджет<em>по желанию</em></legend>' +
        optionsMarkup('budget', CONFIG.budgets, 2) +
      '</fieldset>' +

      '<fieldset class="ofield" data-step="9">' +
        '<legend><i>09</i>Как связаться<em>обязательно</em></legend>' +
        '<input class="oinput" type="text" name="name" placeholder="Как вас зовут" autocomplete="name">' +
        '<div class="ochannels">' + ['Телефон', 'Telegram', 'WhatsApp', 'ВКонтакте'].map(function (c, i) {
          return '<label class="opt opt--sm" for="ch-' + i + '">' +
            '<input type="radio" id="ch-' + i + '" name="channel" value="' + c + '"' + (i === 0 ? ' checked' : '') + '>' +
            '<span class="opt__box"><b>' + c + '</b></span></label>';
        }).join('') + '</div>' +
        '<input class="oinput" type="text" name="contact" inputmode="tel" placeholder="+7 ___ ___-__-__" autocomplete="tel">' +
      '</fieldset>' +

      '<div class="opreview">' +
        '<p class="opreview__label">Текст заявки</p>' +
        '<pre class="opreview__text" data-preview></pre>' +
      '</div>' +

      '<p class="oerr" data-error role="alert" hidden></p>' +

      '<div class="oform__foot">' +
        '<button class="btn btn--solid oform__submit" type="submit">Отправить заявку</button>' +
        '<p class="oform__note" data-mode-note></p>' +
      '</div>' +

    '</form>' +

    /* передача заявки руками: ВК и Telegram не дают заполнить сообщение за клиента */
    '<div class="ohandoff" data-handoff hidden>' +
      '<p class="eyebrow">Последний шаг</p>' +
      '<h3 class="ohandoff__title">Заявка готова</h3>' +
      '<p class="ohandoff__note" data-handoff-note></p>' +

      '<div class="ohandoff__block" data-handoff-photos hidden>' +
        '<p class="ohandoff__step" data-handoff-photostep>Шаг 1 — фото</p>' +
        '<div class="othumbs" data-handoff-thumbs></div>' +
        '<button class="btn btn--ghost" type="button" data-handoff-save>Сохранить фото на устройство</button>' +
        '<p class="ohandoff__hint">В диалоге приложите их скрепкой — вставить файлы за вас сайт не может.</p>' +
      '</div>' +

      '<div class="ohandoff__block">' +
        '<p class="ohandoff__step" data-handoff-textstep>Шаг 2 — текст</p>' +
        '<pre class="opreview__text" data-handoff-text></pre>' +
        '<button class="btn btn--solid ohandoff__go" type="button" data-handoff-copy>Скопировать текст</button>' +
        '<p class="ohandoff__hint" data-handoff-hint></p>' +
      '</div>' +

      '<button class="btn btn--ghost ohandoff__back" type="button" data-handoff-back>Вернуться к форме</button>' +
    '</div>' +

    '<div class="osuccess" data-success hidden>' +
      '<div class="osuccess__seal">✓</div>' +
      '<h3 class="osuccess__title">Заявка получена</h3>' +
      '<p class="osuccess__text" data-success-text></p>' +
      '<pre class="osuccess__recap" data-recap></pre>' +
      '<div class="osuccess__actions">' +
        '<button class="btn btn--ghost" type="button" data-recopy hidden>Скопировать текст ещё раз</button>' +
        '<button class="btn btn--ghost" type="button" data-again>Отправить ещё одну</button>' +
      '</div>' +
    '</div>';
  }

  /* ── логика ──────────────────────────────────────────────── */

  function mount(root) {
    root.innerHTML = markup();

    var form = root.querySelector('.oform');
    var els = {
      count: root.querySelector('[data-count]'),
      pick: root.querySelector('[data-pick]'),
      pickName: root.querySelector('[data-pick-name]'),
      pickClear: root.querySelector('[data-pick-clear]'),
      sizes: root.querySelector('[data-sizes]'),
      sizeNote: root.querySelector('[data-size-note]'),
      sizeOther: form.querySelector('[name="sizeOther"]'),
      reasonOther: form.querySelector('[name="reasonOther"]'),
      dateHint: root.querySelector('[data-date-hint]'),
      drop: root.querySelector('[data-drop]'),
      fileInput: form.querySelector('[name="refs"]'),
      thumbs: root.querySelector('[data-thumbs]'),
      preview: root.querySelector('[data-preview]'),
      error: root.querySelector('[data-error]'),
      modeNote: root.querySelector('[data-mode-note]'),
      submit: root.querySelector('.oform__submit'),
      success: root.querySelector('[data-success]'),
      successText: root.querySelector('[data-success-text]'),
      recap: root.querySelector('[data-recap]'),
      again: root.querySelector('[data-again]'),
      recopy: root.querySelector('[data-recopy]'),
      handoff: root.querySelector('[data-handoff]'),
      handoffNote: root.querySelector('[data-handoff-note]'),
      handoffPhotos: root.querySelector('[data-handoff-photos]'),
      handoffPhotoStep: root.querySelector('[data-handoff-photostep]'),
      handoffTextStep: root.querySelector('[data-handoff-textstep]'),
      handoffThumbs: root.querySelector('[data-handoff-thumbs]'),
      handoffSave: root.querySelector('[data-handoff-save]'),
      handoffText: root.querySelector('[data-handoff-text]'),
      handoffCopy: root.querySelector('[data-handoff-copy]'),
      handoffHint: root.querySelector('[data-handoff-hint]'),
      handoffBack: root.querySelector('[data-handoff-back]')
    };

    var files = [];
    var picked = '';
    var orderNo = orderNumber();

    var mode = CONFIG.transport.telegram.token && CONFIG.transport.telegram.chatId ? 'telegram'
             : CONFIG.transport.webhook.url ? 'webhook'
             : 'link';

    /* куда уйдёт эта конкретная заявка */
    function destinationFor(channel) {
      if (mode === 'webhook') return 'webhook';
      if (mode === 'telegram' && CONFIG.alwaysToBot) return 'bot';
      var route = CONFIG.routes[channel] || 'whatsapp';
      if (route === 'telegram' && mode === 'telegram') return 'bot';
      return route;
    }

    function describeDestination() {
      switch (destinationFor(val('channel'))) {
        case 'webhook': return 'Заявка уходит сразу, вместе с фото.';
        case 'bot': return 'Заявка уйдёт в Telegram сразу, вместе с фото.';
        case 'whatsapp': return 'Откроется WhatsApp с готовым текстом — останется нажать «Отправить».';
        case 'vk': return 'На последнем шаге скопируете текст и откроется диалог ВКонтакте.';
        default: return 'На последнем шаге скопируете текст и откроется Telegram.';
      }
    }

    function val(name) {
      var nodes = form.querySelectorAll('[name="' + name + '"]');
      if (!nodes.length) return '';
      if (nodes[0].type === 'radio') {
        var checked = form.querySelector('[name="' + name + '"]:checked');
        return checked ? checked.value : '';
      }
      return nodes[0].type === 'file' ? '' : nodes[0].value.trim();
    }

    function sizeValue() {
      var v = val('size');
      return v === 'Свой вариант' ? val('sizeOther') : v;
    }

    function reasonValue() {
      var v = val('reason');
      return v === 'Другое' ? (val('reasonOther') || 'Другое') : v;
    }

    /* ── счётчик заполненных полей ── */
    function recount() {
      var filled = 0;
      if (val('kind')) filled++;
      if (reasonValue()) filled++;
      if (val('filling')) filled++;
      if (sizeValue()) filled++;
      if (val('date')) filled++;
      if (val('design')) filled++;
      if (files.length) filled++;
      if (val('budget')) filled++;
      if (val('contact')) filled++;
      els.count.textContent = filled;
    }

    /* ── текст заявки ── */
    /* один источник правды: строки заявки */
    function collectRows() {
      var rows = [];
      var kind = val('kind');
      if (kind || picked) {
        rows.push(['Изделие', kind + (picked ? (kind ? ' — ' : '') + picked : '')]);
      }
      if (reasonValue()) rows.push(['Повод', reasonValue()]);
      if (val('filling')) rows.push(['Начинка', val('filling')]);

      var size = sizeValue();
      if (size) {
        var guests = '';
        var kg = size.match(/^(\d+)[—–-](\d+)\s*кг/);
        if (kg && kind === 'Торт') {
          guests = ' (≈ ' + Math.round(kg[1] * 1000 / GRAMS_PER_GUEST) + '—' +
                   Math.round(kg[2] * 1000 / GRAMS_PER_GUEST) + ' гостей)';
        }
        rows.push(['Размер', size + guests]);
      }

      if (val('date')) {
        var d = daysLeft(val('date'));
        rows.push(['Дата', ruDate(val('date')) +
          (d >= 0 ? ' (через ' + d + ' ' + plural(d, 'день', 'дня', 'дней') + ')' : '')]);
      }
      if (val('design')) rows.push(['Дизайн', val('design')]);
      if (files.length) rows.push(['Референсы', files.length + ' фото']);
      if (val('budget')) rows.push(['Бюджет', val('budget')]);
      return rows;
    }

    function contactLines() {
      var out = [];
      if (val('name')) out.push(val('name'));
      if (val('contact')) out.push(val('channel') + ': ' + val('contact'));
      return out;
    }

    /* обычный текст — для превью на странице и для мессенджеров */
    function buildText() {
      var lines = ['🎂 Заявка № ' + orderNo];
      collectRows().forEach(function (r) { lines.push(r[0] + ': ' + r[1]); });
      var c = contactLines();
      if (c.length) lines.push('Связь: ' + c.join(', '));
      var link = replyLink(val('channel'), val('contact'));
      if (link) lines.push('Ответить: ' + link);
      return lines.join('\n');
    }

    /* карточка для Telegram: жирные подписи, контакт отдельным блоком */
    function buildHtml() {
      var out = ['🎂 <b>Заявка № ' + orderNo + '</b>', ''];
      collectRows().forEach(function (r) {
        out.push('<b>' + r[0] + ':</b> ' + escTg(r[1]));
      });
      var c = contactLines();
      if (c.length) {
        out.push('');
        out.push(escTg(c.join('\n')));
      }
      return out.join('\n');
    }

    /* кнопка «связаться» под карточкой в боте */
    function replyMarkup() {
      var label = CHANNEL_BUTTON[val('channel')];
      var link = replyLink(val('channel'), val('contact'));
      if (!label || !/^https?:/.test(link)) return null;
      return { inline_keyboard: [[{ text: label, url: link }]] };
    }

    function refresh() {
      recount();
      els.preview.textContent = buildText();
      els.modeNote.textContent = describeDestination();
    }

    /* ── размер зависит от типа изделия ── */
    function rebuildSizes() {
      var kind = val('kind') || 'Торт';
      var chosen = val('size');
      var list = (CONFIG.sizes[kind] || CONFIG.sizes['Торт'])
        .concat([{ value: 'Свой вариант', hint: 'напишу сам(а)' }]);
      els.sizes.innerHTML = optionsMarkup('size', list, 2);
      els.sizeNote.textContent = kind === 'Торт' ? 'из расчёта 180 г на гостя' : 'поштучно';
      var keep = els.sizes.querySelector('[name="size"][value="' + chosen + '"]');
      if (keep) keep.checked = true;
      toggleSizeOther();
    }

    function toggleSizeOther() {
      var other = val('size') === 'Свой вариант';
      els.sizeOther.hidden = !other;
      if (!other) els.sizeOther.value = '';
    }

    /* ── файлы ── */
    function addFiles(list) {
      var rejected = [];
      Array.prototype.forEach.call(list, function (f) {
        if (files.length >= CONFIG.maxFiles) return rejected.push(f.name + ' — больше ' + CONFIG.maxFiles + ' не нужно');
        if (!/^image\//.test(f.type)) return rejected.push(f.name + ' — это не картинка');
        if (f.size > CONFIG.maxFileMb * 1024 * 1024) return rejected.push(f.name + ' — тяжелее ' + CONFIG.maxFileMb + ' МБ');
        files.push(f);
      });
      if (rejected.length) showError('Не приложил: ' + rejected.join('; '));
      else hideError();
      drawThumbs();
      refresh();
    }

    function drawThumbs() {
      els.thumbs.innerHTML = '';
      files.forEach(function (f, i) {
        var fig = document.createElement('figure');
        fig.className = 'othumb';
        var img = document.createElement('img');
        img.alt = 'Референс ' + (i + 1);
        img.src = URL.createObjectURL(f);
        img.onload = function () { URL.revokeObjectURL(img.src); };
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = '×';
        btn.setAttribute('aria-label', 'Убрать ' + f.name);
        btn.addEventListener('click', function () {
          files.splice(i, 1);
          drawThumbs();
          refresh();
        });
        fig.appendChild(img);
        fig.appendChild(btn);
        els.thumbs.appendChild(fig);
      });
      els.drop.classList.toggle('is-full', files.length >= CONFIG.maxFiles);
    }

    /* ── ошибки ── */
    function showError(msg) {
      els.error.textContent = msg;
      els.error.hidden = false;
    }

    /* бот не ответил — заявку не теряем, предлагаем запасной путь */
    function showFallback(reason, text) {
      els.error.textContent = 'Не получилось отправить: ' + reason +
        '. Заявка не потеряна — отправьте её в WhatsApp.';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oerr__btn';
      btn.textContent = 'Открыть WhatsApp с этой заявкой';
      btn.addEventListener('click', function () {
        openWith('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(text), text)
          .then(function () {
            hideError();
            succeed(text, 'whatsapp');
          });
      });
      els.error.appendChild(btn);
      els.error.hidden = false;
    }
    function hideError() {
      els.error.hidden = true;
    }

    function markInvalid(step) {
      var fs = form.querySelector('[data-step="' + step + '"]');
      fs.classList.add('is-invalid');
      fs.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var focusable = fs.querySelector('input:not([type="hidden"]), select, textarea');
      if (focusable) focusable.focus({ preventScroll: true });
    }

    function validate() {
      form.querySelectorAll('.is-invalid').forEach(function (f) { f.classList.remove('is-invalid'); });
      if (!val('kind')) { markInvalid(1); return 'Выберите, что печём.'; }
      if (!val('date')) { markInvalid(5); return 'Укажите дату, к которой нужен заказ.'; }
      var contact = val('contact');
      if (!contact) { markInvalid(9); return 'Оставьте контакт — иначе мне некуда ответить.'; }
      var channel = val('channel');
      var digits = contact.replace(/\D/g, '');
      if ((channel === 'Телефон' || channel === 'WhatsApp') && digits.length < 10) {
        markInvalid(9); return 'Похоже, в номере не хватает цифр.';
      }
      if (channel === 'Telegram' && !/^@?[\w\d_.\/:]{4,}$/.test(contact)) {
        markInvalid(9); return 'Укажите ник в Telegram — например, @asiya.';
      }
      return '';
    }

    /* ── отправка ── */
    function sendTelegram() {
      var cfg = CONFIG.transport.telegram;
      var api = 'https://api.telegram.org/bot' + cfg.token;
      var payload = {
        chat_id: cfg.chatId,
        text: buildHtml(),
        parse_mode: 'HTML',
        disable_web_page_preview: true
      };
      var markup = replyMarkup();
      if (markup) payload.reply_markup = markup;

      return fetch(api + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok) throw new Error(j.description || 'Telegram не принял заявку');
        return files.reduce(function (chain, f, i) {
          return chain.then(function () {
            var fd = new FormData();
            fd.append('chat_id', cfg.chatId);
            fd.append('caption', 'Референс ' + (i + 1) + ' к заявке № ' + orderNo);
            fd.append('photo', f, f.name);
            return fetch(api + '/sendPhoto', { method: 'POST', body: fd });
          });
        }, Promise.resolve());
      });
    }

    function sendWebhook(text) {
      var fd = new FormData();
      fd.append('text', text);
      ['kind', 'filling', 'date', 'design', 'budget', 'name', 'channel', 'contact'].forEach(function (n) {
        fd.append(n, val(n));
      });
      fd.append('reason', reasonValue());
      fd.append('size', sizeValue());
      fd.append('catalogItem', picked);
      files.forEach(function (f, i) { fd.append('ref' + (i + 1), f, f.name); });
      return fetch(CONFIG.transport.webhook.url, { method: 'POST', body: fd }).then(function (r) {
        if (!r.ok) throw new Error('Сервер ответил ' + r.status);
      });
    }

    /* копируем текст в буфер и открываем диалог */
    function openWith(url, text) {
      var copy = navigator.clipboard && navigator.clipboard.writeText
        ? navigator.clipboard.writeText(text).catch(function () {})
        : Promise.resolve();
      return copy.then(function () { window.open(url, '_blank', 'noopener'); });
    }

    function send(text) {
      var dest = destinationFor(val('channel'));
      var done = function () { return dest; };

      if (dest === 'webhook') return sendWebhook(text).then(done);
      if (dest === 'bot') return sendTelegram().then(done);
      if (dest === 'whatsapp') {
        return openWith('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(text), text).then(done);
      }
      /* ВК и Telegram заполнить за клиента нельзя — показываем экран передачи */
      return Promise.resolve(dest);
    }

    /* ── передача заявки руками ─────────────────────────────── */

    var handoffState = { text: '', url: '', dest: '', where: '' };

    function dialogUrl(dest) {
      if (dest === 'vk') return 'https://vk.me/' + CONFIG.vkGroup;
      return CONFIG.telegramPublic
        ? 'https://t.me/' + CONFIG.telegramPublic.replace('@', '')
        : 'https://t.me/share/url?url=&text=' + encodeURIComponent(handoffState.text);
    }

    function handoff(text, dest) {
      var where = dest === 'vk' ? 'ВКонтакте' : 'Telegram';
      handoffState = { text: text, dest: dest, where: where, url: '' };
      handoffState.url = dialogUrl(dest);

      form.hidden = true;
      els.handoff.hidden = false;

      els.handoffNote.textContent = where + ' не разрешает сайту заполнить сообщение за вас. ' +
        'Поэтому текст заявки нужно скопировать, а фото приложить в диалоге.';
      els.handoffText.textContent = text;
      els.handoffCopy.textContent = 'Скопировать текст и открыть ' + where;
      els.handoffHint.textContent = 'Текст ляжет в буфер обмена, откроется диалог — вставьте его туда: Ctrl + V.';

      els.handoffPhotos.hidden = files.length === 0;
      els.handoffPhotoStep.textContent = 'Шаг 1 — фото (' + files.length + ')';
      els.handoffTextStep.textContent = files.length ? 'Шаг 2 — текст' : 'Шаг 1 — текст';
      drawHandoffThumbs();

      els.handoff.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function drawHandoffThumbs() {
      els.handoffThumbs.innerHTML = '';
      files.forEach(function (f, i) {
        var fig = document.createElement('figure');
        fig.className = 'othumb othumb--plain';
        var img = document.createElement('img');
        img.alt = 'Референс ' + (i + 1);
        img.src = URL.createObjectURL(f);
        img.onload = function () { URL.revokeObjectURL(img.src); };
        fig.appendChild(img);
        els.handoffThumbs.appendChild(fig);
      });
    }

    /* сохраняем фото под понятными именами, чтобы приложить их в диалоге */
    function saveFiles() {
      files.forEach(function (f, i) {
        var ext = (f.name.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0];
        var url = URL.createObjectURL(f);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'zayavka-' + orderNo + '-foto-' + (i + 1) + ext;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 20000);
      });
      els.handoffSave.textContent = 'Фото сохранены';
    }

    /* копия и переход — строго внутри клика, иначе браузер заблокирует вкладку */
    function copyAndOpen() {
      var text = handoffState.text;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () {});
      }
      window.open(handoffState.url, '_blank', 'noopener');
      succeed(text, handoffState.dest);
    }

    function succeed(text, dest) {
      form.hidden = true;
      els.handoff.hidden = true;
      els.success.hidden = false;
      var hours = CONFIG.responseHours;
      var wait = 'Отвечу в течение ' + hours + ' ' + plural(hours, 'часа', 'часов', 'часов') + '.';
      var manual = dest === 'vk' || dest === 'telegram';

      els.successText.textContent =
        dest === 'bot' || dest === 'webhook'
          ? wait + ' Если написали после ' + CONFIG.worksUntil + ' — отвечу с утра.'
          : dest === 'whatsapp'
            ? 'Осталось нажать «Отправить» в открывшемся WhatsApp — текст уже подставлен. ' + wait
            : 'Текст заявки в буфере обмена — вставьте его в открывшемся диалоге (Ctrl + V)' +
              (files.length ? ' и приложите сохранённые фото. ' : '. ') + wait;

      els.recap.textContent = text;
      els.recopy.hidden = !manual;
      els.success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var problem = validate();
      if (problem) return showError(problem);
      hideError();

      var text = buildText();
      els.submit.disabled = true;
      els.submit.textContent = 'Отправляю…';

      send(text).then(function (dest) {
        if (dest === 'vk' || dest === 'telegram') handoff(text, dest);
        else succeed(text, dest);
      }).catch(function (err) {
        showFallback(err.message, text);
      }).then(function () {
        els.submit.disabled = false;
        els.submit.textContent = 'Отправить заявку';
      });
    });

    /* ── события формы ── */
    form.addEventListener('input', refresh);
    form.addEventListener('change', function (e) {
      if (e.target.name === 'kind') rebuildSizes();
      if (e.target.name === 'size') toggleSizeOther();
      if (e.target.name === 'reason') {
        var other = val('reason') === 'Другое';
        els.reasonOther.hidden = !other;
        if (other) els.reasonOther.focus();
        else els.reasonOther.value = '';
      }
      if (e.target.name === 'channel') {
        var c = val('channel');
        var box = form.querySelector('[name="contact"]');
        box.placeholder = c === 'Telegram' ? '@ваш_ник'
          : c === 'ВКонтакте' ? 'vk.com/ваша_страница'
          : '+7 ___ ___-__-__';
        box.inputMode = c === 'Телефон' || c === 'WhatsApp' ? 'tel' : 'text';
      }
      if (e.target.name === 'date') {
        var d = daysLeft(val('date'));
        if (val('date') && d < 3) {
          els.dateHint.hidden = false;
          els.dateHint.textContent = d < 0
            ? 'Эта дата уже прошла — проверьте, пожалуйста.'
            : 'Срочный заказ. Возьму, если свободна дата, — подтвержу в ответе.';
        } else {
          els.dateHint.hidden = true;
        }
      }
      refresh();
    });

    /* ── файлы: клик и перетаскивание ── */
    els.fileInput.addEventListener('change', function () {
      addFiles(els.fileInput.files);
      els.fileInput.value = '';
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      els.drop.addEventListener(ev, function (e) {
        e.preventDefault();
        els.drop.classList.add('is-over');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      els.drop.addEventListener(ev, function (e) {
        e.preventDefault();
        els.drop.classList.remove('is-over');
      });
    });
    els.drop.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
    });

    /* ── позиция из каталога ── */
    els.pickClear.addEventListener('click', function () {
      picked = '';
      els.pick.hidden = true;
      refresh();
    });

    els.handoffSave.addEventListener('click', saveFiles);
    els.handoffCopy.addEventListener('click', copyAndOpen);
    els.handoffBack.addEventListener('click', function () {
      els.handoff.hidden = true;
      form.hidden = false;
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    els.recopy.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(els.recap.textContent).then(function () {
          els.recopy.textContent = 'Скопировано';
        }).catch(function () {
          els.recopy.textContent = 'Не вышло — выделите текст выше';
        });
      }
    });

    els.again.addEventListener('click', function () {
      form.reset();
      files = [];
      picked = '';
      orderNo = orderNumber();
      els.pick.hidden = true;
      drawThumbs();
      rebuildSizes();
      els.dateHint.hidden = true;
      els.success.hidden = true;
      els.handoff.hidden = true;
      els.handoffSave.textContent = 'Сохранить фото на устройство';
      els.recopy.textContent = 'Скопировать текст ещё раз';
      form.hidden = false;
      hideError();
      refresh();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    refresh();

    /* ── публичный API для карточек каталога ── */
    return {
      preset: function (opts) {
        if (form.hidden) els.again.click();
        if (opts.item) {
          picked = opts.item;
          els.pickName.textContent = opts.item;
          els.pick.hidden = false;
        }
        if (opts.kind) {
          var k = form.querySelector('[name="kind"][value="' + opts.kind + '"]');
          if (k) { k.checked = true; rebuildSizes(); }
        }
        if (opts.reason) {
          var r = form.querySelector('[name="reason"][value="' + opts.reason + '"]');
          if (r) r.checked = true;
        }
        refresh();
      }
    };
  }

  var instances = [];
  document.querySelectorAll('[data-order-form]').forEach(function (root) {
    instances.push(mount(root));
  });

  window.OrderForm = {
    preset: function (opts) {
      instances.forEach(function (i) { i.preset(opts); });
    }
  };
})();

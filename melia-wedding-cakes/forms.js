/* ============================================================
   Формы «Мелии»: заказ торта и запись на дегустацию.
   Обе собраны одним движком по описанию полей — см. FORMS ниже.

   Подключение: <div data-form="order"></div> или data-form="tasting"
   ============================================================ */

(function () {
  'use strict';

  var CONFIG = {
    responseHours: 3,
    worksUntil: '19:00',

    /* контакты для запасного режима «открыть мессенджер» */
    whatsapp: '79000000000',
    vkGroup: 'melia',
    telegramPublic: '',

    /* ── КУДА ПРИХОДИТ ЗАЯВКА ────────────────────────────────
       1) telegram — уходит боту сразу, вместе с фото.
          token от @BotFather, chatId от @userinfobot.
          Токен виден в исходнике: для бота, который только
          принимает заявки, это терпимо, иначе — webhook.
       2) webhook — POST multipart на ваш адрес, токен на сервере.
       3) пусто — клиент копирует текст и переходит в диалог.
       ──────────────────────────────────────────────────────── */
    transport: {
      telegram: { token: '', chatId: '' },
      webhook: { url: '' }
    },

    /* канал клиента → куда уходит заявка, если бот не настроен */
    routes: {
      'Телефон': 'vk',
      'Telegram': 'telegram',
      'WhatsApp': 'whatsapp',
      'ВКонтакте': 'vk'
    },
    alwaysToBot: true,

    maxFiles: 4,
    maxFileMb: 8
  };

  /* ЗАМЕНИТЬ на реальный ассортимент */
  var FILLINGS = [
    'Ваниль и свежие ягоды',
    'Красный бархат с кремом-чиз',
    'Фисташка и малина',
    'Шоколад и солёная карамель',
    'Лимонный курд с маком',
    'Груша и карамелизованный орех',
    'Три шоколада',
    'Хочу заказать дегустацию и выбрать на месте'
  ];

  var CHANNELS = ['Телефон', 'Telegram', 'WhatsApp', 'ВКонтакте'];

  /* когда клиенту удобно, чтобы с ним связались */
  var TIMES = ['Утром', 'Днём', 'Вечером', 'В любое время'];

  /* ── описание форм ───────────────────────────────────────── */

  var FORMS = {
    order: {
      lead: 'Обязательны только дата и контакт. Остальное — по желанию.',
      submit: 'Отправить заявку',
      header: '💍 Заявка на свадебный торт',
      steps: [
        { name: 'date', legend: 'Дата свадьбы', required: true, err: 'Укажите дату свадьбы.',
          type: 'date', label: 'Дата' },
        { name: 'venue', legend: 'Место проведения', type: 'text', label: 'Площадка',
          note: 'от него зависит доставка',
          placeholder: 'Ресторан, база отдыха или адрес' },
        { name: 'guests', legend: 'Количество гостей', type: 'number', min: 2, max: 400,
          placeholder: 'например, 60', note: 'вес подберём сами', label: 'Гостей' },
        { name: 'decor', legend: 'Желаемый декор', type: 'filesOrTalk', label: 'Декор',
          options: ['Пришлю референс', 'Обсудим индивидуально'] },
        { name: 'filling', legend: 'Начинка', type: 'select', options: FILLINGS, label: 'Начинка',
          placeholder: 'Выберите начинку' },
        { name: 'service', legend: 'Презентация торта и нарезка', type: 'options', cols: 2,
          options: [
            { value: 'Да, нужны', hint: 'вынос и нарезка на гостей' },
            { value: 'Нет, спасибо', hint: 'справится площадка' }
          ], label: 'Презентация и нарезка' },
        { name: 'contact', legend: 'Контактные данные', required: true, type: 'contact', withTime: true },
        { name: 'extra', legend: 'Дополнительная информация', type: 'textarea', label: 'Ещё',
          placeholder: 'Аллергии, пожелания к палитре, тайминг вечера — всё, что важно' }
      ]
    },

    tasting: {
      lead: 'Запишитесь — подтвердим время и пришлём адрес.',
      submit: 'Записаться на дегустацию',
      header: '🍰 Запись на дегустацию',
      compact: true,
      steps: [
        { name: 'date', legend: 'Желаемая дата', required: true, err: 'Выберите удобную дату.',
          type: 'date', label: 'Дата' },
        { name: 'guests', legend: 'Количество человек', type: 'number', min: 1, max: 6,
          placeholder: 'например, 2', label: 'Человек' },
        { name: 'contact', legend: 'Контактные данные', required: true, type: 'contact', withTime: true }
      ]
    }
  };

  /* ── утилиты ─────────────────────────────────────────────── */

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function escTg(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }

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
    return Math.round((new Date(iso).getTime() - new Date(todayISO()).getTime()) / 86400000);
  }

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  function orderNumber() {
    var d = new Date();
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    return p(d.getDate()) + p(d.getMonth() + 1) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

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

  var CHANNEL_BUTTON = {
    'WhatsApp': '💬 Написать в WhatsApp',
    'Telegram': '💬 Написать в Telegram',
    'ВКонтакте': '💬 Открыть страницу ВК'
  };

  /* ── разметка полей ──────────────────────────────────────── */

  function num(i) { return i < 9 ? '0' + (i + 1) : String(i + 1); }

  function optionsMarkup(name, list, cols, uid) {
    return '<div class="opts opts--' + cols + '" data-opts="' + name + '">' + list.map(function (o, i) {
      var value = typeof o === 'string' ? o : o.value;
      var hint = typeof o === 'string' ? '' : o.hint;
      var id = uid + '-' + name + '-' + i;
      return '<label class="opt" for="' + id + '">' +
        '<input type="radio" id="' + id + '" name="' + name + '" value="' + esc(value) + '">' +
        '<span class="opt__box"><b>' + esc(value) + '</b>' +
        (hint ? '<i>' + esc(hint) + '</i>' : '') + '</span></label>';
    }).join('') + '</div>';
  }

  function stepMarkup(step, i, uid) {
    var body = '';

    if (step.type === 'options') {
      var list = step.custom ? step.options.concat([{ value: step.custom, hint: 'напишем сами' }]) : step.options;
      body = optionsMarkup(step.name, list, step.cols || 2, uid) +
        (step.custom ? '<input class="fld fld--custom" type="text" name="' + step.name + 'Other" placeholder="' +
          esc(step.customPlaceholder || '') + '" hidden>' : '');

    } else if (step.type === 'select') {
      body = '<select class="fld" name="' + step.name + '"><option value="">' +
        esc(step.placeholder || 'Выберите') + '</option>' +
        step.options.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('') + '</select>';

    } else if (step.type === 'date') {
      body = '<input class="fld fld--date" type="date" name="' + step.name + '" min="' + todayISO() + '">' +
        '<p class="fhint" data-hint="' + step.name + '" hidden></p>';

    } else if (step.type === 'number') {
      body = '<input class="fld" type="number" name="' + step.name + '" min="' + (step.min || 1) +
        '" max="' + (step.max || 99) + '" placeholder="' + esc(step.placeholder || '') + '">';

    } else if (step.type === 'text') {
      body = '<input class="fld" type="text" name="' + step.name + '" placeholder="' +
        esc(step.placeholder || '') + '">';

    } else if (step.type === 'filesOrTalk') {
      /* либо клиент прикладывает референсы, либо оставляет декор на разговор */
      body = optionsMarkup(step.name, step.options, 2, uid) +
        '<div class="dropwrap" data-dropwrap hidden>' +
          '<label class="drop" data-drop>' +
            '<input type="file" name="refs" accept="image/*" multiple hidden>' +
            '<b>Перетащите фото или нажмите, чтобы выбрать</b>' +
            '<i>до ' + CONFIG.maxFiles + ' изображений, каждое до ' + CONFIG.maxFileMb + ' МБ</i>' +
          '</label><div class="thumbs" data-thumbs></div>' +
        '</div>';

    } else if (step.type === 'textarea') {
      body = '<textarea class="fld" name="' + step.name + '" rows="3" placeholder="' +
        esc(step.placeholder || '') + '"></textarea>';

    } else if (step.type === 'files') {
      body = '<label class="drop" data-drop>' +
        '<input type="file" name="refs" accept="image/*" multiple hidden>' +
        '<b>Перетащите фото или нажмите, чтобы выбрать</b>' +
        '<i>до ' + CONFIG.maxFiles + ' изображений, каждое до ' + CONFIG.maxFileMb + ' МБ</i>' +
        '</label><div class="thumbs" data-thumbs></div>';

    } else if (step.type === 'contact') {
      body = '<input class="fld" type="text" name="name" placeholder="Как вас зовут" autocomplete="name">' +
        '<p class="sublabel">Как удобнее связаться</p>' +
        '<div class="channels">' + CHANNELS.map(function (c, k) {
          var id = uid + '-ch-' + k;
          return '<label class="opt opt--sm" for="' + id + '">' +
            '<input type="radio" id="' + id + '" name="channel" value="' + c + '"' + (k === 0 ? ' checked' : '') + '>' +
            '<span class="opt__box"><b>' + c + '</b></span></label>';
        }).join('') + '</div>' +
        '<input class="fld" type="text" name="contact" inputmode="tel" placeholder="+7 ___ ___-__-__" autocomplete="tel">' +
        (step.withTime
          ? '<p class="sublabel">В какое время удобно</p>' +
            '<div class="channels">' + TIMES.map(function (t, k) {
              var id = uid + '-tm-' + k;
              return '<label class="opt opt--sm" for="' + id + '">' +
                '<input type="radio" id="' + id + '" name="when" value="' + t + '"' +
                (k === TIMES.length - 1 ? ' checked' : '') + '>' +
                '<span class="opt__box"><b>' + t + '</b></span></label>';
            }).join('') + '</div>'
          : '');
    }

    return '<fieldset class="fstep" data-step="' + (i + 1) + '">' +
      '<legend><i>' + num(i) + '</i>' + esc(step.legend) +
      (step.required ? '<em>обязательно</em>' : step.note ? '<em>' + esc(step.note) + '</em>' : '') +
      '</legend>' + body + '</fieldset>';
  }

  function markup(schema, uid) {
    return '' +
    '<form class="wform' + (schema.compact ? ' wform--compact' : '') + '" novalidate>' +
      '<div class="wform__top">' +
        '<p class="wform__lead">' + esc(schema.lead) + '</p>' +
        '<p class="wform__counter"><b data-count>0</b> / ' + schema.steps.length + '</p>' +
      '</div>' +
      '<div class="wform__pick" data-pick hidden>' +
        '<span>Из каталога</span><b data-pick-name></b>' +
        '<button type="button" data-pick-clear aria-label="Убрать">×</button>' +
      '</div>' +
      schema.steps.map(function (s, i) { return stepMarkup(s, i, uid); }).join('') +
      '<div class="preview"><p class="preview__label">Текст заявки</p>' +
        '<pre class="preview__text" data-preview></pre></div>' +
      '<p class="ferr" data-error role="alert" hidden></p>' +
      '<div class="wform__foot">' +
        '<button class="btn btn--solid" type="submit" data-submit>' + esc(schema.submit) + '</button>' +
        '<p class="wform__note" data-mode-note></p>' +
      '</div>' +
    '</form>' +

    '<div class="handoff" data-handoff hidden>' +
      '<p class="eyebrow">Последний шаг</p>' +
      '<h3 class="handoff__title">Заявка готова</h3>' +
      '<p class="handoff__note" data-handoff-note></p>' +
      '<div class="handoff__block" data-handoff-photos hidden>' +
        '<p class="handoff__step" data-handoff-photostep></p>' +
        '<div class="thumbs" data-handoff-thumbs></div>' +
        '<button class="btn btn--quiet" type="button" data-handoff-save>Сохранить фото на устройство</button>' +
        '<p class="handoff__hint">В диалоге приложите их скрепкой — вставить файлы за вас сайт не может.</p>' +
      '</div>' +
      '<div class="handoff__block">' +
        '<p class="handoff__step" data-handoff-textstep></p>' +
        '<pre class="preview__text" data-handoff-text></pre>' +
        '<button class="btn btn--solid" type="button" data-handoff-copy>Скопировать текст</button>' +
        '<p class="handoff__hint" data-handoff-hint></p>' +
      '</div>' +
      '<button class="btn btn--quiet handoff__back" type="button" data-handoff-back>Вернуться к форме</button>' +
    '</div>' +

    '<div class="done" data-done hidden>' +
      '<div class="done__seal"><svg><use href="#i-check"/></svg></div>' +
      '<h3 class="done__title" data-done-title>Заявка получена</h3>' +
      '<p class="done__text" data-done-text></p>' +
      '<pre class="done__recap" data-recap></pre>' +
      '<div class="done__actions">' +
        '<button class="btn btn--quiet" type="button" data-recopy hidden>Скопировать текст ещё раз</button>' +
        '<button class="btn btn--quiet" type="button" data-again>Заполнить заново</button>' +
      '</div>' +
    '</div>';
  }

  /* ── сборка формы ────────────────────────────────────────── */

  var seq = 0;

  function mount(root, key) {
    var schema = FORMS[key];
    if (!schema) return null;

    var uid = 'f' + (++seq);
    root.innerHTML = markup(schema, uid);

    var form = root.querySelector('.wform');
    var q = function (sel) { return root.querySelector(sel); };
    var els = {
      count: q('[data-count]'),
      pick: q('[data-pick]'),
      pickName: q('[data-pick-name]'),
      pickClear: q('[data-pick-clear]'),
      preview: q('[data-preview]'),
      error: q('[data-error]'),
      modeNote: q('[data-mode-note]'),
      submit: q('[data-submit]'),
      drop: q('[data-drop]'),
      fileInput: form.querySelector('[name="refs"]'),
      thumbs: q('[data-thumbs]'),
      handoff: q('[data-handoff]'),
      handoffNote: q('[data-handoff-note]'),
      handoffPhotos: q('[data-handoff-photos]'),
      handoffPhotoStep: q('[data-handoff-photostep]'),
      handoffTextStep: q('[data-handoff-textstep]'),
      handoffThumbs: q('[data-handoff-thumbs]'),
      handoffSave: q('[data-handoff-save]'),
      handoffText: q('[data-handoff-text]'),
      handoffCopy: q('[data-handoff-copy]'),
      handoffHint: q('[data-handoff-hint]'),
      handoffBack: q('[data-handoff-back]'),
      done: q('[data-done]'),
      doneTitle: q('[data-done-title]'),
      doneText: q('[data-done-text]'),
      recap: q('[data-recap]'),
      recopy: q('[data-recopy]'),
      again: q('[data-again]')
    };

    var files = [];
    var picked = '';
    var orderNo = orderNumber();

    var mode = CONFIG.transport.telegram.token && CONFIG.transport.telegram.chatId ? 'telegram'
             : CONFIG.transport.webhook.url ? 'webhook'
             : 'link';

    function val(name) {
      var nodes = form.querySelectorAll('[name="' + name + '"]');
      if (!nodes.length) return '';
      if (nodes[0].type === 'radio') {
        var checked = form.querySelector('[name="' + name + '"]:checked');
        return checked ? checked.value : '';
      }
      return nodes[0].type === 'file' ? '' : nodes[0].value.trim();
    }

    function stepValue(step) {
      if (step.type === 'files') return files.length ? files.length + ' фото' : '';
      if (step.type === 'filesOrTalk') {
        var choice = val(step.name);
        if (!choice) return '';
        if (choice === step.options[1]) return choice;
        return files.length ? 'референс, ' + files.length + ' фото' : choice + ' — фото пока нет';
      }
      if (step.type === 'contact') return val('contact');
      if (step.custom && val(step.name) === step.custom) return val(step.name + 'Other');
      var v = val(step.name);
      if (!v) return '';
      if (step.type === 'date') {
        var d = daysLeft(v);
        return ruDate(v) + (d >= 0 ? ' (через ' + d + ' ' + plural(d, 'день', 'дня', 'дней') + ')' : '');
      }
      return v;
    }

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

    /* ── текст заявки ── */

    function collectRows() {
      var rows = [];
      if (picked) rows.push(['Композиция', picked]);
      schema.steps.forEach(function (step) {
        if (step.type === 'contact') return;
        var v = stepValue(step);
        if (v) rows.push([step.label || step.legend, v]);
      });
      return rows;
    }

    function contactLines() {
      var out = [];
      if (val('name')) out.push(val('name'));
      if (val('contact')) {
        var line = val('channel') + ': ' + val('contact');
        if (val('when')) line += ' (' + val('when').toLowerCase() + ')';
        out.push(line);
      }
      return out;
    }

    function buildText() {
      var lines = [schema.header + ' № ' + orderNo];
      collectRows().forEach(function (r) { lines.push(r[0] + ': ' + r[1]); });
      var c = contactLines();
      if (c.length) lines.push('Связь: ' + c.join(', '));
      var link = replyLink(val('channel'), val('contact'));
      if (link) lines.push('Ответить: ' + link);
      return lines.join('\n');
    }

    function buildHtml() {
      var out = ['<b>' + escTg(schema.header) + ' № ' + orderNo + '</b>', ''];
      collectRows().forEach(function (r) { out.push('<b>' + escTg(r[0]) + ':</b> ' + escTg(r[1])); });
      var c = contactLines();
      if (c.length) { out.push(''); out.push(escTg(c.join('\n'))); }
      return out.join('\n');
    }

    function replyMarkup() {
      var label = CHANNEL_BUTTON[val('channel')];
      var link = replyLink(val('channel'), val('contact'));
      if (!label || !/^https?:/.test(link)) return null;
      return { inline_keyboard: [[{ text: label, url: link }]] };
    }

    function recount() {
      var filled = 0;
      schema.steps.forEach(function (s) { if (stepValue(s)) filled++; });
      els.count.textContent = filled;
    }

    function refresh() {
      recount();
      els.preview.textContent = buildText();
      els.modeNote.textContent = describeDestination();
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
      if (rejected.length) showError('Не приложили: ' + rejected.join('; '));
      else hideError();
      drawThumbs(els.thumbs, true);
      refresh();
    }

    function drawThumbs(box, removable) {
      if (!box) return;
      box.innerHTML = '';
      files.forEach(function (f, i) {
        var fig = document.createElement('figure');
        fig.className = 'thumb';
        var img = document.createElement('img');
        img.alt = 'Референс ' + (i + 1);
        img.src = URL.createObjectURL(f);
        img.onload = function () { URL.revokeObjectURL(img.src); };
        fig.appendChild(img);
        if (removable) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = '×';
          btn.setAttribute('aria-label', 'Убрать ' + f.name);
          btn.addEventListener('click', function () {
            files.splice(i, 1);
            drawThumbs(els.thumbs, true);
            refresh();
          });
          fig.appendChild(btn);
        }
        box.appendChild(fig);
      });
      if (els.drop) els.drop.classList.toggle('is-full', files.length >= CONFIG.maxFiles);
    }

    /* ── ошибки ── */

    function showError(msg) {
      els.error.textContent = msg;
      els.error.hidden = false;
    }
    function hideError() { els.error.hidden = true; }

    function showFallback(reason, text) {
      els.error.textContent = 'Не получилось отправить: ' + reason + '. Заявка не потеряна — отправьте её в WhatsApp.';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ferr__btn';
      btn.textContent = 'Открыть WhatsApp с этой заявкой';
      btn.addEventListener('click', function () {
        copyThen('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(text), text);
        hideError();
        succeed(text, 'whatsapp');
      });
      els.error.appendChild(btn);
      els.error.hidden = false;
    }

    function markInvalid(index) {
      var fs = form.querySelector('[data-step="' + (index + 1) + '"]');
      if (!fs) return;
      fs.classList.add('is-bad');
      fs.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var focusable = fs.querySelector('input:not([type="file"]), select, textarea');
      if (focusable) focusable.focus({ preventScroll: true });
    }

    function validate() {
      form.querySelectorAll('.is-bad').forEach(function (f) { f.classList.remove('is-bad'); });

      for (var i = 0; i < schema.steps.length; i++) {
        var step = schema.steps[i];
        if (!step.required) continue;
        if (step.type === 'contact') {
          var contact = val('contact');
          if (!contact) { markInvalid(i); return 'Оставьте контакт — иначе нам некуда ответить.'; }
          var channel = val('channel');
          var digits = contact.replace(/\D/g, '');
          if ((channel === 'Телефон' || channel === 'WhatsApp') && digits.length < 10) {
            markInvalid(i); return 'Похоже, в номере не хватает цифр.';
          }
          if (channel === 'Telegram' && !/^@?[\w\d_.\/:]{4,}$/.test(contact)) {
            markInvalid(i); return 'Укажите ник в Telegram — например, @yarus.';
          }
        } else if (!stepValue(step)) {
          markInvalid(i);
          return step.err || 'Заполните: ' + step.legend.toLowerCase() + '.';
        }
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
      var markup2 = replyMarkup();
      if (markup2) payload.reply_markup = markup2;

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
      fd.append('form', key);
      fd.append('number', orderNo);
      fd.append('text', text);
      schema.steps.forEach(function (s) {
        if (s.type === 'files' || s.type === 'contact') return;
        fd.append(s.name, stepValue(s));
      });
      fd.append('name', val('name'));
      fd.append('channel', val('channel'));
      fd.append('contact', val('contact'));
      fd.append('when', val('when'));
      files.forEach(function (f, i) { fd.append('ref' + (i + 1), f, f.name); });
      return fetch(CONFIG.transport.webhook.url, { method: 'POST', body: fd }).then(function (r) {
        if (!r.ok) throw new Error('Сервер ответил ' + r.status);
      });
    }

    /* копия и переход строго внутри клика, иначе браузер блокирует вкладку */
    function copyThen(url, text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () {});
      }
      window.open(url, '_blank', 'noopener');
    }

    function send(text) {
      var dest = destinationFor(val('channel'));
      var done = function () { return dest; };
      if (dest === 'webhook') return sendWebhook(text).then(done);
      if (dest === 'bot') return sendTelegram().then(done);
      if (dest === 'whatsapp') {
        copyThen('https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(text), text);
        return Promise.resolve(dest);
      }
      return Promise.resolve(dest);   /* вк и telegram — через экран передачи */
    }

    /* ── экран передачи ── */

    var handoffState = { text: '', url: '', dest: '' };

    function handoff(text, dest) {
      var where = dest === 'vk' ? 'ВКонтакте' : 'Telegram';
      handoffState = { text: text, dest: dest, url: '' };
      handoffState.url = dest === 'vk'
        ? 'https://vk.me/' + CONFIG.vkGroup
        : (CONFIG.telegramPublic
            ? 'https://t.me/' + CONFIG.telegramPublic.replace('@', '')
            : 'https://t.me/share/url?url=&text=' + encodeURIComponent(text));

      form.hidden = true;
      els.handoff.hidden = false;
      els.handoffNote.textContent = where + ' не разрешает сайту заполнить сообщение за вас. ' +
        'Поэтому текст нужно скопировать, а фото приложить в диалоге.';
      els.handoffText.textContent = text;
      els.handoffCopy.textContent = 'Скопировать текст и открыть ' + where;
      els.handoffHint.textContent = 'Текст ляжет в буфер обмена, откроется диалог — вставьте его туда: Ctrl + V.';
      els.handoffPhotos.hidden = files.length === 0;
      els.handoffPhotoStep.textContent = 'Шаг 1 — фото (' + files.length + ')';
      els.handoffTextStep.textContent = files.length ? 'Шаг 2 — текст' : 'Шаг 1 — текст';
      drawThumbs(els.handoffThumbs, false);
      els.handoff.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

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

    /* ── финальный экран ── */

    function succeed(text, dest) {
      form.hidden = true;
      els.handoff.hidden = true;
      els.done.hidden = false;

      var hours = CONFIG.responseHours;
      var wait = 'Ответим в течение ' + hours + ' ' + plural(hours, 'часа', 'часов', 'часов') + '.';
      var manual = dest === 'vk' || dest === 'telegram';

      els.doneTitle.textContent = key === 'tasting' ? 'Запись принята' : 'Заявка получена';
      els.doneText.textContent =
        dest === 'bot' || dest === 'webhook'
          ? wait + ' Если написали после ' + CONFIG.worksUntil + ' — ответим утром.'
          : dest === 'whatsapp'
            ? 'Осталось нажать «Отправить» в открывшемся WhatsApp — текст уже подставлен. ' + wait
            : 'Текст в буфере обмена — вставьте его в открывшемся диалоге (Ctrl + V)' +
              (files.length ? ' и приложите сохранённые фото. ' : '. ') + wait;

      els.recap.textContent = text;
      els.recopy.hidden = !manual;
      els.done.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /* ── события ── */

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var problem = validate();
      if (problem) return showError(problem);
      hideError();

      var text = buildText();
      els.submit.disabled = true;
      var label = els.submit.textContent;
      els.submit.textContent = 'Отправляем…';

      send(text).then(function (dest) {
        if (dest === 'vk' || dest === 'telegram') handoff(text, dest);
        else succeed(text, dest);
      }).catch(function (err) {
        showFallback(err.message, text);
      }).then(function () {
        els.submit.disabled = false;
        els.submit.textContent = label;
      });
    });

    form.addEventListener('input', refresh);
    form.addEventListener('change', function (e) {
      var name = e.target.name;

      schema.steps.forEach(function (s) {
        if (s.custom && name === s.name) {
          var other = form.querySelector('[name="' + s.name + 'Other"]');
          var on = val(s.name) === s.custom;
          other.hidden = !on;
          if (on) other.focus(); else other.value = '';
        }
        /* «Пришлю референс» открывает загрузку, «обсудим» — прячет */
        if (s.type === 'filesOrTalk' && name === s.name) {
          var wrap = form.querySelector('[data-dropwrap]');
          var wantsRefs = val(s.name) === s.options[0];
          wrap.hidden = !wantsRefs;
          if (!wantsRefs && files.length) {
            files = [];
            drawThumbs(els.thumbs, true);
          }
        }
        if (s.type === 'date' && name === s.name) {
          var hint = form.querySelector('[data-hint="' + s.name + '"]');
          var v = val(s.name);
          var d = v ? daysLeft(v) : null;
          if (v && d < 0) {
            hint.textContent = 'Эта дата уже прошла — проверьте, пожалуйста.';
            hint.hidden = false;
          } else if (v && s.name === 'date' && key === 'order' && d < 21) {
            hint.textContent = 'До свадьбы меньше трёх недель — напишем, получится ли взять дату.';
            hint.hidden = false;
          } else {
            hint.hidden = true;
          }
        }
      });

      if (name === 'channel') {
        var c = val('channel');
        var box = form.querySelector('[name="contact"]');
        box.placeholder = c === 'Telegram' ? '@ваш_ник'
          : c === 'ВКонтакте' ? 'vk.com/ваша_страница'
          : '+7 ___ ___-__-__';
        box.inputMode = (c === 'Телефон' || c === 'WhatsApp') ? 'tel' : 'text';
      }
      refresh();
    });

    if (els.fileInput) {
      els.fileInput.addEventListener('change', function () {
        addFiles(els.fileInput.files);
        els.fileInput.value = '';
      });
      ['dragenter', 'dragover'].forEach(function (ev) {
        els.drop.addEventListener(ev, function (e) { e.preventDefault(); els.drop.classList.add('is-over'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        els.drop.addEventListener(ev, function (e) { e.preventDefault(); els.drop.classList.remove('is-over'); });
      });
      els.drop.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
      });
    }

    els.pickClear.addEventListener('click', function () {
      picked = '';
      els.pick.hidden = true;
      refresh();
    });

    els.handoffSave.addEventListener('click', saveFiles);
    els.handoffCopy.addEventListener('click', function () {
      copyThen(handoffState.url, handoffState.text);
      succeed(handoffState.text, handoffState.dest);
    });
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
      drawThumbs(els.thumbs, true);
      form.querySelectorAll('.fhint').forEach(function (h) { h.hidden = true; });
      form.querySelectorAll('.fld--custom').forEach(function (i) { i.hidden = true; });
      els.done.hidden = true;
      els.handoff.hidden = true;
      els.handoffSave.textContent = 'Сохранить фото на устройство';
      els.recopy.textContent = 'Скопировать текст ещё раз';
      form.hidden = false;
      hideError();
      refresh();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    refresh();

    return {
      key: key,
      preset: function (opts) {
        if (form.hidden) els.again.click();
        if (opts.composition) {
          picked = opts.composition;
          els.pickName.textContent = opts.composition;
          els.pick.hidden = false;
          var fromCatalog = form.querySelector('[name="kind"][value="Из каталога"]');
          if (fromCatalog) fromCatalog.checked = true;
        }
        refresh();
      }
    };
  }

  var instances = [];
  document.querySelectorAll('[data-form]').forEach(function (root) {
    var made = mount(root, root.dataset.form);
    if (made) instances.push(made);
  });

  window.Forms = {
    preset: function (key, opts) {
      instances.forEach(function (i) { if (i.key === key) i.preset(opts); });
    }
  };
})();

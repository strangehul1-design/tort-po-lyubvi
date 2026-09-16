/* Демо-сайт: витрина, фильтры каталога, связка каталога с формой заявки. */

(function () {
  'use strict';

  /* ── шапка: линия появляется, когда страница сдвинулась ── */
  var topbar = document.querySelector('.topbar');
  var onScroll = function () {
    topbar.classList.toggle('is-stuck', window.scrollY > 8);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── мобильное меню ── */
  var burger = document.querySelector('.burger');
  var mobileNav = document.getElementById('mobile-nav');
  burger.addEventListener('click', function () {
    var open = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!open));
    mobileNav.hidden = open;
  });
  mobileNav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      burger.setAttribute('aria-expanded', 'false');
      mobileNav.hidden = true;
    }
  });

  /* ── фильтры каталога ── */
  var chips = document.querySelectorAll('.chip');
  var cards = document.querySelectorAll('.swatch');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var filter = chip.dataset.filter;
      chips.forEach(function (c) { c.classList.toggle('is-active', c === chip); });
      cards.forEach(function (card) {
        card.classList.toggle('is-hidden', filter !== 'all' && card.dataset.cat !== filter);
      });
    });
  });

  /* ── фото вместо силуэта: <div class="swatch__chip" data-photo="images/x.jpg"> ── */
  document.querySelectorAll('[data-photo]').forEach(function (el) {
    el.style.backgroundImage = 'url("' + el.dataset.photo + '")';
    el.classList.add('has-photo');
  });

  /* ── «Заказать» из каталога подставляет позицию в форму ──
     Позиция каталога → тип изделия и повод, чтобы человек не выбирал заново. */
  var PRESETS = {
    'Торт на годик': { kind: 'Торт', reason: 'День рождения' },
    'Свадебный ярусный торт': { kind: 'Торт', reason: 'Свадьба' },
    'Гендерный торт': { kind: 'Торт', reason: 'Другое' },
    'Моти': { kind: 'Десерты' }
  };

  document.querySelectorAll('.swatch__order').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.dataset.order;
      var preset = PRESETS[item] || { kind: 'Торт' };
      if (window.OrderForm) {
        window.OrderForm.preset({ item: item, kind: preset.kind, reason: preset.reason });
      }
      document.getElementById('order').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ── появление блоков при прокрутке ── */
  var targets = document.querySelectorAll('.section__head, .swatch, .step, .review, .included li, .facts__row');
  if ('IntersectionObserver' in window) {
    targets.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        var delay = Math.min(i, 6) * 55;
        window.setTimeout(function () { entry.target.classList.add('is-in'); }, delay);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach(function (el) { io.observe(el); });
  }
})();

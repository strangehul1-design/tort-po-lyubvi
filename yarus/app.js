/* Лендинг «Ярус»: шапка, фильтры каталога, слоты под фото, появление блоков. */

(function () {
  'use strict';

  /* ── шапка ── */
  var topbar = document.querySelector('.topbar');
  var onScroll = function () { topbar.classList.toggle('is-stuck', window.scrollY > 10); };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  var burger = document.querySelector('.burger');
  var mnav = document.getElementById('mnav');
  burger.addEventListener('click', function () {
    var open = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!open));
    mnav.hidden = open;
  });
  mnav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      burger.setAttribute('aria-expanded', 'false');
      mnav.hidden = true;
    }
  });

  /* ── слоты под фото ──
     В data-photo записан путь, по которому слот ждёт снимок. Пока файла нет,
     остаётся линейный рисунок. Чтобы поставить фото — положите файл по этому
     пути и включите загрузку: <html data-photos="on">. */
  var photosOn = document.documentElement.dataset.photos === 'on';
  document.querySelectorAll('.shot__img').forEach(function (img) {
    var shot = img.closest('.shot');
    var src = img.dataset.photo;
    if (!photosOn || !src) { shot.classList.add('is-empty'); return; }
    img.addEventListener('error', function () { shot.classList.add('is-empty'); });
    img.src = src;
  });

  /* ── каталог: фильтр и сортировка ── */
  var grid = document.querySelector('[data-grid]');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.cake'));
  var chips = document.querySelectorAll('.chip');
  var sorter = document.querySelector('[data-sort]');
  var empty = document.querySelector('[data-empty]');
  var style = 'all';

  cards.forEach(function (c, i) { c.dataset.order = i; });

  function num(card, key) { return parseFloat(card.dataset[key]); }

  function apply() {
    var shown = 0;
    cards.forEach(function (card) {
      var ok = style === 'all' || card.dataset.style === style;
      card.classList.toggle('is-off', !ok);
      if (ok) shown++;
    });
    empty.hidden = shown > 0;

    var by = sorter.value;
    var sorted = cards.slice().sort(function (a, b) {
      if (by === 'price-asc') return num(a, 'price') - num(b, 'price');
      if (by === 'price-desc') return num(b, 'price') - num(a, 'price');
      if (by === 'weight-asc') return num(a, 'weight') - num(b, 'weight');
      if (by === 'weight-desc') return num(b, 'weight') - num(a, 'weight');
      return num(a, 'order') - num(b, 'order');
    });
    sorted.forEach(function (card) { grid.appendChild(card); });
  }

  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      style = chip.dataset.style;
      chips.forEach(function (c) { c.classList.toggle('is-on', c === chip); });
      apply();
    });
  });
  sorter.addEventListener('change', apply);

  /* ── «Выбрать» подставляет композицию в заявку ── */
  document.querySelectorAll('[data-pick]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (window.Forms) window.Forms.preset('order', { composition: btn.dataset.pick });
      document.getElementById('order').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ── появление блоков ── */
  var targets = document.querySelectorAll('.shead, .cake, .step, .shot--hero, .gallery .shot, .word, .facts, .strip');
  if ('IntersectionObserver' in window) {
    targets.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        var delay = Math.min(i, 5) * 70;
        window.setTimeout(function () { entry.target.classList.add('is-in'); }, delay);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    targets.forEach(function (el) { io.observe(el); });
  }
})();

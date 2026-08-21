/* Лендинг «Мелия»: шапка, слоты под фото, появление блоков. */

(function () {
  'use strict';

  /* ── шапка ── */
  var bar = document.querySelector('.bar');
  var onScroll = function () { bar.classList.toggle('is-stuck', window.scrollY > 10); };
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
     остаётся линейный рисунок. Чтобы поставить фото — положите файлы в images/
     и включите загрузку: <html data-photos="on">. */
  var photosOn = document.documentElement.dataset.photos === 'on';
  document.querySelectorAll('.shot__img').forEach(function (img) {
    var shot = img.closest('.shot');
    var src = img.dataset.photo;
    if (!photosOn || !src) { shot.classList.add('is-empty'); return; }
    img.addEventListener('error', function () { shot.classList.add('is-empty'); });
    img.src = src;
  });

  /* ── появление блоков ── */
  /* первый экран не прячем — он должен появиться сразу */
  var targets = document.querySelectorAll(
    '.head, .work, .step, .shot--wide, .gallery .shot, .word, .dfacts'
  );
  if ('IntersectionObserver' in window) {
    targets.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        var delay = Math.min(i, 5) * 80;
        window.setTimeout(function () { entry.target.classList.add('is-in'); }, delay);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.05 });
    targets.forEach(function (el) { io.observe(el); });
  }
})();

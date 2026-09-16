/* Лендинг «Мелия»: шапка, переключатель, слоты под фото, движение. */

(function () {
  'use strict';

  /* Системная настройка «уменьшить движение» уважается по умолчанию,
     но посетитель может включить анимации на сайте — кнопкой в подвале. */
  var systemCalm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var forcedMotion = document.documentElement.dataset.motion === 'on';
  var calm = systemCalm && !forcedMotion;
  var desktop = window.matchMedia('(pointer: fine)').matches && window.innerWidth >= 1080;

  var motionBtn = document.querySelector('[data-motion-btn]');
  if (motionBtn && systemCalm) {
    motionBtn.hidden = false;
    motionBtn.textContent = forcedMotion
      ? 'Выключить анимации на этом сайте'
      : 'В системе выключены анимации — включить здесь';
    motionBtn.addEventListener('click', function () {
      try {
        if (forcedMotion) localStorage.removeItem('melia-motion');
        else localStorage.setItem('melia-motion', 'on');
      } catch (e) {}
      location.reload();
    });
  }

  /* ── шапка ─────────────────────────────────────────────── */

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

  /* ── переключатель: заказать · дегустация · доставка ───── */

  var tabsBox = document.querySelector('.tabs');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var glow = document.querySelector('[data-glow]');

  function moveGlow(tab) {
    if (!glow || window.innerWidth <= 860) return;
    glow.style.setProperty('--glow-x', (tab.offsetLeft - tabs[0].offsetLeft) + 'px');
    glow.style.setProperty('--glow-w', tab.offsetWidth + 'px');
    tabsBox.classList.add('is-ready');
  }

  function activate(name, opts) {
    var tab = tabs.filter(function (t) { return t.dataset.tab === name; })[0];
    if (!tab) return;
    opts = opts || {};

    tabs.forEach(function (t) {
      var on = t === tab;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;

      var panel = document.getElementById(t.getAttribute('aria-controls'));
      panel.hidden = !on;
      panel.classList.remove('is-in');
      if (on) {
        /* перезапускаем появление панели; в спокойном режиме это только проявление */
        void panel.offsetWidth;
        panel.classList.add('is-in');
      }
    });

    moveGlow(tab);
    if (opts.focus) tab.focus();
    if (opts.scroll) scrollToY(offsetOf(tabsBox) - 96);
    if (opts.hash !== false && location.hash.slice(1) !== name) {
      history.replaceState(null, '', '#' + name);
    }
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { activate(tab.dataset.tab, { scroll: false }); });

    /* стрелки переключают вкладки — так работает нативный tablist */
    tab.addEventListener('keydown', function (e) {
      var step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (e.key === 'Home') { e.preventDefault(); return activate(tabs[0].dataset.tab, { focus: true }); }
      if (e.key === 'End') { e.preventDefault(); return activate(tabs[tabs.length - 1].dataset.tab, { focus: true }); }
      if (!step) return;
      e.preventDefault();
      var next = tabs[(i + step + tabs.length) % tabs.length];
      activate(next.dataset.tab, { focus: true });
    });
  });

  window.addEventListener('resize', function () {
    var on = tabs.filter(function (t) { return t.classList.contains('is-on'); })[0];
    if (on) moveGlow(on);
  });

  /* ── прокрутка с плавным замедлением ────────────────────── */

  function offsetOf(el) {
    return el.getBoundingClientRect().top + window.scrollY;
  }

  var scrolling = null;

  function scrollToY(y) {
    y = Math.max(0, Math.min(y, document.documentElement.scrollHeight - window.innerHeight));
    if (calm) { window.scrollTo(0, y); return; }

    var start = window.scrollY;
    var delta = y - start;
    if (Math.abs(delta) < 2) return;
    var dur = Math.min(1100, 420 + Math.abs(delta) * 0.32);
    var t0 = performance.now();
    if (scrolling) cancelAnimationFrame(scrolling);

    var ease = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

    (function step(now) {
      var p = Math.min(1, (now - t0) / dur);
      window.scrollTo(0, start + delta * ease(p));
      if (p < 1) scrolling = requestAnimationFrame(step);
      else scrolling = null;
    })(t0);
  }

  /* якоря ведут плавно и без рывка; вкладки открываются нужной стороной */
  var TAB_NAMES = { order: 1, tasting: 1, delivery: 1 };

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    var name = link.getAttribute('href').slice(1);
    if (!name) return;

    if (TAB_NAMES[name]) {
      e.preventDefault();
      activate(name);
      scrollToY(offsetOf(tabsBox) - 96);
      return;
    }
    var target = document.getElementById(name);
    if (!target) return;
    e.preventDefault();
    history.replaceState(null, '', '#' + name);
    scrollToY(offsetOf(target) - (name === 'top' ? 200 : 40));
  });

  /* ── прокрутка колесом с инерцией: только на компьютере ─── */

  if (desktop && !calm) {
    var target = window.scrollY;
    var running = false;
    var last = 0;

    /* доля сглаживания считается от прошедшего времени, а не от кадра,
       иначе на 144 Гц страница летит вдвое быстрее, чем на 60 Гц */
    var loop = function (now) {
      var dt = last ? Math.min(64, now - last) : 16.7;
      last = now;
      var k = 1 - Math.pow(1 - 0.14, dt / 16.7);

      var current = window.scrollY;
      if (Math.abs(target - current) < 0.6) {
        window.scrollTo(0, target);
        running = false;
        last = 0;
        return;
      }
      window.scrollTo(0, current + (target - current) * k);
      requestAnimationFrame(loop);
    };

    window.addEventListener('wheel', function (e) {
      /* не мешаем прокрутке внутри полей и не ломаем зум */
      if (e.ctrlKey || e.deltaMode !== 0) return;
      var el = e.target;
      if (el && el.closest && el.closest('textarea, select, [data-native-scroll]')) return;
      if (scrolling) return;

      e.preventDefault();
      var max = document.documentElement.scrollHeight - window.innerHeight;
      target = Math.max(0, Math.min(target + e.deltaY, max));
      if (!running) { running = true; requestAnimationFrame(loop); }
    }, { passive: false });

    /* клавиатура и якоря двигают страницу сами — подхватываем позицию */
    window.addEventListener('scroll', function () {
      if (!running) target = window.scrollY;
    }, { passive: true });
  }

  /* ── лёгкий параллакс фото на первом экране ─────────────── */

  var heroPh = document.querySelector('.shot--hero .shot__ph');
  if (heroPh && !calm && desktop) {
    var heroShot = heroPh.closest('.shot');
    var parallax = function () {
      var r = heroShot.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      var shift = (r.top - window.innerHeight * 0.5) * -0.05;
      heroPh.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0)';
    };
    parallax();
    window.addEventListener('scroll', parallax, { passive: true });
  }

  /* ── появление блоков при прокрутке ────────────────────── */

  /* кнопки переключателя не прячем — это органы управления.
     Появление работает и в спокойном режиме: там оно без сдвига, одним
     проявлением — это не укачивает, но страница остаётся живой. */
  var targets = document.querySelectorAll(
    '.head, .work, .step, .shot--wide, .gallery .shot, .word, .dfacts > div'
  );
  if ('IntersectionObserver' in window) {
    /* Класс вешаем скриптом уже после отрисовки, поэтому первое скрытие
       само по себе анимируется: блок виден, гаснет и только потом
       проявляется. Гасим переход на один кадр, чтобы стартовое состояние
       встало мгновенно. */
    targets.forEach(function (el) {
      el.style.transition = 'none';
      el.classList.add('reveal');
    });
    void document.body.offsetWidth;
    targets.forEach(function (el) { el.style.transition = ''; });
    /* Показываем сразу в обработчике, без таймера: в фоновой вкладке
       таймеры душатся до одного срабатывания в секунду, и блок мог
       остаться невидимым. Каскад и так возникает сам — блоки входят
       в экран по очереди, пока страницу листают. */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    targets.forEach(function (el) { io.observe(el); });

    /* страховка: что бы ни случилось, содержимое не остаётся спрятанным */
    window.addEventListener('load', function () {
      window.setTimeout(function () {
        targets.forEach(function (el) { el.classList.add('is-in'); });
      }, 3000);
    });
  }

  /* ── стартовое состояние переключателя ──────────────────── */

  var fromHash = location.hash.slice(1);
  activate(TAB_NAMES[fromHash] ? fromHash : 'order', { hash: false });
  if (TAB_NAMES[fromHash]) {
    window.setTimeout(function () { scrollToY(offsetOf(tabsBox) - 96); }, 60);
  }

  window.addEventListener('hashchange', function () {
    var name = location.hash.slice(1);
    if (TAB_NAMES[name]) activate(name, { hash: false });
  });
})();

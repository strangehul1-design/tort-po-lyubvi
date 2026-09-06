/**
 * Собирает разметку карточек цен, начинок и списка в форме заказа
 * из assets/catalog.js и assets/gallery.js.
 *
 * Карточки лежат в HTML статически, а не рисуются скриптом: так их
 * видит поисковый робот и человек с выключенным JS. Скрипт нужен
 * только чтобы разметка, каталог и фотографии не разъехались руками.
 */
import fs from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('assets/catalog.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('assets/gallery.js', 'utf8'), ctx);
const { CATALOG, FILLINGS } = ctx.window;
const PRICE_PHOTOS = ctx.window.PRICE_PHOTOS || [];

const NB = ' ';
const money = v => new Intl.NumberFormat('ru-RU').format(v) + NB + '₽';
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rv = i => ['rv', 'rv rv-1', 'rv rv-2'][i % 3];

const PLUS = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>`;
const ZOOM = `<span class="shot-zoom" aria-hidden="true"><svg viewBox="0 0 24 24">` +
  `<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4M11 8.6v4.8M8.6 11h4.8"/></svg></span>`;

const cakesData = CATALOG.filter(i => i.weight);
const services = CATALOG.filter(i => !i.weight);

/* ── карточки тортов ──
   Имени у позиции нет, заголовком работает вес. Фотография берётся
   по номеру строки прайса: она и объясняет, почему два торта одного
   веса стоят по-разному. */
const cakes = cakesData.map((i, n) => {
  const ph = PRICE_PHOTOS[i.pos - 1];
  const alt = `Свадебный торт ${i.weight} на ${i.guests.replace(' гостей', '')} гостей`;
  const photo = ph ? `
        <button class="price-ph" type="button" data-big="${ph.big}"
                aria-label="${esc(alt)} — посмотреть крупнее">
          <img itemprop="image" src="${ph.small}" srcset="${ph.small} 800w, ${ph.big} 1600w"
               sizes="(max-width:640px) 64px, (max-width:980px) 40vw, 320px"
               width="${ph.w}" height="${ph.h}" loading="lazy" decoding="async"
               alt="${esc(alt)}">
          ${ZOOM}
        </button>` : '';
  return `      <article class="price price--cake ${rv(n)}" itemscope itemtype="https://schema.org/Product">
        <meta itemprop="name" content="${esc(i.name)}">${photo}
        <div class="price-cake-l">
          <h3 class="price-w" data-cms="price.${i.id}.name">${esc(i.weight)}</h3>
          <p class="price-g" itemprop="description">${esc(i.guests)}</p>
        </div>
        <div class="price-tag" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
          <span class="price-num" data-cms="price.${i.id}.value">${money(i.price)}</span>
          <span class="price-unit">${esc(i.unit)}</span>
          <meta itemprop="price" content="${i.price}">
          <meta itemprop="priceCurrency" content="RUB">
          <link itemprop="availability" href="https://schema.org/InStock">
        </div>
        <button class="btn btn--ghost" type="button" data-add="${i.id}"><span><span class="lbl">В корзину</span>
          ${PLUS}
        </span></button>
      </article>`;
}).join('\n');

/* ── дегустация и доставка: у них есть названия и описания ── */
const servicesHtml = services.map((i, n) => `      <article class="price ${rv(n)}" itemscope itemtype="https://schema.org/Product">
        <h3 class="price-name" itemprop="name" data-cms="price.${i.id}.name">${esc(i.name)}</h3>
        <p class="price-desc" itemprop="description" data-cms="price.${i.id}.desc">${esc(i.desc)}</p>${i.note ? `
        <p class="price-note" data-cms="price.${i.id}.note">${esc(i.note)}</p>` : ''}
        <div class="price-tag" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
          <span class="price-num" data-cms="price.${i.id}.value">${money(i.price)}</span>
          <span class="price-unit">${esc(i.unit)}</span>
          <meta itemprop="price" content="${i.price}">
          <meta itemprop="priceCurrency" content="RUB">
          <link itemprop="availability" href="https://schema.org/InStock">
        </div>
        <button class="btn btn--ghost" type="button" data-add="${i.id}"><span>В корзину
          ${PLUS}
        </span></button>
      </article>`).join('\n');

/* ── карточки начинок ── */
const fills = FILLINGS.map((f, n) => {
  let choice = '';
  if (f.choice) {
    const at = f.choice.indexOf(': ');
    choice = at > 0
      ? `\n        <p class="fill-c"><b>${esc(f.choice.slice(0, at + 1))}</b> ${esc(f.choice.slice(at + 2))}</p>`
      : `\n        <p class="fill-c">${esc(f.choice)}</p>`;
  }
  return `      <article class="fill ${rv(n)}">
        <h3 class="fill-n">${esc(f.name)}</h3>
        <p class="fill-d">${esc(f.desc)}</p>${choice}
      </article>`;
}).join('\n');

const options = FILLINGS.map(f => `              <option>${esc(f.name)}</option>`).join('\n');

let s = fs.readFileSync('index.html', 'utf8');

/** Закрывающий </div> для контейнера, считая вложенность:
    внутри карточек свои <div>, и наивный поиск попал бы в первый из них. */
function closeOf(open) {
  const a = s.indexOf(open);
  if (a < 0) throw new Error(`не найден контейнер: ${open}`);
  let i = a + open.length, depth = 1;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = i;
  let m;
  while ((m = re.exec(s))) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return [a + open.length, m.index];
  }
  throw new Error(`не закрыт контейнер: ${open}`);
}

function fill(name, open, body) {
  const [from, to] = closeOf(open);
  s = s.slice(0, from) + '\n' + body + '\n    ' + s.slice(to);
  console.log(`  ✓ ${name}`);
}

fill('карточки тортов', '<div class="prices prices--cakes" id="price-grid">', cakes);
fill('дегустация и доставка', '<div class="prices" id="service-grid">', servicesHtml);
fill('карточки начинок', '<div class="fills" id="fill-grid">', fills);

/* Список начинок в форме — между заглушкой и пунктом про дегустацию */
{
  const head = '<option value="">Выберите из ассортимента</option>';
  const tail = '              <option data-tasting="1">';
  const a = s.indexOf(head), b = s.indexOf(tail, a);
  if (a < 0 || b < 0) throw new Error('список начинок в форме не найден');
  s = s.slice(0, a + head.length) + '\n' + options + '\n' + s.slice(b);
  console.log('  ✓ список начинок в форме');
}

fs.writeFileSync('index.html', s, 'utf8');
console.log(`\nГотово: ${cakesData.length} тортов (${PRICE_PHOTOS.length} с фото), ` +
            `${services.length} услуг, ${FILLINGS.length} начинок`);

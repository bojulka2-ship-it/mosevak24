/* МОСЭВАК 24 — логика главной страницы.
   Вынесено из index.html для кэширования и строгого CSP без 'unsafe-inline'.
   Все обработчики — через addEventListener, inline-атрибутов (onerror/onclick) в разметке нет. */

/* ================= КОНФИГУРАЦИЯ ================= */
const CONFIG = {
  /* ДЕМО-РЕЖИМ: пустая строка = заявки не уходят на сервер, а сохраняются
     в localStorage браузера. Пользователь видит пометку «Демо-режим».
     Так опубликованная версия на GitHub Pages не засоряет рабочую таблицу.

     Чтобы включить приём заявок, вставьте сюда URL веб-приложения:
       googleScriptUrl: 'https://script.google.com/macros/s/AKfycb…/exec',
     Инструкция — в README, раздел «Подключение приёма заявок».

     ВНИМАНИЕ: это публичный эндпоинт без аутентификации — любой может
     отправить в него POST. Подробности и меры защиты — в SECURITY.md. */
  googleScriptUrl: '',

  /* ID счётчика Яндекс.Метрики: создайте счётчик на metrika.yandex.ru
     (нужен любой Яндекс-аккаунт) и вставьте номер сюда — скрипт подключится сам. */
  yandexMetrikaId: '',

  /* Сколько дней хранить заявки в localStorage демо-режима, прежде чем удалить. */
  demoOrdersTtlDays: 1
};

/* ================= УТИЛИТЫ ================= */

/* Экранирование для вставки в innerHTML.
   Сейчас все данные — литералы в этом файле, но если они когда-нибудь придут
   из URL, localStorage или API, innerHTML без экранирования станет XSS. */
function esc(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const fmt = n => n.toLocaleString('ru-RU');

/* Пересоздаёт иконки lucide. Вызывается после любого innerHTML с data-lucide. */
function icons() {
  if (window.lucide && typeof lucide.createIcons === 'function') lucide.createIcons();
}

/* Яндекс.Метрика — подключается только если заполнен ID */
if (CONFIG.yandexMetrikaId) {
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://mc.yandex.ru/metrika/tag.js';
  s.onload = () => window.ym && ym(CONFIG.yandexMetrikaId, 'init', {clickmap:true, trackLinks:true, accurateTrackBounce:true, webvisor:true});
  document.head.appendChild(s);
}

/* ================= ДАННЫЕ ================= */
const SERVICES = [
  {ico:'wrench',    title:'Эвакуация после поломки', text:'Не заводится или дальше ехать нельзя — доставим к сервису или домой в любой район Москвы и области.'},
  {ico:'siren',     title:'Эвакуация после ДТП',     text:'Аккуратно погрузим автомобиль с любыми повреждениями, скоординируемся с сотрудниками ГИБДД на месте.'},
  {ico:'car',       title:'Перевозка автомобилей',   text:'Легковые авто на платформе с фиксацией колёс — без царапин и скачков по кузову.'},
  {ico:'truck',     title:'Внедорожники и мототехника', text:'Платформы грузоподъёмностью до 7 тонн: внедорожники, минивэны, мотоциклы, квадроциклы.'},
  {ico:'route',     title:'Межгород',                text:'Доставка по области и между городами: до 50 км — 55 ₽/км, далее — 45 ₽/км. Статус рейса — по телефону.'},
  {ico:'hard-hat',  title:'Сложная погрузка',        text:'Заблокированные колёса, перевёртыш, кювет или узкий двор — сдвижные платформы, лебёдка и КМУ.'}
];

const FAQ = [
  {q:'Сколько ждать эвакуатор?', a:'По Москве днём — обычно 20–40 минут, ночью — 15–30 (дороги свободнее). По Московской области — 40–60 минут. Точное время диспетчер называет при подтверждении заявки.'},
  {q:'Изменится ли цена после приезда?', a:'Нет. Стоимость озвучивается по телефону до выезда и фиксируется: вы платите ровно столько, сколько назвал диспетчер.'},
  {q:'Что делать, если колёса заблокированы?', a:'Ничего, это наша работа. Сдвижные платформы с лебёдкой погружают автомобили с заблокированными колёсами — доплата 1 500 ₽. Перевёрнутые машины поднимаем краном-манипулятором.'},
  {q:'Как можно оплатить?', a:'Наличными или переводом по СБП (по QR-коду) — строго после доставки автомобиля. Предоплаты нет. Водитель выдаёт чек и документы о перевозке.'},
  {q:'Работаете ли вы со страховыми после ДТП?', a:'Нет, напрямую со страховыми мы не работаем. Но мы оперативно заберём автомобиль с места ДТП, скоординируемся с ГИБДД и выдадим полный пакет документов о перевозке — он пригодится при вашем обращении в страховую.'},
  {q:'Есть ли наценка за удалённость или ночь?', a:'За ночь, выходные и праздники наценок нет. По расстоянию: до 50 км за МКАД — +55 ₽/км, свыше 50 км от Москвы действует межгород — 45 ₽/км.'}
];

const CALC = {
  cars: [
    {id:'sedan', name:'Легковой',   base:2900},
    {id:'cross', name:'Кроссовер',  base:3400},
    {id:'suv',   name:'Внедорожник',base:4200},
    {id:'moto',  name:'Мото / квадро', base:2500}
  ],
  near: 55, far: 45, limit: 50,
  opts: [
    {id:'wheels', name:'Заблокированные колёса', price:1500},
    {id:'flip',   name:'Перевёртыш (КМУ)',       price:2500},
    {id:'ditch',  name:'Вытаскивание из кювета', price:2000}
  ]
};

/* ================= РЕНДЕР СПИСКОВ ================= */
$('#servicesList').innerHTML = SERVICES.map((s, i) => `
  <div class="srv${i === 0 ? ' open' : ''}">
    <button class="srv-head" aria-expanded="${i === 0}">
      <span class="srv-num">0${i + 1}</span>
      <span class="srv-ico"><i data-lucide="${esc(s.ico)}"></i></span>
      <span class="srv-title">${esc(s.title)}</span>
      <span class="srv-chev"><i data-lucide="chevron-down"></i></span>
    </button>
    <div class="srv-body"><p>${esc(s.text)}</p></div>
  </div>`).join('');

$('#faqList').innerHTML = FAQ.map((f, i) => `
  <div class="faq-item${i === 0 ? ' open' : ''}">
    <button class="faq-q" aria-expanded="${i === 0}">${esc(f.q)}<i data-lucide="chevron-down"></i></button>
    <div class="faq-a"><p>${esc(f.a)}</p></div>
  </div>`).join('');

const tapeText = ['Подача от 20 минут', 'Москва и МО', 'Фиксированная цена до выезда', 'Оплата: наличные · СБП', 'Без скрытых доплат', 'Работаем 24/7'];
const chunk = `<span class="tape-chunk">${tapeText.map(t => `<b>${esc(t)}</b><span class="diamond"></span>`).join('')}</span>`;
$('#tape1').innerHTML = chunk + chunk;
$('#tape2').innerHTML = chunk + chunk;

icons();

/* ================= ФОТО: ЗАПАСНОЙ ВАРИАНТ ПРИ ОШИБКЕ ЗАГРУЗКИ =================
   Раньше здесь стоял атрибут onerror="..." на каждом <img> — он ломает строгий CSP.
   Теперь обработчик навешивается из JS, а класс .noimg включает подпись-заглушку. */
$$('.ph img').forEach(img => {
  img.addEventListener('error', () => {
    const fig = img.closest('figure');
    if (fig) fig.classList.add('noimg');
  });
});

/* ================= ШАПКА, ПРОГРЕСС, МЕНЮ ================= */
const header = $('#siteHeader');
const progress = $('#scrollProgress');

addEventListener('scroll', () => {
  header.classList.toggle('scrolled', scrollY > 10);
  const h = document.documentElement;
  progress.style.width = (scrollY / (h.scrollHeight - innerHeight) * 100) + '%';
}, {passive: true});

const burger = $('#burgerBtn');
const mobileNav = $('#mobileNav');

function setBurgerIcon(open) {
  burger.innerHTML = `<i data-lucide="${open ? 'x' : 'menu'}"></i>`;
  icons();
}

burger.addEventListener('click', () => {
  const open = mobileNav.classList.toggle('open');
  burger.setAttribute('aria-expanded', String(open));
  setBurgerIcon(open);
});

$$('a', mobileNav).forEach(a => a.addEventListener('click', () => {
  mobileNav.classList.remove('open');
  burger.setAttribute('aria-expanded', 'false');
  setBurgerIcon(false);
}));

/* активный пункт меню при прокрутке */
const navLinks = $$('nav.desktop a');
['uslugi','ceny','kalkulyator','o-kompanii','faq','contacts'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
  }), {rootMargin: '-40% 0px -55% 0px'}).observe(el);
});

/* ================= ПОЯВЛЕНИЕ БЛОКОВ ================= */
const revealIO = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (en.isIntersecting) {
      en.target.style.transitionDelay = (en.target.dataset.delay || 0) + 'ms';
      en.target.classList.add('in');
      revealIO.unobserve(en.target);
    }
  });
}, {threshold: .15});
$$('.reveal').forEach(el => revealIO.observe(el));

new IntersectionObserver((es, io) => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), {threshold: .3}).observe($('#stepsBlock'));

/* ================= СЧЁТЧИКИ ================= */
const counterIO = new IntersectionObserver((es, io) => es.forEach(en => {
  if (!en.isIntersecting) return;
  io.unobserve(en.target);
  const el = en.target, target = +el.dataset.target, t0 = performance.now(), dur = 1300;
  (function tick(t) {
    const p = Math.min((t - t0) / dur, 1);
    el.textContent = fmt(Math.round(target * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}), {threshold: .5});
$$('.counter').forEach(el => counterIO.observe(el));

/* ================= АККОРДЕОНЫ ================= */
function bindAccordion(itemSel, btnSel, bodySel) {
  $$(itemSel).forEach(item => {
    const btn = item.querySelector(btnSel), body = item.querySelector(bodySel);
    if (item.classList.contains('open')) body.style.maxHeight = body.scrollHeight + 'px';
    btn.addEventListener('click', () => {
      const willOpen = !item.classList.contains('open');
      $$(itemSel).forEach(other => {
        other.classList.remove('open');
        other.querySelector(bodySel).style.maxHeight = null;
        other.querySelector(btnSel).setAttribute('aria-expanded', 'false');
      });
      if (willOpen) {
        item.classList.add('open');
        body.style.maxHeight = body.scrollHeight + 'px';
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}
bindAccordion('.srv', '.srv-head', '.srv-body');
bindAccordion('.faq-item', '.faq-q', '.faq-a');

/* ================= ТОСТЫ ================= */
function toast(msg, type = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'err' ? ' err' : '');
  el.textContent = msg;               /* textContent, не innerHTML — безопаснее */
  $('#toasts').appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .4s';
    setTimeout(() => el.remove(), 400);
  }, 4200);
}

/* ================= КАЛЬКУЛЯТОР ================= */
const calcCars  = $('#calcCars');
const calcOpts  = $('#calcOpts');
const kmRange   = $('#calcKm');
const kmOut     = $('#calcKmOut');
const calcRows  = $('#calcRows');
const calcTotal = $('#calcTotal');
let calcCar = CALC.cars[0];

calcCars.innerHTML = CALC.cars.map((c, i) => `
  <button type="button" class="${i === 0 ? 'active' : ''}" data-id="${esc(c.id)}">${esc(c.name)}<small>${fmt(c.base)} ₽</small></button>`).join('');

$$('button', calcCars).forEach(b => b.addEventListener('click', () => {
  $$('button', calcCars).forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  calcCar = CALC.cars.find(c => c.id === b.dataset.id);
  calcRender();
}));

calcOpts.innerHTML = CALC.opts.map(o => `
  <label class="opt"><input type="checkbox" id="opt-${esc(o.id)}"><span>${esc(o.name)}</span><span class="pr">+ ${fmt(o.price)} ₽</span></label>`).join('');
$$('input', calcOpts).forEach(i => i.addEventListener('change', calcRender));

function calcCompute() {
  const km = +kmRange.value;
  const road = km <= CALC.limit ? km * CALC.near : CALC.limit * CALC.near + (km - CALC.limit) * CALC.far;
  const optsOn = CALC.opts.filter(o => $('#opt-' + o.id).checked);
  const optSum = optsOn.reduce((s, o) => s + o.price, 0);
  return {km, road, optsOn, optSum, total: calcCar.base + road + optSum};
}

function calcRender() {
  const r = calcCompute();
  kmOut.textContent = r.km === 0 ? 'в пределах МКАД' : r.km + ' км от МКАД';
  let rows = `<div class="price-row"><span class="name">${esc(calcCar.name)} · базовый тариф</span><span class="dots"></span><span class="val">${fmt(calcCar.base)} ₽</span></div>`;
  if (r.km > 0) rows += `<div class="price-row"><span class="name">За МКАД · ${r.km} км</span><span class="dots"></span><span class="val">${fmt(r.road)} ₽</span></div>`;
  r.optsOn.forEach(o => {
    rows += `<div class="price-row"><span class="name">${esc(o.name)}</span><span class="dots"></span><span class="val">+ ${fmt(o.price)} ₽</span></div>`;
  });
  calcRows.innerHTML = rows;
  calcTotal.textContent = fmt(r.total) + ' ₽';
}
kmRange.addEventListener('input', calcRender);
calcRender();

$('#calcFix').addEventListener('click', () => {
  const r = calcCompute();
  const parts = [calcCar.name, r.km === 0 ? 'Москва, в пределах МКАД' : r.km + ' км за МКАД']
    .concat(r.optsOn.map(o => o.name.toLowerCase()));
  $('#f-comment').value = `[Калькулятор] ${parts.join(' · ')} — расчёт ≈ ${fmt(r.total)} ₽. Прошу подтвердить точную цену.`;
  $('#contacts').scrollIntoView({behavior: 'smooth'});
  toast('Расчёт добавлен в заявку — осталось заполнить контакты');
});

/* ================= МАСКА ТЕЛЕФОНА ================= */
const phoneEl = $('#f-phone');
phoneEl.addEventListener('input', () => {
  let d = phoneEl.value.replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (d && !d.startsWith('7')) d = '7' + d;
  d = d.slice(0, 11);
  let out = d ? '+7' : '';
  if (d.length > 1)  out += ' (' + d.slice(1, 4);
  if (d.length >= 5) out += ') ' + d.slice(4, 7);
  if (d.length >= 8) out += '-' + d.slice(7, 9);
  if (d.length >= 10) out += '-' + d.slice(9, 11);
  phoneEl.value = out;
});

/* ================= ПРОВЕРКА АДРЕСА ПО КАРТЕ (OpenStreetMap, без ключей) ================= */
function checkAddress(cityId, addrId, statusId) {
  const city = $('#' + cityId).value.trim();
  const street = $('#' + addrId).value.trim();
  const st = $('#' + statusId);
  st.className = 'map-status';
  st.textContent = '';
  if (!city || street.length < 8) return;
  st.textContent = 'Проверяем адрес на карте…';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  const q = encodeURIComponent(city + ', ' + street);
  fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ru&accept-language=ru&q=' + q, {signal: ctrl.signal})
    .then(r => r.json())
    .then(res => {
      if (res && res.length) {
        st.className = 'map-status ok';
        /* display_name приходит от внешнего API — только через textContent, не innerHTML */
        st.textContent = '✓ Найдено на карте: ' + res[0].display_name.split(',').slice(0, 3).join(', ');
      } else {
        st.className = 'map-status miss';
        st.textContent = 'Не нашли такой адрес на карте — отправим как есть, диспетчер уточнит по телефону';
      }
    })
    .catch(() => {
      st.className = 'map-status miss';
      st.textContent = 'Сервис карт не ответил — адрес отправим как есть';
    })
    .finally(() => clearTimeout(timer));
}
['from', 'to'].forEach(side => {
  $('#f-' + side).addEventListener('blur', () =>
    checkAddress('f-' + side + '-city', 'f-' + side, 'map-' + side));
});

/* ================= ДЕМО-ХРАНИЛИЩЕ (только когда googleScriptUrl пуст) ================= */
const DEMO_KEY = 'evak_orders';
const DEMO_TS  = 'evak_orders_ts';

function demoPurge() {
  try {
    const ts = +localStorage.getItem(DEMO_TS) || 0;
    const ttl = (CONFIG.demoOrdersTtlDays || 1) * 864e5;
    if (ts && Date.now() - ts > ttl) {
      localStorage.removeItem(DEMO_KEY);
      localStorage.removeItem(DEMO_TS);
    }
  } catch (e) { /* приватный режим — просто пропускаем */ }
}

function demoSave(record) {
  demoPurge();
  const arr = JSON.parse(localStorage.getItem(DEMO_KEY) || '[]');
  arr.push(record);
  localStorage.setItem(DEMO_KEY, JSON.stringify(arr));
  localStorage.setItem(DEMO_TS, String(Date.now()));
}

/* ================= ОТПРАВКА ФОРМЫ ================= */
const form       = $('#orderForm');
const submitBtn  = $('#submitBtn');
const success    = $('#formSuccess');
const consentEl  = $('#f-consent');

function setError(fieldId, on) {
  $('#' + fieldId).classList.toggle('error', on);
}

form.addEventListener('submit', async e => {
  e.preventDefault();

  const data = {
    name:     $('#f-name').value.trim(),
    phone:    phoneEl.value.trim(),
    fromCity: $('#f-from-city').value.trim(),
    fromAddr: $('#f-from').value.trim(),
    toCity:   $('#f-to-city').value.trim(),
    toAddr:   $('#f-to').value.trim(),
    comment:  $('#f-comment').value.trim(),
    consent:  consentEl.checked
  };
  data.from = [data.fromCity, data.fromAddr].filter(Boolean).join(', ');
  data.to   = [data.toCity, data.toAddr].filter(Boolean).join(', ');

  const errs = [
    ['fld-name',    data.name.length < 2],
    ['fld-phone',   data.phone.replace(/\D/g, '').length !== 11],
    ['fld-from',    !data.fromCity || data.fromAddr.length < 5],
    ['fld-to',      !data.toCity   || data.toAddr.length < 5],
    ['fld-consent', !data.consent]
  ];
  errs.forEach(([id, bad]) => setError(id, bad));
  if (errs.some(([, bad]) => bad)) {
    toast('Заполните обязательные поля и дайте согласие', 'err');
    return;
  }

  const orderId = 'MS-' + (1000 + Math.floor(Math.random() * 9000));
  const record = {id: orderId, ts: new Date().toLocaleString('ru-RU'), ...data};

  submitBtn.disabled = true;
  submitBtn.style.opacity = '.6';

  try {
    if (CONFIG.googleScriptUrl) {
      /* Apps Script /exec отдаёт "Access-Control-Allow-Origin: *", поэтому обычный
         CORS-запрос работает и ответ можно прочитать. Режим no-cors НЕ используем:
         он давал opaque-ответ (status 0, тело недоступно) и в части браузеров
         ронял POST с "TypeError: Failed to fetch".
         Content-Type: text/plain — safelisted, поэтому preflight не отправляется. */
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), CONFIG.requestTimeoutMs || 20000);

      let res, payload = null;
      try {
        res = await fetch(CONFIG.googleScriptUrl, {
          method: 'POST',
          mode: 'cors',
          /* Ровно 'text/plain' без параметров: это значение из CORS-safelist,
             поэтому preflight (OPTIONS) не отправляется. С добавлением
             ;charset=utf-8 некоторые браузеры решают иначе и делают preflight,
             на который Apps Script отвечает не так, как на POST. */
          headers: {'Content-Type': 'text/plain'},
          body: JSON.stringify(record),
          signal: ctrl.signal,
          credentials: 'omit',
          redirect: 'follow'
        });
        // Apps Script отвечает text/plain — читаем как текст, JSON.parse может не понадобиться.
        const text = await res.text();
        try { payload = JSON.parse(text); } catch (e) { payload = {raw: text}; }
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (payload && payload.ok === false) throw new Error(payload.error || ' Apps Script вернул ok:false');

      console.log('Заявка принята Apps Script:', payload);
      $('#demoNote').hidden = true;
    } else {
      demoSave(record);
      console.log('ЗАЯВКА (демо-режим, сохранена в localStorage):', record);
      $('#demoNote').hidden = false;
    }
    $('#orderNum').textContent = orderId;
    form.style.display = 'none';
    success.style.display = 'block';
    toast('Заявка ' + orderId + ' отправлена');
  } catch (err) {
    /* Различаем причины: иначе всё сводится к «позвоните нам» даже при
       секундной потере связи или опечатке в адресе скрипта. */
    const aborted = err && (err.name === 'AbortError');
    const isHttp   = err && /^HTTP \d/.test(err.message || '');
    console.error('Отправка заявки не удалась:', err);

    if (aborted) {
      toast('Сервер не ответил за 20 секунд. Проверьте интернет или позвоните нам.', 'err');
    } else if (isHttp) {
      toast('Сервер принял запрос, но ответил с ошибкой. Позвоните нам — телефон выше.', 'err');
    } else {
      toast('Не удалось связаться с сервером заявок. Проверьте интернет или позвоните нам.', 'err');
    }
    submitBtn.disabled = false;
    submitBtn.style.opacity = '';
    return;
  }
});

$('#againBtn').addEventListener('click', () => {
  form.reset();
  success.style.display = 'none';
  form.style.display = 'block';
});

$('#year').textContent = new Date().getFullYear();

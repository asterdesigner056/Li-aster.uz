/* Li Auto · Aster Li — без библиотек */
(() => {
  'use strict';
  // настройки страницы лежат в разметке как JSON-данные (не исполняемый код — так требует Content Security Policy)
  const S = (() => { try { return JSON.parse(document.getElementById('site-data').textContent); } catch (e) { return window.SITE || {}; } })();
  const T = S.i18n || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  document.body.classList.add('js');

  /* битые картинки прячем (вместо onerror в разметке — его запрещает Content Security Policy) */
  const hideBroken = (img) => { const t = img.dataset.hideBroken === 'figure' ? img.closest('figure') : img; if (t) t.remove(); };
  document.addEventListener('error', (e) => { const t = e.target; if (t && t.tagName === 'IMG' && t.hasAttribute('data-hide-broken')) hideBroken(t); }, true);
  $$('img[data-hide-broken]').forEach((img) => { if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) hideBroken(img); });

  /* ---------- аналитика: одно место для всех целей ---------- */
  const track = (name, params = {}) => {
    // с GTM события уходят в dataLayer (триггер «Специальное событие» = имя события), без GTM — напрямую в GA4
    try { if (S.gtm) (window.dataLayer = window.dataLayer || []).push({ event: name, ...params }); else if (window.gtag) gtag('event', name, params); } catch (e) {}
    try { window.ym && S.ym && ym(S.ym, 'reachGoal', name, params); } catch (e) {}
    try { window.fbq && name === 'lead_submit' && fbq('track', 'Lead', params); } catch (e) {}
  };
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-ev]');
    if (el) track(el.dataset.ev);
  });

  /* ---------- шапка ---------- */
  const hdr = $('.hdr');
  const mbar = $('.mbar');
  let lastY = 0;
  const onScroll = () => {
    const y = scrollY;
    hdr.classList.toggle('is-solid', y > 40 || document.body.classList.contains('page-privacy'));
    hdr.classList.toggle('is-hidden', y > 600 && y > lastY && !document.body.classList.contains('menu-open'));
    mbar && mbar.classList.toggle('show', y > innerHeight * 0.6);
    lastY = y;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const burger = $('#burger'), nav = $('#nav');
  const closeMenu = () => { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); document.body.classList.remove('menu-open'); };
  burger.addEventListener('click', () => {
    const open = !nav.classList.contains('open');
    nav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open);
    document.body.classList.toggle('menu-open', open);
  });
  $$('a', nav).forEach((a) => a.addEventListener('click', closeMenu));

  /* ---------- появление при скролле ---------- */
  const io = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -6% 0px' });
  $$('.reveal').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 60}ms`; io.observe(el); });

  /* ---------- модальное окно «Забронировать» ---------- */
  const modal = $('#bookModal');
  const bookForm = $('#bookForm');
  let lastFocus = null;
  const openModal = (model) => {
    if (!modal) return;
    lastFocus = document.activeElement;
    bookForm.elements.model.value = model || '';
    $('[data-book-title]', modal).textContent = model ? (T.bookTitleModel || '{name}').replace('{name}', model) : T.bookTitle;
    $('.form__ok', bookForm).hidden = true;
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('open'));
    document.body.classList.add('modal-open');
    setTimeout(() => bookForm.elements.name.focus(), 250);
    track('book_open', { model: model || '' });
  };
  const closeModal = () => {
    if (!modal || modal.hidden) return;
    modal.classList.remove('open');
    document.body.classList.remove('modal-open');
    setTimeout(() => { modal.hidden = true; }, 300);
    lastFocus && lastFocus.focus && lastFocus.focus();
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-book]');
    if (b) { e.preventDefault(); openModal(b.dataset.book); return; }
    if (e.target.closest('[data-close]')) closeModal();
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeMenu(); } });

  /* ---------- формы ---------- */
  const LETTERS = /[^A-Za-zА-Яа-яЁёЎўҚқҒғҲҳʻʼ‘’'`\-\s]/g;
  const fmtPhone = (v) => {
    // префикс +998 уже в поле — убираем его, где бы ни стоял курсор
    let d = v.includes('+998') ? v.replace('+998', '').replace(/\D/g, '') : v.replace(/\D/g, '');
    if (d.length > 9 && d.startsWith('998')) d = d.slice(3);   // вставили номер целиком без «+»
    d = d.slice(0, 9);
    let out = '+998';
    if (d.length) out += ' (' + d.slice(0, 2);
    if (d.length >= 2) out += ')';
    if (d.length > 2) out += ' ' + d.slice(2, 5);
    if (d.length > 5) out += '-' + d.slice(5, 7);
    if (d.length > 7) out += '-' + d.slice(7, 9);
    return out;
  };

  // UTM-метки — храним 30 дней
  let utm = '';
  try {
    const q = new URLSearchParams(location.search);
    const fresh = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'yclid', 'fbclid']
      .filter((k) => q.get(k)).map((k) => `${k}=${q.get(k)}`).join('&');
    if (fresh) localStorage.setItem('li_utm', JSON.stringify({ v: fresh, t: Date.now() }));
    const saved = JSON.parse(localStorage.getItem('li_utm') || 'null');
    if (saved && Date.now() - saved.t < 30 * 864e5) utm = saved.v;
  } catch (e) {}

  /* отправка: send.php (CRM Oktell + Telegram + CSV). Если PHP недоступен
     (статический хостинг или файл открыт с диска) — напрямую в CRM. */
  const phoneCRM = (v) => { const d = v.replace(/\D/g, '').slice(-9); return `+998 (${d.slice(0, 2)}) ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`; };
  const sendDirect = async (form) => {
    const L = S.lead || {}; const F = (n) => form.elements[n].value;
    if (!L.endpoint) throw new Error('no endpoint');
    const u = new URLSearchParams(F('utm'));
    const res = await fetch(L.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fio: F('name').trim(), phone: phoneCRM(F('phone')), comment: F('type') === 'booking' ? 'Бронирование' : 'Заявка с сайта',
        marka: L.marka || 'li auto', model: F('model').replace(/^Li\s+/i, ''), website: L.website || location.hostname,
        city: L.city || '', language: (S.lang || 'ru').toUpperCase(),
        utm_source: u.get('utm_source') || '', utm_medium: u.get('utm_medium') || '', utm_campaign: u.get('utm_campaign') || '',
        utm_content: u.get('utm_content') || '', utm_term: u.get('utm_term') || '',
      }),
    });
    if (!res.ok) throw new Error('crm ' + res.status);
  };
  const sendLead = async (form) => {
    if ((S.lead || {}).mode === 'direct') return sendDirect(form);  // сайт без PHP
    // urlencoded, а не multipart: сервер принимает только такой формат (защита от PHP2Shell)
    const body = new URLSearchParams(new FormData(form));
    const res = await fetch(S.endpoint || 'send.php', { method: 'POST', body, credentials: 'same-origin' });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || res.status);
  };

  // ошибка отправки — сообщение под кнопкой вместо системного окна браузера
  const showErr = (form, err) => {
    let box = form.querySelector('.form__err');
    if (!box) { box = document.createElement('p'); box.className = 'form__err'; box.setAttribute('role', 'alert'); form.querySelector('[type=submit]').after(box); }
    const local = location.protocol === 'file:';
    box.textContent = local ? T.errLocal : T.err;
    box.hidden = false;
    console.error('[форма] заявка не отправлена:', err && err.message || err,
      local ? '— страница открыта с диска: send.php работает только на хостинге с PHP или в npm run dev'
            : '— проверьте, что send.php выполняется сервером (нужен PHP) и CRM отвечает (см. crm.log)');
  };

  $$('.js-form').forEach((form) => {
    const F = (n) => form.elements[n];
    const name = F('name'), phone = F('phone');
    let shownAt = performance.now();
    const fill = () => { F('utm').value = utm; F('page').value = location.href.split('#')[0]; F('ref').value = document.referrer; F('lang').value = S.lang; };
    form.addEventListener('focusin', () => { if (F('el').value === '0') shownAt = performance.now(); F('el').value = '1'; }, { once: true });
    fill();

    // имя: только буквы, пробел, дефис и апостроф
    name.addEventListener('input', () => {
      const v = name.value.replace(LETTERS, '').replace(/\s{2,}/g, ' ');
      if (v !== name.value) name.value = v;
      name.closest('.fld').classList.remove('has-err');
    });
    // телефон: только цифры в маске +998 (XX) XXX-XX-XX
    phone.addEventListener('keydown', (e) => {
      if (e.key.length === 1 && !/\d/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
    });
    const toEnd = () => { const n = phone.value.length; phone.setSelectionRange(n, n); };
    phone.addEventListener('focus', () => { if (!phone.value) phone.value = '+998 ('; setTimeout(toEnd, 0); });
    phone.addEventListener('click', () => { if (phone.value.replace(/\D/g, '').length <= 3) toEnd(); });
    phone.addEventListener('input', () => { phone.value = fmtPhone(phone.value); phone.closest('.fld').classList.remove('has-err'); });
    phone.addEventListener('blur', () => { if (phone.value.replace(/\D/g, '').length <= 3) phone.value = ''; });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let ok = true;
      const n = name.value.trim();
      if (n.length < 2 || LETTERS.test(n)) { name.closest('.fld').classList.add('has-err'); ok = false; }
      LETTERS.lastIndex = 0;
      if (phone.value.replace(/\D/g, '').length !== 12) { phone.closest('.fld').classList.add('has-err'); ok = false; }
      if (!F('consent').checked) ok = false;
      if (!ok) { form.querySelector('.has-err input')?.focus(); return; }

      F('el').value = String(Math.round(performance.now() - shownAt));   // сколько мс заполняли форму (боты — мгновенно)
      const btn = form.querySelector('[type=submit]'); const label = btn.textContent;
      btn.disabled = true; btn.textContent = T.sending;
      const errBox = form.querySelector('.form__err'); if (errBox) errBox.hidden = true;
      try {
        await sendLead(form);
        form.querySelector('.form__ok').hidden = false;
        track('lead_submit', { model: F('model').value, type: F('type').value });
        const model = F('model').value;
        form.reset(); fill(); F('model').value = model;
      } catch (err) {
        showErr(form, err);
      } finally {
        btn.disabled = false; btn.textContent = label;
      }
    });
  });

  // ссылки «#lead» без бронирования — подставить модель в нижнюю форму
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href="#lead"]:not([data-book])');
    const lf = $('#leadForm');
    if (!a || !lf) return;
    if (a.dataset.model) lf.elements.model.value = a.dataset.model;
    setTimeout(() => lf.elements.name.focus({ preventScroll: true }), 700);
  });

  /* ---------- галерея: кнопки, перетаскивание мышью, свайп ---------- */
  const gal = $('#gal');
  if (gal) {
    const items = () => $$('.gal__item', gal);
    const count = $('#galCount');
    const padL = () => parseFloat(getComputedStyle(gal).paddingLeft) || 0;
    const current = () => {
      let idx = 0, best = Infinity;
      items().forEach((it, i) => { const d = Math.abs(it.offsetLeft - padL() - gal.scrollLeft); if (d < best) { best = d; idx = i; } });
      return idx;
    };
    const go = (i) => {
      const list = items(); if (!list.length) return;
      i = Math.max(0, Math.min(list.length - 1, i));
      gal.scrollTo({ left: list[i].offsetLeft - padL(), behavior: 'smooth' });
    };
    const update = () => {
      const list = items(), i = current();
      if (count) count.textContent = list.length ? `${String(i + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}` : '';
      const max = gal.scrollWidth - gal.clientWidth - 2;
      $$('.gal__btn').forEach((b) => { b.disabled = b.dataset.dir === '-1' ? gal.scrollLeft <= 2 : gal.scrollLeft >= max; });
    };
    $$('.gal__btn').forEach((b) => b.addEventListener('click', () => go(current() + Number(b.dataset.dir))));
    gal.addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
    addEventListener('resize', update);
    setTimeout(update, 300);

    // перетаскивание мышью (на тач-устройствах работает родной свайп)
    let drag = null;
    gal.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, left: gal.scrollLeft, moved: false, start: current() };
      gal.classList.add('is-drag');
    });
    addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4) drag.moved = true;
      gal.scrollLeft = drag.left - dx;
    });
    addEventListener('pointerup', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, start = drag.start, moved = drag.moved;
      gal.classList.remove('is-drag');
      drag = null;
      if (moved) go(Math.abs(dx) > 60 ? start + (dx < 0 ? 1 : -1) : start);
    });
    // колесо мыши с Shift / тачпад — родной; стрелки клавиатуры
    gal.setAttribute('tabindex', '0');
    gal.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(current() + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(current() - 1); }
    });
  }

  /* ---------- карта (Яндекс, грузится при приближении к блоку) ---------- */
  const map = $('#map');
  const card = $('.dealer');
  if (map && card) {
    const mio = new IntersectionObserver((ents) => {
      if (ents[0].isIntersecting) {
        card.classList.add('is-active');
        map.innerHTML = `<iframe loading="lazy" title="map" src="${card.dataset.map}" allowfullscreen></iframe>`;
        mio.disconnect();
      }
    }, { rootMargin: '400px' });
    mio.observe(map);
  }
})();

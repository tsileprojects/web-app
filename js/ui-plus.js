/* TSPL UI-plus: sidebar search, pinned programs, dark mode, loading placeholder,
   help tooltips, and TV / Status buttons. Safe to include on any page that has the
   standard .app layout; does nothing on pages without it. */
(function () {
  'use strict';
  if (window.top !== window.self) return;                       // never inside an iframe
  var PAGE = (location.pathname.split('/').pop() || 'main_ho.html').replace('.html', '');
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  // CSS
  var css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = 'css/ui-plus.css';
  document.head.appendChild(css);

  // Dark mode applies before layout to avoid a flash
  if (store('tsplTheme') === 'dark') document.documentElement.classList.add('tspl-dark');

  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  function withI18n(fn) {
    if (window.TSPL_T) return fn();
    var sc = document.createElement('script'); sc.src = 'js/i18n.js';
    sc.onload = fn; sc.onerror = function () { window.TSPL_T = function (k) { return k; }; fn(); };
    document.head.appendChild(sc);
  }
  var T = function (k, v) { return window.TSPL_T ? window.TSPL_T(k, v) : k; };

  ready(function () {
    var app = document.querySelector('.app');
    if (!app) return;
    withI18n(function () {
      headerButtons();
      sidebar();
      deptColours();
      skeleton();
      activity();
    });
  });

  // ---------- Header: dark mode, TV, status, help tips ----------
  function headerButtons() {
    var bar = document.querySelector('.header-actions');
    if (!bar) return;
    var unit = (PAGE.match(/^unit_(ap2|fipl|ts2|ts4|ts9)$/) || [])[1];
    function btn(id, icon, tip, onClick) {
      var b = document.createElement('button');
      b.type = 'button'; b.id = id; b.className = 'icon-btn uip-btn';
      b.setAttribute('aria-label', tip.split('.')[0]); b.setAttribute('data-tip', tip);
      b.innerHTML = '<i class="las ' + icon + '" aria-hidden="true"></i>';
      b.addEventListener('click', onClick);
      return b;
    }
    var first = bar.firstElementChild;
    var dark = btn('btnTheme', document.documentElement.classList.contains('tspl-dark') ? 'la-sun' : 'la-moon', T('tipTheme'), function () {
        var on = document.documentElement.classList.toggle('tspl-dark');
        store('tsplTheme', on ? 'dark' : 'light');
        dark.querySelector('i').className = 'las ' + (on ? 'la-sun' : 'la-moon');
      });
    var q = unit ? '?unit=' + unit.toUpperCase() : '';
    function openIn(url) {   // same window: show the page in the dashboard frame
      var f = document.getElementById('mainFrame');
      if (f) { f.src = url; document.querySelectorAll('.menu-link.active').forEach(function (a) { a.classList.remove('active'); }); } else location.href = url;
    }
    var tv = btn('btnTv', 'la-tv', T('tipTv'), function () { openIn('tv.html' + q); });
    var st = btn('btnStatus', 'la-heartbeat', T('tipStatus'), function () { openIn('status.html'); });
    var rp = btn('btnReport', 'la-file-download', T('tipReport'), function () { openIn('report.html' + q); });
    var rq = btn('btnReq', 'la-check-circle', T('tipReq'), function () { openIn('requests.html'); });
    var langs = window.TSPL_I18N ? TSPL_I18N.langs : [['en', 'EN']];
    var cur = window.TSPL_I18N ? TSPL_I18N.lang() : 'en';
    var lg = btn('btnLang', 'la-language', T('tipLang'), function () {
      var i = langs.map(function (x) { return x[0]; }).indexOf(cur);
      TSPL_I18N.set(langs[(i + 1) % langs.length][0]);
    });
    lg.classList.add('uip-lang');
    lg.innerHTML = '<span>' + (langs.filter(function (x) { return x[0] === cur; })[0] || langs[0])[1] + '</span>';
    [rq, rp, st, tv, dark, lg].forEach(function (b) { bar.insertBefore(b, first); });

    // Help tips on the existing buttons
    var tips = { btnBell: T('tipBell'), btnAsk: T('tipAsk'), btnFullscreen: T('tipFull') };
    Object.keys(tips).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el.hasAttribute('data-tip')) { el.setAttribute('data-tip', tips[id]); el.removeAttribute('title'); }
    });
  }

  // ---------- Sidebar: search + pinned ----------
  function sidebar() {
    var nav = document.querySelector('aside.sidebar nav');
    if (!nav) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll('.menu-link'));
    function keyOf(a) { return a.getAttribute('data-embed') || a.getAttribute('href') || ''; }
    function label(a) { var s = a.querySelector('span'); return (s ? s.textContent : a.textContent).trim(); }

    // search box
    var box = document.createElement('div');
    box.className = 'uip-search';
    box.innerHTML = '<i class="las la-search" aria-hidden="true"></i><input type="search" placeholder="' + T('search') + '" aria-label="' + T('search') + '"><button type="button" aria-label="Clear search" hidden>&times;</button>';
    var empty = document.createElement('div'); empty.className = 'uip-empty uip-hide'; empty.textContent = T('noMatch');
    nav.parentNode.insertBefore(box, nav);
    nav.parentNode.insertBefore(empty, nav);
    var input = box.querySelector('input'), clear = box.querySelector('button');
    var openState = null;

    function filter() {
      var q = input.value.trim().toLowerCase();
      clear.hidden = !q;
      var menus = Array.prototype.slice.call(nav.querySelectorAll('details.menu'));
      if (q && !openState) openState = menus.map(function (m) { return m.open; });
      var hits = 0;
      links.forEach(function (a) {
        var hit = !q || label(a).toLowerCase().indexOf(q) > -1;
        a.classList.toggle('uip-hide', !hit);
        a.classList.toggle('uip-hit', !!q && hit);
        if (hit) hits++;
      });
      menus.forEach(function (m, i) {
        var any = !!m.querySelector('.menu-link:not(.uip-hide)');
        var headHit = q && m.querySelector('summary').textContent.toLowerCase().indexOf(q) > -1;
        if (headHit) m.querySelectorAll('.menu-link').forEach(function (a) { a.classList.remove('uip-hide'); });
        m.classList.toggle('uip-hide', !!q && !any && !headHit);
        if (q) m.open = any || headHit; else if (openState) m.open = openState[i];
      });
      nav.querySelectorAll('.single').forEach(function (s) { s.classList.toggle('uip-hide', !!q && !s.querySelector('.menu-link:not(.uip-hide)')); });
      if (!q) openState = null;
      empty.classList.toggle('uip-hide', !q || hits > 0);
    }
    input.addEventListener('input', filter);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; filter(); }
      if (e.key === 'Enter') { var f = links.filter(function (a) { return !a.classList.contains('uip-hide'); })[0]; if (f) f.click(); }
    });
    clear.addEventListener('click', function () { input.value = ''; filter(); input.focus(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !/input|textarea/i.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); input.focus(); }
    });

    // pinned
    var PK = 'tsplPins_' + PAGE;
    var pins = []; try { pins = JSON.parse(store(PK) || '[]') || []; } catch (e) { pins = []; }
    var group = document.createElement('div'); group.className = 'uip-pinned';
    nav.insertBefore(group, nav.firstChild);

    function save() { store(PK, JSON.stringify(pins)); }
    function render() {
      group.innerHTML = '';
      var valid = pins.filter(function (k) { return links.some(function (a) { return keyOf(a) === k; }); });
      group.classList.toggle('uip-hide', !valid.length);
      if (!valid.length) return;
      group.innerHTML = '<div class="uip-pinned-head"><i class="las la-star"></i>' + T('pinned') + '</div>';
      valid.forEach(function (k) {
        var src = links.filter(function (a) { return keyOf(a) === k; })[0];
        var a = document.createElement('a');
        a.className = 'menu-link'; a.href = '#';
        a.innerHTML = (src.querySelector('i') ? src.querySelector('i').outerHTML : '') + '<span>' + label(src).replace(/[<&]/g, function (c) { return c === '<' ? '&lt;' : '&amp;'; }) + '</span>';
        a.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); src.click(); });
        a.appendChild(star(k));
        group.appendChild(a);
      });
      links.forEach(function (a) { var s = a.querySelector('.uip-star'); if (s) s.classList.toggle('on', pins.indexOf(keyOf(a)) > -1); });
    }
    function star(k) {
      var s = document.createElement('button');
      s.type = 'button'; s.className = 'uip-star' + (pins.indexOf(k) > -1 ? ' on' : '');
      s.setAttribute('aria-label', 'Pin to top'); s.title = 'Pin / unpin';
      s.textContent = '\u2605';
      s.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var i = pins.indexOf(k);
        if (i > -1) pins.splice(i, 1); else pins.push(k);
        save(); render();
      });
      return s;
    }
    links.forEach(function (a) {
      var k = keyOf(a);
      if (!k || k === '#') return;
      a.appendChild(star(k));
    });
    render();
  }

  // ---------- Department colour code ----------
  var DEPT = [
    [/fsa|final audit|quality|dqr|qty|cft/i, '#8b5cf6', 'Quality / FSA'],
    [/needle|cmd/i, '#f97316', 'Needles / CMD'],
    [/mc_plan|machine|mc plan/i, '#0d9488', 'Machines'],
    [/dpr|cot|pro and eff|production|eff/i, '#16a34a', 'Production / Efficiency'],
    [/kpi|mmr|gm/i, '#2563eb', 'Management KPI'],
    [/gsd|sam|ie\b/i, '#4f46e5', 'GSD / IE'],
    [/fc|finance|psc|cost/i, '#ca8a04', 'Finance / Costing'],
    [/emb|smp|sample|ppd|cut/i, '#db2777', 'Sampling / EMB / Cutting'],
    [/doc|format|ref|library|process/i, '#64748b', 'Documents']
  ];
  function deptOf(text) { for (var i = 0; i < DEPT.length; i++) if (DEPT[i][0].test(text)) return DEPT[i]; return null; }
  function deptColours() {
    var nav = document.querySelector('aside.sidebar nav');
    if (!nav) return;
    nav.querySelectorAll('details.menu').forEach(function (m) {
      var head = m.querySelector('summary');
      var d = deptOf(head ? head.textContent : '');
      if (!d) { var votes = {}; m.querySelectorAll('.menu-link').forEach(function (a) { var x = deptOf(a.textContent); if (x) votes[x[1]] = (votes[x[1]] || 0) + 1; });
        var best = Object.keys(votes).sort(function (a, b) { return votes[b] - votes[a]; })[0]; if (best) d = DEPT.filter(function (x) { return x[1] === best; })[0]; }
      if (d) { m.style.setProperty('--dept', d[1]); m.classList.add('uip-dept'); m.setAttribute('data-dept', d[2]); }
    });
    nav.querySelectorAll('.menu-link').forEach(function (a) {
      var d = deptOf(a.textContent);
      if (d) { a.style.setProperty('--dept', d[1]); a.classList.add('uip-dept-link'); }
    });
  }

  // ---------- Activity log: page opens and program opens ----------
  function activity() {
    function who() { try { var u = JSON.parse(localStorage.getItem('tsplUser') || 'null'); return u ? u.email : ''; } catch (e) { return ''; } }
    function login() { try { return JSON.parse(sessionStorage.getItem('userLoggedIn') || '{}').username || ''; } catch (e) { return ''; } }
    function send(detail) {
      var go = function () {
        if (!window.TSPL_MONITOR_URL) return;
        var n = '__hit' + Date.now() + Math.floor(Math.random() * 1000), s = document.createElement('script');
        window[n] = function () { window[n] = function () {}; s.remove(); };
        s.src = window.TSPL_MONITOR_URL + '?action=hit&page=' + encodeURIComponent(PAGE) + '&login=' + encodeURIComponent(login()) + '&who=' + encodeURIComponent(who()) + '&detail=' + encodeURIComponent(detail) + '&callback=' + n;
        s.onerror = function () { window[n] = function () {}; };
        document.body.appendChild(s);
      };
      if (window.TSPL_MONITOR_URL) go();
      else { var c = document.createElement('script'); c.src = 'js/tspl-config.js'; c.onload = go; document.head.appendChild(c); }
    }
    send('page');
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('aside.sidebar .menu-link');
      if (!a || (e.target.closest('.uip-star'))) return;
      var sp = a.querySelector('span'); send('program: ' + (sp ? sp.textContent : a.textContent).trim().slice(0, 80));
    }, true);
  }

  // ---------- Loading placeholder ----------
  function skeleton() {
    var wrap = document.getElementById('iframeWrap'), frame = document.getElementById('mainFrame');
    if (!wrap || !frame) return;
    var sk = document.createElement('div');
    sk.className = 'uip-skel'; sk.setAttribute('aria-hidden', 'true');
    sk.innerHTML = '<div class="row"><i></i><i></i><i></i><i></i></div><div class="row two"><i></i><i></i></div><div class="row two"><i></i><i></i></div><div class="msg">' + T('loadingDash') + '</div>';
    wrap.appendChild(sk);
    var timer = null;
    function on() { sk.classList.add('on'); clearTimeout(timer); timer = setTimeout(off, 15000); }
    function off() { sk.classList.remove('on'); clearTimeout(timer); }
    frame.addEventListener('load', function () { setTimeout(off, 250); });
    new MutationObserver(function (m) { if (m.some(function (x) { return x.attributeName === 'src'; })) on(); }).observe(frame, { attributes: true });
  }
})();

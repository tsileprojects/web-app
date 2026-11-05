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

  ready(function () {
    var app = document.querySelector('.app');
    if (!app) return;
    headerButtons();
    sidebar();
    skeleton();
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
    var dark = btn('btnTheme', document.documentElement.classList.contains('tspl-dark') ? 'la-sun' : 'la-moon',
      'Dark / light mode. Easier on the eyes at night; your choice is remembered on this computer.', function () {
        var on = document.documentElement.classList.toggle('tspl-dark');
        store('tsplTheme', on ? 'dark' : 'light');
        dark.querySelector('i').className = 'las ' + (on ? 'la-sun' : 'la-moon');
      });
    var tv = btn('btnTv', 'la-tv', 'TV display. Opens a full-screen live board (output, efficiency, quality) for the floor or meeting-room TV.', function () {
      window.open('tv.html' + (unit ? '?unit=' + unit.toUpperCase() : ''), '_blank', 'noopener');
    });
    var st = btn('btnStatus', 'la-heartbeat', 'Program status. Shows which programs are up, down or restricted, from the error monitor.', function () {
      window.open('status.html', '_blank', 'noopener');
    });
    [st, tv, dark].forEach(function (b) { bar.insertBefore(b, first); });

    // Help tips on the existing buttons
    var tips = {
      btnBell: 'Notifications. Program errors found by the monitor; open to fix, ignore or re-check them.',
      btnAsk: 'Ask TSPL. Ask a question in plain words about production, efficiency, quality, FSA, needles and more.',
      btnFullscreen: 'Full screen. Hides the browser bars; press Esc to come back.',
      btnSidebar: 'Show / hide the menu.'
    };
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
    box.innerHTML = '<i class="las la-search" aria-hidden="true"></i><input type="search" placeholder="Search programs…" aria-label="Search programs"><button type="button" aria-label="Clear search" hidden>&times;</button>';
    var empty = document.createElement('div'); empty.className = 'uip-empty uip-hide'; empty.textContent = 'No program matches.';
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
      group.innerHTML = '<div class="uip-pinned-head"><i class="las la-star"></i>Pinned</div>';
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

  // ---------- Loading placeholder ----------
  function skeleton() {
    var wrap = document.getElementById('iframeWrap'), frame = document.getElementById('mainFrame');
    if (!wrap || !frame) return;
    var sk = document.createElement('div');
    sk.className = 'uip-skel'; sk.setAttribute('aria-hidden', 'true');
    sk.innerHTML = '<div class="row"><i></i><i></i><i></i><i></i></div><div class="row two"><i></i><i></i></div><div class="row two"><i></i><i></i></div><div class="msg">Loading dashboard…</div>';
    wrap.appendChild(sk);
    var timer = null;
    function on() { sk.classList.add('on'); clearTimeout(timer); timer = setTimeout(off, 15000); }
    function off() { sk.classList.remove('on'); clearTimeout(timer); }
    frame.addEventListener('load', function () { setTimeout(off, 250); });
    new MutationObserver(function (m) { if (m.some(function (x) { return x.attributeName === 'src'; })) on(); }).observe(frame, { attributes: true });
  }
})();

/* TSPL Help button: on every portal page and tab.
 * Anyone can describe a problem, attach screenshots (browse, drag & drop or paste) and send it.
 * The report goes straight to the HO bell (TSPL Error Monitor, source "Help desk"), which
 * runs automatic checks / safe fixes and answers with a ticket number. */
(function () {
  // Merchant logins may only open the merchant portal and the FSA dashboard
  try { var _mu = JSON.parse(sessionStorage.getItem('userLoggedIn') || 'null'), _pg = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    if (_mu && _mu.redirect === 'merchant.html' && ['merchant.html', 'fsa.html', 'index.html', ''].indexOf(_pg) < 0) { location.replace('merchant.html'); return; } } catch (e) {}
  'use strict';
  // one button per screen: pages shown inside a portal frame use the portal's button
  try { if (window.top !== window && (window.top.TSPLHelp || window.top.document.getElementById('mainFrame') || window.top.document.getElementById('vFrame'))) return; } catch (e) {}
  if (window.TSPLHelp) return;

  var MAX_PHOTOS = 3, TYPES = ['Error message', 'Data not showing', 'Wrong figures', 'Slow / not loading', 'Login / access', 'Question'];
  var photos = [], busy = false;

  function url() { return window.TSPL_MONITOR_URL || 'https://script.google.com/macros/s/AKfycbz4dLAQFFJ1yxrHJZrQRtzThsVHRuVcJz3ZrYb3SBMTXIVq6NonUXgDWqnVzE-9b9k0/exec'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function login() { try { return (JSON.parse(sessionStorage.getItem('userLoggedIn') || 'null') || {}).username || ''; } catch (e) { return ''; } }
  function pageName() { return (document.title || location.pathname.split('/').pop() || 'TSPL portal').replace(/\s+/g, ' ').trim(); }
  // which program is on screen right now (portal frame, CEO viewer, or this page)
  function current() {
    var a = document.querySelector('.menu-link.active span') || document.querySelector('.menu-link.active');
    var f = document.getElementById('mainFrame');
    var v = document.getElementById('viewer');
    if (v && v.classList.contains('on')) return { name: (document.getElementById('vTitle') || {}).textContent || 'Program', url: (document.getElementById('vFrame') || {}).src || '' };
    if (f) {
      var src = f.getAttribute('src') || '';
      try { src = new URL(src, location.href).href; } catch (e) {}
      return { name: a ? a.textContent.replace(/\s+/g, ' ').trim() : (/home\.html/.test(src) ? 'Dashboard home' : 'Program'), url: src };
    }
    return { name: pageName(), url: location.href };
  }

  var css = '' +
    '#tsplHelpBtn{position:fixed;right:20px;bottom:20px;z-index:2147483000;height:48px;padding:0 18px 0 14px;border-radius:999px;border:0;background:#0B2545;color:#fff;font:600 14px/1 Inter,"Segoe UI",Roboto,Arial,sans-serif;display:flex;align-items:center;gap:8px;box-shadow:0 8px 24px rgba(11,37,69,.28);cursor:pointer;transition:transform .15s,box-shadow .15s}' +
    '#tsplHelpBtn:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(11,37,69,.34)}#tsplHelpBtn:focus-visible{outline:3px solid #C8962E;outline-offset:2px}' +
    '#tsplHelpBtn svg{width:20px;height:20px}' +
    '.tsh-ov{position:fixed;inset:0;z-index:2147483001;background:rgba(15,23,42,.45);display:none;justify-content:flex-end}' +
    '.tsh-ov.on{display:flex}' +
    '.tsh{width:460px;max-width:100%;height:100%;background:#fff;color:#0F172A;display:flex;flex-direction:column;font:14px/1.45 Inter,"Segoe UI",Roboto,Arial,sans-serif;box-shadow:-12px 0 40px rgba(15,23,42,.25);animation:tshIn .2s ease-out}' +
    '@keyframes tshIn{from{transform:translateX(40px);opacity:.4}to{transform:none;opacity:1}}' +
    '.tsh-hd{background:#0B2545;color:#fff;padding:20px 22px;display:flex;justify-content:space-between;gap:12px;align-items:flex-start}' +
    '.tsh-hd h2{margin:0;font-size:19px;font-weight:700}.tsh-hd p{margin:4px 0 0;font-size:13px;color:#CBD5E1}' +
    '.tsh-x{width:40px;height:40px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;font-size:20px;cursor:pointer;flex:none}' +
    '.tsh-bd{flex:1;overflow:auto;padding:20px 22px;display:flex;flex-direction:column;gap:16px}' +
    '.tsh label,.tsh .lb{font-size:13px;font-weight:600;color:#334155;display:block;margin-bottom:6px}' +
    '.tsh input[type=text],.tsh textarea{width:100%;box-sizing:border-box;border:1px solid #CBD5E1;border-radius:10px;padding:11px 12px;font:inherit;color:#0F172A;background:#fff;-webkit-user-select:text;user-select:text}' +
    '.tsh textarea{min-height:120px;resize:vertical}.tsh input:focus,.tsh textarea:focus{outline:none;border-color:#1D4ED8;box-shadow:0 0 0 3px rgba(29,78,216,.15)}' +
    '.tsh-prog{display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid #E2E8F0;background:#F8FAFC;border-radius:10px;font-size:13px}' +
    '.tsh-prog b{display:block;font-size:14px;color:#0F172A}.tsh-prog span{color:#64748B;word-break:break-all}' +
    '.tsh-chips{display:flex;flex-wrap:wrap;gap:8px}' +
    '.tsh-chip{min-height:36px;padding:0 12px;border-radius:999px;border:1px solid #CBD5E1;background:#fff;color:#334155;font:inherit;font-size:13px;font-weight:600;cursor:pointer}' +
    '.tsh-chip.on{background:#0B2545;border-color:#0B2545;color:#fff}' +
    '.tsh-drop{border:2px dashed #CBD5E1;border-radius:12px;padding:16px;text-align:center;color:#475569;font-size:13px;cursor:pointer;background:#F8FAFC}' +
    '.tsh-drop.hov{border-color:#1D4ED8;background:#EFF6FF}.tsh-drop b{color:#1D4ED8}' +
    '.tsh-th{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}' +
    '.tsh-th div{position:relative;border-radius:8px;overflow:hidden;border:1px solid #E2E8F0;aspect-ratio:4/3;background:#F1F5F9}' +
    '.tsh-th img{width:100%;height:100%;object-fit:cover;display:block}' +
    '.tsh-th button{position:absolute;top:4px;right:4px;width:28px;height:28px;border-radius:50%;border:0;background:rgba(15,23,42,.75);color:#fff;cursor:pointer;font-size:15px;line-height:28px}' +
    '.tsh-ft{padding:16px 22px;border-top:1px solid #E2E8F0;display:flex;flex-direction:column;gap:8px}' +
    '.tsh-send{height:48px;border:0;border-radius:10px;background:#0B2545;color:#fff;font:inherit;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}' +
    '.tsh-send[disabled]{opacity:.6;cursor:default}.tsh-err{color:#B91C1C;font-size:13px;min-height:18px}' +
    '.tsh-small{font-size:12px;color:#64748B}' +
    '.tsh-ok{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:24px 8px}' +
    '.tsh-ok .ic{width:64px;height:64px;border-radius:50%;background:#DCFCE7;color:#15803D;display:flex;align-items:center;justify-content:center}' +
    '.tsh-ok h3{margin:4px 0 0;font-size:19px}.tsh-tk{font:700 15px/1 ui-monospace,Consolas,monospace;background:#F1F5F9;padding:8px 12px;border-radius:8px;color:#0B2545}' +
    '.tsh-steps{width:100%;text-align:left;border:1px solid #E2E8F0;border-radius:10px;padding:12px 14px;background:#F8FAFC;font-size:13px}' +
    '.tsh-steps div{display:flex;gap:8px;padding:4px 0}.tsh-steps i{flex:none;width:8px;height:8px;border-radius:50%;margin-top:6px;background:#1D4ED8}' +
    '.tsh-spin{width:18px;height:18px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:tshS 1s linear infinite}@keyframes tshS{to{transform:rotate(360deg)}}' +
    '@media (max-width:520px){#tsplHelpBtn span{display:none}#tsplHelpBtn{padding:0;width:52px;justify-content:center}}' +
    '@media print{#tsplHelpBtn,.tsh-ov{display:none!important}}';

  function build() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var btn = document.createElement('button');
    btn.id = 'tsplHelpBtn'; btn.type = 'button'; btn.setAttribute('aria-label', 'Help – report an issue'); btn.title = 'Help – report an issue';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"></path><path d="M12 17h.01"></path></svg><span>Help</span>';
    document.body.appendChild(btn);

    var ov = document.createElement('div'); ov.className = 'tsh-ov'; ov.id = 'tsplHelp';
    ov.innerHTML =
      '<section class="tsh" role="dialog" aria-modal="true" aria-labelledby="tshTitle">' +
      '<div class="tsh-hd"><div><h2 id="tshTitle">Need help?</h2><p>Tell HO what went wrong. It reaches the HO team at once and is checked automatically.</p></div>' +
      '<button type="button" class="tsh-x" data-x aria-label="Close">&times;</button></div>' +
      '<div class="tsh-bd" id="tshBody"></div>' +
      '<div class="tsh-ft" id="tshFoot"></div></section>';
    document.body.appendChild(ov);

    btn.addEventListener('click', open);
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('[data-x]')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.classList.contains('on')) close(); });
    document.addEventListener('paste', function (e) {
      if (!ov.classList.contains('on') || !e.clipboardData) return;
      var files = [].slice.call(e.clipboardData.items || []).filter(function (i) { return i.kind === 'file' && /^image\//.test(i.type); }).map(function (i) { return i.getAsFile(); });
      if (files.length) { e.preventDefault(); addFiles(files); }
    });
  }

  function form() {
    var c = current(), saved = '';
    try { saved = localStorage.getItem('tsplHelpName') || ''; } catch (e) {}
    photos = [];
    document.getElementById('tshBody').innerHTML =
      '<div><span class="lb">Program</span><div class="tsh-prog"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0B2545" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"></rect><path d="M8 21h8"></path></svg>' +
        '<div><b id="tshProg">' + esc(c.name) + '</b><span>' + esc(pageName()) + '</span></div></div></div>' +
      '<div><label for="tshName">Your name</label><input id="tshName" type="text" maxlength="80" autocomplete="name" placeholder="e.g. Ramesh, FIPL QA" value="' + esc(saved) + '"></div>' +
      '<div><span class="lb" id="tshTypeL">What kind of issue?</span><div class="tsh-chips" role="group" aria-labelledby="tshTypeL">' +
        TYPES.map(function (t) { return '<button type="button" class="tsh-chip" data-t="' + esc(t) + '" aria-pressed="false">' + esc(t) + '</button>'; }).join('') + '</div></div>' +
      '<div><label for="tshMsg">Describe the issue</label><textarea id="tshMsg" maxlength="2000" placeholder="What were you doing, and what happened? Copy any error message here."></textarea></div>' +
      '<div><span class="lb">Screenshots <span class="tsh-small">(optional, up to ' + MAX_PHOTOS + ')</span></span>' +
        '<div class="tsh-drop" id="tshDrop" tabindex="0" role="button" aria-label="Add screenshots">Drop images here, press <b>Ctrl + V</b> to paste, or <b>browse</b></div>' +
        '<input type="file" id="tshFile" accept="image/*" multiple hidden><div class="tsh-th" id="tshTh"></div></div>';
    document.getElementById('tshFoot').innerHTML =
      '<div class="tsh-err" id="tshErr" role="alert"></div>' +
      '<button type="button" class="tsh-send" id="tshSend"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 2 11 13"></path><path d="M22 2 15 22l-4-9-9-4z"></path></svg>Send to HO</button>' +
      '<span class="tsh-small">Your name, this page and your screenshots are sent to the HO team only.</span>';

    var body = document.getElementById('tshBody');
    body.querySelector('.tsh-chips').addEventListener('click', function (e) {
      var b = e.target.closest('.tsh-chip'); if (!b) return;
      [].forEach.call(body.querySelectorAll('.tsh-chip'), function (x) { x.classList.toggle('on', x === b && !b.classList.contains('on')); x.setAttribute('aria-pressed', x.classList.contains('on')); });
    });
    var drop = document.getElementById('tshDrop'), file = document.getElementById('tshFile');
    drop.addEventListener('click', function () { file.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    file.addEventListener('change', function () { addFiles([].slice.call(file.files || [])); file.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('hov'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('hov'); }); });
    drop.addEventListener('drop', function (e) { addFiles([].slice.call((e.dataTransfer && e.dataTransfer.files) || [])); });
    document.getElementById('tshTh').addEventListener('click', function (e) {
      var b = e.target.closest('[data-rm]'); if (!b) return; photos.splice(+b.getAttribute('data-rm'), 1); thumbs();
    });
    document.getElementById('tshSend').addEventListener('click', send);
  }

  function shrink(f, cb) {
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var m = 1600, w = img.width, h = img.height, k = Math.min(1, m / Math.max(w, h));
        var cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
        var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
        var q = 0.82, d = cv.toDataURL('image/jpeg', q);
        while (d.length > 1400000 && q > 0.4) { q -= 0.12; d = cv.toDataURL('image/jpeg', q); }
        cb(d);
      };
      img.onerror = function () { cb(null); };
      img.src = rd.result;
    };
    rd.onerror = function () { cb(null); };
    rd.readAsDataURL(f);
  }
  function addFiles(files) {
    files = files.filter(function (f) { return f && /^image\//.test(f.type); });
    var err = document.getElementById('tshErr');
    if (photos.length + files.length > MAX_PHOTOS) err.textContent = 'Only ' + MAX_PHOTOS + ' screenshots can be attached.';
    files.slice(0, MAX_PHOTOS - photos.length).forEach(function (f) {
      shrink(f, function (d) { if (d && photos.length < MAX_PHOTOS) { photos.push(d); thumbs(); } });
    });
  }
  function thumbs() {
    document.getElementById('tshTh').innerHTML = photos.map(function (d, i) {
      return '<div><img src="' + d + '" alt="Screenshot ' + (i + 1) + '"><button type="button" data-rm="' + i + '" aria-label="Remove screenshot ' + (i + 1) + '">&times;</button></div>';
    }).join('');
  }

  function send() {
    if (busy) return;
    var err = document.getElementById('tshErr'), name = document.getElementById('tshName').value.trim(), msg = document.getElementById('tshMsg').value.trim();
    var t = document.querySelector('.tsh-chip.on'), c = current();
    if (!name) { err.textContent = 'Please enter your name.'; document.getElementById('tshName').focus(); return; }
    if (!msg && !photos.length) { err.textContent = 'Please describe the issue or attach a screenshot.'; document.getElementById('tshMsg').focus(); return; }
    err.textContent = '';
    try { localStorage.setItem('tsplHelpName', name); } catch (e) {}
    busy = true;
    var b = document.getElementById('tshSend'); b.disabled = true; b.innerHTML = '<span class="tsh-spin"></span>Sending and checking…';
    var payload = { action: 'help', name: name, login: login(), page: pageName(), pageUrl: location.href, program: c.name, programUrl: c.url,
      type: t ? t.getAttribute('data-t') : '', message: msg, photos: photos,
      env: navigator.userAgent.replace(/\s+/g, ' ').slice(0, 250) + ' | ' + screen.width + 'x' + screen.height + ' | ' + new Date().toString().slice(0, 33) };
    var done = function (r) {
      busy = false;
      if (r && r.ok) { success(r); return; }
      b.disabled = false; b.innerHTML = 'Send to HO';
      err.textContent = (r && r.error) ? r.error : 'Could not send. Please check the internet and try again.';
    };
    fetch(url(), { method: 'POST', body: JSON.stringify(payload) })
      .then(function (res) { return res.json(); })
      .then(done)
      .catch(function () {
        // the report may still have arrived (browser could not read the reply)
        fetch(url(), { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) }).then(function () { done({ ok: true, ticket: '', steps: ['Sent to HO for review'] }); }).catch(function () { done(null); });
      });
  }

  function success(r) {
    document.getElementById('tshBody').innerHTML =
      '<div class="tsh-ok"><div class="ic"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg></div>' +
      '<h3>' + (r.fixed ? 'Fixed automatically' : 'Sent to HO') + '</h3>' +
      (r.ticket ? '<div>Ticket <span class="tsh-tk">' + esc(r.ticket) + '</span></div>' : '') +
      '<div class="tsh-small">' + (r.fixed ? 'Please try again now. HO can still see this report.' : 'The HO team has been alerted on the dashboard bell. Keep the ticket number if you call HO.') + '</div>' +
      (r.steps && r.steps.length ? '<div class="tsh-steps"><b style="display:block;margin-bottom:4px">Automatic check</b>' + r.steps.map(function (s) { return '<div><i></i><span>' + esc(s) + '</span></div>'; }).join('') + '</div>' : '') +
      '</div>';
    document.getElementById('tshFoot').innerHTML = '<button type="button" class="tsh-send" id="tshAgain">Report another issue</button><button type="button" class="tsh-chip" data-x style="height:44px">Close</button>';
    document.getElementById('tshAgain').addEventListener('click', form);
    // refresh the HO bell straight away if it is on this screen
    try { if (window.TSPLNotifyPoll) window.TSPLNotifyPoll(); } catch (e) {}
  }

  function open() { form(); document.getElementById('tsplHelp').classList.add('on'); setTimeout(function () { var n = document.getElementById('tshName'); (n.value ? document.getElementById('tshMsg') : n).focus(); }, 50); }
  function close() { document.getElementById('tsplHelp').classList.remove('on'); document.getElementById('tsplHelpBtn').focus(); }

  window.TSPLHelp = { open: open };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();

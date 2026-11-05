/* TSPL app helpers: email-code sign-in, monitor calls, offline queue.
   Needs js/tspl-config.js (TSPL_MONITOR_URL). Optional js/i18n.js. */
(function () {
  'use strict';
  var KEY_T = 'tsplToken', KEY_U = 'tsplUser';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function login() { try { return (JSON.parse(sessionStorage.getItem('userLoggedIn') || '{}').username) || ''; } catch (e) { return ''; } }
  var PAGE = (location.pathname.split('/').pop() || '').replace('.html', '');

  function jsonp(params, cb, ms) {
    var name = '__tx' + Date.now() + Math.floor(Math.random() * 1e4), s = document.createElement('script'), done = false;
    window[name] = function (r) { if (done) return; done = true; window[name] = function () {}; cb(r); };
    var q = Object.keys(params).filter(function (k) { return params[k] != null; }).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    s.src = window.TSPL_MONITOR_URL + '?' + q + '&callback=' + name + '&_=' + Date.now();
    s.onerror = function () { if (!done) { done = true; window[name] = function () {}; cb(null); } };
    setTimeout(function () { if (!done) { done = true; window[name] = function () {}; cb(null); } }, ms || 60000);
    (document.body || document.head).appendChild(s);
  }

  var A = {
    esc: esc, jsonp: jsonp, login: login,
    token: function () { return ls(KEY_T); },
    user: function () { try { return JSON.parse(ls(KEY_U) || 'null'); } catch (e) { return null; } },
    /** call the monitor with the sign-in key; cb(result or null when offline) */
    call: function (params, cb, ms) {
      params = Object.assign({}, params, { token: A.token(), login: login(), page: params.page || PAGE });
      jsonp(params, function (r) {
        if (r && r.error === 'signin') { ls(KEY_T, null); ls(KEY_U, null); A.signIn(function () { A.call(params, cb, ms); }); return; }
        cb(r);
      }, ms);
    },
    signOut: function () { var t = A.token(); ls(KEY_T, null); ls(KEY_U, null); if (t) jsonp({ action: 'signout', token: t }, function () {}); },
    /** shows the sign-in box; done(user) after success */
    signIn: function (done) {
      var T = window.TSPL_T || function (k) { return k; };
      var old = document.getElementById('txSign'); if (old) old.remove();
      var d = document.createElement('div'); d.id = 'txSign';
      d.innerHTML = '<style>#txSign{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:system-ui,Arial,sans-serif}' +
        '#txSign .bx{background:#fff;color:#0f172a;border-radius:14px;padding:22px 22px 18px;width:min(380px,92vw);box-shadow:0 10px 40px rgba(0,0,0,.3)}#txSign h3{margin:0 0 4px;font-size:18px}' +
        '#txSign p{margin:0 0 14px;font-size:13px;color:#5b6577}#txSign input{width:100%;box-sizing:border-box;height:42px;border:1px solid #cbd5e1;border-radius:8px;padding:0 12px;font-size:16px;margin-bottom:10px}' +
        '#txSign .row{display:flex;gap:8px}#txSign button{flex:1;height:40px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;font-size:14px;cursor:pointer}#txSign button.p{background:#2196f3;color:#fff;border-color:#2196f3}' +
        '#txSign .err{color:#b91c1c;font-size:13px;min-height:18px;margin-bottom:6px}#txSign .ok{color:#15803d}</style>' +
        '<div class="bx" role="dialog" aria-modal="true" aria-label="Sign in"><h3>Sign in</h3><p>Use your company email. We will email you a 6-digit code.</p>' +
        '<div id="txS1"><input id="txEmail" type="email" autocomplete="email" placeholder="name@texportsyndicate.com"><div class="err" id="txErr1"></div>' +
        '<div class="row"><button type="button" id="txCancel">Cancel</button><button type="button" class="p" id="txSend">Send code</button></div></div>' +
        '<div id="txS2" hidden><input id="txCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="6-digit code"><div class="err" id="txErr2"></div>' +
        '<div class="row"><button type="button" id="txBack">Back</button><button type="button" class="p" id="txVerify">Sign in</button></div></div></div>';
      document.body.appendChild(d);
      var em = d.querySelector('#txEmail'); em.value = ls('tsplLastEmail') || ''; em.focus();
      function busy(b, on, txt) { b.disabled = on; if (txt) b.textContent = txt; }
      d.querySelector('#txCancel').onclick = function () { d.remove(); };
      d.querySelector('#txBack').onclick = function () { d.querySelector('#txS2').hidden = true; d.querySelector('#txS1').hidden = false; };
      function send() {
        var e1 = d.querySelector('#txErr1'), b = d.querySelector('#txSend');
        var email = em.value.trim(); if (!/@/.test(email)) { e1.textContent = 'Enter your email'; return; }
        busy(b, true, 'Sending…'); e1.textContent = '';
        jsonp({ action: 'auth_start', email: email, login: login(), page: PAGE }, function (r) {
          busy(b, false, 'Send code');
          if (!r) { e1.textContent = 'No connection. Please try again.'; return; }
          if (!r.ok) { e1.textContent = r.error; return; }
          ls('tsplLastEmail', email);
          d.querySelector('#txS1').hidden = true; d.querySelector('#txS2').hidden = false;
          var e2 = d.querySelector('#txErr2'); e2.className = 'err ok'; e2.textContent = 'Code sent to ' + email + '. Check your inbox (and spam).';
          d.querySelector('#txCode').focus();
        });
      }
      function verify() {
        var e2 = d.querySelector('#txErr2'), b = d.querySelector('#txVerify');
        busy(b, true, 'Checking…'); e2.className = 'err'; e2.textContent = '';
        jsonp({ action: 'auth_verify', email: em.value.trim(), code: d.querySelector('#txCode').value, login: login(), page: PAGE }, function (r) {
          busy(b, false, 'Sign in');
          if (!r) { e2.textContent = 'No connection. Please try again.'; return; }
          if (!r.ok) { e2.textContent = r.error; return; }
          ls(KEY_T, r.token); ls(KEY_U, JSON.stringify(r.user)); d.remove();
          if (done) done(r.user);
        });
      }
      d.querySelector('#txSend').onclick = send; em.onkeydown = function (e) { if (e.key === 'Enter') send(); };
      d.querySelector('#txVerify').onclick = verify; d.querySelector('#txCode').onkeydown = function (e) { if (e.key === 'Enter') verify(); };
    },
    /** run fn(user) once signed in */
    need: function (fn) { var u = A.user(); if (u && A.token()) fn(u); else A.signIn(fn); },
    uid: function () { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  };

  // ---------- offline queue (IndexedDB, survives logout) ----------
  var DB = null;
  function db(cb) {
    if (DB) return cb(DB);
    if (!window.indexedDB) return cb(null);
    var rq = indexedDB.open('tsplQueue', 1);
    rq.onupgradeneeded = function () { rq.result.createObjectStore('q', { keyPath: 'cid' }); };
    rq.onsuccess = function () { DB = rq.result; cb(DB); };
    rq.onerror = function () { cb(null); };
  }
  function store(mode, fn, done) { db(function (d) { if (!d) return done && done(null); var tx = d.transaction('q', mode); var r = fn(tx.objectStore('q')); tx.oncomplete = function () { done && done(r && r.result); }; tx.onerror = function () { done && done(null); }; }); }
  var Q = {
    /** add an entry; it is sent now if online, otherwise later */
    add: function (params, label, cb) {
      var item = { cid: A.uid(), params: Object.assign({}, params), label: label || params.action, created: new Date().toISOString() };
      item.params.cid = item.cid; item.params.devTime = new Date().toLocaleString('en-IN');
      store('readwrite', function (s) { return s.put(item); }, function () { Q.flush(); cb && cb(item); });
    },
    list: function (cb) { store('readonly', function (s) { return s.getAll(); }, function (r) { cb(r || []); }); },
    remove: function (cid, cb) { store('readwrite', function (s) { return s.delete(cid); }, cb); },
    busy: false,
    /** try to send everything waiting */
    flush: function (cb) {
      if (Q.busy) return cb && cb();
      if (navigator.onLine === false) { Q.changed(); return cb && cb(); }
      Q.busy = true;
      Q.list(function (items) {
        var i = 0;
        (function next() {
          if (i >= items.length) { Q.busy = false; Q.changed(); return cb && cb(); }
          var it = items[i++];
          var params = Object.assign({}, it.params, { token: A.token(), login: login(), page: PAGE });
          jsonp(params, function (r) {
            if (!r) { Q.busy = false; Q.changed(); return cb && cb(); }               // still offline - stop
            if (r.ok) { Q.remove(it.cid, next); if (Q.onSent) Q.onSent(it, r); }
            else if (r.error === 'signin') { Q.busy = false; Q.changed(); A.signIn(function () { Q.flush(cb); }); }
            else { it.error = r.error; store('readwrite', function (s) { return s.put(it); }, next); }   // keep, show the error
          }, 30000);
        })();
      });
    },
    changed: function () { Q.list(function (items) { document.dispatchEvent(new CustomEvent('tspl-queue', { detail: items })); }); },
    onSent: null
  };
  window.addEventListener('online', function () { Q.flush(); });
  setInterval(function () { Q.flush(); }, 60000);

  window.TSPL_APP = A;
  window.TSPL_QUEUE = Q;
})();

/* =====================================================================
 *  TSPL NOTIFICATION BELL + AUTO-RECOVERY  (main dashboard)
 *  - Shows problems found by the TSPL Error Monitor (all programs)
 *  - Catches errors on this dashboard itself
 *  - Safe auto-correction: reloads a program that hangs / after the
 *    internet comes back. It never changes any data.
 *  If anything here fails, the dashboard keeps working as before.
 * ===================================================================== */
(function () {
  'use strict';


  // set in js/tspl-config.js (shared with Ask TSPL)
  var TSPL_MONITOR_URL = window.TSPL_MONITOR_URL || '';

  var POLL_MS = 2 * 60 * 1000;     // refresh bell every 2 minutes
  var LOAD_TIMEOUT_MS = 30000;     // program must load within 30 s
  var READ_KEY = 'tsplBellRead';

  var state = { server: [], closed: [], local: [], online: null, lastSync: null };
  var read = {};
  try { read = JSON.parse(localStorage.getItem(READ_KEY) || '{}') || {}; } catch (e) { read = {}; }

  function saveRead() { try { localStorage.setItem(READ_KEY, JSON.stringify(read)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ago(t) {
    var d = new Date(t); if (isNaN(d)) return '';
    var s = Math.round((Date.now() - d.getTime()) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /* ---------- JSONP call to the monitor (works from GitHub Pages) ---------- */
  var cbSeq = 0;
  function api(params, done) {
    if (!TSPL_MONITOR_URL) { done && done(null); return; }
    var name = '__tsplCb' + (++cbSeq) + '_' + Date.now();
    var s = document.createElement('script');
    var finished = false;
    var timer = setTimeout(function () { finish(null); }, params.action === 'runnow' ? 300000 : 90000);
    function finish(res) {
      if (finished) return; finished = true; clearTimeout(timer);
      // keep a harmless callback: a reply that arrives after the timeout must not throw
      window[name] = function () {};
      setTimeout(function () { try { delete window[name]; } catch (e) { window[name] = undefined; } }, 300000);
      if (s.parentNode) s.parentNode.removeChild(s);
      done && done(res);
    }
    window[name] = function (res) { finish(res); };
    var q = Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    s.src = TSPL_MONITOR_URL + '?' + q + '&callback=' + name + '&_=' + Date.now();
    s.onerror = function () { finish(null); };
    document.body.appendChild(s);
  }

  /* ---------- Local (this dashboard) notifications ---------- */
  function addLocal(sev, program, message, extra) {
    var key = program + '|' + message;
    for (var i = 0; i < state.local.length; i++) {
      if (state.local[i].key === key && state.local[i].status === 'Open') {
        state.local[i].count++; state.local[i].last = new Date().toISOString(); render(); return;
      }
    }
    var n = { id: 'L' + Date.now() + Math.floor(Math.random() * 1000), key: key, local: true, status: 'Open',
              severity: sev, program: program, message: message, target: (extra && extra.target) || '',
              source: 'This dashboard', first: new Date().toISOString(), last: new Date().toISOString(), count: 1 };
    state.local.unshift(n);
    if (state.local.length > 30) state.local.length = 30;
    // also send to central monitor log (errors only)
    if (sev === 'Error') api({ action: 'log', program: 'HO Dashboard: ' + program, message: message, where: n.target, source: 'Dashboard' });
    render();
  }
  function resolveLocalByProgram(program, note) {
    state.local.forEach(function (n) { if (n.program === program && n.status === 'Open') { n.status = 'Auto-resolved'; n.note = note; } });
    render();
  }

  /* ---------- UI ---------- */
  var btn, badge, panel, listEl, footEl, tab = 'open';

  function build() {
    btn = document.getElementById('btnBell');
    if (!btn) {
      var actions = document.querySelector('.header-actions');
      if (!actions) return false;
      btn = document.createElement('button');
      btn.id = 'btnBell'; btn.className = 'icon-btn bell-btn'; btn.type = 'button';
      btn.innerHTML = '<i class="las la-bell" aria-hidden="true"></i><span class="bell-badge" id="bellBadge" hidden>0</span>';
      actions.insertBefore(btn, actions.firstChild);
    }
    badge = document.getElementById('bellBadge');
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');

    panel = document.createElement('div');
    panel.className = 'bell-panel'; panel.id = 'bellPanel'; panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Notifications');
    panel.innerHTML =
      '<div class="bell-head">' +
        '<strong>Notifications</strong>' +
        '<div class="bell-head-actions">' +
          '<button type="button" class="bell-link" data-act="runnow" title="Check all programs now"><i class="las la-sync"></i> Check now</button>' +
          '<button type="button" class="bell-link" data-act="readall" title="Mark all as read"><i class="las la-check-double"></i></button>' +
          '<button type="button" class="bell-link" data-act="close" aria-label="Close">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div class="bell-tabs"><button type="button" data-tab="open" class="on">Open</button><button type="button" data-tab="closed">Resolved</button></div>' +
      '<div class="bell-list" id="bellList"></div>' +
      '<div class="bell-foot" id="bellFoot"></div>';
    document.body.appendChild(panel);
    listEl = panel.querySelector('#bellList');
    footEl = panel.querySelector('#bellFoot');

    btn.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    document.addEventListener('click', function (e) { if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) toggle(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) toggle(false); });
    panel.addEventListener('click', onPanelClick);
    return true;
  }

  function toggle(force) {
    var show = typeof force === 'boolean' ? force : panel.hidden;
    panel.hidden = !show;
    btn.setAttribute('aria-expanded', String(show));
    if (show) { render(); }
  }

  function allOpen() { return state.local.filter(function (n) { return n.status === 'Open'; }).concat(state.server); }
  function allClosed() { return state.local.filter(function (n) { return n.status !== 'Open'; }).concat(state.closed); }

  function render() {
    if (!btn) return;
    var open = allOpen();
    var unread = open.filter(function (n) { return read[n.id] !== (n.count || 1); }).length;
    badge.hidden = unread === 0;
    badge.textContent = unread > 99 ? '99+' : String(unread);
    btn.classList.toggle('has-error', open.some(function (n) { return n.severity === 'Error'; }));
    btn.title = open.length ? open.length + ' open issue(s)' : 'No open issues';
    if (panel.hidden) return;

    var items = tab === 'open' ? open : allClosed();
    if (!items.length) {
      listEl.innerHTML = '<div class="bell-empty"><i class="las la-check-circle"></i><div>' +
        (tab === 'open' ? 'All programs running fine' : 'No resolved items yet') + '</div></div>';
    } else {
      listEl.innerHTML = items.map(function (n) {
        var sev = String(n.severity || 'Error').toLowerCase();
        var isOpen = n.status === 'Open';
        return '<div class="bell-item sev-' + esc(sev) + (read[n.id] === (n.count || 1) ? '' : ' unread') + '" data-id="' + esc(n.id) + '">' +
          '<div class="bell-item-top"><span class="bell-dot"></span><span class="bell-prog">' + esc(n.program || 'Program') + '</span>' +
          '<span class="bell-time">' + esc(ago(n.last || n.first)) + '</span></div>' +
          '<div class="bell-msg">' + esc(n.message) + '</div>' +
          '<div class="bell-meta">' + esc(n.source || '') + (n.count > 1 ? ' · seen ' + esc(n.count) + '×' : '') +
            (!isOpen ? ' · ' + esc(n.status) + (n.note ? ': ' + esc(n.note) : '') : '') + '</div>' +
          (isOpen ? '<div class="bell-actions">' +
            (n.target && /^https?:/.test(n.target) ? '<button type="button" data-act="open">Open</button>' : '') +
            '<button type="button" data-act="recheck">Re-check / auto-fix</button>' +
            '<button type="button" data-act="resolve">Resolved</button>' +
            '<button type="button" data-act="copy" title="Copy details to send to Claude">Copy for Claude</button>' +
          '</div>' : '') +
          '<div class="bell-status" aria-live="polite"></div>' +
        '</div>';
      }).join('');
    }
    var txt = TSPL_MONITOR_URL
      ? (state.online === false ? '<span class="warn">Monitor not reachable - showing dashboard alerts only</span>'
         : 'Synced ' + (state.lastSync ? ago(state.lastSync) : '…'))
      : '<span class="warn">Central monitor not connected yet - showing dashboard alerts only</span>';
    footEl.innerHTML = txt;
    // mark visible open items as read
    if (tab === 'open') { open.forEach(function (n) { read[n.id] = n.count || 1; }); saveRead(); badge.hidden = true; }
  }

  function find(id) {
    return allOpen().concat(allClosed()).filter(function (n) { return n.id === id; })[0];
  }

  function copyText(t) {
    var ok = false;
    try {
      var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); document.body.removeChild(ta);
    } catch (e) {}
    if (!ok && navigator.clipboard) { navigator.clipboard.writeText(t).catch(function () {}); ok = true; }
    return ok;
  }

  function onPanelClick(e) {
    var tb = e.target.closest('[data-tab]');
    if (tb) {
      tab = tb.getAttribute('data-tab');
      panel.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('on', b === tb); });
      render(); return;
    }
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'close') return toggle(false);
    if (act === 'readall') { allOpen().forEach(function (n) { read[n.id] = n.count || 1; }); saveRead(); render(); return; }
    if (act === 'runnow') {
      if (!TSPL_MONITOR_URL) { footEl.innerHTML = '<span class="warn">Connect the monitor first (see setup guide)</span>'; return; }
      b.disabled = true; b.innerHTML = '<i class="las la-sync spin"></i> Checking…';
      api({ action: 'runnow' }, function () { b.disabled = false; b.innerHTML = '<i class="las la-sync"></i> Check now'; poll(); });
      return;
    }
    var item = b.closest('.bell-item'); if (!item) return;
    var n = find(item.getAttribute('data-id')); if (!n) return;
    var st = item.querySelector('.bell-status');
    if (act === 'open') { window.open(n.target, '_blank', 'noopener'); return; }
    if (act === 'copy') {
      var t = 'TSPL error to fix\nProgram: ' + n.program + '\nError: ' + n.message + '\nSource: ' + (n.source || '') +
              '\nLink: ' + (n.target || '-') + '\nFirst seen: ' + n.first + '\nTimes: ' + (n.count || 1) + '\nID: ' + n.id;
      st.textContent = copyText(t) ? 'Copied - paste it to Claude and say "resolve this".' : 'Copy blocked - select text manually.';
      return;
    }
    if (act === 'resolve') {
      if (n.local) { n.status = 'Resolved'; n.note = 'Marked by user'; render(); return; }
      st.textContent = 'Saving…';
      api({ action: 'resolve', id: n.id }, function (r) { st.textContent = r && r.ok ? 'Marked resolved' : 'Could not reach monitor'; poll(); });
      return;
    }
    if (act === 'recheck') {
      if (n.local) {
        if (n.target && frame) { st.textContent = 'Reloading program…'; reloadFrame(n.program, n.target); }
        else { st.textContent = 'Dashboard errors clear on page refresh.'; }
        return;
      }
      st.textContent = 'Checking now…';
      api({ action: 'recheck', id: n.id }, function (r) {
        if (!r) { st.textContent = 'Could not reach monitor'; return; }
        st.textContent = r.fixed ? 'Fixed - working normally now ✔' : 'Still failing: ' + (r.msg || '') + ' — use "Copy for Claude".';
        setTimeout(poll, 800);
      });
    }
  }

  /* ---------- Poll central monitor ---------- */
  function poll() {
    if (!TSPL_MONITOR_URL) { render(); return; }
    api({ action: 'list' }, function (r) {
      if (r && r.ok) {
        state.server = r.open || []; state.closed = r.closed || []; state.online = true; state.lastSync = new Date();
      } else { state.online = false; }
      render();
    });
  }

  /* ---------- Safe auto-correction for programs opened in the dashboard ---------- */
  var frame = document.getElementById('mainFrame');
  var loadTimer = null, retried = {}, currentLabel = 'Home';

  function labelFor(url) {
    var a = Array.prototype.slice.call(document.querySelectorAll('.menu-link')).filter(function (l) { return l.getAttribute('data-embed') === url; })[0];
    return a ? (a.textContent || '').replace(/\s+/g, ' ').trim() : url;
  }
  function reloadFrame(label, url) {
    try { frame.src = 'about:blank'; setTimeout(function () { frame.src = url; }, 150); } catch (e) {}
  }
  function watchLoad() {
    var url = frame.getAttribute('src');
    if (!url || url === 'about:blank') return;
    currentLabel = labelFor(url);
    clearTimeout(loadTimer);
    loadTimer = setTimeout(function () {
      if (!retried[url]) {               // AUTO-CORRECTION: one silent retry
        retried[url] = 1;
        addLocal('Warning', currentLabel, 'Program was slow to load (over 30 s) - reloaded automatically.', { target: url });
        reloadFrame(currentLabel, url);
      } else {
        addLocal('Error', currentLabel, 'Program is not loading even after automatic retry. It may be down or very slow.', { target: url });
      }
    }, LOAD_TIMEOUT_MS);
  }
  if (frame) {
    frame.addEventListener('load', function () {
      var url = frame.getAttribute('src');
      if (!url || url === 'about:blank') return;
      clearTimeout(loadTimer);
      if (retried[url]) { delete retried[url]; resolveLocalByProgram(labelFor(url), 'Loaded fine after retry'); }
    });
    new MutationObserver(function (m) { m.forEach(function (x) { if (x.attributeName === 'src') watchLoad(); }); })
      .observe(frame, { attributes: true, attributeFilter: ['src'] });
  }

  // AUTO-CORRECTION: internet drop / return
  window.addEventListener('offline', function () {
    addLocal('Warning', 'Network', 'Internet connection lost. Programs cannot load or save until it is back.');
  });
  window.addEventListener('online', function () {
    resolveLocalByProgram('Network', 'Connection restored');
    var url = frame && frame.getAttribute('src');
    if (url && url !== 'about:blank') reloadFrame(currentLabel, url);   // reload the open program
    poll();
  });

  // Errors on the dashboard page itself
  window.addEventListener('error', function (e) {
    if (e && e.target && e.target !== window && e.target.tagName) {
      var src = e.target.src || e.target.href || '';
      if (/callback=__tsplCb/.test(src)) return;     // monitor offline is shown in footer instead
      addLocal('Warning', 'Dashboard file', 'Could not load ' + e.target.tagName.toLowerCase() + ': ' + src);
      return;
    }
    // "Script error." with no line = an error inside a script from another website (Google, Looker...).
    // The browser hides its details and nothing on this page can fix it, so it is not raised as an alert.
    if (!e || (/^Script error\.?$/i.test(String(e.message || '').trim()) && !e.lineno)) return;
    addLocal('Error', 'Dashboard script', (e.message || 'Script error') + (e.lineno ? ' (line ' + e.lineno + ')' : ''));
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    addLocal('Error', 'Dashboard script', 'Unhandled: ' + (e && e.reason && (e.reason.message || e.reason)));
  });

  /* ---------- start ---------- */
  function start() {
    try {
      if (!build()) return;
      render();
      poll();
      setInterval(poll, POLL_MS);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
    } catch (e) { /* never break the dashboard */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  // allow other scripts on this page to raise a notification: TSPLNotify('Error','Program','message')
  window.TSPLNotify = function (sev, program, message) { try { addLocal(sev || 'Error', program || 'Program', message || ''); } catch (e) {} };
})();

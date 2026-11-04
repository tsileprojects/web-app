/* =====================================================================
 *  ASK TSPL - plain-language questions on the HO dashboard
 *  Answers come from the TSPL Error Monitor web app (Ask.gs), which runs
 *  read-only queries on the live Google Sheets. If anything fails here,
 *  the dashboard keeps working as before.
 * ===================================================================== */
(function () {
  'use strict';
  var URL_ = function () { return window.TSPL_MONITOR_URL || ''; };
  var EXAMPLES = [
    'Efficiency % by unit yesterday',
    'Production vs target by unit this week',
    'FTR % by unit this month',
    'AP2 FSA pass % this month',
    'Which needle types are below 20 in CMD stock?',
    'Broken needles by machine type in TS9 in October',
    'Lines that failed COT last week',
    'GSD requests pending (yet to do)'
  ];
  var history = [];      // [{q, a}]
  var busy = false;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>'); }

  var seq = 0;
  function jsonp(params, done) {
    var name = '__tsplAsk' + (++seq) + '_' + Date.now();
    var s = document.createElement('script'), fin = false;
    var timer = setTimeout(function () { end(null); }, 120000);
    function end(r) {
      if (fin) return; fin = true; clearTimeout(timer);
      // keep a harmless callback: a reply that arrives after the timeout must not throw
      window[name] = function () {};
      setTimeout(function () { try { delete window[name]; } catch (e) { window[name] = undefined; } }, 300000);
      if (s.parentNode) s.parentNode.removeChild(s);
      done(r);
    }
    window[name] = end;
    var q = Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    s.src = URL_() + '?' + q + '&callback=' + name + '&_=' + Date.now();
    s.onerror = function () { end(null); };
    document.body.appendChild(s);
  }

  var btn, panel, log, input, sendBtn;

  function build() {
    var actions = document.querySelector('.header-actions');
    if (!actions) return false;
    btn = document.getElementById('btnAsk');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'btnAsk'; btn.type = 'button'; btn.className = 'ask-chip';
      btn.innerHTML = '<i class="las la-robot" aria-hidden="true"></i><span>Ask TSPL</span>';
      actions.insertBefore(btn, actions.firstChild);
    }
    btn.title = 'Ask a question about your data';

    panel = document.createElement('aside');
    panel.className = 'ask-panel'; panel.hidden = true;
    panel.setAttribute('aria-label', 'Ask TSPL');
    panel.innerHTML =
      '<div class="ask-head"><div><strong>Ask TSPL</strong><span>Answers from your live sheets</span></div>' +
      '<div><button type="button" class="ask-icon" data-act="new" title="New chat"><i class="las la-redo-alt"></i></button>' +
      '<button type="button" class="ask-icon" data-act="close" aria-label="Close">&times;</button></div></div>' +
      '<div class="ask-log" id="askLog"></div>' +
      '<form class="ask-form" autocomplete="off"><textarea rows="2" placeholder="Ask about production, efficiency, quality, FSA, cutting, needles…" maxlength="500"></textarea>' +
      '<button type="submit" class="ask-send" title="Ask"><i class="las la-paper-plane"></i></button></form>' +
      '<div class="ask-note">Numbers are read live from the department Datamasters. Read-only - nothing is changed.</div>';
    document.body.appendChild(panel);
    log = panel.querySelector('#askLog');
    input = panel.querySelector('textarea');
    sendBtn = panel.querySelector('.ask-send');

    // the dashboard blocks text selection globally; allow it inside the panel
    ['selectstart', 'contextmenu'].forEach(function (ev) { panel.addEventListener(ev, function (e) { e.stopPropagation(); }); });

    btn.addEventListener('click', function () { toggle(); });
    panel.addEventListener('click', onClick);
    panel.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input.value); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) toggle(false); });
    welcome();
    return true;
  }

  function toggle(force) {
    var show = typeof force === 'boolean' ? force : panel.hidden;
    panel.hidden = !show;
    btn.classList.toggle('on', show);
    if (show) setTimeout(function () { input.focus(); }, 50);
  }

  function welcome() {
    log.innerHTML = '<div class="ask-msg bot"><div class="ask-bubble">Hello! Ask me in plain words about production & targets, efficiency & COT, end-line quality (FTR), FSA audits, cutting, needle stock & issues, GSD requests or sample indents - by unit, line, buyer, style or date.' +
      (URL_() ? '' : '<div class="ask-warn">Ask TSPL is being set up - it will answer once the monitor link is added.</div>') +
      '</div><div class="ask-chips">' + EXAMPLES.map(function (x) { return '<button type="button" data-q="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div></div>';
  }

  function onClick(e) {
    var c = e.target.closest('[data-q]');
    if (c) { ask(c.getAttribute('data-q')); return; }
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'close') toggle(false);
    if (act === 'new') { history = []; welcome(); input.focus(); }
  }

  function add(html, cls) {
    var d = document.createElement('div');
    d.className = 'ask-msg ' + cls;
    d.innerHTML = html;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  function table(t) {
    if (!t || !t.headers || !t.headers.length) return '';
    var rows = (t.rows || []).slice(0, 50);
    return '<div class="ask-table"><table><thead><tr>' + t.headers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr>' + r.map(function (v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>' + ((t.rows || []).length > 50 ? '<div class="ask-small">Showing first 50 rows</div>' : '');
  }

  function ask(q) {
    q = String(q || '').trim();
    if (!q || busy) return;
    input.value = '';
    add('<div class="ask-bubble">' + esc(q) + '</div>', 'me');
    if (!URL_()) { add('<div class="ask-bubble">Ask TSPL is not connected yet. Please finish the monitor setup (Allow + add link).</div>', 'bot err'); return; }
    busy = true; sendBtn.disabled = true;
    var wait = add('<div class="ask-bubble ask-typing"><span></span><span></span><span></span> Reading your sheets…</div>', 'bot');
    var h = history.slice(-2).map(function (x) { return 'Q: ' + x.q + '\nA: ' + x.a; }).join('\n').slice(0, 1500);
    jsonp({ action: 'ask', q: q, h: h }, function (r) {
      busy = false; sendBtn.disabled = false;
      wait.parentNode && wait.parentNode.removeChild(wait);
      if (!r) { add('<div class="ask-bubble">Could not reach Ask TSPL. Check the internet and try again.</div>', 'bot err'); return; }
      if (!r.ok) { add('<div class="ask-bubble">' + esc(r.error || 'Sorry, something went wrong.') + '</div>', 'bot err'); return; }
      history.push({ q: q, a: r.answer });
      var how = (r.queries || []).length ? '<details class="ask-how"><summary>How this was calculated</summary>' +
        r.queries.map(function (x) {
          return '<div><b>' + esc(x.purpose || 'Query') + '</b> <span class="ask-small">(' + esc(x.source) + ', ' + esc(x.rows) + ' rows' + (x.error ? ', error: ' + esc(x.error) : '') + ')</span><code>' + esc(x.tq) + '</code></div>';
        }).join('') + (r.ms ? '<div class="ask-small">Answered in ' + (r.ms / 1000).toFixed(1) + ' s</div>' : '') + '</details>' : '';
      var fu = (r.followups || []).length ? '<div class="ask-chips">' + r.followups.map(function (x) { return '<button type="button" data-q="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</div>' : '';
      add('<div class="ask-bubble">' + fmt(r.answer) + table(r.table) + how + '</div>' + fu, 'bot');
    });
  }

  function start() { try { build(); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

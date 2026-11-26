/* Unit lock: a factory / department login sees only its own unit's data.
   FIPL, TS2, TS4, TS9, AP2, EMB and SMP logins are locked to their unit.
   CMD, HO and every other login are not locked and can see all units.
   Load this in <head> of any page that can show more than one unit. */
(function () {
  var MAP = {
    'unit_fipl.html': 'FIPL', 'unit_ts2.html': 'TS2', 'unit_ts4.html': 'TS4', 'unit_ts9.html': 'TS9',
    'unit_ap2.html': 'AP2', 'dept_emb.html': 'EMB', 'dept_smp.html': 'SMP'
  };
  var who = null;
  try { who = JSON.parse(sessionStorage.getItem('userLoggedIn') || 'null'); } catch (e) {}
  var L = who && MAP[String(who.redirect || '').toLowerCase()];
  window.TSPL_LOCK = L || null;
  if (!L) return;

  function norm(v) { return String(v == null ? '' : v).toUpperCase().replace(/[\s+_]+/g, ' ').trim(); }
  function ok(v) {
    v = norm(v);
    if (L === 'SMP') return v === 'SMP' || v === 'HO SMP' || v === 'HOSMP';
    return v === L;
  }
  window.TSPL_UNIT_OK = ok;

  // 1) The page must be opened for the login's own unit.
  var m = location.search.match(/[?&]unit=([^&#]*)/i);
  var cur = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
  if (cur === null || !ok(cur)) {
    var val = L === 'SMP' ? 'HO%20Smp' : L;
    var qs = location.search.replace(/^\?/, '').split('&').filter(function (p) { return p && !/^unit=/i.test(p); });
    qs.unshift('unit=' + val);
    location.replace(location.pathname + '?' + qs.join('&') + location.hash);
    return;
  }

  // 2) Hide buttons, tabs and rows that belong to other units (or to "All").
  function sweep() {
    var els = document.querySelectorAll('[data-u]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!ok(el.getAttribute('data-u'))) { if (el.style.display !== 'none') el.style.display = 'none'; }
    }
  }
  var t = 0;
  function soon() { if (!t) t = setTimeout(function () { t = 0; sweep(); }, 30); }
  try { new MutationObserver(soon).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  document.addEventListener('DOMContentLoaded', sweep);

  // 3) Ignore clicks on anything for another unit, even if it slips through.
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-u]');
    if (b && !ok(b.getAttribute('data-u'))) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
})();

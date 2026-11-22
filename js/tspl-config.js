/* Shared settings for the HO dashboard add-ons (notification bell + Ask TSPL).
 * Paste the TSPL Error Monitor web-app URL (ends with /exec) below. */
window.TSPL_MONITOR_URL = 'https://script.google.com/macros/s/AKfycbz4dLAQFFJ1yxrHJZrQRtzThsVHRuVcJz3ZrYb3SBMTXIVq6NonUXgDWqnVzE-9b9k0/exec';

/* Permanent fix for "Could not load data": every call to the TSPL Error Monitor that a page makes with a
 * <script> tag (JSONP) is fetched WITHOUT the browser's Google cookies. When Chrome's Google sign-in needs
 * re-verification ("Verify it's you"), Google answers cookie-carrying requests with a sign-in page instead
 * of data; a cookie-free request always gets the data. If the cookie-free fetch fails, the original
 * script tag is used, exactly as before. Pages keep working unchanged. */
(function () {
  if (window.__tsplCallFix || !window.fetch) return; window.__tsplCallFix = true;
  var BASE = 'https://script.google.com/macros/', ap = Node.prototype.appendChild, ib = Node.prototype.insertBefore;
  function intercept(parent, el, orig, ref) {
    var src = el && el.tagName === 'SCRIPT' ? (el.getAttribute('src') || '') : '';
    if (src.indexOf(BASE) !== 0 || el.__tsplTried) return orig.call(parent, el, ref);
    el.__tsplTried = true;
    var tries = 0;
    (function go() {
      fetch(src, { credentials: 'omit', cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      }).then(function (t) {
        if (/^\s*</.test(t)) throw new Error('not data');
        var s = document.createElement('script'); s.text = t; s.__tsplTried = true;
        orig.call(parent, s, ref);
        try { el.dispatchEvent(new Event('load')); if (typeof el.onload === 'function') el.onload(); } catch (e) {}
      }).catch(function () {
        if (++tries < 2) return setTimeout(go, 1500);
        orig.call(parent, el, ref);   // fall back to the normal script tag
      });
    })();
    return el;
  }
  Node.prototype.appendChild = function (el) { return intercept(this, el, ap); };
  Node.prototype.insertBefore = function (el, ref) { return intercept(this, el, ib, ref); };
})();

/* Adds a "Home" button to TSPL pages.
   Inside the portal (in the dashboard frame) it returns to the portal home;
   opened on its own it returns to the user's portal (or the phone app). */
(function () {
  'use strict';
  function dest() {
    if (window.top !== window.self) return 'home.html';
    if (/\/m\.html/.test(document.referrer) || /[?&]from=app\b/.test(location.search)) return 'm.html';
    try { var s = JSON.parse(sessionStorage.getItem('userLoggedIn') || '{}'); if (s.redirect) return s.redirect; } catch (e) {}
    return 'main_ho.html';
  }
  function add() {
    if (document.getElementById('tsplHomeBtn')) return;
    var b = document.createElement('a');
    b.id = 'tsplHomeBtn'; b.href = dest(); b.setAttribute('aria-label', 'Home'); b.title = 'Back to the main dashboard';
    b.innerHTML = '&#8962;&nbsp;Home';
    b.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font:600 13px system-ui,Arial,sans-serif;padding:7px 12px;border-radius:8px;' +
      'background:#2196f3;color:#fff;text-decoration:none;margin-right:12px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.15)';
    var h = document.querySelector('header');
    if (h) { h.insertBefore(b, h.firstChild); }
    else { b.style.position = 'fixed'; b.style.left = '12px'; b.style.top = '12px'; b.style.zIndex = '60'; document.body.appendChild(b); }
  }
  if (document.readyState !== 'loading') add(); else document.addEventListener('DOMContentLoaded', add);
})();

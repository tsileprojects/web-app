/* =====================================================================
 *  HAPPY DIWALI strip (option A - night sky rockets)
 *  Shows on every page until 12-Nov-2026 23:59 IST, then switches off
 *  by itself (this file can be deleted any time after that).
 *  Users can close it with the x button (hidden for that browser session).
 *  If anything fails, the page keeps working as before.
 * ===================================================================== */
(function () {
  'use strict';
  try {
    var END = new Date('2026-11-13T00:00:00+05:30').getTime();
    if (Date.now() >= END) return;                                   // auto-expiry
    if (window.top !== window.self) return;                          // not inside the dashboard's iframe pages
    try { if (sessionStorage.getItem('tsplDiwaliClosed') === '1') return; } catch (e) {}

    var H = 46;
    var css = document.createElement('style');
    css.textContent =
      '#tsplDiwali{position:relative;height:' + H + 'px;background:#0B1630;overflow:hidden;z-index:50;flex:none}' +
      '#tsplDiwali canvas{position:absolute;inset:0;width:100%;height:100%;display:block}' +
      '#tsplDiwali .dw-t{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:14px;pointer-events:none;' +
      'font-family:Georgia,"Times New Roman",serif;text-align:center}' +
      '#tsplDiwali .dw-h{font-size:21px;color:#FAC775;letter-spacing:.5px;animation:dwShim 2.4s ease-in-out infinite}' +
      '#tsplDiwali .dw-s{font:12px Roboto,Arial,sans-serif;color:#B5D4F4}' +
      '#tsplDiwali .dw-x{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:24px;height:24px;border:0;border-radius:50%;' +
      'background:rgba(255,255,255,.12);color:#fff;font:16px/24px Arial,sans-serif;cursor:pointer;padding:0}' +
      '#tsplDiwali .dw-x:hover{background:rgba(255,255,255,.25)}' +
      '@keyframes dwShim{0%,100%{opacity:1}50%{opacity:.62}}' +
      'body.tspl-dw .app{height:calc(100vh - ' + H + 'px)!important}' +
      'body.tspl-dw main.app-main{height:calc(100vh - ' + H + 'px - var(--header-h) - var(--footer-h))!important}' +
      '@media (max-width:640px){#tsplDiwali .dw-s{display:none}}';
    document.head.appendChild(css);

    function mount() {
      if (document.getElementById('tsplDiwali')) return;
      var bar = document.createElement('div');
      bar.id = 'tsplDiwali'; bar.setAttribute('role', 'note'); bar.setAttribute('aria-label', 'Happy Diwali from Team TSPL');
      bar.innerHTML = '<canvas aria-hidden="true"></canvas><div class="dw-t"><span class="dw-h">Happy Diwali</span>' +
        '<span class="dw-s">May the festival of lights brighten every line - Team TSPL</span></div>' +
        '<button type="button" class="dw-x" aria-label="Close Diwali greeting" title="Close">&times;</button>';
      document.body.insertBefore(bar, document.body.firstChild);
      if (!document.querySelector('.app')) { bar.style.position = 'fixed'; bar.style.bottom = '0'; bar.style.left = '0'; bar.style.right = '0'; bar.style.zIndex = '1000'; }
      document.body.classList.add('tspl-dw');
      bar.querySelector('.dw-x').addEventListener('click', function () {
        stop = true; bar.parentNode.removeChild(bar); document.body.classList.remove('tspl-dw');
        try { sessionStorage.setItem('tsplDiwaliClosed', '1'); } catch (e) {}
      });
      run(bar.querySelector('canvas'));
    }

    var stop = false;
    function run(cv) {
      var ctx = cv.getContext('2d'); if (!ctx) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2), W = 0, Hh = 0;
      function size() { W = cv.clientWidth; Hh = cv.clientHeight; cv.width = W * dpr; cv.height = Hh * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
      size(); window.addEventListener('resize', size);
      var colors = ['#F09595', '#FAC775', '#9FE1CB', '#85B7EB', '#ED93B1', '#97C459'];
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {                                      // static starry strip
        for (var i = 0; i < 70; i++) { ctx.fillStyle = colors[i % colors.length]; ctx.globalAlpha = .7; ctx.fillRect(Math.random() * W, Math.random() * Hh, 1.5, 1.5); }
        return;
      }
      var rockets = [], parts = [], t = 0;
      function launch() {
        var x = W * (0.03 + Math.random() * 0.94);
        if (x > W * 0.3 && x < W * 0.7) x = Math.random() < 0.5 ? W * (0.05 + Math.random() * 0.22) : W * (0.73 + Math.random() * 0.22);
        rockets.push({ x: x, y: Hh + 2, vx: (Math.random() - 0.5) * 0.4, vy: -(2.1 + Math.random() * 0.9),
                       ty: Hh * (0.15 + Math.random() * 0.35), c: colors[Math.random() * colors.length | 0] });
      }
      function burst(r) {
        for (var i = 0; i < 26; i++) {
          var a = i / 26 * Math.PI * 2, s = 1.2 * (0.6 + Math.random() * 0.6);
          parts.push({ x: r.x, y: r.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, c: Math.random() < 0.25 ? '#ffffff' : r.c });
        }
      }
      function step() {
        if (stop) return;
        if (document.hidden) { requestAnimationFrame(step); return; }
        t++; if (t % 40 === 0) launch();
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(11,22,48,0.28)'; ctx.fillRect(0, 0, W, Hh);
        ctx.globalCompositeOperation = 'lighter';
        for (var i = rockets.length - 1; i >= 0; i--) {
          var r = rockets[i]; r.x += r.vx; r.y += r.vy;
          ctx.fillStyle = r.c; ctx.fillRect(r.x - 1, r.y - 1, 2, 3);
          for (var k = 1; k < 5; k++) { ctx.globalAlpha = 0.5 / k; ctx.fillStyle = '#FAC775'; ctx.fillRect(r.x - r.vx * k * 2, r.y - r.vy * k * 2, 1.3, 1.3); }
          ctx.globalAlpha = 1;
          if (r.y <= r.ty) { burst(r); rockets.splice(i, 1); }
        }
        for (var j = parts.length - 1; j >= 0; j--) {
          var p = parts[j]; p.x += p.vx; p.y += p.vy; p.vx *= 0.97; p.vy = p.vy * 0.97 + 0.025; p.life -= 0.02;
          if (p.life <= 0) { parts.splice(j, 1); continue; }
          ctx.globalAlpha = p.life; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (Date.now() >= END) { stop = true; var b = document.getElementById('tsplDiwali'); if (b) b.parentNode.removeChild(b); document.body.classList.remove('tspl-dw'); return; }
        requestAnimationFrame(step);
      }
      step();
    }

    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  } catch (e) { /* never break the page */ }
})();

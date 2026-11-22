// Security and session checking
document.addEventListener('DOMContentLoaded', function() {
    if (typeof checkLogin === 'function') checkLogin();
});

// Add logout button functionality
function logout() {
    sessionStorage.removeItem('userLoggedIn');
    window.location.href = "index.html";
}

// ===== Helpers =====
const $ = (sel, par=document) => par.querySelector(sel);
const $$ = (sel, par=document) => Array.from(par.querySelectorAll(sel));

// Sidebar toggle (desktop collapse only)
const appRoot = $('#appRoot');
const btnSidebar = $('#btnSidebar');

function toggleSidebar() {
    appRoot.classList.toggle('is-collapsed');
}

btnSidebar.addEventListener('click', toggleSidebar);

// ===== Fullscreen =====
const btnFullscreen = $('#btnFullscreen');
const icoExpand = $('#icoExpand');
const icoCompress = $('#icoCompress');
function updateFsIcons() {
    const fs = !!document.fullscreenElement;
    icoExpand.style.display = fs ? 'none' : '';
    icoCompress.style.display = fs ? '' : 'none';
    btnFullscreen.setAttribute('aria-label', fs ? 'Exit fullscreen' : 'Enter fullscreen');
    btnFullscreen.title = fs ? 'Exit fullscreen' : 'Fullscreen';
}
btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
    } else {
        document.exitFullscreen?.();
    }
});
document.addEventListener('fullscreenchange', updateFsIcons);
updateFsIcons();

// ===== Logout =====
const btnLogout = $('#btnLogout');
btnLogout.addEventListener('click', () => {
    if (typeof logout === 'function') {
        logout();
    } else {
        console.warn('logout() not found.');
    }
});

// ===== Navigation: load into iframe via data-embed (links only) =====
const frame = $('#mainFrame');
// Google Apps Script programs are opened in their own browser tab: inside the portal frame Chrome blocks
// Google's sign-in cookies (third-party cookies), which shows "Sorry, unable to open the file at present".
function isAppsScript(url) { return /^https:\/\/script\.google\.com\//.test(url); }
function changeView(url, name) {
    if (!url) return;
    try {
        if (isAppsScript(url)) {
            const w = window.open(url, '_blank');
            const safe = String(name || 'This program').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
            const u = url.replace(/"/g, '&quot;');
            frame.srcdoc = '<!doctype html><html><body style="margin:0;font-family:Segoe UI,Roboto,Arial,sans-serif;background:#f4f6fa;color:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh">' +
                '<div style="max-width:460px;text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:28px 30px;box-shadow:0 8px 24px rgba(15,23,42,.08)">' +
                '<div style="font-size:18px;font-weight:700;margin-bottom:8px">' + safe + '</div>' +
                '<div style="font-size:14px;color:#475569;margin-bottom:18px">' + (w ? 'opened in a new browser tab.' : 'Your browser blocked the new tab. Click below to open it.') + '</div>' +
                '<a href="' + u + '" target="_blank" rel="noopener" style="display:inline-block;background:#0b2545;color:#fff;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:8px">Open ' + safe + ' \u2197</a>' +
                '<div style="font-size:12px;color:#64748b;margin-top:14px">Google programs open in their own tab so your Google sign-in always works.</div></div></body></html>';
            return;
        }
        frame.removeAttribute('srcdoc');
        frame.src = url;
    } catch (e) {
        console.error('Failed to set iframe src', e);
    }
}
function clearActive() {
    $$('.menu-link').forEach(l => l.classList.remove('active'));
    $$('.menu').forEach(m => m.classList.remove('active'));
}
function setActive(linkEl) {
    if (!linkEl) return;
    clearActive();
    linkEl.classList.add('active');
    const menu = linkEl.closest('details.menu');
    if (menu) { menu.classList.add('active'); menu.open = true; }
}

// Handle clicks on anchor menu items (not buttons)
document.addEventListener('click', (e) => {
    const link = e.target.closest('a.menu-link');
    if (!link) return;
    const embed = link.getAttribute('data-embed');
    if (embed) {
        e.preventDefault();
        setActive(link);
        changeView(embed, (link.querySelector('span') || link).textContent.trim());
    }
});

// optional: allow deep-linking to ?embed=URL
const params = new URLSearchParams(location.search);
const initial = params.get('embed');
if (initial) {
    const match = $$('.menu-link').find(a => a.getAttribute('data-embed') === initial);
    if (match) setActive(match);
    changeView(initial);
} else {
    // Set initial active to the default iframe src
    const currentSrc = frame.getAttribute('src');
    const match = $$('.menu-link').find(a => a.getAttribute('data-embed') === currentSrc);
    if (match) setActive(match);
}

// Accessibility: close other details when opening one
$$('.menu').forEach(d => {
    d.addEventListener('toggle', () => {
        if (d.open) {
            $$('.menu').forEach(other => { if (other !== d) other.open = false; });
        }
    })
});

// ===== About modal =====
const aboutBtn = $('#about-btn');
const aboutModal = $('#about-modal');
const closeBtn = aboutModal ? aboutModal.querySelector('.close-modal, .close-about-modal') : null;
let lastFocus = null;

function showAboutModal() {
    lastFocus = document.activeElement;
    aboutModal.classList.add('open');
    aboutModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (closeBtn) closeBtn.focus();
}

function hideAboutModal() {
    aboutModal.classList.remove('open');
    aboutModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
}

if (aboutBtn) aboutBtn.addEventListener('click', showAboutModal);
if (closeBtn) closeBtn.addEventListener('click', hideAboutModal);

// Close modal when clicking outside
aboutModal.addEventListener('click', function(e) {
    if (e.target === this) hideAboutModal();
});

// Close with ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aboutModal.classList.contains('open')) hideAboutModal();
});

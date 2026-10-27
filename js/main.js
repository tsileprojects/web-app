// Security and session checking
document.addEventListener('DOMContentLoaded', function() {
    checkLogin();
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
function changeView(url) {
    if (!url) return;
    try {
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
        changeView(embed);
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
const closeBtn = aboutModal.querySelector('.close-modal');
let lastFocus = null;

function showAboutModal() {
    lastFocus = document.activeElement;
    aboutModal.classList.add('open');
    aboutModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
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

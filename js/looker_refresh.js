// js/looker-refresh.js
(function() {
    // <== CHANGE THIS to change refresh frequency (ms). Default: 5 minutes.
    const REFRESH_MS = 5 * 60 * 1000;

    let refreshTimer = null;
    const iframeId = 'mainFrame';

    // Helper: start auto-refresh for a particular looker URL
    function startLookerRefresh(originalUrl) {
        stopLookerRefresh(); // clear any existing timer
        // Build base (strip query) so we avoid stacking multiple t= params
        const base = originalUrl.split('?')[0];

        // Immediately set iframe to base + cachebuster so we always load fresh at start
        const connector = originalUrl.includes('?') ? '&' : '?';
        const iframe = document.getElementById(iframeId);
        if (!iframe) return;

        iframe.src = base + connector + 't=' + Date.now();

        // Start interval to refresh with cache-busting timestamp
        refreshTimer = setInterval(() => {
            // Use same base, append fresh timestamp
            try {
                iframe.src = base + connector + 't=' + Date.now();
            } catch (err) {
                // ignore cross-origin or other errors
                console.warn('Looker refresh error', err);
            }
        }, REFRESH_MS);
    }

    function stopLookerRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
    }

    // Utility to decide if a URL is a Looker Studio embed
    function isLookerEmbed(url) {
        return typeof url === 'string' && url.indexOf('lookerstudio.google.com/embed') !== -1;
    }

    // Set iframe src (used by menu clicks). Handles looker vs non-looker.
    function setIframe(url) {
        if (!url) return;
        const iframe = document.getElementById(iframeId);
        if (!iframe) return;

        // If url is relative (like home.html) or already contains html, just set it.
        if (isLookerEmbed(url)) {
            startLookerRefresh(url);
        } else {
            // Non-Looker: stop refreshing and just set the src as-is
            stopLookerRefresh();
            iframe.src = url;
        }
    }

    // Attach click listeners to menu links that have data-embed attribute
    function attachMenuListeners() {
        const menuLinks = document.querySelectorAll('.menu-link[data-embed], a[data-embed]');
        menuLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                // Prevent default only for anchors that are supposed to embed
                if (this.getAttribute('href') === '#' || this.hasAttribute('data-embed')) {
                    e.preventDefault();
                }
                // Some buttons (like About) might not have data-embed; guard.
                const embedUrl = this.dataset && this.dataset.embed ? this.dataset.embed.trim() : null;
                if (embedUrl) {
                    setIframe(embedUrl);
                }
            });
        });
    }

    // On initial load, if iframe already points to a looker report, start refresh
    function initOnLoad() {
        const iframe = document.getElementById(iframeId);
        if (!iframe) return;
        const currentSrc = iframe.getAttribute('src') || '';
        if (isLookerEmbed(currentSrc)) {
            startLookerRefresh(currentSrc);
        }
        attachMenuListeners();
    }

    // Run on DOMContentLoaded in case scripts above not finished
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOnLoad);
    } else {
        initOnLoad();
    }

    // Optional: expose controls for debugging in console:
    window.__LOokerRefresh = {
        start(url) { if (isLookerEmbed(url)) startLookerRefresh(url); },
        stop() { stopLookerRefresh(); },
        intervalMs: REFRESH_MS
    };
})();


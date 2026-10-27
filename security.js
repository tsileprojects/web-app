// =====================
// ENHANCED SECURITY
// =====================
(function() {
    'use strict';
    
    // Check if user is logged in (you might want to modify this based on your auth system)
    const isLoggedIn = sessionStorage.getItem('userLoggedIn');
    const currentPage = window.location.pathname.split('/').pop();
    
    // Define allowed pages without login (only index.html)
    const allowedPages = ['index.html'];
    
    // Redirect to index.html if not logged in and trying to access other pages
    if (!isLoggedIn && !allowedPages.includes(currentPage)) {
        window.location.href = "index.html";
        return; // Stop execution if redirecting
    }
    
    // Disable right-click context menu
    document.addEventListener("contextmenu", function(e) {
        e.preventDefault();
        return false;
    });
    
    // Disable text selection
    document.addEventListener("selectstart", function(e) {
        e.preventDefault();
        return false;
    });
    
    // Enhanced keyboard shortcuts protection
    document.addEventListener("keydown", function(e) {
        if (
            e.key === "F12" || 
            (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
            (e.ctrlKey && e.key === "U") ||
            (e.metaKey && e.altKey && e.key === "I") ||
            (e.metaKey && e.altKey && e.key === "J") ||
            (e.ctrlKey && e.key === "S") || // Prevent save
            (e.ctrlKey && e.key === "P")   // Prevent print
        ) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    });
    
    // Prevent going back using browser's back button
    history.pushState(null, null, location.href);
    window.onpopstate = function() {
        history.go(1);
        if (!sessionStorage.getItem('userLoggedIn') && !allowedPages.includes(currentPage)) {
            window.location.href = "index.html";
        }
    };
    
    // Protection against console access
    const noop = function() {};
    console.log = noop;
    console.warn = noop;
    console.error = noop;
    console.info = noop;
    console.debug = noop;
    
    // Override alert to prevent modification
    const originalAlert = window.alert;
    window.alert = function(message) {
        originalAlert(message);
    };
    
})();

// Enhanced logout function
function logout() {
    sessionStorage.removeItem('userLoggedIn');
    sessionStorage.removeItem('userData');
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = "index.html";
}

// Session timeout (30 minutes)
let sessionTimeout;
function resetSessionTimer() {
    clearTimeout(sessionTimeout);
    sessionTimeout = setTimeout(function() {
        if (sessionStorage.getItem('userLoggedIn')) {
            alert('Session expired due to inactivity');
            logout();
        }
    }, 30 * 60 * 1000); // 30 minutes
}

// Reset timer on user activity
['mousemove', 'keypress', 'click', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, resetSessionTimer, { passive: true });
});

// Initialize session timer
if (sessionStorage.getItem('userLoggedIn')) {
    resetSessionTimer();
}

// Protection against frame embedding
if (self !== top) {
    top.location = self.location;
}

// Additional security: Prevent navigation away without logout
window.addEventListener('beforeunload', function(e) {
    if (sessionStorage.getItem('userLoggedIn')) {
        // Optional: Add confirmation when leaving the site
        // e.preventDefault();
        // e.returnValue = '';
    }
});

// Detect URL changes (for SPA-like behavior)
let currentUrl = window.location.href;
setInterval(function() {
    if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        const currentPage = window.location.pathname.split('/').pop();
        const isLoggedIn = sessionStorage.getItem('userLoggedIn');
        const allowedPages = ['index.html'];
        
        if (!isLoggedIn && !allowedPages.includes(currentPage)) {
            window.location.href = "index.html";
        }
    }
}, 100);
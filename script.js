// User authentication data
const userGroups = {
    users1: { redirect: "main_ho.html", users: [{ username: "ho", password: "tspl248" }, { username: "hr", password: "hr486" }] },
    users2: { redirect: "main.html", users: [{ username: "ho", password: "ho123" }, { username: "hr", password: "hr123" }] },
    users3: { redirect: "unit_fipl.html", users: [{ username: "fipl", password: "fipl991" }] },
    users4: { redirect: "unit_ts2.html", users: [{ username: "ts2", password: "ts2771" }] },
    users5: { redirect: "unit_ts4.html", users: [{ username: "ts4", password: "ts4934" }] },
    users6: { redirect: "unit_ts9.html", users: [{ username: "ts9", password: "ts9753" }] },
    users7: { redirect: "unit_ap2.html", users: [{ username: "ap2", password: "ap2318" }] },
    users8: { redirect: "dept_smp.html", users: [{ username: "smp", password: "smp285" }] },
    users9: { redirect: "dept_emb.html", users: [{ username: "emb", password: "emb974" }] },
    users10: { redirect: "dept_cmd.html", users: [{ username: "cmd", password: "cmd336" }] },
    users11: { redirect: "dept_gsd.html", users: [{ username: "gsd", password: "gsd266" }] },
    users12: { redirect: "dept_qty.html", users: [{ username: "cft", password: "cft123" }] },
    users13: { redirect: "dept_ppd.html", users: [{ username: "ppd", password: "ppd123" }] },
    users14: { redirect: "kpi_data.html", target: "_blank", users: [{ username: "kpi", password: "kpi123" }] },
    users15: { redirect: "dept_cmp.html", users: [{ username: "cmp", password: "cmp988" }] },
    users16: { redirect: "unit_mrh.html", users: [{ username: "mrh", password: "mrh159" }] },
    users17: { redirect: "unit_bi.html", users: [{ username: "bi", password: "bi740" }] },
    users18: { redirect: "main_ho_test.html", users: [{ username: "man", password: "man2975" }] },
    users19: { redirect: "dept_gsd_fc.html", users: [{ username: "gsdfc", password: "fc123" }] },
    users20: { redirect: "dept_fsa.html", users: [{ username: "sathish", password: "2008" }] },
    users21: { redirect: "ceo.html", users: [{ username: "ceo", hash: "9039256e1679e7d2f8611670c6775a1ffc66e28a47246b66fe0757431990d517" }] },   // Director & CEO - password kept only as a SHA-256 hash
    users22: { redirect: "merchant.html", users: [{ username: "merchant", hash: "2c8123797bf2f71e63734c95d685f336d1914a7cc1606652339ffdb3e583be0c" }] },   // Merchants (one shared login) - FSA dashboard only, password kept as a SHA-256 hash
    users23: { redirect: "audit.html", users: [{ username: "audit", hash: "b98a99eae5715cd616c780929d52c5a2fd7f559abedf98a0866a6f73191bb7dd" }] },   // Auditors (HO audit) - e-Cutmax & FCR Audit page only, password kept as a SHA-256 hash
    users24: { redirect: "att.html", users: [{ username: "hohr", hash: "25cd70c311dd4aa21e4d4ceea371906f64979a5e38b56ab771666a554c6615c8" }, { username: "hr_fipl", hash: "de82ff5bca74a7a43be5a9e89de4cb27a93cda6337c71f6541af697817888803" }, { username: "hr_ts2", hash: "281cba4501a28bbca0173b9a2bd61ee4e2629ceb798be5e12a42c020154755e2" }, { username: "hr_ts4", hash: "5b5192b23863379df80976f61c3fcc67423f27c789b6a8ce66b60a994518e354" }, { username: "hr_ts9", hash: "05aa6694ff6fac17c8037cb5bb2f48efddd0ef7facebdb98fc894a2817250dbe" }, { username: "hr_ap2", hash: "7d83dd9ada08d5392ecf713c62a56371dac17fee08ebe839c4062e97af1e74c9" }] }   // Attendance app: HO HR (all factories) + one HR login per factory; passwords kept as SHA-256 hashes
};

async function sha256Hex(text) {
    try {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    } catch (e) { return ""; }
}
    

// DOM elements
const navbarMenu = document.querySelector(".navbar .links");
const hamburgerBtn = document.querySelector(".hamburger-btn");
const hideMenuBtn = navbarMenu?.querySelector(".close-btn");
const showPopupBtn = document.querySelector(".login-btn");
const formPopup = document.querySelector(".form-popup");
const hidePopupBtn = formPopup?.querySelector(".close-btn");
const loginForm = document.getElementById("login-form");
const loginButton = document.getElementById("login-button");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const usernameError = document.getElementById("username-error");
const passwordError = document.getElementById("password-error");

// Initialize application
function initApp() {
    if (hamburgerBtn && hideMenuBtn) {
        hamburgerBtn.addEventListener("click", () => {
            navbarMenu.classList.toggle("show-menu");
        });

        hideMenuBtn.addEventListener("click", () => hamburgerBtn.click());
    }

    if (showPopupBtn) {
        showPopupBtn.addEventListener("click", () => {
            document.body.classList.add("show-popup");
        });
    }

    if (hidePopupBtn) {
        hidePopupBtn.addEventListener("click", () => {
            document.body.classList.remove("show-popup");
            resetForm();
        });
    }

    document.addEventListener("click", (e) => {
        if (e.target === document.body && document.body.classList.contains("show-popup")) {
            document.body.classList.remove("show-popup");
            resetForm();
        }
    });

    if (loginForm) {
        loginForm.addEventListener("submit", function(e) {
            e.preventDefault();
            handleLogin();
        });
    }

    if (usernameInput) usernameInput.addEventListener("input", validateUsername);
    if (passwordInput) passwordInput.addEventListener("input", validatePassword);

    // Show login popup on page load
    window.addEventListener('load', () => {
        setTimeout(() => {
            document.body.classList.add("show-popup");
        }, 2000);
    });
}

// Validation functions
function validateUsername() {
    const username = usernameInput.value.trim();
    const usernameField = usernameInput.parentElement;
    
    if (username.length < 2) {
        usernameField.classList.add("error");
        usernameError.style.display = "block";
        return false;
    } else {
        usernameField.classList.remove("error");
        usernameError.style.display = "none";
        return true;
    }
}

function validatePassword() {
    const password = passwordInput.value;
    const passwordField = passwordInput.parentElement;
    
    if (password.length < 3) {
        passwordField.classList.add("error");
        passwordError.style.display = "block";
        return false;
    } else {
        passwordField.classList.remove("error");
        passwordError.style.display = "none";
        return true;
    }
}

// Main login function
function handleLogin() {
    const isUsernameValid = validateUsername();
    const isPasswordValid = validatePassword();

    if (isUsernameValid && isPasswordValid) {
        loginButton.classList.add("loading");
        loginButton.disabled = true;

        setTimeout(async () => {
            const username = usernameInput.value;
            const password = passwordInput.value;
            const passHash = await sha256Hex(password);
            let authenticated = false;

            for (const group in userGroups) {
                const matchedUser = userGroups[group].users.find(user =>
                    user.username === username && (user.hash ? (passHash !== "" && user.hash === passHash) : user.password === password)
                );

                if (matchedUser) {
                    if (userGroups[group].redirect === 'att.html') sessionStorage.setItem('attKey', await sha256Hex(password + ':tspl-att'));
                    sessionStorage.setItem('userLoggedIn', JSON.stringify({
                        username,
                        redirect: userGroups[group].redirect
                    }));

                    if (userGroups[group].target === "_blank") {
                        window.open(userGroups[group].redirect, "_blank");
                    } else {
                        window.location.href = userGroups[group].redirect;
                    }
                    authenticated = true;
                    break;
                }
            }

            if (!authenticated) {
                alert("Invalid username or password.");
                loginButton.classList.remove("loading");
                loginButton.disabled = false;
            }
        }, 1500);
    } else {
        if (!isUsernameValid) usernameInput.focus();
        else if (!isPasswordValid) passwordInput.focus();
    }
}

// Reset form function
function resetForm() {
    if (loginForm) {
        loginForm.reset();
        usernameInput.parentElement.classList.remove("error");
        passwordInput.parentElement.classList.remove("error");
        usernameError.style.display = "none";
        passwordError.style.display = "none";
        loginButton.classList.remove("loading");
        loginButton.disabled = false;
    }
}

// Check if the user is logged in (for other pages)
function checkLogin() {
    const userData = sessionStorage.getItem('userLoggedIn');
    if (!userData) {
        window.location.href = "index.html";
        return;
    }
    const user = JSON.parse(userData);
    const currentPage = window.location.pathname.split('/').pop();
    if (user.redirect !== currentPage) {
        window.location.href = user.redirect;
    }
}

// Initialize the application when DOM is loaded

document.addEventListener('DOMContentLoaded', initApp);




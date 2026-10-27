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
    users20: { redirect: "dept_fsa.html", users: [{ username: "sathish", password: "2008" }] }
};
    

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

        setTimeout(() => {
            const username = usernameInput.value;
            const password = passwordInput.value;
            let authenticated = false;

            for (const group in userGroups) {
                const matchedUser = userGroups[group].users.find(user =>
                    user.username === username && user.password === password
                );

                if (matchedUser) {
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




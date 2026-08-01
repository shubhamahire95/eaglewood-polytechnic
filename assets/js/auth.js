import {
    signInWithAdminAuth,
    hasAdminSession,
    purgeSupabaseAuthStorage,
} from "./supabase.js";

const loginBtn = document.getElementById("loginBtn");
const msg = document.getElementById("msg");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

if (!loginBtn || !msg || !emailInput || !passwordInput) {
    throw new Error("Admin login form elements missing.");
}

initLogin();

async function initLogin() {
    purgeSupabaseAuthStorage();
    loginBtn.addEventListener("click", login);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Enter") login();
    });

    try {
        if (await hasAdminSession()) {
            window.location.replace("index.html");
        }
    } catch (err) {
        console.error("[Auth] session restore failed:", err);
    }
}

async function login() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    msg.textContent = "";
    if (!email || !password) {
        msg.textContent = "Enter email and password.";
        return;
    }

    setLoading(true);

    try {
        const result = await signInWithAdminAuth(email, password);
        if (!result.ok) {
            msg.textContent = result.message || "Invalid login credentials.";
            return;
        }

        window.location.replace("index.html");
    } catch (err) {
        console.error("[Auth] login failed:", err);
        msg.textContent = "Connection error. Check your internet connection and try again.";
    } finally {
        setLoading(false);
    }
}

function setLoading(isLoading) {
    loginBtn.disabled = isLoading;
    loginBtn.textContent = isLoading ? "Signing in..." : "Login";
}

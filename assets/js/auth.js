import {
    supabase,
    ensureCmsReady,
    safeAdminSelect,
    isAuthConfigured,
    verifyLegacyAdmin,
    getAdminLoginRoute,
    buildAdminUserFilter,
} from "./supabase.js";

const loginBtn = document.getElementById("loginBtn");
const msg = document.getElementById("msg");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

if (!loginBtn || !msg || !emailInput || !passwordInput) {
    throw new Error("Admin login form elements are missing.");
}

initLogin();

async function initLogin() {
    try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
            await ensureCmsReady();
            const admin = await resolveAdminRecord(sessionData.session.user);
            if (admin) {
                storeAdmin(admin, sessionData.session.user, "supabase");
                window.location.replace("index.html");
                return;
            }
            await supabase.auth.signOut();
            localStorage.removeItem("admin");
        }
    } catch (error) {
        console.warn("Session check skipped:", error?.message || error);
    }

    loginBtn.addEventListener("click", login);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Enter") login();
    });
}

async function login() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    msg.textContent = "";
    if (!email || !password) {
        msg.textContent = "Enter email and password.";
        return;
    }

    setLoading(true);

    try {
        await ensureCmsReady();

        const route = await getAdminLoginRoute(email);

        if (route === "legacy" || route === "unknown") {
            const legacyResult = await signInWithLegacy(email, password);
            if (legacyResult.ok) {
                window.location.replace("index.html");
                return;
            }
            if (route === "legacy") {
                msg.textContent = legacyResult.message;
                return;
            }
        }

        if (route === "auth" && isAuthConfigured()) {
            const authResult = await signInWithAuth(email, password);
            if (authResult.ok) {
                window.location.replace("index.html");
                return;
            }

            if (authResult.allowLegacyFallback) {
                const legacyResult = await signInWithLegacy(email, password);
                if (legacyResult.ok) {
                    window.location.replace("index.html");
                    return;
                }
                msg.textContent = pickLoginMessage(authResult.message, legacyResult.message);
                return;
            }

            msg.textContent = authResult.message;
            return;
        }

        if (!isAuthConfigured()) {
            const legacyResult = await signInWithLegacy(email, password);
            if (legacyResult.ok) {
                window.location.replace("index.html");
                return;
            }
            msg.textContent = legacyResult.message || "Auth not configured.";
            return;
        }

        const legacyResult = await signInWithLegacy(email, password);
        if (legacyResult.ok) {
            window.location.replace("index.html");
            return;
        }
        msg.textContent = legacyResult.message || "Invalid password.";
    } catch {
        msg.textContent = "Connection error. Check your internet connection and try again.";
    } finally {
        setLoading(false);
    }
}

async function signInWithAuth(email, password) {
    if (!isAuthConfigured()) {
        return { ok: false, message: "Auth not configured.", allowLegacyFallback: true };
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            const mapped = mapAuthError(error);
            return {
                ok: false,
                message: mapped.message,
                allowLegacyFallback: mapped.allowLegacyFallback,
            };
        }

        if (!data?.user) {
            return { ok: false, message: "Invalid password.", allowLegacyFallback: true };
        }

        const admin = await resolveAdminRecord(data.user);
        if (!admin) {
            await supabase.auth.signOut();
            localStorage.removeItem("admin");
            return { ok: false, message: "Admin profile missing.", allowLegacyFallback: false };
        }

        storeAdmin(admin, data.user, "supabase");
        return { ok: true };
    } catch {
        return { ok: false, message: "Connection error. Check your internet connection and try again.", allowLegacyFallback: false };
    }
}

async function signInWithLegacy(email, password) {
    const verified = await verifyLegacyAdmin(email, password);

    if (!verified.ok) {
        if (verified.reason === "inactive") {
            return { ok: false, message: "This admin account is inactive. Contact the institute administrator." };
        }
        if (verified.reason === "missing_table" || verified.reason === "not_configured" || verified.reason === "schema_incomplete") {
            return { ok: false, message: "Database schema is incomplete. Run supabase/RUN_ALL_MIGRATIONS.sql in the Supabase SQL Editor." };
        }
        return { ok: false, message: "Invalid password." };
    }

    const row = verified.admin;
    const admin = normalizeAdminRow(row);

    if (isAuthConfigured()) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && data?.user) {
            const linked = await resolveAdminRecord(data.user);
            if (linked) {
                storeAdmin(linked, data.user, "supabase");
                return { ok: true };
            }
        }
    }

    storeAdmin(
        admin,
        { id: admin.auth_user_id || null, email: admin.email, user_metadata: { name: admin.name } },
        "legacy",
    );
    return {
        ok: true,
        limited: true,
        message: "Signed in with legacy credentials. Link Supabase Auth for full CRUD access.",
    };
}

async function resolveAdminRecord(user) {
    const { data, ok } = await safeAdminSelect("admins", (q) => q.select("*").or(buildAdminUserFilter(user)).limit(5), []);
    if (!ok || !data?.length) return null;

    const row = data.find(isActiveAdminRow);
    return row ? normalizeAdminRow(row) : null;
}

function isActiveAdminRow(row) {
    if (row.status) return row.status === "active";
    if (typeof row.active === "boolean") return row.active;
    return true;
}

function normalizeAdminRow(row) {
    return {
        id: row.id,
        auth_user_id: row.auth_user_id || null,
        email: row.email,
        name: row.name || row.email,
        role: row.role || "admin",
        status: row.status || (row.active === false ? "inactive" : "active"),
    };
}

function mapAuthError(error) {
    if (!error) {
        return { message: "Invalid password.", allowLegacyFallback: true };
    }

    const code = String(error.code || error.error_code || "").toLowerCase();
    const message = String(error.message || error.msg || "").toLowerCase();

    if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
        return { message: "Email not confirmed.", allowLegacyFallback: false };
    }

    if (
        code === "invalid_credentials"
        || message.includes("invalid login credentials")
        || message.includes("invalid credentials")
    ) {
        return { message: "Invalid password.", allowLegacyFallback: true };
    }

    if (code === "user_banned" || message.includes("banned") || message.includes("disabled")) {
        return { message: "This account has been disabled. Contact the institute administrator.", allowLegacyFallback: false };
    }

    if (code === "too_many_requests" || message.includes("too many")) {
        return { message: "Too many attempts. Please wait a minute and try again.", allowLegacyFallback: false };
    }

    if (message.includes("invalid api key") || message.includes("auth") && message.includes("not configured")) {
        return { message: "Auth not configured.", allowLegacyFallback: true };
    }

    return { message: "Unable to sign in. Please verify your credentials.", allowLegacyFallback: false };
}

function pickLoginMessage(authMessage, legacyMessage) {
    if (legacyMessage === "Admin profile missing." && authMessage === "Invalid password.") {
        return "Admin profile missing.";
    }
    if (legacyMessage === "Invalid password." && authMessage === "Invalid password.") {
        return "Invalid password.";
    }
    if (legacyMessage && legacyMessage !== "Invalid password.") return legacyMessage;
    return authMessage || legacyMessage || "Unable to sign in.";
}

function storeAdmin(admin, user, mode = "supabase") {
    localStorage.setItem("admin", JSON.stringify({
        id: admin.id,
        auth_user_id: admin.auth_user_id || user?.id || null,
        email: admin.email || user?.email,
        name: admin.name || user?.user_metadata?.name || admin.email || user?.email,
        role: admin.role || "admin",
        status: admin.status || "active",
        auth_mode: mode,
    }));
}

function setLoading(isLoading) {
    loginBtn.disabled = isLoading;
    loginBtn.textContent = isLoading ? "Signing in..." : "Login";
}

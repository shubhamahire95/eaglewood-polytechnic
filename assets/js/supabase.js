import CONFIG from "./config.js";
import { probeRpcCapabilities, isRpcDeployed, clearRpcCapabilities, markRpcDeployed } from "./rpc-capabilities.js";

const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";
const CDN_URLS = [
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
    "https://unpkg.com/@supabase/supabase-js@2",
];

const CLIENT_KEY = "__eaglewoodSupabaseClient";
const LOADER_KEY = "__eaglewoodSupabaseLoader";
const STATUS_KEY = "ew_cms_status";
const SCHEMA_CAPS_KEY = "ew_schema_caps";
const LEGACY_SESSION_KEY = "ew_admin_session";
const LEGACY_CREDS_KEY = "ew_admin_legacy_creds";
const LOCAL_ADMIN_SESSION_KEY = "ew_local_admin_session";
const AUTH_STORAGE_KEY = CONFIG.auth?.storageKey || "ew-supabase-auth";
const CMS_SYNC_KEY = "ew_cms_updated_at";
const WRITE_PROBE_KEY = "ew_admin_write_probe";
const WRITE_PROBE_TTL_MS = 10 * 60 * 1000;
const LEGACY_SESSION_HEADER = "x-legacy-admin-session";
const ADMIN_EMAIL_HEADER = "x-admin-email";
const ADMIN_PASSWORD_HEADER = "x-admin-password";

const PUBLIC_INSERT_TABLES = new Set(["inquiries", "admissions", "contacts"]);

/** Tables that include a display_order column (form tables do not). */
export const TABLES_WITH_DISPLAY_ORDER = new Set([
    "settings",
    "home_slides",
    "updates",
    "notices",
    "principal_message",
    "courses",
    "departments",
    "faculty",
    "facilities",
    "placements",
    "gallery",
    "ai_knowledge_base",
    "ai_prompts",
    "footer_blocks",
    "media_library",
]);

export function tableHasDisplayOrder(table) {
    return TABLES_WITH_DISPLAY_ORDER.has(table);
}

/** PostgREST order clause — never use display_order on tables without that column. */
export function restOrderQuery(table) {
    if (tableHasDisplayOrder(table)) {
        return "order=display_order.asc.nullslast&order=created_at.desc";
    }
    return "order=created_at.desc";
}

/** Anon/public REST headers only — no admin credentials or user JWT. */
export function buildPublicAuthHeaders(extra = {}) {
    return {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
        ...extra,
    };
}

const EMAIL_NOT_CONFIRMED_MESSAGE =
    "Your administrator account has not been confirmed yet. "
    + "Please confirm the email in Supabase Authentication or disable email confirmation for development.";

/** No-op storage prevents Supabase Auth from persisting or refreshing sessions. */
const NOOP_AUTH_STORAGE = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
};

export function isDevelopmentEnv() {
    const env = String(CONFIG.env || "").toLowerCase();
    if (env === "development") return true;
    if (env === "production") return false;
    if (typeof location !== "undefined") {
        const host = location.hostname;
        return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
    }
    return false;
}

/** Dev-only legacy RPC fallback — never enabled in production. */
export function isDevLegacyFallbackEnabled() {
    return isDevelopmentEnv() && CONFIG.auth?.devLegacyFallback === true;
}

/** Legacy-only admin login — no Supabase Auth. */
export function isLegacyAuthOnly() {
    return CONFIG.auth?.mode === "legacy" || CONFIG.auth?.supabaseAuth === false;
}

/** Remove stale Supabase Auth keys that trigger /auth/v1/* requests. */
export function purgeSupabaseAuthStorage() {
    try {
        const remove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (
                key === AUTH_STORAGE_KEY
                || key.includes("auth-token")
                || key.startsWith("sb-")
            ) {
                remove.push(key);
            }
        }
        remove.forEach((key) => localStorage.removeItem(key));
    } catch {
        /* ignore */
    }
}

if (isLegacyAuthOnly()) {
    purgeSupabaseAuthStorage();
}

/** Legacy admins.password login via verify_legacy_admin. */
export function isLegacyPasswordLoginEnabled() {
    return isLegacyAuthOnly() || CONFIG.auth?.legacyPasswordLogin !== false;
}

function createLocalAdminSession(admin, email, password) {
    const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
    try {
        sessionStorage.setItem(LOCAL_ADMIN_SESSION_KEY, JSON.stringify({
            id: admin.id,
            email: admin.email,
            expires_at: expiresAt,
        }));
    } catch {
        /* ignore */
    }
    storeLegacyCredentials(email, password);
    storeAdminProfile({ ...admin, devLegacy: true });
}

function getLocalAdminSession() {
    try {
        const raw = sessionStorage.getItem(LOCAL_ADMIN_SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.id) return null;
        if (parsed.expires_at && Date.now() > parsed.expires_at) {
            sessionStorage.removeItem(LOCAL_ADMIN_SESSION_KEY);
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

function clearLocalAdminSession() {
    try {
        sessionStorage.removeItem(LOCAL_ADMIN_SESSION_KEY);
    } catch {
        /* ignore */
    }
}

function storeLegacyCredentials(email, password) {
    try {
        sessionStorage.setItem(LEGACY_CREDS_KEY, JSON.stringify({ email: email.trim(), password }));
    } catch {
        /* ignore */
    }
}

export function loadLegacyCredentials() {
    try {
        const raw = sessionStorage.getItem(LEGACY_CREDS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed?.email && parsed?.password) return parsed;
    } catch {
        /* ignore */
    }
    return null;
}

function clearLegacyCredentials() {
    try {
        sessionStorage.removeItem(LEGACY_CREDS_KEY);
    } catch {
        /* ignore */
    }
}

function getLegacySessionToken() {
    try {
        const raw = localStorage.getItem(LEGACY_SESSION_KEY);
        if (!raw) return "";
        const parsed = JSON.parse(raw);
        if (parsed?.token) return String(parsed.token);
        return String(raw);
    } catch {
        return localStorage.getItem(LEGACY_SESSION_KEY) || "";
    }
}

function setLegacySessionToken(token, expiresAt = "") {
    localStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify({
        token,
        expires_at: expiresAt,
    }));
}

function buildClientOptions() {
    const headers = {};
    const legacyToken = getLegacySessionToken();
    if (legacyToken) headers[LEGACY_SESSION_HEADER] = legacyToken;
    const creds = loadLegacyCredentials();
    if (creds?.email && creds?.password) {
        headers[ADMIN_EMAIL_HEADER] = creds.email;
        headers[ADMIN_PASSWORD_HEADER] = creds.password;
    }
    const authOptions = isLegacyAuthOnly()
        ? {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storage: NOOP_AUTH_STORAGE,
            storageKey: AUTH_STORAGE_KEY,
        }
        : {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            storageKey: AUTH_STORAGE_KEY,
        };
    return { auth: authOptions, global: { headers } };
}

function getClientHeaderFingerprint() {
    const creds = loadLegacyCredentials();
    return `${getLegacySessionToken() || ""}:${creds?.email || ""}:${creds?.password || ""}`;
}

/** Build REST headers for admin writes — single auth path for REST + storage. */
export function buildAdminAuthHeaders(extra = {}) {
    const headers = {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
        ...extra,
    };
    const legacyToken = getLegacySessionToken();
    if (legacyToken) headers[LEGACY_SESSION_HEADER] = legacyToken;
    const creds = loadLegacyCredentials();
    if (creds?.email && creds?.password) {
        headers[ADMIN_EMAIL_HEADER] = creds.email;
        headers[ADMIN_PASSWORD_HEADER] = creds.password;
    }
    return headers;
}

function isJwtAuthError(error) {
    const status = Number(error?.status || error?.statusCode || 0);
    const code = String(error?.code || "");
    const msg = String(error?.message || "").toLowerCase();
    return status === 401 || code === "PGRST301" || msg.includes("jwt");
}

/** Drop stale Supabase Auth JWTs that cause 401 on REST (legacy admin uses publishable key only). */
export async function ensureCleanRestAuth() {
    purgeSupabaseAuthStorage();
    try {
        if (window[CLIENT_KEY]?.auth) {
            await window[CLIENT_KEY].auth.signOut({ scope: "local" });
        }
    } catch {
        /* ignore */
    }
    await refreshSupabaseClient();
}

/** Admin SELECT via PostgREST fetch — uses legacy header auth, never a stale user JWT. */
async function adminRestSelect(table, { publishedOnly = false, limit = 250 } = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${limit}`;
    if (publishedOnly) url += "&published=eq.true";
    url += `&${restOrderQuery(table)}`;
    const res = await fetch(url, { headers: buildAdminAuthHeaders() });
    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = null;
    }
    if (!res.ok) {
        return {
            ok: false,
            data: [],
            reason: isJwtAuthError({ status: res.status, message: data?.message, code: data?.code })
                ? "auth"
                : (res.status === 401 || res.status === 403 || String(data?.code) === "42501" ? "permission" : "error"),
            error: { message: data?.message || text, code: data?.code, status: res.status },
        };
    }
    return { ok: true, data: Array.isArray(data) ? data : [] };
}

/** Admin table write via PostgREST fetch — guarantees auth headers on every request. */
async function adminRestRequest(method, table, { payload, match, prefer } = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}`;
    if (match && typeof match === "object") {
        const params = Object.entries(match).map(
            ([key, value]) => `${encodeURIComponent(key)}=eq.${encodeURIComponent(value)}`,
        );
        if (params.length) url += `?${params.join("&")}`;
    }
    const headers = buildAdminAuthHeaders({
        Prefer: prefer || (method === "POST" ? "return=representation" : "return=minimal"),
    });
    const init = { method, headers };
    if (payload !== undefined) init.body = JSON.stringify(payload);
    const res = await fetch(url, init);
    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = text;
    }
    if (!res.ok) {
        return {
            ok: false,
            error: { message: data?.message || text, code: data?.code, status: res.status },
            data: null,
        };
    }
    if (method === "POST" && Array.isArray(data)) {
        return { ok: true, data: data[0] ?? null };
    }
    return { ok: true, data };
}

const CMS_STORAGE_BUCKET = CONFIG.cms?.storageBucket || "cms";

/** Public URL for a CMS storage object path. */
export function getCmsStoragePublicUrl(path) {
    const clean = String(path || "").replace(/^\/+/, "");
    return `${SUPABASE_URL}/storage/v1/object/public/${CMS_STORAGE_BUCKET}/${clean}`;
}

function encodeStoragePath(path) {
    return String(path || "")
        .split("/")
        .filter(Boolean)
        .map((part) => encodeURIComponent(part))
        .join("/");
}

function parseStorageError(status, text, data) {
    const message = data?.message || data?.error || text || "Storage request failed";
    const code = data?.code || data?.statusCode || "";
    const lower = String(message).toLowerCase();
    const permission = status === 401 || status === 403
        || lower.includes("policy")
        || lower.includes("row-level security")
        || lower.includes("accessdenied")
        || code === "AccessDenied";
    return { message, code, status, permission };
}

/** Upload file to CMS storage via REST with admin auth headers. */
export async function adminStorageUpload(path, file, { upsert = false } = {}) {
    if (!(await prepareAdminWriteRequest())) {
        return { ok: false, reason: "permission", error: { message: "Admin session required" } };
    }
    const encoded = encodeStoragePath(path);
    const url = `${SUPABASE_URL}/storage/v1/object/${CMS_STORAGE_BUCKET}/${encoded}`;
    const headers = buildAdminAuthHeaders({
        "Content-Type": file?.type || "application/octet-stream",
        "Cache-Control": "3600",
    });
    if (upsert) headers["x-upsert"] = "true";
    delete headers.Prefer;

    try {
        const res = await fetch(url, { method: "POST", headers, body: file });
        const text = await res.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
        if (!res.ok) {
            const err = parseStorageError(res.status, text, data);
            return { ok: false, reason: err.permission ? "permission" : "error", error: err };
        }
        return { ok: true, path, publicUrl: getCmsStoragePublicUrl(path), data };
    } catch (err) {
        return { ok: false, reason: "network", error: { message: err?.message || "Network error" } };
    }
}

/** Remove file(s) from CMS storage via REST with admin auth headers. */
export async function adminStorageRemove(paths) {
    if (!(await prepareAdminWriteRequest())) {
        return { ok: false, reason: "permission", error: { message: "Admin session required" } };
    }
    const list = (Array.isArray(paths) ? paths : [paths]).filter(Boolean);
    if (!list.length) return { ok: true };

    const headers = buildAdminAuthHeaders({ "Content-Type": "application/json" });
    delete headers.Prefer;

    try {
        for (const path of list) {
            const encoded = encodeStoragePath(path);
            const url = `${SUPABASE_URL}/storage/v1/object/${CMS_STORAGE_BUCKET}/${encoded}`;
            const res = await fetch(url, { method: "DELETE", headers });
            if (!res.ok && res.status !== 404) {
                const text = await res.text();
                let data = null;
                try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
                const err = parseStorageError(res.status, text, data);
                return { ok: false, reason: err.permission ? "permission" : "error", error: err };
            }
        }
        return { ok: true };
    } catch (err) {
        return { ok: false, reason: "network", error: { message: err?.message || "Network error" } };
    }
}

function loadWriteProbeCache() {
    try {
        const raw = sessionStorage.getItem(WRITE_PROBE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.at || Date.now() - parsed.at > WRITE_PROBE_TTL_MS) {
            sessionStorage.removeItem(WRITE_PROBE_KEY);
            return null;
        }
        if (parsed.fingerprint !== getClientHeaderFingerprint()) return null;
        return parsed.result ?? null;
    } catch {
        return null;
    }
}

function saveWriteProbeCache(result) {
    try {
        sessionStorage.setItem(WRITE_PROBE_KEY, JSON.stringify({
            at: Date.now(),
            fingerprint: getClientHeaderFingerprint(),
            result,
        }));
    } catch {
        /* ignore */
    }
}

/** Clear cached write-permission probe (login, logout, after migration). */
export function clearAdminWriteProbeCache() {
    try {
        sessionStorage.removeItem(WRITE_PROBE_KEY);
    } catch {
        /* ignore */
    }
}

/** Lightweight permission check — calls is_admin() RPC with admin headers (no table writes). */
async function fetchIsAdminViaRpc() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
            method: "POST",
            headers: buildAdminAuthHeaders(),
            body: "{}",
        });
        if (!res.ok) {
            return { ok: false, admin: false, status: res.status };
        }
        const text = (await res.text()).trim().toLowerCase();
        return { ok: true, admin: text === "true" };
    } catch {
        return { ok: false, admin: false };
    }
}

/** Probe whether admin credentials pass RLS (cached; never INSERTs probe rows). */
export async function probeAdminWriteAccess(options = {}) {
    const { force = false } = options;
    if (!(await prepareAdminWriteRequest())) {
        return { ok: false, reason: "no_credentials" };
    }
    if (!force) {
        const cached = loadWriteProbeCache();
        if (cached) return cached;
    }
    const rpc = await fetchIsAdminViaRpc();
    if (rpc.ok && rpc.admin) {
        const result = { ok: true };
        saveWriteProbeCache(result);
        return result;
    }
    const result = {
        ok: false,
        reason: "permission",
        error: { message: "is_admin() returned false" },
    };
    saveWriteProbeCache(result);
    return result;
}

/** Notify open public pages that CMS data changed (cross-tab sync). */
export function notifyCmsDataChanged() {
    clearCmsQueryCache();
    try {
        localStorage.setItem(CMS_SYNC_KEY, String(Date.now()));
    } catch {
        /* ignore */
    }
}

let schemaCaps = null;
let lastConnectionDiagnostics = null;

/**
 * Tables in supabase/migrations/001_eaglewood_cms.sql — the ONLY tables queried by JS.
 * See supabase/TABLES.md for the full manifest.
 */
export const CMS_TABLES = new Set([
    "admins",
    "settings",
    "home_slides",
    "updates",
    "notices",
    "principal_message",
    "courses",
    "departments",
    "faculty",
    "facilities",
    "placements",
    "gallery",
    "media_library",
    "footer_blocks",
    "inquiries",
    "admissions",
    "contacts",
    "ai_knowledge_base",
    "ai_prompts",
    "ai_conversations",
]);

const queryCache = new Map();
const tableStatus = new Map();
let cmsReadyPromise = null;
let cmsFullyMissing = false;
let cmsAdminMode = false;
/** Tracks admin header creds on the cached Supabase client (see getClientHeaderFingerprint). */
let clientHeaderFingerprint = "";

/** Enable full CMS queries on admin pages (even before connection is confirmed). */
export function setCmsAdminMode(enabled) {
    cmsAdminMode = Boolean(enabled);
}

export function cmsEnabled() {
    return CONFIG.cms?.enabled === true;
}

function markAllMissing() {
    cmsFullyMissing = true;
    CMS_TABLES.forEach((t) => tableStatus.set(t, "missing"));
}

function cachedStatus() {
    try {
        return sessionStorage.getItem(STATUS_KEY);
    } catch {
        return null;
    }
}

function setCachedStatus(value) {
    try {
        sessionStorage.setItem(STATUS_KEY, value);
    } catch {
        /* ignore */
    }
}

/** True when CMS is enabled AND full schema (settings) is reachable. */
export function isCmsAvailable() {
    return cmsEnabled() && !cmsFullyMissing && cachedStatus() === "ready";
}

/** When true, public pages must render CMS data only — no local fallback/demo content. */
export function isCmsStrictMode() {
    return cmsEnabled() && !cmsFullyMissing && cachedStatus() !== "unavailable";
}

/** True when at least admins table is reachable (auth bootstrap). */
export function isAuthBootstrapReady() {
    const status = cachedStatus();
    return cmsEnabled() && (status === "ready" || status === "partial");
}

/** Human-readable CMS state for admin UI. */
export function getCmsStatusLabel() {
    if (!cmsEnabled()) return "Not configured";
    if (cmsFullyMissing || cachedStatus() === "unavailable") return "Database not set up";
    if (cachedStatus() === "ready") return "Connected";
    if (cachedStatus() === "partial") return "Setup required";
    return "Checking…";
}

export function getMissingTables() {
    return [...CMS_TABLES].filter((t) => tableStatus.get(t) === "missing");
}

export function getCmsTableStats() {
    const missing = getMissingTables();
    const total = CMS_TABLES.size;
    return { total, found: total - missing.length, missing };
}

export function getLastConnectionDiagnostics() {
    return lastConnectionDiagnostics;
}

/** Clear in-memory query cache so public pages pick up fresh CMS data. */
export function clearCmsQueryCache() {
    queryCache.clear();
}

/** Clear cached probe result (e.g. after running migration). */
export function resetCmsStatus() {
    try {
        sessionStorage.removeItem(STATUS_KEY);
        sessionStorage.removeItem(SCHEMA_CAPS_KEY);
    } catch {
        /* ignore */
    }
    cmsReadyPromise = null;
    cmsFullyMissing = false;
    schemaCaps = null;
    lastConnectionDiagnostics = null;
    tableStatus.clear();
    clearCmsQueryCache();
    clearRpcCapabilities();
    clearAdminWriteProbeCache();
}

function loadSchemaCaps() {
    if (schemaCaps) return schemaCaps;
    try {
        const raw = sessionStorage.getItem(SCHEMA_CAPS_KEY);
        if (raw) schemaCaps = JSON.parse(raw);
    } catch {
        /* ignore */
    }
    return schemaCaps;
}

function saveSchemaCaps(caps) {
    schemaCaps = caps;
    try {
        sessionStorage.setItem(SCHEMA_CAPS_KEY, JSON.stringify(caps));
    } catch {
        /* ignore */
    }
}

function isMissingColumnError(error) {
    const code = String(error?.code || "");
    const msg = String(error?.message || error?.details || "").toLowerCase();
    return code === "42703" || (msg.includes("column") && msg.includes("does not exist"));
}

function isMissingRpcError(error) {
    const code = String(error?.code || "");
    return code === "PGRST202";
}

function getProjectIdFromUrl(url = SUPABASE_URL) {
    try {
        return new URL(url).hostname.split(".")[0] || url;
    } catch {
        return url;
    }
}

function tableProbeResult(error) {
    if (!error) return "ok";
    if (isMissingTableError(error)) return "missing";
    return "error";
}

/** Admin-only connection diagnostics — logs URL, project, per-table status, storage, RPC. */
export async function logCmsConnectionDiagnostics() {
    const projectId = getProjectIdFromUrl();
    const tableResults = {};
    const tables = [...CMS_TABLES];

    await Promise.all(tables.map(async (table) => {
        try {
            const { error } = await supabase.from(table).select("id").limit(1);
            tableResults[table] = tableProbeResult(error);
            if (tableResults[table] === "ok") tableStatus.set(table, "ok");
            else if (tableResults[table] === "missing") tableStatus.set(table, "missing");
        } catch {
            tableResults[table] = "error";
        }
    }));

    let storage = { ok: false, detail: "unknown" };
    try {
        const { data, error } = await supabase.storage.from(CONFIG.cms?.storageBucket || "cms").list("", { limit: 1 });
        storage = { ok: !error, detail: error ? String(error.message || error) : `${data?.length ?? 0} object(s) visible` };
    } catch (err) {
        storage = { ok: false, detail: String(err?.message || err) };
    }

    let rpc = { ok: true, detail: "Legacy verify_legacy_admin" };

    const missing = tables.filter((t) => tableResults[t] === "missing");
    const diagnostics = {
        url: SUPABASE_URL,
        projectId,
        tables: tableResults,
        missing,
        storage,
        rpc,
        stats: {
            total: tables.length,
            found: tables.length - missing.length,
        },
    };
    lastConnectionDiagnostics = diagnostics;

    console.group("[CMS] Connection diagnostics");
    console.log("Supabase URL:", SUPABASE_URL);
    console.log("Project ID:", projectId);
    for (const table of tables) {
        const state = tableResults[table];
        console.log(state === "ok" ? `✓ ${table} — Exists` : state === "missing" ? `✗ ${table} — Missing` : `? ${table} — ${state}`);
    }
    console.log("Missing tables:", missing.length ? missing : "[]");
    console.log("Storage bucket:", storage.ok ? "✓ Ready" : `✗ ${storage.detail}`);
    console.log("RPC status:", rpc.ok ? "✓ Ready" : `✗ ${rpc.detail}`);
    console.log(`Tables found: ${diagnostics.stats.found}/${diagnostics.stats.total}`);
    console.groupEnd();

    return diagnostics;
}

/** Probe live schema — re-probes when verifyFull is true and CMS is not confirmed ready. */
export async function probeSchemaCapabilities(options = {}) {
    const { force = false, verifyFull = false } = options;
    const cached = loadSchemaCaps();
    const status = cachedStatus();

    if (cached && !force) {
        const confirmedReady = cached.settings === true && status === "ready";
        if (confirmedReady) return cached;
        if (!verifyFull && cached.admins !== undefined) return cached;
    }

    const caps = {
        admins: cached?.admins ?? false,
        settings: cached?.settings ?? false,
        authUserId: cached?.authUserId ?? false,
        statusColumn: cached?.statusColumn ?? false,
        rpc: cached?.rpc ?? false,
    };

    const needsAdminProbe = force || !cached?.admins;
    if (needsAdminProbe) {
        const { data: adminRows, error: adminError } = await supabase.from("admins").select("*").limit(1);
        caps.admins = !adminError;

        if (caps.admins && adminRows?.length) {
            const row = adminRows[0];
            caps.authUserId = Object.prototype.hasOwnProperty.call(row, "auth_user_id");
            caps.statusColumn = Object.prototype.hasOwnProperty.call(row, "status");
        }
    }

    const needsSettingsProbe = verifyFull && (force || cached?.settings !== true);
    if (needsSettingsProbe) {
        const { error: settingsError } = await supabase.from("settings").select("id").limit(1);
        caps.settings = !settingsError;

        if (!caps.settings) {
            caps.rpc = false;
        }
    }

    saveSchemaCaps(caps);
    return caps;
}

/**
 * Connect CMS for admin dashboard — probes each table independently.
 * Returns { connected, reason?, missing?, stats?, storage?, rpc? }
 */
export async function connectCms(options = {}) {
    const { force = false } = options;

    if (!cmsEnabled()) {
        markAllMissing();
        return { connected: false, reason: "disabled" };
    }

    if (force) {
        cmsReadyPromise = null;
        queryCache.clear();
        try {
            sessionStorage.removeItem(STATUS_KEY);
            sessionStorage.removeItem(SCHEMA_CAPS_KEY);
        } catch {
            /* ignore */
        }
        schemaCaps = null;
        tableStatus.clear();
    }

    setCmsAdminMode(true);

    await probeRpcCapabilities({ force });

    const caps = await probeSchemaCapabilities({ force, verifyFull: true });

    if (!caps.admins) {
        setCachedStatus("unavailable");
        markAllMissing();
        await logCmsConnectionDiagnostics();
        return { connected: false, reason: "no_admins", missing: getMissingTables() };
    }

    tableStatus.set("admins", "ok");
    cmsFullyMissing = false;

    const diagnostics = await logCmsConnectionDiagnostics();
    const missing = getMissingTables();
    const stats = getCmsTableStats();

    if (missing.length === 0) {
        setCachedStatus("ready");
        caps.settings = true;
        saveSchemaCaps(caps);
        return {
            connected: true,
            stats,
            storage: diagnostics.storage,
            rpc: diagnostics.rpc,
        };
    }

    setCachedStatus("partial");
    return {
        connected: false,
        reason: missing.includes("settings") ? "migration_required" : "partial_schema",
        missing,
        stats,
        storage: diagnostics.storage,
        rpc: diagnostics.rpc,
    };
}

/** Probe each CMS table once and cache status (admin health check only). */
export async function probeCmsTableHealth() {
    const tables = [...CMS_TABLES];
    await Promise.all(tables.map(async (table) => {
        try {
            const { error } = await supabase.from(table).select("id").limit(1);
            const result = tableProbeResult(error);
            if (result === "ok") tableStatus.set(table, "ok");
            else if (result === "missing") tableStatus.set(table, "missing");
        } catch {
            /* keep existing status on transient failures */
        }
    }));

    const missing = getMissingTables();
    if (missing.length === 0) {
        setCachedStatus("ready");
        cmsFullyMissing = false;
        const caps = loadSchemaCaps() || {};
        caps.settings = true;
        caps.admins = true;
        saveSchemaCaps(caps);
    } else if (tableStatus.get("admins") === "ok") {
        setCachedStatus("partial");
    }
}

/** True when only legacy `admins` exists (migration not run). */
export function isLegacySchema() {
    const caps = loadSchemaCaps();
    if (caps) return caps.admins && !caps.settings;
    return cachedStatus() === "partial";
}

/** True when login RPCs are available. @deprecated Supabase Auth only — always false. */
export function hasAuthRpc() {
    return false;
}

/** Build admin OR filter without referencing missing columns. */
export function buildAdminUserFilter(user, caps = loadSchemaCaps()) {
    const filters = [`email.eq.${user.email}`];
    if (caps?.authUserId && user.id) {
        filters.push(`auth_user_id.eq.${user.id}`);
    }
    return filters.join(",");
}

/** Columns safe to select from admins on the current schema. */
export function adminSelectColumns(caps = loadSchemaCaps()) {
    const cols = ["id", "email", "name", "role"];
    if (caps?.statusColumn) cols.push("status");
    if (caps?.authUserId) cols.push("auth_user_id");
    return cols.join(",");
}

/**
 * Probe admins table once per session. Settings/RPC are only checked when verifyFull is true.
 * When cms.enabled is false → returns false immediately, ZERO network calls.
 */
export async function ensureCmsReady(options = {}) {
    const { force = false, verifyFull = false } = options;

    if (!cmsEnabled()) {
        markAllMissing();
        return false;
    }

    if (!force && cmsReadyPromise) return cmsReadyPromise;

    cmsReadyPromise = (async () => {
        const status = cachedStatus();
        if (status === "unavailable" && !force) {
            markAllMissing();
            return false;
        }
        if (status === "ready" && !force) {
            cmsFullyMissing = false;
            CMS_TABLES.forEach((t) => {
                if (tableStatus.get(t) !== "missing") tableStatus.set(t, "ok");
            });
            return true;
        }

        const caps = await probeSchemaCapabilities({ force, verifyFull: verifyFull || force });

        if (!caps.admins) {
            setCachedStatus("unavailable");
            markAllMissing();
            return false;
        }

        tableStatus.set("admins", "ok");
        cmsFullyMissing = false;

        await probeRpcCapabilities({ force: force || verifyFull });

        if (verifyFull || force) {
            await probeCmsTableHealth();
        } else if (caps.settings) {
            setCachedStatus("ready");
            tableStatus.set("settings", "ok");
            CMS_TABLES.forEach((t) => {
                if (tableStatus.get(t) !== "missing") tableStatus.set(t, "ok");
            });
            return true;
        }

        if (getMissingTables().length === 0) {
            setCachedStatus("ready");
            return true;
        }

        setCachedStatus("partial");
        return true;
    })();

    return cmsReadyPromise;
}

async function requireCmsReady() {
    if (!cmsEnabled()) return false;
    if (isCmsAvailable()) return true;
    if (cachedStatus() === "partial") return true;
    const ready = await ensureCmsReady();
    if (ready) await probeRpcCapabilities();
    return ready;
}

function isPartialCms() {
    return cachedStatus() === "partial";
}

/** Block reads only when a table is confirmed missing — not when setup is partial. */
function shouldBlockPublicRead(table) {
    return !cmsAdminMode && tableStatus.get(table) === "missing";
}

/** Clear leftover legacy-session artifacts (does not touch Supabase Auth session). */
export function clearLegacyAuthArtifacts() {
    try {
        localStorage.removeItem(LEGACY_SESSION_KEY);
        clearLocalAdminSession();
        clearLegacyCredentials();
    } catch {
        /* ignore */
    }
}

async function verifyLegacyAdminRpc(email, password) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_legacy_admin`, {
            method: "POST",
            headers: {
                apikey: SUPABASE_PUBLISHABLE_KEY,
                Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                p_email: email.trim(),
                p_password: password,
            }),
        });
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }
        if (!res.ok || !data) {
            return { ok: false, reason: "invalid" };
        }
        if (data?.error === "inactive") {
            return { ok: false, reason: "inactive" };
        }
        if (!data?.id || String(data?.status || "active") !== "active") {
            return { ok: false, reason: "inactive" };
        }
        if (data?.session_token) {
            setLegacySessionToken(data.session_token, data.expires_at || "");
            await syncWriteClient();
        }
        return { ok: true, admin: formatAdminProfile(data) };
    } catch {
        return { ok: false, reason: "network" };
    }
}

export async function validateLegacySession() {
    const local = getLocalAdminSession();
    const cached = JSON.parse(localStorage.getItem("admin") || "null");
    const creds = loadLegacyCredentials();
    if (local?.id && cached?.id && String(local.id) === String(cached.id) && cached.status === "active"
        && creds?.email && creds?.password) {
        return formatAdminProfile(cached);
    }
    return null;
}

async function tryLegacyPasswordLogin(email, password) {
    if (!isLegacyPasswordLoginEnabled()) {
        return { ok: false, reason: "disabled" };
    }

    const verified = await verifyLegacyAdminRpc(email, password);
    if (!verified.ok) {
        return { ok: false, message: "Invalid email or password.", code: "invalid_credentials" };
    }

    createLocalAdminSession(verified.admin, email, password);
    clearAdminWriteProbeCache();
    await syncWriteClient();
    return { ok: true, admin: verified.admin, devLegacy: true };
}

/** @deprecated */
async function tryDevLegacyLogin(email, password) {
    return tryLegacyPasswordLogin(email, password);
}

/** @deprecated Use clearLegacyAuthArtifacts */
export function clearStaleSupabaseAuthStorage() {
    clearLegacyAuthArtifacts();
}

function logAuthError(error, context = "") {
    if (!error) return;
    console.error("[Auth] error", context, error);
    console.error("[Auth] status:", error.status);
    console.error("[Auth] code:", error.code || error.error_code);
    console.error("[Auth] message:", error.message || error.msg);
}

function formatAdminProfile(data) {
    return {
        id: data.id,
        auth_user_id: data.auth_user_id,
        email: data.email,
        name: data.name || data.email,
        role: data.role || "admin",
        status: data.status,
    };
}

function mapAuthErrorMessage(error) {
    const code = String(error?.code || error?.error_code || "").toLowerCase();
    const message = String(error?.message || error?.msg || "").toLowerCase();

    if (code === "email_not_confirmed" || message.includes("email not confirmed")) {
        return EMAIL_NOT_CONFIRMED_MESSAGE;
    }
    if (code === "invalid_credentials" || code === "400" && message.includes("invalid login")) {
        return "Invalid email or password.";
    }
    if (code === "user_banned" || message.includes("banned") || message.includes("disabled")) {
        return "This account has been disabled. Contact the institute administrator.";
    }
    if (code === "too_many_requests" || message.includes("too many")) {
        return "Too many attempts. Please wait a minute and try again.";
    }
    return "Unable to sign in. Please verify your credentials and try again.";
}

export function storeAdminProfile(admin) {
    localStorage.setItem("admin", JSON.stringify({
        id: admin.id,
        auth_user_id: admin.auth_user_id,
        email: admin.email,
        name: admin.name || admin.email,
        role: admin.role || "admin",
        status: admin.status || "active",
        devLegacy: Boolean(admin.devLegacy),
    }));
}

export async function getAuthSession() {
    return null;
}

/** @deprecated Legacy mode — Supabase Auth is disabled. */
export async function resolveAdminProfile() {
    return null;
}

export async function signInWithAdminAuth(email, password) {
    purgeSupabaseAuthStorage();
    return tryLegacyPasswordLogin(email, password);
}

export async function signOutAdmin() {
    localStorage.removeItem("admin");
    clearLegacyAuthArtifacts();
    clearAdminWriteProbeCache();
    purgeSupabaseAuthStorage();
    await refreshSupabaseClient();
}

export let supabase = await getSupabaseClient();

export async function refreshSupabaseClient() {
    const fingerprint = getClientHeaderFingerprint();
    if (window[CLIENT_KEY] && clientHeaderFingerprint === fingerprint) {
        supabase = window[CLIENT_KEY];
        return supabase;
    }
    window[CLIENT_KEY] = null;
    clientHeaderFingerprint = "";
    supabase = await getSupabaseClient();
    return supabase;
}

async function syncWriteClient() {
    const fingerprint = getClientHeaderFingerprint();
    if (window[CLIENT_KEY] && clientHeaderFingerprint === fingerprint) {
        return window[CLIENT_KEY];
    }
    return refreshSupabaseClient();
}

async function prepareAdminWriteRequest() {
    if (!(await ensureAdminWriteSession())) return false;
    await syncWriteClient();
    return true;
}

/** Returns a Supabase client with write headers attached, or null when write session is missing. */
export async function getAdminWriteClient() {
    if (!(await prepareAdminWriteRequest())) return null;
    return syncWriteClient();
}

function isMissingTableError(error) {
    const msg = String(error?.message || error?.details || "").toLowerCase();
    const code = String(error?.code || "");
    const status = Number(error?.status || error?.statusCode || 0);
    return (
        status === 404
        || code === "42P01"
        || code === "PGRST205"
        || code === "PGRST204"
        || msg.includes("does not exist")
        || msg.includes("could not find")
        || msg.includes("relation")
        || msg.includes("404")
        || msg.includes("not found")
    );
}

function isPermissionError(error) {
    const msg = String(error?.message || "").toLowerCase();
    return msg.includes("permission") || msg.includes("policy") || msg.includes("jwt") || String(error?.code) === "42501";
}

function notConfiguredResult(fallback = []) {
    return { data: fallback, ok: false, reason: "not_configured" };
}

/**
 * Central data fetch — never throws, never logs console spam.
 * Makes NO network request when CMS is disabled or tables are missing.
 */
export async function safeFetch(table, builder, fallback = [], cacheKey = "") {
    if (!CMS_TABLES.has(table)) {
        return notConfiguredResult(fallback);
    }
    if (!cmsEnabled() || cmsFullyMissing || cachedStatus() === "unavailable") {
        return notConfiguredResult(fallback);
    }
    if (shouldBlockPublicRead(table)) {
        return { data: fallback, ok: false, reason: "missing_table" };
    }
    if (cmsAdminMode && tableStatus.get(table) === "missing") {
        return { data: fallback, ok: false, reason: "missing_table" };
    }

    const key = cacheKey || `fetch:${table}`;
    if (queryCache.has(key)) return queryCache.get(key);

    const request = (async () => {
        if (!(await requireCmsReady())) {
            return { data: fallback, ok: false, reason: "not_configured" };
        }
        if (shouldBlockPublicRead(table)) {
            return { data: fallback, ok: false, reason: "missing_table" };
        }
        try {
            let query = supabase.from(table);
            if (typeof builder === "function") query = builder(query);
            else query = query.select(builder || "*");

            const { data, error, count } = await query;
            if (error) {
                if (isJwtAuthError(error)) {
                    await ensureCleanRestAuth();
                    let retryQuery = supabase.from(table);
                    if (typeof builder === "function") retryQuery = builder(retryQuery);
                    else retryQuery = retryQuery.select(builder || "*");
                    const retry = await retryQuery;
                    if (!retry.error) {
                        tableStatus.set(table, "ok");
                        const rows = retry.data ?? fallback;
                        return { data: rows, ok: true, count: typeof retry.count === "number" ? retry.count : rows?.length };
                    }
                }
                if (isMissingTableError(error)) {
                    tableStatus.set(table, "missing");
                    return { data: fallback, ok: false, reason: "missing_table" };
                }
                if (isPermissionError(error)) {
                    return { data: fallback, ok: false, reason: "permission" };
                }
                return { data: fallback, ok: false, reason: "error" };
            }
            tableStatus.set(table, "ok");
            const rows = data ?? fallback;
            return { data: rows, ok: true, count: typeof count === "number" ? count : rows?.length };
        } catch {
            return { data: fallback, ok: false, reason: "network" };
        }
    })();

    queryCache.set(key, request);
    return request;
}

export async function safeCount(table, cacheKey = "") {
    if (!CMS_TABLES.has(table)) {
        return { count: null, ok: false, reason: "not_configured" };
    }
    if (!cmsEnabled() || cmsFullyMissing || cachedStatus() === "unavailable") {
        return { count: null, ok: false, reason: "not_configured" };
    }
    if (shouldBlockPublicRead(table)) {
        return { count: null, ok: false, reason: "missing_table" };
    }
    if (cmsAdminMode && tableStatus.get(table) === "missing") {
        return { count: null, ok: false, reason: "missing_table" };
    }

    const key = cacheKey || `count:${table}`;
    if (queryCache.has(key)) return queryCache.get(key);

    const request = (async () => {
        if (!(await requireCmsReady())) {
            return { count: null, ok: false, reason: "not_configured" };
        }
        if (shouldBlockPublicRead(table)) {
            return { count: null, ok: false, reason: "missing_table" };
        }
        try {
            const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
            if (error) {
                if (isMissingTableError(error)) {
                    tableStatus.set(table, "missing");
                    return { count: null, ok: false, reason: "missing_table" };
                }
                return { count: null, ok: false, reason: "error" };
            }
            tableStatus.set(table, "ok");
            return { count: count ?? 0, ok: true };
        } catch {
            return { count: null, ok: false, reason: "network" };
        }
    })();

    queryCache.set(key, request);
    return request;
}

export async function safeInsert(table, payload) {
    if (PUBLIC_INSERT_TABLES.has(table)) {
        return safePublicInsert(table, payload);
    }
    if (!CMS_TABLES.has(table)) return { data: null, ok: false, reason: "not_configured" };
    if (!(await requireCmsReady())) return { data: null, ok: false, reason: "not_configured" };
    if (!cmsAdminMode && isPartialCms() && table !== "admins") return { data: null, ok: false, reason: "not_configured" };
    if (!(await prepareAdminWriteRequest())) return { data: null, ok: false, reason: "permission" };
    try {
        const result = await adminRestRequest("POST", table, { payload });
        if (!result.ok) {
            const error = result.error;
            if (isMissingTableError(error)) {
                tableStatus.set(table, "missing");
                return { data: null, ok: false, reason: "missing_table" };
            }
            if (isPermissionError(error)) {
                return { data: null, ok: false, reason: "permission" };
            }
            return { data: null, ok: false, reason: "error" };
        }
        notifyCmsDataChanged();
        return { data: result.data, ok: true };
    } catch {
        return { data: null, ok: false, reason: "network" };
    }
}

/** Public form submissions — no admin session required. Uses isolated REST (no admin headers). */
export async function safePublicInsert(table, payload) {
    if (!PUBLIC_INSERT_TABLES.has(table)) {
        return { data: null, ok: false, reason: "not_configured" };
    }
    if (!(await requireCmsReady())) return { data: null, ok: false, reason: "not_configured" };
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
            method: "POST",
            headers: buildPublicAuthHeaders({ Prefer: "return=representation" }),
            body: JSON.stringify(payload),
        });
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }
        if (!res.ok) {
            const code = String(data?.code || "");
            const msg = String(data?.message || "").toLowerCase();
            if (res.status === 401 || res.status === 403 || code === "42501" || msg.includes("policy")) {
                return { data: null, ok: false, reason: "permission" };
            }
            if (code === "PGRST301" || msg.includes("jwt")) {
                return { data: null, ok: false, reason: "auth" };
            }
            return { data: null, ok: false, reason: "error" };
        }
        const row = Array.isArray(data) ? data[0] : data;
        return { data: row, ok: true };
    } catch {
        return { data: null, ok: false, reason: "network" };
    }
}

export async function safeUpdate(table, payload, match) {
    if (!CMS_TABLES.has(table)) return { ok: false, reason: "not_configured" };
    if (!(await requireCmsReady())) return { ok: false, reason: "not_configured" };
    if (!cmsAdminMode && isPartialCms() && table !== "admins") return { ok: false, reason: "not_configured" };
    if (!(await prepareAdminWriteRequest())) return { ok: false, reason: "permission" };
    try {
        const result = await adminRestRequest("PATCH", table, { payload, match });
        if (!result.ok) {
            const error = result.error;
            if (isMissingTableError(error)) {
                tableStatus.set(table, "missing");
                return { ok: false, reason: "missing_table" };
            }
            return { ok: false, reason: isPermissionError(error) ? "permission" : "error" };
        }
        notifyCmsDataChanged();
        return { ok: true };
    } catch {
        return { ok: false, reason: "network" };
    }
}

export async function safeDelete(table, match) {
    if (!CMS_TABLES.has(table)) return { ok: false, reason: "not_configured" };
    if (!(await requireCmsReady())) return { ok: false, reason: "not_configured" };
    if (!cmsAdminMode && isPartialCms() && table !== "admins") return { ok: false, reason: "not_configured" };
    if (!(await prepareAdminWriteRequest())) return { ok: false, reason: "permission" };
    try {
        const result = await adminRestRequest("DELETE", table, { match });
        if (!result.ok) {
            const error = result.error;
            if (isMissingTableError(error)) {
                tableStatus.set(table, "missing");
                return { ok: false, reason: "missing_table" };
            }
            return { ok: false, reason: isPermissionError(error) ? "permission" : "error" };
        }
        notifyCmsDataChanged();
        return { ok: true };
    } catch {
        return { ok: false, reason: "network" };
    }
}

/** Admin-only direct select — gated, never throws. */
export async function safeAdminSelect(table, builder, fallback = null) {
    if (!CMS_TABLES.has(table)) return { data: fallback, ok: false, reason: "not_configured" };
    if (!(await requireCmsReady())) return { data: fallback, ok: false, reason: "not_configured" };
    if (!cmsAdminMode && isPartialCms() && table !== "admins") return { data: fallback, ok: false, reason: "not_configured" };

    const creds = loadLegacyCredentials();
    if (cmsAdminMode && creds?.email && creds?.password) {
        await ensureCleanRestAuth();
        await syncWriteClient();
        const rest = await adminRestSelect(table, { publishedOnly: false, limit: 250 });
        if (rest.ok) {
            tableStatus.set(table, "ok");
            return { data: rest.data ?? fallback, ok: true };
        }
        if (rest.reason === "auth") {
            await ensureCleanRestAuth();
            const retry = await adminRestSelect(table, { publishedOnly: false, limit: 250 });
            if (retry.ok) {
                tableStatus.set(table, "ok");
                return { data: retry.data ?? fallback, ok: true };
            }
        }
        if (rest.reason === "permission") {
            return { data: fallback ?? [], ok: false, reason: "permission" };
        }
    }

    try {
        await ensureCleanRestAuth();
        let query = supabase.from(table);
        if (typeof builder === "function") query = builder(query);
        else query = query.select(builder || "*");
        const { data, error } = await query;
        if (error) {
            if (isJwtAuthError(error)) {
                await ensureCleanRestAuth();
                let retryQuery = supabase.from(table);
                if (typeof builder === "function") retryQuery = builder(retryQuery);
                else retryQuery = retryQuery.select(builder || "*");
                const retry = await retryQuery;
                if (!retry.error) {
                    tableStatus.set(table, "ok");
                    return { data: retry.data ?? fallback, ok: true };
                }
            }
            if (isMissingTableError(error)) return { data: fallback, ok: false, reason: "missing_table" };
            if (isPermissionError(error)) return { data: fallback, ok: false, reason: "permission" };
            return { data: fallback, ok: false, reason: "error" };
        }
        tableStatus.set(table, "ok");
        return { data: data ?? fallback, ok: true };
    } catch {
        return { data: fallback, ok: false, reason: "network" };
    }
}

/** @deprecated Use cms-import / direct REST — RPC removed. */
export async function invokeBootstrapCmsDefaultContent() {
    return { ok: false, reason: "missing_rpc" };
}

/** @deprecated Use cms-import / direct REST — RPC removed. */
export async function invokeSeedCmsAsAdmin() {
    return { ok: false, reason: "missing_rpc" };
}

/** RPC helper — never throws; skips network when RPC is known missing. */
export async function safeRpc(fn, params = {}, fallback = null) {
    if (!cmsEnabled()) return { data: fallback, ok: false, reason: "not_configured" };
    const deployed = isRpcDeployed(fn);
    if (deployed === false) {
        return { data: fallback, ok: false, reason: "missing_rpc" };
    }
    if (deployed === null) {
        await probeRpcCapabilities();
        if (isRpcDeployed(fn) === false) {
            return { data: fallback, ok: false, reason: "missing_rpc" };
        }
    }
    try {
        const { data, error } = await supabase.rpc(fn, params);
        if (error) {
            if (isMissingRpcError(error)) {
                return { data: fallback, ok: false, reason: "missing_rpc" };
            }
            return { data: fallback, ok: false, reason: "error" };
        }
        return { data: data ?? fallback, ok: true };
    } catch {
        return { data: fallback, ok: false, reason: "network" };
    }
}

export async function hasAdminSession() {
    const creds = loadLegacyCredentials();
    const cached = JSON.parse(localStorage.getItem("admin") || "null");
    if (!(creds?.email && creds?.password && cached?.id && cached?.status === "active")) {
        return false;
    }
    const local = getLocalAdminSession();
    return Boolean(local?.id && String(local.id) === String(cached.id));
}

export async function ensureAdminWriteSession() {
    const creds = loadLegacyCredentials();
    const local = getLocalAdminSession();
    const cached = JSON.parse(localStorage.getItem("admin") || "null");

    if (!(creds?.email && creds?.password)) return false;
    if (!(local?.id && cached?.id && cached?.status === "active")) return false;

    await syncWriteClient();
    return true;
}

/** Attach stored admin credentials to the Supabase client once on dashboard load. */
export async function ensureAdminWriteSessionOnLoad() {
    const creds = loadLegacyCredentials();
    if (!creds?.email || !creds?.password) return false;
    if (!window[CLIENT_KEY]) {
        supabase = await getSupabaseClient();
    } else {
        await syncWriteClient();
    }
    return true;
}

/** Explain why admin UI may be read-only despite appearing signed in. */
export async function getAdminWriteCapability() {
    if (!(await ensureAdminWriteSession())) {
        return {
            canWrite: false,
            reason: "no_credentials",
            message: "Sign in again to continue.",
        };
    }
    const probe = await probeAdminWriteAccess();
    if (probe.ok) {
        return { canWrite: true };
    }
    return {
        canWrite: false,
        reason: probe.reason || "permission",
        message: mapCrudReason(probe.reason),
    };
}

export function mapCrudReason(reason) {
    if (!reason || reason === "not_configured") return "CMS is not configured.";
    if (reason === "missing_table") return "This module is not available yet.";
    if (reason === "permission") {
        return "Database writes are blocked. Run npm run cms:fix (requires SUPABASE_DB_URL in .env.local), then sign in again.";
    }
    if (reason === "missing_rpc") return "Could not complete this action.";
    if (reason === "no_credentials") return "Sign in again to continue.";
    if (reason === "network") return "Network error. Try again.";
    return "Could not complete this action.";
}

export function getTableStatus(table) {
    if (!CMS_TABLES.has(table)) return "not_configured";
    if (!cmsEnabled()) return "disabled";
    return tableStatus.get(table) || "unknown";
}

/** @deprecated Use safeFetch */
export async function safeSupabaseQuery(queryPromise, fallbackValue = [], cacheKey = "") {
    if (!cmsEnabled()) return fallbackValue;
    if (cacheKey && queryCache.has(cacheKey)) return queryCache.get(cacheKey);

    const request = (async () => {
        try {
            const { data, error } = await queryPromise;
            if (error) return fallbackValue;
            return data ?? fallbackValue;
        } catch {
            return fallbackValue;
        }
    })();

    if (cacheKey) queryCache.set(cacheKey, request);
    return request;
}

/** True when Supabase URL + publishable key are present (Auth may be used). */
export function isAuthConfigured() {
    return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

export async function getSupabaseClient() {
    const fingerprint = getClientHeaderFingerprint();
    if (window[CLIENT_KEY] && clientHeaderFingerprint === fingerprint) {
        return window[CLIENT_KEY];
    }

    await ensureSupabaseCdn();
    if (!window.supabase?.createClient) {
        throw new Error("Supabase SDK loaded, but createClient() is unavailable.");
    }

    window[CLIENT_KEY] = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        buildClientOptions(),
    );
    clientHeaderFingerprint = fingerprint;
    return window[CLIENT_KEY];
}

async function ensureSupabaseCdn() {
    if (window.supabase?.createClient) return;
    if (window[LOADER_KEY]) return window[LOADER_KEY];
    window[LOADER_KEY] = loadFromCdns();
    return window[LOADER_KEY];
}

async function loadFromCdns() {
    let lastError;
    for (const url of CDN_URLS) {
        try {
            await loadScriptOnce(url);
            if (window.supabase?.createClient) return;
            lastError = new Error(`Supabase CDN loaded without createClient(): ${url}`);
        } catch (error) {
            lastError = error;
        }
    }
    throw new Error(`Unable to load Supabase JavaScript SDK. ${lastError?.message || "Unknown CDN error"}`);
}

function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
        const existing = [...document.scripts].find((script) => script.src === src);
        if (existing?.dataset.loaded === "true") {
            resolve();
            return;
        }
        if (existing) {
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
            return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.dataset.supabaseSdk = "true";
        script.addEventListener("load", () => {
            script.dataset.loaded = "true";
            resolve();
        }, { once: true });
        script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
        document.head.appendChild(script);
    });
}

export { CONFIG, CONFIG as CMS_CONFIG };

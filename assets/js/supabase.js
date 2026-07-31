import CONFIG from "./config.js";

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

let schemaCaps = null;

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

/** Enable full CMS queries on admin pages (even before connection is confirmed). */
export function setCmsAdminMode(enabled) {
    cmsAdminMode = Boolean(enabled);
}

function cmsEnabled() {
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
    tableStatus.clear();
    queryCache.clear();
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
    return code === "PGRST202" || isMissingTableError(error);
}

/** Probe live schema once per session — avoids 404/400 on missing tables, columns, RPCs. */
export async function probeSchemaCapabilities(options = {}) {
    const { force = false, verifyFull = false } = options;
    const cached = loadSchemaCaps();
    if (cached && !force) return cached;

    const caps = {
        admins: false,
        settings: false,
        authUserId: false,
        statusColumn: false,
        rpc: false,
    };

    const { data: adminRows, error: adminError } = await supabase.from("admins").select("*").limit(1);
    caps.admins = !adminError;

    if (caps.admins && adminRows?.length) {
        const row = adminRows[0];
        caps.authUserId = Object.prototype.hasOwnProperty.call(row, "auth_user_id");
        caps.statusColumn = Object.prototype.hasOwnProperty.call(row, "status");
    }

    if (verifyFull) {
        const { error: settingsError } = await supabase.from("settings").select("id").limit(1);
        caps.settings = !settingsError && !isMissingTableError(settingsError);

        if (caps.settings) {
            const { error: rpcError } = await supabase.rpc("get_admin_login_route", {
                p_email: "__schema_probe__@invalid.local",
            });
            caps.rpc = !rpcError && !isMissingRpcError(rpcError);
        }
    }

    saveSchemaCaps(caps);
    return caps;
}

/**
 * Connect CMS for admin dashboard — probes settings table and upgrades to "ready" when migration ran.
 * Returns { connected: boolean, reason?: string, missing?: string[] }
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
    }

    setCmsAdminMode(true);

    const caps = await probeSchemaCapabilities({ force: true, verifyFull: true });

    if (!caps.admins) {
        setCachedStatus("unavailable");
        markAllMissing();
        return { connected: false, reason: "no_admins" };
    }

    tableStatus.set("admins", "ok");
    cmsFullyMissing = false;

    if (caps.settings) {
        setCachedStatus("ready");
        tableStatus.set("settings", "ok");
        CMS_TABLES.forEach((t) => {
            if (tableStatus.get(t) !== "missing") tableStatus.set(t, "ok");
        });
        return { connected: true };
    }

    CMS_TABLES.forEach((t) => {
        if (t !== "admins") tableStatus.set(t, "missing");
    });
    setCachedStatus("partial");
    return {
        connected: false,
        reason: "migration_required",
        missing: getMissingTables(),
    };
}

/** Probe each CMS table once and cache status (admin health check only). */
export async function probeCmsTableHealth() {
    const tables = [...CMS_TABLES];
    await Promise.all(tables.map(async (table) => {
        try {
            const { error } = await supabase.from(table).select("id").limit(1);
            tableStatus.set(table, error && isMissingTableError(error) ? "missing" : "ok");
        } catch {
            tableStatus.set(table, "missing");
        }
    }));

    if (tableStatus.get("settings") === "ok") {
        setCachedStatus("ready");
        cmsFullyMissing = false;
        const caps = loadSchemaCaps() || {};
        caps.settings = true;
        saveSchemaCaps(caps);
    }
}

/** True when only legacy `admins` exists (migration not run). */
export function isLegacySchema() {
    const caps = loadSchemaCaps();
    if (caps) return caps.admins && !caps.settings;
    return cachedStatus() === "partial";
}

/** True when login RPCs are available. */
export function hasAuthRpc() {
    const caps = loadSchemaCaps();
    return Boolean(caps?.rpc);
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
    if (!caps?.settings) cols.push("password");
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
            tableStatus.set("settings", "ok");
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

        if (caps.settings) {
            setCachedStatus("ready");
            tableStatus.set("settings", "ok");
            CMS_TABLES.forEach((t) => {
                if (t !== "admins" && tableStatus.get(t) !== "missing") tableStatus.set(t, "ok");
            });
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
    return ensureCmsReady();
}

function isPartialCms() {
    return cachedStatus() === "partial";
}

export const supabase = await getSupabaseClient();

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
    if (isPartialCms() && table !== "admins" && !cmsAdminMode) {
        return notConfiguredResult(fallback);
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
        try {
            let query = supabase.from(table);
            if (typeof builder === "function") query = builder(query);
            else query = query.select(builder || "*");

            const { data, error, count } = await query;
            if (error) {
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
    if (isPartialCms() && table !== "admins" && !cmsAdminMode) {
        return { count: null, ok: false, reason: "not_configured" };
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
    if (!CMS_TABLES.has(table)) return { data: null, ok: false, reason: "not_configured" };
    if (!(await requireCmsReady())) return { data: null, ok: false, reason: "not_configured" };
    try {
        const { data, error } = await supabase.from(table).insert(payload).select().maybeSingle();
        if (error) {
            if (isMissingTableError(error)) {
                tableStatus.set(table, "missing");
                return { data: null, ok: false, reason: "missing_table" };
            }
            return { data: null, ok: false, reason: isPermissionError(error) ? "permission" : "error" };
        }
        queryCache.clear();
        return { data, ok: true };
    } catch {
        return { data: null, ok: false, reason: "network" };
    }
}

export async function safeUpdate(table, payload, match) {
    if (!CMS_TABLES.has(table)) return { ok: false, reason: "not_configured" };
    if (!(await requireCmsReady())) return { ok: false, reason: "not_configured" };
    try {
        const { error } = await supabase.from(table).update(payload).match(match);
        if (error) {
            if (isMissingTableError(error)) {
                tableStatus.set(table, "missing");
                return { ok: false, reason: "missing_table" };
            }
            return { ok: false, reason: isPermissionError(error) ? "permission" : "error" };
        }
        queryCache.clear();
        return { ok: true };
    } catch {
        return { ok: false, reason: "network" };
    }
}

export async function safeDelete(table, match) {
    if (!CMS_TABLES.has(table)) return { ok: false, reason: "not_configured" };
    if (!(await requireCmsReady())) return { ok: false, reason: "not_configured" };
    try {
        const { error } = await supabase.from(table).delete().match(match);
        if (error) {
            if (isMissingTableError(error)) {
                tableStatus.set(table, "missing");
                return { ok: false, reason: "missing_table" };
            }
            return { ok: false, reason: isPermissionError(error) ? "permission" : "error" };
        }
        queryCache.clear();
        return { ok: true };
    } catch {
        return { ok: false, reason: "network" };
    }
}

/** Admin-only direct select — gated, never throws. */
export async function safeAdminSelect(table, builder, fallback = null) {
    if (!CMS_TABLES.has(table)) return { data: fallback, ok: false, reason: "not_configured" };
    if (!(await requireCmsReady())) return { data: fallback, ok: false, reason: "not_configured" };
    try {
        let query = supabase.from(table);
        if (typeof builder === "function") query = builder(query);
        else query = query.select(builder || "*");
        const { data, error } = await query;
        if (error) {
            if (isMissingTableError(error)) return { data: fallback, ok: false, reason: "missing_table" };
            if (isPermissionError(error)) return { data: fallback, ok: false, reason: "permission" };
            return { data: fallback, ok: false, reason: "error" };
        }
        return { data: data ?? fallback, ok: true };
    } catch {
        return { data: fallback, ok: false, reason: "network" };
    }
}

/** RPC helper — never throws. Skips network call when RPCs are known missing. */
export async function safeRpc(fn, params = {}, fallback = null) {
    if (!cmsEnabled()) return { data: fallback, ok: false, reason: "not_configured" };
    const caps = loadSchemaCaps();
    if (caps && !caps.rpc) return { data: fallback, ok: false, reason: "missing_rpc" };
    try {
        const { data, error } = await supabase.rpc(fn, params);
        if (error) {
            if (isMissingRpcError(error)) {
                saveSchemaCaps({ ...(caps || {}), rpc: false });
                return { data: fallback, ok: false, reason: "missing_rpc" };
            }
            return { data: fallback, ok: false, reason: "error" };
        }
        if (caps) {
            caps.rpc = true;
            saveSchemaCaps(caps);
        }
        return { data: data ?? fallback, ok: true };
    } catch {
        return { data: fallback, ok: false, reason: "network" };
    }
}

export async function verifyLegacyAdmin(email, password) {
    const caps = loadSchemaCaps() || await probeSchemaCapabilities();

    if (caps.rpc) {
        const result = await safeRpc("verify_legacy_admin", {
            p_email: email,
            p_password: password,
        });
        if (result.ok && result.data) {
            if (result.data?.error === "inactive") return { ok: false, reason: "inactive" };
            return { ok: true, admin: result.data };
        }
        if (result.reason !== "missing_rpc") {
            return { ok: false, reason: "invalid" };
        }
    }

    try {
        const { data, error } = await supabase
            .from("admins")
            .select(adminSelectColumns(caps))
            .eq("email", email)
            .eq("password", password)
            .limit(1);
        if (error) {
            if (isMissingTableError(error)) return { ok: false, reason: "missing_table" };
            if (isMissingColumnError(error)) return { ok: false, reason: "schema_incomplete" };
            return { ok: false, reason: "invalid" };
        }
        if (!data?.length) return { ok: false, reason: "invalid" };
        const row = data[0];
        if (row.status && row.status !== "active") return { ok: false, reason: "inactive" };
        return { ok: true, admin: row };
    } catch {
        return { ok: false, reason: "network" };
    }
}

export async function getAdminLoginRoute(email) {
    const caps = loadSchemaCaps() || await probeSchemaCapabilities();

    if (caps.rpc) {
        const result = await safeRpc("get_admin_login_route", { p_email: email });
        if (result.ok && result.data) return result.data;
    }

    try {
        const selectCols = caps.authUserId ? "auth_user_id,password" : "password";
        const { data, error } = await supabase
            .from("admins")
            .select(selectCols)
            .eq("email", email)
            .limit(1);
        if (error || !data?.length) return "unknown";
        const row = data[0];
        if (caps.authUserId && row.auth_user_id) return "auth";
        if (row.password) return "legacy";
        return caps.settings ? "auth" : "legacy";
    } catch {
        return "unknown";
    }
}

export async function hasAdminSession() {
    try {
        const { data } = await supabase.auth.getSession();
        return Boolean(data?.session?.user);
    } catch {
        return false;
    }
}

export function mapCrudReason(reason) {
    if (!reason || reason === "not_configured") return "CMS is not configured.";
    if (reason === "missing_table") return "Database table is missing. Run the migration.";
    if (reason === "permission") return "Permission denied. Sign in with Supabase Auth.";
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
    if (window[CLIENT_KEY]) return window[CLIENT_KEY];
    await ensureSupabaseCdn();
    if (!window.supabase?.createClient) {
        throw new Error("Supabase SDK loaded, but createClient() is unavailable.");
    }
    window[CLIENT_KEY] = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage,
        },
    });
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

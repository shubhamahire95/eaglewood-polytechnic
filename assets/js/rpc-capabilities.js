/**
 * RPC capability registry — loaded from static config (no network probes, no 404s).
 * Updated by: npm run cms:deploy:all after successful SQL deploy.
 */
const CAPS_URL = "/assets/data/rpc-capabilities.json";
const CACHE_KEY = "ew_rpc_capabilities";

let memoryCache = null;
let loadPromise = null;

function loadCache() {
    if (memoryCache) return memoryCache;
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) memoryCache = JSON.parse(raw);
    } catch {
        /* ignore */
    }
    return memoryCache;
}

function saveCache(caps) {
    memoryCache = caps;
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(caps));
    } catch {
        /* ignore */
    }
}

export function clearRpcCapabilities() {
    memoryCache = null;
    loadPromise = null;
    try {
        sessionStorage.removeItem(CACHE_KEY);
    } catch {
        /* ignore */
    }
}

export function isRpcDeployed(name) {
    const caps = loadCache();
    if (!caps) return null;
    return caps[name] === true;
}

/** Load RPC capabilities from static JSON — never calls /rpc/* endpoints. */
export async function probeRpcCapabilities({ force = false } = {}) {
    if (!force && loadCache()) return loadCache();
    if (loadPromise && !force) return loadPromise;

    loadPromise = (async () => {
        try {
            const res = await fetch(CAPS_URL, { cache: "no-store" });
            if (res.ok) {
                const caps = await res.json();
                saveCache(caps);
                return caps;
            }
        } catch {
            /* ignore */
        }
        const fallback = { verify_legacy_admin: true };
        saveCache(fallback);
        return fallback;
    })();

    try {
        return await loadPromise;
    } finally {
        loadPromise = null;
    }
}

/** Called after successful production SQL deploy. */
export function markAllRpcsDeployed() {
    const caps = {
        verify_legacy_admin: true,
        create_legacy_admin_session: false,
        validate_legacy_admin_session: false,
        revoke_legacy_admin_session: false,
        destroy_legacy_admin_session: false,
        bootstrap_cms_default_content: false,
        seed_cms_as_admin: false,
        get_admin_login_route: true,
        bootstrap_admin_auth_links: false,
    };
    saveCache(caps);
    return caps;
}

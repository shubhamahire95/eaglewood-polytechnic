/**
 * Shared admin REST auth for Node verification/deploy scripts.
 * Matches assets/js/supabase.js buildAdminAuthHeaders().
 */
export const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";
export const PROJECT_REF = "rhqmquaojetmzdznbevz";

export const DEFAULT_ADMIN_EMAIL = "admin@eaglewoodpoly.in";
export const DEFAULT_ADMIN_PASSWORD = "admin123";

/** Auth headers only — no Content-Type (safe for GET/DELETE without body). */
export function buildAdminAuthHeaders(email, password, extra = {}) {
    return {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "x-admin-email": email,
        "x-admin-password": password,
        ...extra,
    };
}

/** Auth headers with JSON Content-Type for POST/PATCH bodies. */
export function buildAdminJsonHeaders(email, password, extra = {}) {
    return buildAdminAuthHeaders(email, password, {
        "Content-Type": "application/json",
        ...extra,
    });
}

export function buildPublicAuthHeaders(extra = {}) {
    return {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
        ...extra,
    };
}

/** Strip Content-Type for bodyless DELETE/GET requests. */
export function stripBodyHeaders(headers = {}) {
    const next = { ...headers };
    delete next["Content-Type"];
    delete next["content-type"];
    delete next.Prefer;
    return next;
}

/** Lightweight write check — is_admin() RPC with header credentials (no INSERT probe). */
export async function checkAdminWritePermission(email = DEFAULT_ADMIN_EMAIL, password = DEFAULT_ADMIN_PASSWORD) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
        method: "POST",
        headers: buildAdminJsonHeaders(email, password),
        body: "{}",
    });
    if (!res.ok) {
        return { ok: false, admin: false, status: res.status, body: await res.text() };
    }
    const text = (await res.text()).trim().toLowerCase();
    return { ok: true, admin: text === "true" };
}

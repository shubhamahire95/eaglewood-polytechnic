/**
 * Shared Principal Message content — single Supabase source for admin, home, and about.
 */
import { fetchCmsRows } from "./cms-store.js";
import { ensureMediaMap, resolveAdminPreviewUrl } from "./media-url.js";
import { instituteLabel, programTypeLabel } from "./site-settings.js";

const INSTITUTE_SORT = { polytechnic: 0, diploma: 0, engineering: 1, degree: 1 };

/** Normalize institute column to polytechnic (diploma) or engineering (degree). */
export function principalInstituteKey(row = {}) {
    const key = String(row.institute || "polytechnic").toLowerCase();
    if (key === "engineering" || key === "degree") return "engineering";
    return "polytechnic";
}

/** Short program label for badges: Diploma | Degree */
export function principalProgramLabel(row = {}) {
    return programTypeLabel(principalInstituteKey(row) === "engineering" ? "degree" : "diploma");
}

/** Stable anchor id for about-page deep links. */
export function principalAnchorId(row = {}) {
    return principalInstituteKey(row) === "engineering" ? "principal-degree" : "principal-diploma";
}

/** Diploma first, then degree; then display_order. */
export function sortPrincipalRows(rows = []) {
    return [...rows].sort((a, b) => {
        const orderDiff = Number(a.display_order || 0) - Number(b.display_order || 0);
        if (orderDiff !== 0) return orderDiff;
        return (INSTITUTE_SORT[principalInstituteKey(a)] ?? 0) - (INSTITUTE_SORT[principalInstituteKey(b)] ?? 0);
    });
}

/** Fetch published principal messages (supports dual principals). */
export async function fetchPrincipalMessages({ admin = false, limit = 2 } = {}) {
    await ensureMediaMap();
    const result = await fetchCmsRows("principal_message", {
        admin,
        publishedOnly: !admin,
        limit: Math.max(limit, 10),
    });
    const rows = Array.isArray(result.data) ? result.data : [];
    return sortPrincipalRows(rows.filter((row) => admin || row.published !== false)).slice(0, limit);
}

/** Fetch the latest published principal message from Supabase. */
export async function fetchPrincipalMessage(options = {}) {
    const rows = await fetchPrincipalMessages({ ...options, limit: 1 });
    return rows[0] || null;
}

/** Use the exact stored URL (Supabase Storage public URL when uploaded). */
export function resolvePrincipalPhotoUrlSync(url) {
    if (!url || typeof url !== "string") return "";
    const trimmed = String(url).trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return resolveAdminPreviewUrl(trimmed);
}

export async function resolvePrincipalPhotoUrl(url) {
    await ensureMediaMap();
    return resolvePrincipalPhotoUrlSync(url);
}

export function principalInitials(name = "Principal") {
    return String(name)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "EP";
}

function isPrincipalLogoUrl(url = "") {
    const lower = String(url).toLowerCase();
    return /logo|emblem|crest|seal|badge|official/.test(lower)
        && !/photo|portrait|headshot|profile/.test(lower);
}

export function principalPhotoMarkup({
    photoUrl,
    name = "Principal",
    className = "gov-principal-photo",
    loading = "lazy",
    placeholderClass = "gov-principal-fallback",
} = {}) {
    const src = resolvePrincipalPhotoUrlSync(photoUrl);
    const alt = esc(name);
    if (!src) {
        return `<div class="${placeholderClass}" aria-hidden="true">${esc(principalInitials(name))}</div>`;
    }
    const logoClass = isPrincipalLogoUrl(photoUrl) || isPrincipalLogoUrl(src) ? " is-logo" : "";
    const attrs = loading === "eager"
        ? 'loading="eager" fetchpriority="high" decoding="async"'
        : 'loading="lazy" decoding="async"';
    return `<img ${attrs} src="${esc(src)}" alt="${alt}" class="${className}${logoClass}" width="240" height="240">`;
}

export function principalMessageParagraphs(message, { excerpt = false, maxLength = 320 } = {}) {
    const text = String(message || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text) return [];
    if (!excerpt) {
        return String(message || "")
            .split(/(?:<\/p>|<br\s*\/?>|\n)/i)
            .map((chunk) => chunk.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
            .filter(Boolean);
    }
    const clipped = text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
    return [clipped];
}

function esc(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

export { instituteLabel, programTypeLabel };

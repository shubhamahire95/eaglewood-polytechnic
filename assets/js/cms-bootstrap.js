/**
 * CMS content bootstrap — seeds recovered Eaglewood defaults into Supabase when empty.
 */
import { cmsEnabled, safeCount } from "./supabase.js";
import { importCmsContent } from "./cms-import.js";

const CONTENT_TABLES = [
    "home_slides", "principal_message", "updates", "notices", "courses",
    "departments", "faculty", "facilities", "placements", "gallery", "footer_blocks",
];

const BOOTSTRAP_LOCK_KEY = "ew_cms_bootstrap_lock";

export async function getCmsContentCounts() {
    if (!cmsEnabled()) return {};
    const entries = await Promise.all(CONTENT_TABLES.map(async (table) => {
        const result = await safeCount(table, `audit:count:${table}`);
        return [table, result.ok ? (result.count || 0) : 0];
    }));
    return Object.fromEntries(entries);
}

export async function isCmsContentEmpty() {
    const counts = await getCmsContentCounts();
    return CONTENT_TABLES.every((table) => (counts[table] || 0) === 0);
}

/** Seed Supabase when CMS tables are empty (direct REST inserts with admin headers). */
export async function bootstrapCmsContentIfNeeded({ force = false, adminOnly = false } = {}) {
    if (!cmsEnabled()) {
        return { ok: false, skipped: true, reason: "cms_disabled" };
    }

    const empty = await isCmsContentEmpty();
    if (!empty && !force) {
        return { ok: true, skipped: true, reason: "already_has_content" };
    }

    if (!force) {
        const lock = sessionStorage.getItem(BOOTSTRAP_LOCK_KEY);
        if (lock === "done") {
            return { ok: true, skipped: true, reason: "already_seeded" };
        }
        if (lock === "pending") {
            return { ok: false, skipped: true, reason: "in_progress" };
        }
        sessionStorage.setItem(BOOTSTRAP_LOCK_KEY, "pending");
    }

    const result = await importCmsContent({ force });

    if (result.seeded) {
        sessionStorage.setItem(BOOTSTRAP_LOCK_KEY, "done");
        try {
            localStorage.removeItem("ew_cms_bootstrap_rpc_missing");
            localStorage.setItem("ew_cms_updated_at", String(Date.now()));
        } catch {
            /* ignore */
        }
        return { ok: true, seeded: true, via: result.via, data: result };
    }

    if (result.skipped) {
        sessionStorage.setItem(BOOTSTRAP_LOCK_KEY, "done");
        return { ok: true, skipped: true, reason: "already_seeded", via: result.via };
    }

    if (result.reason === "permission") {
        sessionStorage.removeItem(BOOTSTRAP_LOCK_KEY);
        return { ok: false, skipped: true, reason: "permission", via: result.via };
    }

    sessionStorage.removeItem(BOOTSTRAP_LOCK_KEY);
    return { ok: false, skipped: true, reason: result.reason || "error", via: result.via };
}

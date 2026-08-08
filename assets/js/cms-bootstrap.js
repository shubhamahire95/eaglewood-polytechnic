/**
 * CMS content bootstrap — seeds Eaglewood defaults into Supabase when empty.
 */
import { cmsEnabled, safeCount } from "./supabase.js";
import { bootstrapAllContentTables, bootstrapTableIfEmpty, BOOTSTRAP_TABLES } from "./cms-store.js";

const BOOTSTRAP_LOCK_KEY = "ew_cms_bootstrap_lock";

export async function getCmsContentCounts() {
    if (!cmsEnabled()) return {};
    const entries = await Promise.all(BOOTSTRAP_TABLES.map(async (table) => {
        const result = await safeCount(table, `audit:count:${table}`);
        return [table, result.ok ? (result.count || 0) : 0];
    }));
    return Object.fromEntries(entries);
}

export async function isCmsContentEmpty() {
    const counts = await getCmsContentCounts();
    return BOOTSTRAP_TABLES.every((table) => (counts[table] || 0) === 0);
}

/** Seed Supabase when CMS tables are empty (admin REST inserts). */
export async function bootstrapCmsContentIfNeeded({ force = false } = {}) {
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

    const results = await bootstrapAllContentTables();
    const inserted = Object.values(results).reduce((sum, r) => sum + (r.bootstrapped ? (r.inserted || 0) : 0), 0);
    const failed = Object.entries(results).find(([, r]) => r.ok === false);

    if (failed) {
        sessionStorage.removeItem(BOOTSTRAP_LOCK_KEY);
        return { ok: false, skipped: true, reason: failed[1].reason || "error", table: failed[0] };
    }

    if (inserted > 0) {
        sessionStorage.setItem(BOOTSTRAP_LOCK_KEY, "done");
        try {
            localStorage.setItem("ew_cms_updated_at", String(Date.now()));
        } catch {
            /* ignore */
        }
        return { ok: true, seeded: true, inserted, via: "direct_insert", data: results };
    }

    sessionStorage.setItem(BOOTSTRAP_LOCK_KEY, "done");
    return { ok: true, skipped: true, reason: "already_seeded", via: "direct_insert" };
}

export { bootstrapTableIfEmpty };

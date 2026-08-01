/**
 * Import production CMS content into Supabase via admin REST inserts only.
 * Requires admin login (x-admin-email / x-admin-password headers + RLS fix applied).
 */
import {
    safeInsert,
    safeCount,
    ensureAdminWriteSession,
    clearCmsQueryCache,
    notifyCmsDataChanged,
} from "./supabase.js";

const SEED_URL = "/assets/data/cms-seed-data.json";

const SEED_ORDER = [
    "home_slides",
    "principal_message",
    "updates",
    "notices",
    "courses",
    "departments",
    "faculty",
    "facilities",
    "placements",
    "gallery",
    "footer_blocks",
    "ai_prompts",
    "ai_knowledge_base",
];

let seedDataPromise = null;

async function loadSeedData() {
    if (!seedDataPromise) {
        seedDataPromise = fetch(SEED_URL)
            .then((res) => {
                if (!res.ok) throw new Error(`Seed data not found (${res.status})`);
                return res.json();
            });
    }
    return seedDataPromise;
}

async function tableIsEmpty(table) {
    const result = await safeCount(table, `seed:probe:${table}`);
    return result.ok && (result.count || 0) === 0;
}

const WRITE_BLOCKED_KEY = "ew_cms_writes_blocked";

/** Insert seed rows via admin write session (legacy header auth). */
export async function seedCmsViaDirectInsert() {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(WRITE_BLOCKED_KEY) === "1") {
        return { ok: false, reason: "permission", skipped: true };
    }

    if (!(await ensureAdminWriteSession())) {
        try {
            sessionStorage.setItem(WRITE_BLOCKED_KEY, "1");
        } catch {
            /* ignore */
        }
        return { ok: false, reason: "permission" };
    }

    let data;
    try {
        data = await loadSeedData();
    } catch {
        return { ok: false, reason: "seed_data_missing" };
    }

    let inserted = 0;
    const tables = [];

    for (const table of SEED_ORDER) {
        if (!(await tableIsEmpty(table))) continue;
        const raw = data[table];
        const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
        if (!rows.length) continue;

        for (const row of rows) {
            const result = await safeInsert(table, row);
            if (!result.ok) {
                if (result.reason === "permission") {
                    try {
                        sessionStorage.setItem(WRITE_BLOCKED_KEY, "1");
                    } catch {
                        /* ignore */
                    }
                }
                return { ok: false, reason: result.reason || "error", table, inserted };
            }
            inserted += 1;
        }
        tables.push(table);
    }

    if (inserted > 0) {
        clearCmsQueryCache();
        notifyCmsDataChanged();
        return { ok: true, seeded: true, inserted, tables, via: "direct_insert" };
    }

    return { ok: true, seeded: false, skipped: true, reason: "already_seeded", via: "direct_insert" };
}

/** Seed CMS content — direct REST inserts only. */
export async function importCmsContent({ force = false } = {}) {
    if (force) {
        try {
            sessionStorage.removeItem("ew_cms_bootstrap_lock");
        } catch {
            /* ignore */
        }
    }

    return seedCmsViaDirectInsert();
}

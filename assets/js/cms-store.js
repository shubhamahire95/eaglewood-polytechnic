/**
 * Unified CMS data layer — Supabase is authoritative when it has rows.
 * When a table is empty in Supabase, serve bundled seed JSON for reads only.
 * Admin edits in local overlay always merge on top (until writes persist).
 */
import {
    safeFetch,
    safeAdminSelect,
    safeInsert,
    safeUpdate,
    safeDelete,
    safeCount,
    safePublicInsert,
    notifyCmsDataChanged,
    clearCmsQueryCache,
    tableHasDisplayOrder,
} from "./supabase.js";

const LOCAL_STORE_KEY = "ew_cms_local_overlay";

export const CONTENT_TABLES = new Set([
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
]);

let seedCache = null;
let seedPromise = null;

const SEED_URL = "/assets/data/cms-seed-data.json";

export function isContentTable(table) {
    return CONTENT_TABLES.has(table);
}

function loadOverlay() {
    try {
        return JSON.parse(localStorage.getItem(LOCAL_STORE_KEY) || "{}");
    } catch {
        return {};
    }
}

function saveOverlay(overlay) {
    try {
        localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(overlay));
        localStorage.setItem("ew_cms_updated_at", String(Date.now()));
    } catch {
        /* ignore */
    }
}

function tableOverlay(table) {
    const overlay = loadOverlay();
    if (!overlay[table]) overlay[table] = { upserts: {}, deleted: [] };
    return overlay[table];
}

function persistTableOverlay(table, slice) {
    const overlay = loadOverlay();
    overlay[table] = slice;
    saveOverlay(overlay);
}

function normalizeSeedRows(table, raw) {
    if (!raw) return [];
    const rows = Array.isArray(raw) ? raw : [raw];
    const now = new Date().toISOString();
    return rows.map((row, index) => ({
        ...row,
        id: row.id || `local-${table}-${index}`,
        created_at: row.created_at || now,
        updated_at: row.updated_at || row.created_at || now,
    }));
}

function sortRows(rows) {
    return [...rows].sort((a, b) => {
        const orderDiff = Number(a.display_order || 0) - Number(b.display_order || 0);
        if (orderDiff !== 0) return orderDiff;
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
}

function filterPublished(rows, publishedOnly) {
    if (!publishedOnly) return rows;
    return rows.filter((row) => row.published !== false);
}

function mergeSeedAndLocal(seedRows, slice) {
    const upserts = slice?.upserts || {};
    const deleted = new Set((slice?.deleted || []).map(String));
    const merged = seedRows
        .filter((row) => !deleted.has(String(row.id)))
        .map((row) => (upserts[String(row.id)] ? { ...row, ...upserts[String(row.id)] } : row));

    const existing = new Set(merged.map((row) => String(row.id)));
    Object.entries(upserts).forEach(([id, row]) => {
        if (!existing.has(id) && !deleted.has(id)) merged.push(row);
    });
    return merged;
}

async function fetchSupabaseRows(table, { admin = false, publishedOnly = false, limit = 250 } = {}) {
    const builder = (q) => {
        let query = q.select("*").limit(limit);
        if (publishedOnly) query = query.eq("published", true);
        if (tableHasDisplayOrder(table)) {
            query = query
                .order("display_order", { ascending: true, nullsFirst: false })
                .order("created_at", { ascending: false });
        } else {
            query = query.order("created_at", { ascending: false });
        }
        return query;
    };

    if (admin) {
        return safeAdminSelect(table, builder, []);
    }
    return safeFetch(table, builder, [], `cms-store:${table}:${publishedOnly ? "pub" : "all"}`);
}

/** Read CMS rows: Supabase → seed (when empty) → local overlay merge. */
export async function fetchCmsRows(table, { admin = false, publishedOnly = false, limit = 250 } = {}) {
    if (!isContentTable(table)) {
        const result = admin
            ? await fetchSupabaseRows(table, { admin: true, publishedOnly, limit })
            : await safeFetch(table, (q) => {
                let query = q.select("*").limit(limit);
                if (publishedOnly) query = query.eq("published", true);
                return query.order("created_at", { ascending: false });
            }, [], `cms-store:${table}`);
        return {
            data: Array.isArray(result.data) ? result.data : [],
            ok: result.ok === true,
            source: result.ok ? "supabase" : "none",
        };
    }

    const remote = await fetchSupabaseRows(table, { admin, publishedOnly, limit });
    const remoteRows = Array.isArray(remote.data) ? remote.data : [];
    const remoteCount = remoteRows.length;
    const slice = tableOverlay(table);
    const hasOverlay = Boolean(
        Object.keys(slice?.upserts || {}).length
        || (slice?.deleted || []).length,
    );

    let baseRows = remoteRows;
    let usedSeed = false;
    if (remoteCount === 0) {
        const seed = await loadSeedData();
        const seedRows = normalizeSeedRows(table, seed[table]);
        if (seedRows.length) {
            baseRows = seedRows;
            usedSeed = true;
        }
    }

    const merged = mergeSeedAndLocal(baseRows, slice);
    const data = filterPublished(sortRows(merged), publishedOnly).slice(0, limit);

    let source = "none";
    if (remoteCount > 0) {
        source = hasOverlay ? "supabase+overlay" : "supabase";
    } else if (usedSeed) {
        source = hasOverlay ? "seed+overlay" : "seed";
    } else if (hasOverlay) {
        source = "overlay";
    }

    return {
        data,
        ok: remote.ok === true || usedSeed || hasOverlay || data.length > 0,
        source,
        fallback: remoteCount === 0 && (usedSeed || hasOverlay),
    };
}

/** Count effective CMS rows (Supabase, or seed/overlay when Supabase is empty). */
export async function cmsTableCount(table) {
    if (!isContentTable(table)) {
        const result = await safeCount(table, `cms-store:count:${table}`);
        return { count: result.ok ? (result.count ?? 0) : null, ok: result.ok === true, reason: result.reason };
    }

    const remote = await safeCount(table, `cms-store:count:${table}`);
    if (remote.ok && (remote.count || 0) > 0) {
        return {
            count: remote.count ?? 0,
            ok: true,
            source: "supabase",
            fallback: false,
            reason: remote.reason,
        };
    }

    const { data } = await fetchCmsRows(table, { admin: true, publishedOnly: false, limit: 10000 });
    const count = data.length;
    return {
        count,
        ok: remote.ok === true || count > 0,
        source: count > 0 && !(remote.count > 0) ? "seed" : "supabase",
        fallback: count > 0 && !(remote.count > 0),
        reason: remote.reason,
    };
}

function localUpsert(table, row) {
    const slice = tableOverlay(table);
    slice.upserts[String(row.id)] = {
        ...row,
        updated_at: new Date().toISOString(),
    };
    const deleted = slice.deleted.filter((id) => String(id) !== String(row.id));
    persistTableOverlay(table, { upserts: slice.upserts, deleted });
    clearCmsQueryCache();
}

function localDelete(table, id) {
    const slice = tableOverlay(table);
    const key = String(id);
    delete slice.upserts[key];
    if (!slice.deleted.includes(key)) slice.deleted.push(key);
    persistTableOverlay(table, { upserts: slice.upserts, deleted: slice.deleted });
    clearCmsQueryCache();
}

/** Insert — persists to Supabase only (no local overlay fallback). */
export async function cmsInsert(table, payload) {
    const result = await safeInsert(table, payload);
    if (result.ok) {
        return { ...result, source: "supabase", localOnly: false };
    }
    return result;
}

/** Update — persists to Supabase only (no local overlay fallback). */
export async function cmsUpdate(table, payload, match) {
    const result = await safeUpdate(table, payload, match);
    if (result.ok) {
        return { ...result, source: "supabase", localOnly: false };
    }
    return result;
}

/** Delete — persists to Supabase only (no local overlay fallback). */
export async function cmsDelete(table, match) {
    const result = await safeDelete(table, match);
    if (result.ok) {
        return { ...result, source: "supabase", localOnly: false };
    }
    return result;
}

/** Whether CMS tables still have no Supabase rows (bootstrap may be needed). */
export async function isUsingSeedFallback() {
    const tables = [
        "home_slides", "principal_message", "updates", "notices",
        "courses", "departments", "facilities", "placements", "gallery",
    ];
    for (const table of tables) {
        const remote = await safeCount(table, `cms-store:probe:${table}`);
        if (remote.ok && (remote.count || 0) > 0) return false;
    }
    return true;
}

/** Bundled default content used when Supabase returns zero rows for a table. */
export async function loadSeedData() {
    if (seedCache) return seedCache;
    if (!seedPromise) {
        seedPromise = fetch(SEED_URL)
            .then((res) => {
                if (!res.ok) throw new Error(`Seed data not found (${res.status})`);
                return res.json();
            })
            .then((data) => {
                seedCache = data;
                return data;
            })
            .catch(() => ({}));
    }
    return seedPromise;
}

export { normalizeSeedRows, mergeSeedAndLocal };

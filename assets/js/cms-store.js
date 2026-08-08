/**
 * CMS data layer — Supabase is the only source of truth for admin reads/writes.
 * Public pages may render bundled seed JSON when the database is empty (display-only, no ids).
 */
import {
    safeFetch,
    safeAdminSelect,
    safeInsert,
    safeUpdate,
    safeDelete,
    safeCount,
    notifyCmsDataChanged,
    clearCmsQueryCache,
    tableHasDisplayOrder,
} from "./supabase.js";
import { sanitizeWritePayload } from "./cms-schema.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEED_URL = "/assets/data/cms-seed-data.json";
const LEGACY_OVERLAY_KEY = "ew_cms_local_overlay";

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
    "downloads",
    "footer_blocks",
    "ai_prompts",
    "ai_knowledge_base",
]);

export const BOOTSTRAP_TABLES = [
    "home_slides",
    "updates",
    "notices",
    "courses",
    "departments",
    "faculty",
    "facilities",
    "placements",
    "gallery",
    "downloads",
    "footer_blocks",
];

let seedCache = null;
let seedPromise = null;
const bootstrapInflight = new Map();

export function isContentTable(table) {
    return CONTENT_TABLES.has(table);
}

/** True only for real Postgres UUID primary keys. */
export function isUuid(id) {
    return typeof id === "string" && UUID_RE.test(id);
}

export function stripWritePayload(payload) {
    const clean = { ...(payload || {}) };
    delete clean.id;
    delete clean._displayOnly;
    delete clean._displayIndex;
    delete clean._seed;
    delete clean._local;
    delete clean._queued;
    delete clean.category; // legacy seed field on notices (not in DB)
    return clean;
}

function prepareWritePayload(table, payload) {
    return sanitizeWritePayload(table, stripWritePayload(payload)).payload;
}

/** Remove legacy overlay / fake-id caches from older builds. */
export function clearCmsLocalCache() {
    try {
        localStorage.removeItem(LEGACY_OVERLAY_KEY);
    } catch {
        /* ignore */
    }
    clearCmsQueryCache();
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

/** Display-only seed rows for the public site — never assigned database ids. */
function normalizeDisplaySeed(raw) {
    if (!raw) return [];
    const rows = Array.isArray(raw) ? raw : [raw];
    const now = new Date().toISOString();
    return rows.map((row, index) => ({
        ...stripWritePayload(row),
        _displayOnly: true,
        _displayIndex: index,
        created_at: row.created_at || now,
        updated_at: row.updated_at || row.created_at || now,
    }));
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

/** Read rows: admin always from Supabase; public uses seed only when DB is empty (display-only). */
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

    if (admin || remoteRows.length > 0) {
        const data = filterPublished(sortRows(remoteRows), publishedOnly).slice(0, limit);
        return {
            data,
            ok: remote.ok === true || (admin && data.length > 0),
            source: "supabase",
            fallback: false,
        };
    }

    const seed = await loadSeedData();
    const raw = seed[table];
    const displayRows = normalizeDisplaySeed(raw);
    const data = filterPublished(sortRows(displayRows), publishedOnly).slice(0, limit);
    return {
        data,
        ok: data.length > 0,
        source: data.length ? "seed" : "none",
        fallback: data.length > 0,
    };
}

/** Row count from Supabase only. */
export async function cmsTableCount(table) {
    const result = await safeCount(table, `cms-store:count:${table}`);
    return {
        count: result.ok ? (result.count ?? 0) : 0,
        ok: result.ok === true,
        source: "supabase",
        fallback: false,
        reason: result.reason,
        message: result.message,
    };
}

/**
 * Upsert: UPDATE when editing row has a valid UUID, otherwise INSERT.
 * Never PATCH non-UUID ids. Never update an unrelated row.
 */
export async function cmsUpsert(table, payload, existingRow = null) {
    const rowId = existingRow?.id ?? null;
    const clean = prepareWritePayload(table, payload);

    if (isUuid(rowId)) {
        const result = await safeUpdate(table, clean, { id: rowId });
        return {
            ...result,
            inserted: false,
            id: rowId,
            source: "supabase",
        };
    }

    const insertPayload = prepareWritePayload(table, payload);
    const result = await safeInsert(table, insertPayload);
    return {
        ...result,
        inserted: true,
        id: result.data?.id ?? null,
        source: "supabase",
    };
}

export const cmsSave = cmsUpsert;

export async function cmsInsert(table, payload) {
    const result = await safeInsert(table, prepareWritePayload(table, payload));
    return {
        ...result,
        inserted: true,
        id: result.data?.id ?? null,
        source: "supabase",
    };
}

export async function cmsUpdate(table, payload, match) {
    const id = match?.id;
    if (!isUuid(id)) {
        return cmsUpsert(table, payload, null);
    }
    const result = await safeUpdate(table, prepareWritePayload(table, payload), { id });
    return { ...result, inserted: false, id, source: "supabase" };
}

export async function cmsDelete(table, match) {
    const id = match?.id;
    if (!isUuid(id)) {
        return {
            ok: false,
            reason: "invalid_id",
            message: "Cannot delete a row without a database id.",
        };
    }
    const result = await safeDelete(table, { id });
    return { ...result, source: "supabase" };
}

/** Insert seed defaults when table is empty — requires working admin RLS. */
export async function bootstrapTableIfEmpty(table) {
    if (!isContentTable(table)) {
        return { ok: true, bootstrapped: false, skipped: true };
    }

    const countResult = await safeCount(table, `bootstrap:count:${table}`);
    if (countResult.ok && (countResult.count || 0) > 0) {
        return { ok: true, bootstrapped: false, count: countResult.count };
    }

    if (bootstrapInflight.has(table)) {
        return bootstrapInflight.get(table);
    }

    const job = (async () => {
        const seed = await loadSeedData();
        const raw = seed[table];
        const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
        if (!rows.length) {
            return { ok: true, bootstrapped: false, reason: "no_seed" };
        }

        let inserted = 0;
        let lastRow = null;
        for (const row of rows) {
            const result = await safeInsert(table, prepareWritePayload(table, row));
            if (!result.ok) {
                return {
                    ok: false,
                    bootstrapped: false,
                    reason: result.reason,
                    message: result.message,
                    inserted,
                };
            }
            inserted += 1;
            lastRow = result.data;
        }

        clearCmsQueryCache();
        notifyCmsDataChanged();
        return { ok: true, bootstrapped: true, inserted, data: lastRow };
    })();

    bootstrapInflight.set(table, job);
    try {
        return await job;
    } finally {
        bootstrapInflight.delete(table);
    }
}

export async function bootstrapAllContentTables() {
    const results = {};
    for (const table of BOOTSTRAP_TABLES) {
        results[table] = await bootstrapTableIfEmpty(table);
    }
    clearCmsQueryCache();
    return results;
}

export async function isUsingSeedFallback() {
    for (const table of BOOTSTRAP_TABLES) {
        const remote = await safeCount(table, `cms-store:probe:${table}`);
        if (remote.ok && (remote.count || 0) > 0) return false;
    }
    return true;
}

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

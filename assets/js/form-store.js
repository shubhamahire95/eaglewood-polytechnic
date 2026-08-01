/**
 * Public form submissions — Supabase REST first, local queue when RLS blocks anon insert.
 * Admin reads merged Supabase + queued rows (same pattern as cms-store).
 */
import { safeAdminSelect, safeFetch, safePublicInsert, notifyCmsDataChanged } from "./supabase.js";

const QUEUE_KEY = "ew_public_form_queue";

export const PUBLIC_FORM_TABLES = new Set(["contacts", "admissions", "inquiries"]);

function loadQueue() {
    try {
        return JSON.parse(localStorage.getItem(QUEUE_KEY) || "{}");
    } catch {
        return {};
    }
}

function saveQueue(queue) {
    try {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        localStorage.setItem("ew_cms_updated_at", String(Date.now()));
    } catch {
        /* ignore */
    }
}

function notifyFormChanged() {
    notifyCmsDataChanged();
}

function sanitizePayload(table, payload) {
    const clean = { ...payload };
    Object.keys(clean).forEach((key) => {
        if (clean[key] === undefined || clean[key] === "") delete clean[key];
    });

    if (table === "contacts") {
        clean.status = clean.status || "new";
        clean.reply_status = clean.reply_status || "pending";
    } else if (table === "admissions") {
        clean.status = clean.status || "new";
        clean.application_status = clean.application_status || "pending";
        clean.payment_status = clean.payment_status || "pending";
    } else if (table === "inquiries") {
        clean.status = clean.status || "new";
        clean.reply_status = clean.reply_status || "pending";
    }
    return clean;
}

function enqueueLocal(table, payload) {
    const queue = loadQueue();
    if (!queue[table]) queue[table] = [];
    const row = {
        ...payload,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        _local: true,
        _queued: true,
    };
    queue[table].unshift(row);
    saveQueue(queue);
    return row;
}

function removeFromQueue(table, id) {
    const queue = loadQueue();
    if (!queue[table]) return;
    queue[table] = queue[table].filter((row) => String(row.id) !== String(id));
    saveQueue(queue);
}

export function isPublicFormTable(table) {
    return PUBLIC_FORM_TABLES.has(table);
}

/** Submit a public form — persists to Supabase or local queue. */
export async function submitPublicForm(table, payload) {
    if (!PUBLIC_FORM_TABLES.has(table)) {
        return { ok: false, reason: "not_configured" };
    }

    const cleaned = sanitizePayload(table, payload);
    const remote = await safePublicInsert(table, cleaned);
    if (remote.ok) {
        notifyFormChanged();
        return { ok: true, data: remote.data, source: "supabase" };
    }

    if (remote.reason === "permission") {
        const row = enqueueLocal(table, cleaned);
        notifyFormChanged();
        return { ok: true, data: row, source: "local", queued: true };
    }

    return remote;
}

/** Read form rows for admin/public — Supabase rows + queued local submissions. */
export async function fetchFormRows(table, { admin = false, limit = 250 } = {}) {
    const builder = (q) => q.select("*").order("created_at", { ascending: false }).limit(limit);
    const remote = admin
        ? await safeAdminSelect(table, builder, [])
        : await safeFetch(table, builder, [], `forms:${table}`);
    const remoteRows = Array.isArray(remote.data) ? remote.data : [];
    const queued = (loadQueue()[table] || []).filter((row) => row._queued !== false);

    const remoteIds = new Set(remoteRows.map((row) => String(row.id)));
    const merged = [
        ...queued.filter((row) => !remoteIds.has(String(row.id))),
        ...remoteRows,
    ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    return {
        data: merged.slice(0, limit),
        ok: remote.ok !== false || merged.length > 0,
        source: queued.length && !remoteRows.length ? "local" : "supabase",
        queuedCount: queued.length,
    };
}

export async function formTableCount(table) {
    const result = await fetchFormRows(table, { admin: true, limit: 10000 });
    const queued = (loadQueue()[table] || []).length;
    return { count: (result.data || []).length, ok: result.ok !== false, queued };
}

/** Try flushing queued submissions when Supabase accepts anon inserts again. */
export async function flushFormQueue() {
    const queue = loadQueue();
    let synced = 0;
    for (const table of PUBLIC_FORM_TABLES) {
        const rows = [...(queue[table] || [])];
        for (const row of rows) {
            const { id, _local, _queued, ...payload } = row;
            const result = await safePublicInsert(table, sanitizePayload(table, payload));
            if (result.ok) {
                removeFromQueue(table, id);
                synced += 1;
            } else if (result.reason === "permission" || result.reason === "auth") {
                break;
            }
        }
    }
    if (synced > 0) notifyFormChanged();
    return synced;
}

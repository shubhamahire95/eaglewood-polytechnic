#!/usr/bin/env node
/**
 * Complete database integration audit — live Supabase probes only.
 * Run: node scripts/full-database-audit.js
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
    SUPABASE_URL,
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    buildAdminAuthHeaders,
    buildPublicAuthHeaders,
} from "./lib/admin-rest.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMAIL = DEFAULT_ADMIN_EMAIL;
const PASS = DEFAULT_ADMIN_PASSWORD;

const CMS_TABLES = [
    "home_slides", "principal_message", "updates", "notices", "courses",
    "departments", "faculty", "facilities", "placements", "gallery", "downloads",
    "footer_blocks", "media_library", "ai_knowledge_base", "ai_prompts",
    "inquiries", "admissions", "contacts", "settings", "admins", "ai_conversations",
];

const RPCS = [
    { name: "verify_legacy_admin", body: { p_email: EMAIL, p_password: PASS } },
    { name: "is_admin", body: {} },
    { name: "legacy_admin_from_headers", body: {} },
    { name: "legacy_admin_session_admin_id", body: {} },
    { name: "create_legacy_admin_session", body: { p_email: EMAIL, p_password: PASS } },
    { name: "validate_legacy_admin_session", body: { p_session_token: "00000000-0000-4000-8000-000000000000" } },
    { name: "destroy_legacy_admin_session", body: { p_session_token: "00000000-0000-4000-8000-000000000000" } },
    { name: "get_admin_login_route", body: { p_email: EMAIL } },
];

const report = { timestamp: new Date().toISOString(), sections: {}, failures: [], missingObjects: [] };

async function rpc(name, body = {}, headers = buildPublicAuthHeaders()) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed = text;
    try { parsed = JSON.parse(text); } catch { /* keep text */ }
    return { status: res.status, body: parsed, raw: text };
}

async function rest(method, path, { headers, body } = {}) {
    const res = await fetch(`${SUPABASE_URL}${path}`, {
        method,
        headers: headers || buildAdminAuthHeaders(EMAIL, PASS),
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed = text;
    try { parsed = JSON.parse(text); } catch { /* keep text */ }
    return { status: res.status, body: parsed, raw: text };
}

function section(title, data) {
    report.sections[title] = data;
    console.log(`\n${"=".repeat(60)}\n${title}\n${"=".repeat(60)}`);
    console.log(typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

// ── STEP 2: RPC audit ───────────────────────────────────────────────────────
console.log("Eaglewood — Full Database Audit\n");

const rpcResults = {};
for (const { name, body } of RPCS) {
    const adminHeaders = buildAdminAuthHeaders(EMAIL, PASS);
    const pub = await rpc(name, body, buildPublicAuthHeaders());
    const adm = await rpc(name, body, adminHeaders);
    rpcResults[name] = { public: pub, withAdminHeaders: adm };
    console.log(`RPC ${name}: public=${pub.status} admin=${adm.status}`);
    if (pub.status === 404 || adm.status === 404) {
        report.missingObjects.push(`function public.${name}()`);
    }
}
section("STEP 2 — RPC functions", rpcResults);

const loginData = rpcResults.verify_legacy_admin?.withAdminHeaders?.body;
const sessionToken = loginData?.session_token || null;
section("STEP 4 — Login response fields", {
    id: loginData?.id,
    email: loginData?.email,
    has_session_token: Boolean(sessionToken),
    session_token_preview: sessionToken ? `${String(sessionToken).slice(0, 8)}…` : null,
});

// is_admin with every auth combination
const isAdminVariants = {
    publishable_only: await rpc("is_admin", {}, buildPublicAuthHeaders()),
    admin_email_password_headers: await rpc("is_admin", {}, buildAdminAuthHeaders(EMAIL, PASS)),
};
if (sessionToken) {
    isAdminVariants.legacy_session_header = await rpc("is_admin", {}, buildAdminAuthHeaders(EMAIL, PASS, {
        "x-legacy-admin-session": sessionToken,
    }));
}
section("STEP 2 — is_admin() variants", isAdminVariants);

// ── STEP 1 & 3: Per-table CRUD probe ────────────────────────────────────────
const crudResults = {};
const insertPayloads = {
    principal_message: { name: "Audit", message: "probe", published: false, status: "hidden", display_order: 9999 },
    home_slides: { title: "Probe", image_url: "assets/images/campus.jpg", published: false, status: "hidden", display_order: 9999 },
    updates: { title: "Probe", description: "x", published: false, status: "hidden", display_order: 9999 },
    notices: { title: "Probe", description: "x", published: false, status: "hidden", display_order: 9999 },
    courses: { title: "Probe", published: false, status: "hidden", display_order: 9999 },
    departments: { title: "Probe", published: false, status: "hidden", display_order: 9999 },
    faculty: { name: "Probe", published: false, status: "hidden", display_order: 9999 },
    facilities: { title: "Probe", published: false, status: "hidden", display_order: 9999 },
    placements: { title: "Probe", published: false, status: "hidden", display_order: 9999 },
    gallery: { title: "Probe", image_url: "assets/images/campus.jpg", published: false, status: "hidden", display_order: 9999 },
    footer_blocks: { block_key: `audit_${Date.now()}`, title: "Probe", published: false, status: "hidden", display_order: 9999 },
    inquiries: { name: "Probe", phone: "9999999999", message: "x" },
    admissions: { student_name: "Probe", phone: "9999999999" },
    contacts: { name: "Probe", email: "probe@test.com", message: "x" },
};

for (const table of CMS_TABLES) {
    const select = await rest("GET", `/rest/v1/${table}?select=id&limit=1`, {
        headers: { ...buildAdminAuthHeaders(EMAIL, PASS), Prefer: "count=exact" },
    });
    const payload = insertPayloads[table];
    let insert = { status: "skipped", body: "no probe payload" };
    if (payload) {
        insert = await rest("POST", `/rest/v1/${table}`, {
            headers: buildAdminAuthHeaders(EMAIL, PASS, { Prefer: "return=representation" }),
            body: payload,
        });
        let insertedId = null;
        if (Array.isArray(insert.body) && insert.body[0]?.id) {
            insertedId = insert.body[0].id;
        }
        if (insertedId) {
            const patch = await rest("PATCH", `/rest/v1/${table}?id=eq.${insertedId}`, {
                headers: buildAdminAuthHeaders(EMAIL, PASS),
                body: { title: table === "home_slides" ? "Patched" : undefined, name: table === "principal_message" ? "Patched" : undefined },
            });
            const del = await rest("DELETE", `/rest/v1/${table}?id=eq.${insertedId}`, {
                headers: buildAdminAuthHeaders(EMAIL, PASS),
            });
            crudResults[table] = { select: select.status, insert: insert.status, insertError: insert.body, patch: patch.status, delete: del.status };
        } else {
            crudResults[table] = { select: select.status, insert: insert.status, insertError: insert.body };
            if (insert.status === 401 || insert.body?.code === "42501") {
                report.failures.push(`${table} INSERT blocked by RLS (42501)`);
            }
        }
    } else {
        crudResults[table] = { select: select.status, insert };
    }
}
section("STEP 1 & 3 — Table CRUD (admin headers)", crudResults);

// Fake ID PATCH (documents client bug if still present)
const fakePatch = await rest("PATCH", "/rest/v1/principal_message?id=eq.local-principal_message-0", {
    headers: buildAdminAuthHeaders(EMAIL, PASS),
    body: { name: "x" },
});
section("STEP 7 — Fake local ID PATCH", fakePatch);

// Storage
const bucket = await rest("GET", "/storage/v1/bucket/cms", { headers: buildPublicAuthHeaders() });
const storageUpload = await rest("POST", "/storage/v1/object/cms/audit-probe.txt", {
    headers: buildAdminAuthHeaders(EMAIL, PASS, { "Content-Type": "text/plain", "x-upsert": "true" }),
    body: "probe",
});
section("STEP 10 — Storage", { bucket, storageUpload });

// Admin row inspection
const adminRow = await rest("GET", `/rest/v1/admins?select=id,email,auth_user_id,role,status&email=eq.${encodeURIComponent(EMAIL)}`, {
    headers: buildAdminAuthHeaders(EMAIL, PASS),
});
section("STEP 4 — Admin row", adminRow);

// Diagnosis
const diagnosis = [];
if (rpcResults.legacy_admin_from_headers?.withAdminHeaders?.status === 404) {
    diagnosis.push("MISSING: public.legacy_admin_from_headers() — is_admin() cannot read x-admin-email / x-admin-password headers");
    report.missingObjects.push("function public.legacy_admin_from_headers()");
}
if (isAdminVariants.admin_email_password_headers?.body === false || isAdminVariants.admin_email_password_headers?.body === "false") {
    diagnosis.push("BROKEN: is_admin() returns false with valid admin email+password headers — RLS verified_admin_manage blocks all writes");
}
if (!sessionToken) {
    diagnosis.push("MISSING: verify_legacy_admin() does not return session_token — migration 006/010 not applied");
}
if (bucket.status !== 200) {
    diagnosis.push("MISSING: storage bucket 'cms'");
    report.missingObjects.push("storage bucket cms");
}
if (fakePatch.status === 400 && fakePatch.body?.code === "22P02") {
    diagnosis.push("CLIENT: PATCH with local-principal_message-0 is invalid UUID (22P02) — must INSERT then UPDATE real UUID");
}

section("DIAGNOSIS", diagnosis);

// Generate minimal fix SQL
const fixSqlPath = join(root, "supabase", "GENERATED_FIX_ADMIN_WRITES.sql");
const fixSql = `-- AUTO-GENERATED ${report.timestamp}
-- Missing objects detected by scripts/full-database-audit.js
-- Apply in Supabase Dashboard → SQL Editor, then re-run: npm run audit:backend

${report.missingObjects.map((o) => `-- MISSING: ${o}`).join("\n")}

-- Full fix (idempotent): supabase/migrations/010_admin_auth_storage_fix.sql
-- Or run: npm run cms:fix  (requires SUPABASE_DB_URL in .env.local)
`;
writeFileSync(fixSqlPath, fixSql);
console.log(`\nWrote ${fixSqlPath}`);

mkdirSync(join(root, "tmp"), { recursive: true });
writeFileSync(join(root, "tmp", "database-audit-report.json"), JSON.stringify(report, null, 2));
console.log("Wrote tmp/database-audit-report.json");

process.exit(report.failures.length > 0 || diagnosis.length > 0 ? 1 : 0);

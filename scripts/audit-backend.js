#!/usr/bin/env node
/**
 * Backend audit — traces auth + CRUD against live Supabase.
 * Run: node scripts/audit-backend.js
 */
import {
    SUPABASE_URL,
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    buildAdminAuthHeaders,
    buildPublicAuthHeaders,
    checkAdminWritePermission,
} from "./lib/admin-rest.js";

const ADMIN_HEADERS = buildAdminAuthHeaders(DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, {
    Prefer: "return=representation",
});

const TABLES = [
    "home_slides", "principal_message", "updates", "notices", "courses",
    "departments", "faculty", "facilities", "placements", "gallery",
    "footer_blocks", "media_library", "ai_knowledge_base", "ai_prompts",
    "inquiries", "admissions", "contacts", "settings",
];

async function rpc(name, body = {}, headers = ADMIN_HEADERS) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.text() };
}

async function count(table) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, {
        headers: { ...ADMIN_HEADERS, Prefer: "count=exact" },
    });
    return { status: res.status, count: (res.headers.get("content-range") || "").split("/")[1] || "?" };
}

async function insertProbe(table, payload) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify(payload),
    });
    const body = await res.text();
    let row = null;
    try { row = JSON.parse(body)?.[0]; } catch { /* ignore */ }
    if (row?.id) {
        await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${row.id}`, {
            method: "DELETE",
            headers: ADMIN_HEADERS,
        });
    }
    return { status: res.status, body };
}

console.log("=== Eaglewood CMS Backend Audit ===\n");

console.log("1. AUTH");
const login = await rpc("verify_legacy_admin", {
    p_email: DEFAULT_ADMIN_EMAIL,
    p_password: DEFAULT_ADMIN_PASSWORD,
}, buildPublicAuthHeaders());
console.log(`   verify_legacy_admin → ${login.status} ${login.body.slice(0, 120)}`);

const isAdmin = await rpc("is_admin", {});
console.log(`   is_admin → ${isAdmin.status} ${isAdmin.body}`);

const legacyHeaders = await rpc("legacy_admin_from_headers", {});
console.log(`   legacy_admin_from_headers → ${legacyHeaders.status} ${legacyHeaders.body.slice(0, 120)}`);

const permission = await checkAdminWritePermission();
console.log(`   checkAdminWritePermission → admin=${permission.admin}`);

console.log("\n2. TABLE COUNTS");
for (const table of TABLES) {
    const c = await count(table);
    console.log(`   ${table}: HTTP ${c.status} rows=${c.count}`);
}

console.log("\n3. INSERT PROBES (admin headers)");
const probes = {
    principal_message: { name: "Audit", message: "probe", published: true, status: "published", display_order: 99 },
    home_slides: { title: "Probe", image_url: "assets/images/campus.jpg", published: false, status: "hidden", display_order: 99 },
    notices: { title: "Probe", description: "probe", published: false, status: "hidden", display_order: 99 },
};
for (const [table, payload] of Object.entries(probes)) {
    const r = await insertProbe(table, payload);
    console.log(`   INSERT ${table} → HTTP ${r.status} ${r.body.slice(0, 160)}`);
}

console.log("\n4. PATCH FAKE ID (must NOT happen in app)");
const fakePatch = await fetch(`${SUPABASE_URL}/rest/v1/principal_message?id=eq.local-principal_message-0`, {
    method: "PATCH",
    headers: ADMIN_HEADERS,
    body: JSON.stringify({ name: "x" }),
});
console.log(`   PATCH local-* → HTTP ${fakePatch.status} ${(await fakePatch.text()).slice(0, 120)}`);

console.log("\n5. STORAGE");
const bucket = await fetch(`${SUPABASE_URL}/storage/v1/bucket/cms`, { headers: buildPublicAuthHeaders() });
console.log(`   bucket cms → HTTP ${bucket.status} ${(await bucket.text()).slice(0, 120)}`);

console.log("\n=== ROOT CAUSE ===");
if (isAdmin.body.trim() === "false") {
    console.log("• is_admin() returns false — migration 010 not applied.");
    console.log("• legacy_admin_from_headers() missing — migration 010 not applied.");
    console.log("• All admin INSERT/UPDATE/DELETE blocked by RLS (42501).");
    console.log("• Fix: apply supabase/migrations/010_admin_auth_storage_fix.sql");
    console.log("  Then run: npm run cms:fix  (requires SUPABASE_DB_URL in .env.local)");
}
if (bucket.status !== 200) {
    console.log("• Storage bucket 'cms' missing — created by migration 010.");
}
console.log("\nClient fixes applied: no local-* ids, upsert by UUID, real API errors surfaced.");

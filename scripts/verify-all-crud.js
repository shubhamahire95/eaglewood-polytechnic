#!/usr/bin/env node
/**
 * Post-migration verification — all admin CRUD + storage.
 * Run after applying GENERATED_FIX_ADMIN_WRITES.sql:
 *   node scripts/verify-all-crud.js
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
    SUPABASE_URL,
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    buildAdminJsonHeaders,
    buildPublicAuthHeaders,
    stripBodyHeaders,
} from "./lib/admin-rest.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const EMAIL = DEFAULT_ADMIN_EMAIL;
const PASS = DEFAULT_ADMIN_PASSWORD;

const results = [];
let sessionToken = null;

function pass(label) { results.push({ label, ok: true }); console.log(`✓ ${label}`); }
function fail(label, detail) { results.push({ label, ok: false, detail }); console.log(`✗ ${label}: ${detail}`); }

function adminHeaders(extra = {}) {
    const h = buildAdminJsonHeaders(EMAIL, PASS, extra);
    if (sessionToken) h["x-legacy-admin-session"] = sessionToken;
    return h;
}

async function rpc(name, body = {}, headers = buildPublicAuthHeaders()) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: "POST", headers, body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed = text;
    try { parsed = JSON.parse(text); } catch { /* keep */ }
    return { status: res.status, body: parsed };
}

async function rest(method, path, { headers, body, binary } = {}) {
    let resolvedHeaders = headers || adminHeaders();
    if (body === undefined && (method === "DELETE" || method === "GET" || method === "HEAD")) {
        resolvedHeaders = stripBodyHeaders(resolvedHeaders);
    }
    const init = { method, headers: resolvedHeaders };
    if (body !== undefined) init.body = binary ? body : JSON.stringify(body);
    const res = await fetch(`${SUPABASE_URL}${path}`, init);
    const text = await res.text();
    let parsed = text;
    try { parsed = JSON.parse(text); } catch { /* keep */ }
    return { status: res.status, body: parsed, raw: text };
}

async function crudTable(table, insertPayload, patchField = "title") {
    const ins = await rest("POST", `/rest/v1/${table}`, {
        headers: adminHeaders({ Prefer: "return=representation" }),
        body: insertPayload,
    });
    if (ins.status !== 201) return fail(`${table} INSERT`, `${ins.status} ${ins.raw?.slice(0, 120)}`);
    const id = Array.isArray(ins.body) ? ins.body[0]?.id : ins.body?.id;
    if (!id) return fail(`${table} INSERT id`, "no uuid returned");

    const patch = { [patchField]: `Patched ${Date.now()}` };
    const upd = await rest("PATCH", `/rest/v1/${table}?id=eq.${id}`, { body: patch });
    if (upd.status !== 204 && upd.status !== 200) return fail(`${table} UPDATE`, `${upd.status}`);

    const del = await rest("DELETE", `/rest/v1/${table}?id=eq.${id}`);
    if (del.status !== 204 && del.status !== 200) return fail(`${table} DELETE`, `${del.status}`);

    pass(`${table} CRUD`);
    return id;
}

console.log("=== Post-fix CRUD Verification ===\n");

// Login
const login = await rpc("verify_legacy_admin", { p_email: EMAIL, p_password: PASS });
if (login.status !== 200 || !login.body?.id) {
    fail("Login", `${login.status} ${JSON.stringify(login.body)}`);
} else {
    pass("Login");
    if (login.body.session_token) {
        sessionToken = login.body.session_token;
        pass("Session token");
    } else {
        fail("Session token", "missing from verify_legacy_admin response");
    }
}

// is_admin
const isAdmin = await rpc("is_admin", {}, adminHeaders());
if (isAdmin.body === true) pass("is_admin() == true");
else fail("is_admin() == true", String(isAdmin.body));

// Header auth RPC
const legacyHeaders = await rpc("legacy_admin_from_headers", {}, adminHeaders());
if (legacyHeaders.status === 200 && legacyHeaders.body) pass("Header authentication (legacy_admin_from_headers)");
else fail("Header authentication", `${legacyHeaders.status} ${JSON.stringify(legacyHeaders.body)}`);

// No fake IDs
const fake = await rest("PATCH", "/rest/v1/principal_message?id=eq.local-principal_message-0", { body: { name: "x" } });
if (fake.status === 400 && fake.body?.code === "22P02") pass("Zero fake IDs (rejects local-*)");
else fail("Zero fake IDs", `unexpected ${fake.status}`);

// CMS CRUD
await crudTable("principal_message", { name: "Test", message: "m", published: false, status: "hidden", display_order: 9999 }, "name");
await crudTable("home_slides", { title: "Test", image_url: "assets/images/campus.jpg", published: false, status: "hidden", display_order: 9999 });
await crudTable("courses", { title: "Test Course", published: false, status: "hidden", display_order: 9999 });
await crudTable("gallery", { title: "Test", image_url: "assets/images/campus.jpg", published: false, status: "hidden", display_order: 9999 });
await crudTable("facilities", { title: "Test", published: false, status: "hidden", display_order: 9999 });
await crudTable("placements", { title: "Test", published: false, status: "hidden", display_order: 9999 });
await crudTable("notices", { title: "Test", description: "d", published: false, status: "hidden", display_order: 9999 });
await crudTable("updates", { title: "Test", description: "d", published: false, status: "hidden", display_order: 9999 });
await crudTable("downloads", { title: "Test Download", file_url: "https://example.com/test.pdf", published: false, status: "hidden", display_order: 9999 });
await crudTable("footer_blocks", { block_key: `test_${Date.now()}`, title: "Test", published: false, status: "hidden", display_order: 9999 });
await crudTable("ai_knowledge_base", { question: "Q?", answer: "A", published: false, status: "hidden", display_order: 9999 }, "question");
await crudTable("ai_prompts", { name: "Test", prompt: "p", published: false, status: "hidden", display_order: 9999 }, "name");

// Forms
const inq = await rest("POST", "/rest/v1/inquiries", {
    headers: adminHeaders({ Prefer: "return=representation" }),
    body: { name: "Test", phone: "9999999999", message: "m" },
});
if (inq.status === 201) {
    pass("Inquiry save");
    const id = inq.body?.[0]?.id;
    if (id) await rest("DELETE", `/rest/v1/inquiries?id=eq.${id}`);
} else fail("Inquiry save", `${inq.status}`);

const adm = await rest("POST", "/rest/v1/admissions", {
    headers: adminHeaders({ Prefer: "return=representation" }),
    body: { student_name: "Test", phone: "9999999999" },
});
if (adm.status === 201) {
    pass("Admission save");
    const id = adm.body?.[0]?.id;
    if (id) await rest("DELETE", `/rest/v1/admissions?id=eq.${id}`);
} else fail("Admission save", `${adm.status}`);

const con = await rest("POST", "/rest/v1/contacts", {
    headers: adminHeaders({ Prefer: "return=representation" }),
    body: { name: "Test", email: "t@t.com", message: "m" },
});
if (con.status === 201) {
    pass("Contact save");
    const id = con.body?.[0]?.id;
    if (id) await rest("DELETE", `/rest/v1/contacts?id=eq.${id}`);
} else fail("Contact save", `${con.status}`);

// Storage upload + delete
const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
);
const path = `audit/test-${Date.now()}.png`;
const up = await rest("POST", `/storage/v1/object/cms/${path}`, {
    headers: adminHeaders({ "Content-Type": "image/png", "x-upsert": "true" }),
    body: png,
    binary: true,
});
if (up.status === 200 || up.status === 201) {
    pass("Storage upload");
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const del = await rest("DELETE", `/storage/v1/object/cms/${encodedPath}`);
    if (del.status === 200 || del.status === 204) pass("Image delete");
    else fail("Image delete", `${del.status} ${del.raw?.slice(0, 120) || ""}`);
} else {
    fail("Storage upload", `${up.status} ${up.raw?.slice(0, 120)}`);
}

// Seed check
const seedTables = ["principal_message", "home_slides", "footer_blocks", "settings", "notices", "updates"];
for (const table of seedTables) {
    const res = await rest("GET", `/rest/v1/${table}?select=id&limit=1`, {
        headers: { ...adminHeaders(), Prefer: "count=exact" },
    });
    const count = Number((res.headers?.get ? "0" : "0") || 0);
    // fetch doesn't expose headers in our wrapper — recount
    const c2 = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, {
        headers: { ...adminHeaders(), Prefer: "count=exact" },
    });
    const n = Number((c2.headers.get("content-range") || "").split("/")[1] || 0);
    if (n > 0) pass(`Seeded: ${table} (${n} rows)`);
    else fail(`Seeded: ${table}`, "empty");
}

const failed = results.filter((r) => !r.ok);
console.log(`\n=== ${failed.length ? "FAIL" : "PASS"}: ${results.filter((r) => r.ok).length}/${results.length} checks ===`);
process.exit(failed.length ? 1 : 0);

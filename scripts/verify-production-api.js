#!/usr/bin/env node
/**
 * API-level production verification (no browser).
 * Tests admin header auth, CRUD, public form inserts, and seeded content.
 */
const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";
const ADMIN_EMAIL = "admin@eaglewoodpoly.in";
const ADMIN_PASSWORD = "admin123";

const ADMIN_HEADERS = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
    "x-admin-email": ADMIN_EMAIL,
    "x-admin-password": ADMIN_PASSWORD,
    Prefer: "return=representation",
};

const PUBLIC_HEADERS = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
};

const CONTENT_TABLES = [
    "home_slides", "principal_message", "updates", "notices", "courses",
    "departments", "facilities", "gallery", "footer_blocks", "settings",
];

async function count(table, publishedOnly = false) {
    const filter = publishedOnly && !["settings", "admins"].includes(table) ? "&published=eq.true" : "";
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1${filter}`, {
        headers: { ...PUBLIC_HEADERS, Prefer: "count=exact" },
    });
    return Number((res.headers.get("content-range") || "").split("/")[1] || 0);
}

async function adminInsert(table, payload) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: ADMIN_HEADERS,
        body: JSON.stringify(payload),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text };
}

async function publicInsert(table, payload) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: PUBLIC_HEADERS,
        body: JSON.stringify(payload),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text };
}

async function adminDelete(table, id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: "DELETE",
        headers: ADMIN_HEADERS,
    });
    return res.ok;
}

async function main() {
    const failures = [];
    console.log("Production API verification\n");

    const login = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_legacy_admin`, {
        method: "POST",
        headers: PUBLIC_HEADERS,
        body: JSON.stringify({ p_email: ADMIN_EMAIL, p_password: ADMIN_PASSWORD }),
    });
    if (!login.ok) failures.push(`verify_legacy_admin: ${login.status}`);
    else console.log("✓ Admin login RPC");

    const principal = await adminInsert("principal_message", {
        name: "API Test Principal",
        message: "Production verification message",
        published: true,
        status: "published",
        display_order: 99,
    });
    if (!principal.ok) failures.push(`principal insert: ${principal.status} ${principal.body}`);
    else {
        console.log("✓ Admin CRUD insert (principal_message)");
        const row = JSON.parse(principal.body)[0];
        if (row?.id) await adminDelete("principal_message", row.id);
    }

    for (const table of ["inquiries", "admissions", "contacts"]) {
        const payload = table === "admissions"
            ? { student_name: "API Test", phone: "9000000001", email: "api@test.com", course: "Civil", status: "new", application_status: "new", payment_status: "pending" }
            : table === "contacts"
                ? { name: "API Test", email: "api@test.com", phone: "9000000001", subject: "Test", message: "Hello", status: "new", reply_status: "pending" }
                : { name: "API Test", phone: "9000000001", email: "api@test.com", course: "Civil", message: "Hello", status: "new", reply_status: "pending" };
        const ins = await publicInsert(table, payload);
        if (!ins.ok) failures.push(`${table} insert: ${ins.status} ${ins.body}`);
        else {
            console.log(`✓ Public form insert (${table})`);
            const row = JSON.parse(ins.body)[0];
            if (row?.id) await adminDelete(table, row.id);
        }
    }

    const bootstrap = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bootstrap_cms_default_content`, {
        method: "POST",
        headers: PUBLIC_HEADERS,
        body: "{}",
    });
    if (bootstrap.status === 404) console.log("○ bootstrap_cms_default_content not deployed (expected — using direct seed)");
    else console.log(`✓ Bootstrap RPC (${bootstrap.status})`);

    for (const table of CONTENT_TABLES) {
        const n = await count(table, table !== "settings");
        const ok = n > 0;
        console.log(`${ok ? "✓" : "✗"} ${table}: ${n} row(s)`);
        if (!ok) failures.push(`${table} empty`);
    }

    const storage = await fetch(`${SUPABASE_URL}/storage/v1/bucket/cms`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    if (!storage.ok) failures.push(`storage bucket cms: ${storage.status}`);
    else console.log("✓ Storage bucket cms");

    if (failures.length) {
        console.log(`\nFAIL (${failures.length}):`);
        failures.forEach((f) => console.log(`  • ${f}`));
        process.exit(1);
    }
    console.log("\nPASS: Production API verification complete.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

#!/usr/bin/env node
/**
 * API-level production verification (no browser).
 * Tests admin header auth, CRUD, public form inserts, and seeded content.
 */
import {
    SUPABASE_URL,
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    buildAdminJsonHeaders,
    buildPublicAuthHeaders,
    checkAdminWritePermission,
    stripBodyHeaders,
} from "./lib/admin-rest.js";

const ADMIN_HEADERS = buildAdminJsonHeaders(DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, {
    Prefer: "return=representation",
});

const PUBLIC_HEADERS = buildPublicAuthHeaders({ Prefer: "return=minimal" });

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
        headers: stripBodyHeaders(ADMIN_HEADERS),
    });
    return res.ok;
}

async function main() {
    const failures = [];
    console.log("Production API verification\n");

    const login = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_legacy_admin`, {
        method: "POST",
        headers: PUBLIC_HEADERS,
        body: JSON.stringify({ p_email: DEFAULT_ADMIN_EMAIL, p_password: DEFAULT_ADMIN_PASSWORD }),
    });
    if (!login.ok) failures.push(`verify_legacy_admin: ${login.status}`);
    else console.log("✓ Admin login RPC");

    const permission = await checkAdminWritePermission();
    if (!permission.admin) {
        failures.push(`is_admin RPC: false (migration 010 not applied — run npm run cms:fix)`);
    } else {
        console.log("✓ Admin write permission (is_admin)");
    }

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
            const cleanup = await fetch(`${SUPABASE_URL}/rest/v1/${table}?email=eq.api@test.com&select=id&limit=5`, {
                headers: ADMIN_HEADERS,
            });
            if (cleanup.ok) {
                const rows = await cleanup.json();
                for (const row of rows) {
                    if (row?.id) await adminDelete(table, row.id);
                }
            }
        }
    }

    const bootstrap = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bootstrap_cms_default_content`, {
        method: "POST",
        headers: PUBLIC_HEADERS,
        body: "{}",
    });
    if (bootstrap.status === 404) {
        console.log("○ bootstrap RPC not used (admin REST seed)");
    } else if (bootstrap.ok) {
        console.log("✓ bootstrap_cms_default_content RPC (optional)");
    }

    for (const table of CONTENT_TABLES) {
        const n = await count(table, table !== "settings");
        const ok = n > 0;
        console.log(`${ok ? "✓" : "✗"} ${table}: ${n} row(s)`);
        if (!ok) failures.push(`${table} empty`);
    }

    const storagePath = `probe/api-${Date.now()}.png`;
    const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/cms/${storagePath}`, {
        method: "POST",
        headers: {
            ...ADMIN_HEADERS,
            "Content-Type": "image/png",
        },
        body: Buffer.from("89504e470d0a1a0a", "hex"),
    });
    if (!upload.ok) {
        const body = await upload.text();
        failures.push(`storage upload: ${upload.status} ${body}`);
    } else {
        console.log("✓ Storage bucket cms (verified via upload)");
        const delHeaders = stripBodyHeaders(ADMIN_HEADERS);
        await fetch(`${SUPABASE_URL}/storage/v1/object/cms/${storagePath}`, {
            method: "DELETE",
            headers: delHeaders,
        });
    }

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

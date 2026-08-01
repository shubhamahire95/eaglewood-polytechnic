#!/usr/bin/env node
/**
 * Full project audit — tables, RPCs, auth, CMS content counts.
 * Usage: node scripts/full-project-audit.js
 */
const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const TABLES = [
    "admins", "settings", "home_slides", "principal_message", "updates", "notices",
    "courses", "departments", "faculty", "facilities", "placements", "gallery",
    "footer_blocks", "media_library", "contacts", "admissions", "inquiries",
    "ai_knowledge_base", "ai_prompts", "ai_conversations",
];

const RPCS = [
    "verify_legacy_admin",
    "create_legacy_admin_session",
    "validate_legacy_admin_session",
    "revoke_legacy_admin_session",
    "destroy_legacy_admin_session",
    "bootstrap_cms_default_content",
    "bootstrap_admin_auth_links",
];

async function tableAudit(table) {
    const totalRes = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, {
        headers: { ...headers, Prefer: "count=exact" },
    });
    const totalRange = totalRes.headers.get("content-range") || "";
    const total = Number(totalRange.split("/")[1] || 0);
    let published = total;
    if (["settings", "admins", "inquiries", "admissions", "contacts", "ai_conversations"].includes(table)) {
        published = total;
    } else {
        const pubRes = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&published=eq.true&limit=1`, {
            headers: { ...headers, Prefer: "count=exact" },
        });
        const pubRange = pubRes.headers.get("content-range") || "";
        published = Number(pubRange.split("/")[1] || 0);
    }
    return { table, exists: totalRes.ok, status: totalRes.status, total, published };
}

async function rpcAudit(fn) {
    let body = {};
    if (fn === "verify_legacy_admin" || fn === "create_legacy_admin_session") {
        body = { p_email: "audit@invalid.local", p_password: "x" };
    } else if (fn === "validate_legacy_admin_session" || fn === "revoke_legacy_admin_session" || fn === "destroy_legacy_admin_session") {
        body = { p_session_token: "00000000-0000-0000-0000-000000000000" };
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
    const text = await res.text();
    const missing = text.includes("PGRST202");
    return { fn, status: res.status, deployed: !missing, note: missing ? "NOT DEPLOYED" : "deployed" };
}

async function main() {
    console.log("Eaglewood Polytechnic — Full Project Audit\n");
    console.log(`Supabase: ${SUPABASE_URL}\n`);

    console.log("=== DATABASE TABLES ===");
    const tables = [];
    for (const table of TABLES) {
        const row = await tableAudit(table);
        tables.push(row);
        const mark = !row.exists ? "MISSING" : row.published === 0 ? "EMPTY" : "OK";
        console.log(`[${mark}] ${table.padEnd(22)} total=${row.total} published=${row.published}`);
    }

    console.log("\n=== RPC FUNCTIONS ===");
    const rpcs = [];
    for (const fn of RPCS) {
        const row = await rpcAudit(fn);
        rpcs.push(row);
        console.log(`[${row.deployed ? "OK" : "MISSING"}] ${fn} (${row.status})`);
    }

    console.log("\n=== AUTH ===");
    const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers,
        body: JSON.stringify({ email: "admin@eaglewoodpoly.in", password: "admin123" }),
    });
    const authBody = await auth.json().catch(() => ({}));
    console.log(`Supabase Auth signIn: ${auth.status} ${authBody.error_code || authBody.code || "ok"}`);
    const admins = await fetch(`${SUPABASE_URL}/rest/v1/admins?select=email,auth_user_id,status&limit=5`, { headers });
    const adminRows = await admins.json();
    console.log("admins:", JSON.stringify(adminRows));

    const bucket = await fetch(`${SUPABASE_URL}/storage/v1/bucket/cms`, { headers });
    console.log(`Storage bucket cms: ${bucket.status} ${bucket.ok ? "OK" : "MISSING"}`);

    console.log("\n=== ROOT CAUSES ===");
    const emptyContent = tables.filter((t) => t.exists && t.published === 0 && !["admins", "inquiries", "admissions", "contacts", "ai_conversations", "media_library"].includes(t.table));
    if (emptyContent.length) {
        console.log(`• ${emptyContent.length} CMS content tables are EMPTY → admin shows "No content yet"; homepage sections hidden in strict mode.`);
    }
    if (!rpcs.find((r) => r.fn === "create_legacy_admin_session")?.deployed) {
        console.log("• create_legacy_admin_session NOT DEPLOYED → admin writes fail without Supabase Auth JWT (run RUN_ALL_MIGRATIONS.sql migration 006).");
    }
    if (authBody.error_code === "email_not_confirmed") {
        console.log("• admin@eaglewoodpoly.in email NOT CONFIRMED → production Supabase Auth login blocked (run fix_admin_login.sql).");
    }
    const adminRow = adminRows?.[0];
    if (adminRow && !adminRow.auth_user_id) {
        console.log("• admins.auth_user_id is NULL → RLS is_admin() cannot match JWT user.");
    }
    if (!rpcs.find((r) => r.fn === "bootstrap_cms_default_content")?.deployed) {
        console.log("• bootstrap_cms_default_content NOT DEPLOYED (expected — auto demo seed disabled).");
    }

    console.log("\n=== HOMEPAGE CONTENT SOURCES (verified) ===");
    const sources = [
        ["Hero", "home_slides", tables.find((t) => t.table === "home_slides")?.published || 0],
        ["Principal", "principal_message", tables.find((t) => t.table === "principal_message")?.published || 0],
        ["Mission/Vision", "settings", tables.find((t) => t.table === "settings")?.published || 0],
        ["Updates", "updates", tables.find((t) => t.table === "updates")?.published || 0],
        ["Notices", "notices", tables.find((t) => t.table === "notices")?.published || 0],
        ["Courses", "courses", tables.find((t) => t.table === "courses")?.published || 0],
        ["Departments", "departments", tables.find((t) => t.table === "departments")?.published || 0],
        ["Facilities", "facilities", tables.find((t) => t.table === "facilities")?.published || 0],
        ["Placements", "placements", tables.find((t) => t.table === "placements")?.published || 0],
        ["Gallery", "gallery", tables.find((t) => t.table === "gallery")?.published || 0],
        ["Footer", "footer_blocks + settings", (tables.find((t) => t.table === "footer_blocks")?.published || 0) + (tables.find((t) => t.table === "settings")?.published || 0)],
    ];
    sources.forEach(([section, table, count]) => {
        console.log(`${section.padEnd(16)} → ${table.padEnd(24)} ${count > 0 ? "Supabase ✓" : "EMPTY — section hidden on homepage"}`);
    });
    console.log("about/courses/departments/gallery/infrastructure pages → still HARDCODED HTML (not wired to CMS)");

    const issues = emptyContent.length + (authBody.error_code === "email_not_confirmed" ? 1 : 0) + (!rpcs.find((r) => r.fn === "create_legacy_admin_session")?.deployed ? 1 : 0);
    process.exit(issues > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

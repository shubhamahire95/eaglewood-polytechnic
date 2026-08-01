/**
 * Verifies per-table CMS connection logic (mirrors logCmsConnectionDiagnostics).
 * Usage: node scripts/verify-cms-connection.js
 */
const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const CMS_TABLES = [
    "admins", "settings", "home_slides", "updates", "notices", "principal_message",
    "courses", "departments", "faculty", "facilities", "placements", "gallery",
    "media_library", "footer_blocks", "contacts", "inquiries", "admissions",
    "ai_knowledge_base", "ai_prompts", "ai_conversations",
];

function isMissing(status, body) {
    return status === 404 || body?.code === "PGRST205" || body?.code === "42P01";
}

async function probeTable(table) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, { headers });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return "ok";
    if (isMissing(res.status, body)) return "missing";
    return "error";
}

async function main() {
    console.log("Supabase URL:", SUPABASE_URL);
    console.log("Project ID:", new URL(SUPABASE_URL).hostname.split(".")[0]);
    console.log("");

    const results = {};
    for (const table of CMS_TABLES) {
        results[table] = await probeTable(table);
        console.log(results[table] === "ok" ? `✓ ${table} — Exists` : `✗ ${table} — ${results[table]}`);
    }

    const missing = CMS_TABLES.filter((t) => results[t] === "missing");
    const found = CMS_TABLES.length - missing.length;
    console.log("\nMissing tables:", missing.length ? missing : "[]");
    console.log(`Tables found: ${found}/${CMS_TABLES.length}`);

    const storageRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/cms`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: "", limit: 1 }),
    });
    console.log("Storage bucket:", storageRes.ok ? "✓ Ready" : `✗ HTTP ${storageRes.status}`);

    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_admin_login_route`, {
        method: "POST",
        headers,
        body: JSON.stringify({ p_email: "__schema_probe__@invalid.local" }),
    });
    console.log("RPC status:", rpcRes.ok ? "✓ Ready" : `✗ HTTP ${rpcRes.status}`);

    if (found !== CMS_TABLES.length) {
        console.error("\nFAIL: not all tables reachable");
        process.exit(1);
    }
    console.log("\nPASS: 20/20 tables found");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

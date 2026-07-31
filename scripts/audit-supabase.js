#!/usr/bin/env node
/**
 * Full Supabase backend audit — tables, columns, RPCs, storage buckets.
 * Usage: node scripts/audit-supabase.js
 */
const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";

const TABLES = [
    "admins", "settings", "home_slides", "updates", "notices", "principal_message",
    "courses", "departments", "faculty", "facilities", "placements", "gallery",
    "media_library", "footer_blocks", "inquiries", "admissions", "contacts",
    "ai_knowledge_base", "ai_prompts", "ai_conversations",
];

const RPCS = ["get_admin_login_route", "verify_legacy_admin"];

const ADMIN_COLUMNS = ["id", "auth_user_id", "name", "email", "password", "role", "permissions", "status", "created_at", "updated_at"];

const BUCKETS = ["cms"];

const headers = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
};

async function probeTable(table) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, { headers });
    return { table, status: res.status, ok: res.ok };
}

async function probeColumn(table, column) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${column}&limit=0`, { headers });
    const body = await res.json().catch(() => ({}));
    return { table, column, ok: res.ok, status: res.status, code: body.code };
}

async function probeRpc(fn) {
    const params = fn === "get_admin_login_route"
        ? { p_email: "__audit__@invalid.local" }
        : { p_email: "__audit__@invalid.local", p_password: "x" };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers,
        body: JSON.stringify(params),
    });
    const body = await res.json().catch(() => ({}));
    return { fn, ok: res.ok, status: res.status, code: body.code };
}

async function probeBucket(bucket) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${bucket}`, { headers });
    return { bucket, ok: res.ok, status: res.status };
}

async function main() {
    console.log("Eaglewood Supabase Backend Audit\n");
    console.log(`Project: ${SUPABASE_URL}\n`);

    const tableResults = await Promise.all(TABLES.map(probeTable));
    const missingTables = tableResults.filter((r) => !r.ok);

    console.log("TABLES");
    tableResults.forEach((r) => console.log(`  ${r.ok ? "OK " : "ERR"} ${r.status} ${r.table}`));

    console.log("\nADMINS COLUMNS");
    const colResults = await Promise.all(ADMIN_COLUMNS.map((c) => probeColumn("admins", c)));
    const missingColumns = colResults.filter((r) => !r.ok);
    colResults.forEach((r) => console.log(`  ${r.ok ? "OK " : "ERR"} ${r.column}${r.code ? ` (${r.code})` : ""}`));

    console.log("\nRPC FUNCTIONS");
    const rpcResults = await Promise.all(RPCS.map(probeRpc));
    const missingRpc = rpcResults.filter((r) => !r.ok);
    rpcResults.forEach((r) => console.log(`  ${r.ok ? "OK " : "ERR"} ${r.status} ${r.fn}${r.code ? ` (${r.code})` : ""}`));

    console.log("\nSTORAGE BUCKETS");
    const bucketResults = await Promise.all(BUCKETS.map(probeBucket));
    const missingBuckets = bucketResults.filter((r) => !r.ok);
    bucketResults.forEach((r) => console.log(`  ${r.ok ? "OK " : "ERR"} ${r.status} ${r.bucket}`));

    console.log("\nSUMMARY");
    console.log(`  Missing tables:  ${missingTables.length ? missingTables.map((t) => t.table).join(", ") : "none"}`);
    console.log(`  Missing columns: ${missingColumns.length ? missingColumns.map((c) => c.column).join(", ") : "none"}`);
    console.log(`  Missing RPC:     ${missingRpc.length ? missingRpc.map((r) => r.fn).join(", ") : "none"}`);
    console.log(`  Missing buckets: ${missingBuckets.length ? missingBuckets.map((b) => b.bucket).join(", ") : "none"}`);

    if (missingTables.length || missingColumns.length || missingRpc.length || missingBuckets.length) {
        console.log("\nAction: Run supabase/RUN_ALL_MIGRATIONS.sql in Supabase SQL Editor, then click Retry in admin dashboard.");
        process.exit(1);
    }
    console.log("\nAll checks passed.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

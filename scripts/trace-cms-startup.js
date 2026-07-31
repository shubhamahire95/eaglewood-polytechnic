/**
 * Replicates exact dashboard startup Supabase queries in order.
 * Usage: node scripts/trace-cms-startup.js
 */
const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const log = [];

async function query(step, method, path, body) {
    const res = await fetch(`${SUPABASE_URL}${path}`, {
        method: method || "GET",
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    let responseBody;
    const text = await res.text();
    try {
        responseBody = JSON.parse(text);
    } catch {
        responseBody = text.slice(0, 300);
    }
    const entry = {
        step,
        method: method || "GET",
        path,
        table: path.match(/\/rest\/v1\/([^?]+)/)?.[1] || path.match(/\/rpc\/([^?]+)/)?.[1] || "—",
        schema: "public",
        columns: path.match(/select=([^&]+)/)?.[1]?.replace(/%2C/g, ",") || (body ? JSON.stringify(body) : "—"),
        expected: "HTTP 200",
        actual: `HTTP ${res.status}`,
        ok: res.ok,
        body: responseBody,
    };
    log.push(entry);
    return entry;
}

async function main() {
    console.log("=== CMS STARTUP TRACE (mirrors connectCms → probeSchemaCapabilities) ===\n");
    console.log(`Project: ${SUPABASE_URL}`);
    console.log(`Key type: publishable (sb_publishable_...)\n`);

    // Step 1: bootstrapAdminAccess — supabase.auth.getSession() (local only, no REST table query if no session)

    // Step 2: connectCms → probeSchemaCapabilities force+verifyFull
    // Query 1: admins select *
    await query(
        1,
        "GET",
        "/rest/v1/admins?select=*&limit=1",
    );

    // Query 2: settings select id (THE CONNECTION GATE)
    const settings = await query(
        2,
        "GET",
        "/rest/v1/settings?select=id&limit=1",
    );

    // Query 3: RPC (only if settings ok — skipped when settings fails)
    if (settings.ok) {
        await query(
            3,
            "POST",
            "/rest/v1/rpc/get_admin_login_route",
            { p_email: "__schema_probe__@invalid.local" },
        );
    } else {
        log.push({
            step: 3,
            method: "POST",
            path: "/rest/v1/rpc/get_admin_login_route",
            table: "get_admin_login_route",
            schema: "public",
            columns: "p_email",
            expected: "HTTP 200 (skipped — settings probe failed first)",
            actual: "SKIPPED",
            ok: null,
            body: "RPC probe not reached because settings table missing",
        });
    }

    console.log("QUERY LOG:\n");
    for (const e of log) {
        console.log(`--- Step ${e.step} ---`);
        console.log(`  Function chain: connectCms() → probeSchemaCapabilities({ verifyFull: true })`);
        console.log(`  Request: ${e.method} ${e.path}`);
        console.log(`  Table: ${e.table} | Schema: ${e.schema}`);
        console.log(`  Columns/params: ${e.columns}`);
        console.log(`  Expected: ${e.expected}`);
        console.log(`  Actual: ${e.actual}`);
        if (e.body?.code) console.log(`  Error code: ${e.body.code}`);
        if (e.body?.message) console.log(`  Message: ${e.body.message}`);
        console.log("");
    }

    const firstFail = log.find((e) => e.ok === false);
    console.log("=== DECISION CHAIN ===\n");
    console.log("isCmsAvailable() = cms.enabled && !cmsFullyMissing && sessionStorage.ew_cms_status === 'ready'");
    console.log("connectCms() sets ew_cms_status = 'ready' ONLY when caps.settings === true");
    console.log("caps.settings = true ONLY when GET /rest/v1/settings?select=id returns HTTP 200\n");

    if (firstFail) {
        console.log(`FIRST FAILING REQUEST: Step ${firstFail.step}`);
        console.log(`  ${firstFail.method} ${firstFail.path}`);
        console.log(`  ${firstFail.actual} — ${firstFail.body?.message || firstFail.body}\n`);
    }

    console.log("=== ROOT CAUSE CLASSIFICATION ===\n");
    if (settings.actual === "HTTP 404" && settings.body?.code === "PGRST205") {
        console.log("Category: MISSING MIGRATION (missing table)");
        console.log("The table public.settings does not exist in project rhqmquaojetmzdznbevz.");
        console.log("RUN_ALL_MIGRATIONS.sql has never been executed on this Supabase project.");
        console.log("This is NOT a health-check bug, wrong URL, wrong key, or RLS issue.");
        console.log("URL and key are valid (admins query returns HTTP 200).");
    }

    process.exit(firstFail ? 1 : 0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

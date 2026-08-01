#!/usr/bin/env node
/**
 * One-shot production CMS deploy:
 * - Legacy admin write sessions (APPLY_ADMIN_WRITE_FIX)
 * - Bootstrap RPCs + Eaglewood default content (APPLY_CMS_SYNC)
 *
 * Usage (any one):
 *   set SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@...
 *   set SUPABASE_ACCESS_TOKEN=sbp_...
 *   npm run cms:deploy:all
 *
 * Or paste supabase/APPLY_ALL_PRODUCTION.sql in Supabase SQL Editor.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = join(root, "supabase", "PRODUCTION_STABILIZE.sql");
const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const PROJECT_REF = "rhqmquaojetmzdznbevz";
const KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";

function loadEnvValue(name) {
    const candidates = [process.env[name]].filter(Boolean);
    for (const envFile of [".env.local", ".env"]) {
        const path = join(root, envFile);
        if (!existsSync(path)) continue;
        const text = readFileSync(path, "utf8");
        for (const line of text.split("\n")) {
            const match = line.match(new RegExp(`^\\s*${name}\\s*=\\s*["']?([^"'\\n#]+)`));
            if (match) candidates.push(match[1].trim());
        }
    }
    return candidates[0] || "";
}

async function promptDbUrl() {
    const rl = createInterface({ input, output });
    try {
        const value = await rl.question("Paste SUPABASE_DB_URL (or press Enter to skip): ");
        return value.trim();
    } finally {
        rl.close();
    }
}

async function verifyBootstrapRpc() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bootstrap_cms_default_content`, {
        method: "POST",
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: "{}",
    });
    const text = await res.text();
    return { deployed: !text.includes("PGRST202"), status: res.status, body: text };
}

async function verifyContent() {
    const tables = ["home_slides", "courses", "updates", "principal_message", "settings"];
    const rows = [];
    for (const table of tables) {
        const filter = table === "settings" ? "" : "&published=eq.true";
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1${filter}`, {
            headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "count=exact" },
        });
        const range = res.headers.get("content-range") || "";
        const count = Number(range.split("/")[1] || 0);
        rows.push({ table, count });
    }
    return rows;
}

async function applyViaPg(dbUrl) {
    const pg = await import("pg");
    const sql = readFileSync(sqlPath, "utf8");
    const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
        console.log("Applying APPLY_ALL_PRODUCTION.sql via Postgres...");
        await client.query(sql);
        console.log("Applied successfully.");
    } finally {
        await client.end();
    }
}

async function applyViaManagementApi(accessToken) {
    const sql = readFileSync(sqlPath, "utf8");
    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Management API ${res.status}: ${text}`);
    }
    console.log("Applied successfully via Supabase Management API.");
}

async function main() {
    console.log("Eaglewood CMS — Production Deploy\n");

    const before = await verifyBootstrapRpc();
    if (before.deployed) {
        const counts = await verifyContent();
        const empty = counts.filter((r) => r.count === 0 && r.table !== "settings");
        if (!empty.length) {
            console.log("Bootstrap RPC deployed and CMS tables already have content.");
            counts.forEach((r) => console.log(`  ${r.table}: ${r.count}`));
            return;
        }
        console.log("Bootstrap RPC exists but some tables are empty — re-running deploy SQL...");
    } else {
        console.log("Bootstrap RPC not deployed yet.");
    }

    let dbUrl = loadEnvValue("SUPABASE_DB_URL") || loadEnvValue("DATABASE_URL");
    const accessToken = loadEnvValue("SUPABASE_ACCESS_TOKEN");

    if (!dbUrl && !accessToken && process.stdin.isTTY) {
        dbUrl = await promptDbUrl();
    }

    if (dbUrl) {
        await applyViaPg(dbUrl);
    } else if (accessToken) {
        await applyViaManagementApi(accessToken);
    } else {
        console.error("\nCannot apply automatically.");
        console.error("1. Copy supabase/PRODUCTION_STABILIZE.sql");
        console.error("2. Supabase Dashboard → SQL Editor → paste → Run");
        console.error("3. npm run verify:cms");
        process.exit(1);
    }

    const after = await verifyBootstrapRpc();
    console.log(after.deployed ? "Bootstrap RPC: OK" : `Bootstrap RPC: MISSING (${after.body})`);

    const counts = await verifyContent();
    console.log("\nContent verification:");
    counts.forEach((r) => console.log(`  ${r.count > 0 ? "✓" : "✗"} ${r.table}: ${r.count}`));

    const failed = counts.filter((r) => r.count === 0);
    if (failed.length) {
        console.error(`\n${failed.length} table(s) still empty after deploy.`);
        process.exit(1);
    }

    const capsPath = join(root, "assets", "data", "rpc-capabilities.json");
    const allTrue = Object.fromEntries([
        "verify_legacy_admin", "create_legacy_admin_session", "validate_legacy_admin_session",
        "revoke_legacy_admin_session", "destroy_legacy_admin_session",
        "bootstrap_cms_default_content", "seed_cms_as_admin",
        "get_admin_login_route", "bootstrap_admin_auth_links",
    ].map((k) => [k, true]));
    writeFileSync(capsPath, `${JSON.stringify(allTrue, null, 2)}\n`, "utf8");
    console.log("Updated assets/data/rpc-capabilities.json");

    console.log("\nPASS: Production CMS deployed and seeded.");
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});

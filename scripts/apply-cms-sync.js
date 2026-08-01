#!/usr/bin/env node
/**
 * Deploy bootstrap_cms_default_content RPC and seed all CMS tables.
 *
 * Usage (any one):
 *   set SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@...
 *   set SUPABASE_ACCESS_TOKEN=sbp_...
 *   npm run cms:deploy
 *
 * Or paste supabase/APPLY_CMS_SYNC.sql in Supabase SQL Editor (one-time).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = join(root, "supabase", "APPLY_CMS_SYNC.sql");
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

async function verifyBootstrapRpc() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bootstrap_cms_default_content`, {
        method: "POST",
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: "{}",
    });
    const text = await res.text();
    return { deployed: !text.includes("PGRST202"), status: res.status, body: text };
}

async function applyViaPg(dbUrl) {
    const pg = await import("pg");
    const sql = readFileSync(sqlPath, "utf8");
    const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
        console.log("Applying APPLY_CMS_SYNC.sql via Postgres...");
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
    console.log("CMS Content Deploy\n");

    const before = await verifyBootstrapRpc();
    if (before.deployed) {
        const probe = await fetch(`${SUPABASE_URL}/rest/v1/home_slides?select=id&limit=1`, {
            headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "count=exact" },
        });
        const range = probe.headers.get("content-range") || "";
        const count = Number(range.split("/")[1] || 0);
        if (count > 0) {
            console.log("Bootstrap RPC deployed and home_slides has content.");
            return;
        }
        console.log("RPC deployed but tables empty — running bootstrap...");
        const boot = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bootstrap_cms_default_content`, {
            method: "POST",
            headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
            body: "{}",
        });
        console.log("Bootstrap:", await boot.text());
        return;
    }

    const dbUrl = loadEnvValue("SUPABASE_DB_URL") || loadEnvValue("DATABASE_URL");
    const accessToken = loadEnvValue("SUPABASE_ACCESS_TOKEN");

    if (dbUrl) {
        await applyViaPg(dbUrl);
    } else if (accessToken) {
        await applyViaManagementApi(accessToken);
    } else {
        console.error("Cannot apply automatically — set SUPABASE_DB_URL or SUPABASE_ACCESS_TOKEN in .env.local");
        console.error("Or paste supabase/APPLY_CMS_SYNC.sql in Supabase SQL Editor and run it once.");
        process.exit(1);
    }

    const after = await verifyBootstrapRpc();
    console.log(after.deployed ? "OK bootstrap_cms_default_content" : "MISSING bootstrap_cms_default_content");
    console.log("\nVerify: npm run verify:cms");
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});

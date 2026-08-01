#!/usr/bin/env node
/**
 * Seed CMS via bootstrap_cms_default_content() RPC or default_content.sql.
 *
 * Usage:
 *   npm run cms:bootstrap
 *   npm run db:seed
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";

function loadDbUrl() {
    const candidates = [process.env.SUPABASE_DB_URL, process.env.DATABASE_URL].filter(Boolean);
    for (const envFile of [".env.local", ".env"]) {
        const path = join(root, envFile);
        if (!existsSync(path)) continue;
        const text = readFileSync(path, "utf8");
        for (const line of text.split("\n")) {
            const match = line.match(/^\s*(?:SUPABASE_DB_URL|DATABASE_URL)\s*=\s*["']?([^"'\n#]+)/);
            if (match) candidates.push(match[1].trim());
        }
    }
    return candidates[0] || "";
}

async function bootstrapViaRpc() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bootstrap_cms_default_content`, {
        method: "POST",
        headers: {
            apikey: KEY,
            Authorization: `Bearer ${KEY}`,
            "Content-Type": "application/json",
        },
        body: "{}",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        if (body?.code === "PGRST202") {
            return { ok: false, reason: "missing_rpc" };
        }
        throw new Error(body?.message || `RPC failed (${res.status})`);
    }
    return { ok: true, data: body };
}

async function bootstrapViaSql() {
    const dbUrl = loadDbUrl();
    if (!dbUrl) return { ok: false, reason: "no_db_url" };
    const applyPath = join(root, "supabase", "APPLY_CMS_SYNC.sql");
    const sqlPath = existsSync(applyPath)
        ? applyPath
        : join(root, "supabase", "default_content.sql");
    const pg = await import("pg");
    const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
        await client.query(readFileSync(sqlPath, "utf8"));
    } finally {
        await client.end();
    }
    return { ok: true, data: { seeded: true, via: "sql" } };
}

async function main() {
    console.log("CMS bootstrap\n");

    let result = await bootstrapViaRpc();
    if (!result.ok && result.reason === "missing_rpc") {
        console.log("RPC not deployed — trying SQL fallback...");
        result = await bootstrapViaSql();
        if (!result.ok && result.reason === "no_db_url") {
            console.error("Bootstrap RPC is not deployed and SUPABASE_DB_URL is missing.");
            console.error("Run supabase/APPLY_CMS_SYNC.sql in Supabase SQL Editor (one-time).");
            process.exit(1);
        }
    }

    if (!result.ok) {
        console.error("Bootstrap failed:", result.reason || "unknown");
        process.exit(1);
    }

    console.log("Bootstrap result:", result.data);
    console.log("\nVerify: npm run verify:cms");
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});

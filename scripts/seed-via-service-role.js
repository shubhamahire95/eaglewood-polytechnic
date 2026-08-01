#!/usr/bin/env node
/**
 * Seed CMS content using Supabase service role (bypasses RLS).
 *
 * Usage:
 *   set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 *   npm run db:seed:service
 *
 * Or paste supabase/default_content.sql in Supabase SQL Editor.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const sqlPath = join(root, "supabase", "default_content.sql");

function loadServiceRoleKey() {
    const candidates = [process.env.SUPABASE_SERVICE_ROLE_KEY].filter(Boolean);
    for (const envFile of [".env.local", ".env"]) {
        const path = join(root, envFile);
        if (!existsSync(path)) continue;
        const text = readFileSync(path, "utf8");
        for (const line of text.split("\n")) {
            const match = line.match(/^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?([^"'\n#]+)/);
            if (match) candidates.push(match[1].trim());
        }
    }
    return candidates[0] || "";
}

async function main() {
    const key = loadServiceRoleKey();
    if (!key) {
        console.error("Missing SUPABASE_SERVICE_ROLE_KEY.");
        console.error("Add it to .env.local or run: npm run db:seed (requires SUPABASE_DB_URL)");
        console.error("Or paste supabase/default_content.sql in Supabase SQL Editor.");
        process.exit(1);
    }

    const pg = await import("pg");
    const sql = readFileSync(sqlPath, "utf8");

    const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    if (dbUrl) {
        const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
        await client.connect();
        try {
            await client.query(sql);
            console.log("Default CMS content imported via Postgres.");
        } finally {
            await client.end();
        }
        return;
    }

    console.error("Service role REST seeding requires SUPABASE_DB_URL for SQL execution.");
    console.error("Paste supabase/default_content.sql in Supabase SQL Editor.");
    process.exit(1);
}

main().catch((err) => {
    console.error("Seed failed:", err.message || err);
    process.exit(1);
});

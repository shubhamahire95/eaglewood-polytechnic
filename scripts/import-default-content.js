#!/usr/bin/env node
/**
 * Apply supabase/default_content.sql to Supabase Postgres.
 *
 * Usage:
 *   set SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@...
 *   npm run db:seed
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = join(root, "supabase", "default_content.sql");

function loadDbUrl() {
    const candidates = [
        process.env.SUPABASE_DB_URL,
        process.env.DATABASE_URL,
        process.env.POSTGRES_URL,
    ].filter(Boolean);

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

async function main() {
    const dbUrl = loadDbUrl();
    if (!dbUrl) {
        console.error("Missing SUPABASE_DB_URL.");
        console.error("Paste supabase/default_content.sql in Supabase SQL Editor, or set SUPABASE_DB_URL in .env.local");
        process.exit(1);
    }

    const pg = await import("pg");
    const sql = readFileSync(sqlPath, "utf8");
    const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

    console.log("Connecting...");
    await client.connect();
    try {
        console.log("Importing default CMS content...");
        await client.query(sql);
        console.log("Default content imported successfully.");
    } finally {
        await client.end();
    }

    console.log("Verify: node scripts/verify-cms-content.js");
}

main().catch((err) => {
    console.error("Import failed:", err.message || err);
    process.exit(1);
});

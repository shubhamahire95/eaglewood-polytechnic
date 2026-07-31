#!/usr/bin/env node
/**
 * Apply supabase/RUN_ALL_MIGRATIONS.sql to a Supabase Postgres database.
 *
 * Usage:
 *   set SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
 *   node scripts/run-migrations.js
 *
 * Find the connection string in Supabase Dashboard → Project Settings → Database → Connection string (URI).
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = join(root, "supabase", "RUN_ALL_MIGRATIONS.sql");

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
        console.error("Missing database URL.");
        console.error("Set SUPABASE_DB_URL or add it to .env.local");
        console.error("Example: postgresql://postgres.[ref]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres");
        process.exit(1);
    }

    let pg;
    try {
        pg = await import("pg");
    } catch {
        console.error("Install pg first: npm install pg");
        process.exit(1);
    }

    const sql = readFileSync(sqlPath, "utf8");
    const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

    console.log("Connecting to database...");
    await client.connect();
    try {
        console.log("Running migrations from RUN_ALL_MIGRATIONS.sql...");
        await client.query(sql);
        console.log("Migrations applied successfully.");
    } finally {
        await client.end();
    }

    console.log("Verify: node scripts/audit-supabase.js");
}

main().catch((err) => {
    console.error("Migration failed:", err.message || err);
    process.exit(1);
});

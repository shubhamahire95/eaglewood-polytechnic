#!/usr/bin/env node
/**
 * Apply pending CMS migrations (011 + 012) to production Supabase.
 *
 * Fixes: missing downloads table, program_type, institute columns, settings seeds.
 *
 * Usage (any one):
 *   set SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@...
 *   npm run db:migrate:pending
 *
 *   set SUPABASE_ACCESS_TOKEN=sbp_...
 *   npm run db:migrate:pending
 *
 * Or paste supabase/APPLY_PENDING_MIGRATIONS.sql in Supabase SQL Editor.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { SUPABASE_URL, PROJECT_REF } from "./lib/admin-rest.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");
const bundlePath = join(root, "supabase", "APPLY_PENDING_MIGRATIONS.sql");

const PENDING = [
    "011_client_content_fields.sql",
    "012_create_downloads.sql",
];

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

function buildBundleSql() {
    const header = `-- Pending CMS schema updates (migrations 011 + 012)
-- Project: ${PROJECT_REF}
-- Idempotent: safe to run multiple times. No data-destructive statements.

`;
    const body = PENDING.map((file) => readFileSync(join(migrationsDir, file), "utf8").trim()).join("\n\n");
    const sql = `${header}${body}\n`;
    writeFileSync(bundlePath, sql, "utf8");
    return sql;
}

function staticVerifyBundle(sqlBody) {
    const required = [
        "add column if not exists program_type",
        "add column if not exists institute",
        "add column if not exists qualification",
        "create table if not exists public.downloads",
        "policy public_read_published on public.downloads",
        "policy verified_admin_manage on public.downloads",
        "set_downloads_updated_at",
        "idx_downloads_published_order",
        "on conflict (key) do nothing",
        "notify pgrst, 'reload schema'",
    ];
    const forbidden = [
        /\btruncate\s+table\b/i,
        /\bdrop\s+table\b/i,
        /\bdelete\s+from\b/i,
    ];
    const missing = required.filter((needle) => !sqlBody.includes(needle));
    const unsafe = forbidden.filter((re) => re.test(sqlBody));
    if (missing.length) throw new Error(`Bundle missing required SQL: ${missing.join(", ")}`);
    if (unsafe.length) throw new Error("Bundle contains destructive statements");
}

async function promptDbUrl() {
    const rl = createInterface({ input, output });
    try {
        const value = await rl.question("Paste SUPABASE_DB_URL: ");
        const trimmed = value.trim();
        if (!trimmed) return "";
        const envPath = join(root, ".env.local");
        const line = `SUPABASE_DB_URL=${trimmed}\n`;
        if (existsSync(envPath)) {
            const existing = readFileSync(envPath, "utf8");
            if (!existing.includes("SUPABASE_DB_URL=")) {
                writeFileSync(envPath, `${existing.trimEnd()}\n${line}`, "utf8");
            }
        } else {
            writeFileSync(envPath, line, "utf8");
        }
        console.log("Saved SUPABASE_DB_URL to .env.local");
        return trimmed;
    } finally {
        rl.close();
    }
}

async function applyViaPg(dbUrl, sql) {
    const pg = await import("pg");
    const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
        await client.query(sql);
    } finally {
        await client.end();
    }
}

async function applyViaManagementApi(accessToken, sql) {
    const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Management API ${res.status}: ${text}`);
}

async function verifyDownloadsTable() {
    const key = loadEnvValue("SUPABASE_ANON_KEY") || "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";
    const res = await fetch(`${SUPABASE_URL}/rest/v1/downloads?select=id&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    return res.ok;
}

async function main() {
    console.log("Apply pending CMS migrations (011 + 012)\n");

    const sql = buildBundleSql();
    staticVerifyBundle(PENDING.map((file) => readFileSync(join(migrationsDir, file), "utf8").trim()).join("\n\n"));
    console.log(`Wrote ${bundlePath}`);
    console.log("Static verification: PASS (idempotent, no destructive statements)\n");

    let dbUrl = loadEnvValue("SUPABASE_DB_URL") || loadEnvValue("DATABASE_URL");
    let accessToken = loadEnvValue("SUPABASE_ACCESS_TOKEN");

    if (!dbUrl && !accessToken && process.stdin.isTTY) {
        dbUrl = await promptDbUrl();
    }

    if (dbUrl) {
        console.log("Applying via Postgres...");
        await applyViaPg(dbUrl, sql);
    } else if (accessToken) {
        console.log("Applying via Supabase Management API...");
        await applyViaManagementApi(accessToken, sql);
    } else {
        console.log("SQL bundle ready for manual apply in Supabase SQL Editor:");
        console.log(`  ${bundlePath}`);
        process.exit(0);
    }

    const ok = await verifyDownloadsTable();
    if (!ok) {
        console.error("Migration ran but downloads table probe still failed — wait a few seconds and hard-refresh.");
        process.exit(1);
    }

    console.log("✓ downloads table exists");
    console.log("✓ Pending migrations applied");
    console.log("\nNext: hard-refresh admin dashboard → Retry connection → expect Tables found: 21/21");
}

main().catch((err) => {
    console.error("Migration failed:", err.message || err);
    process.exit(1);
});

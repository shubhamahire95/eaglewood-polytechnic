#!/usr/bin/env node
/**
 * Builds supabase/RUN_ALL_MIGRATIONS.sql from numbered migration files.
 * Usage: node scripts/build-run-all-migrations.js
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "supabase", "migrations");
const outPath = join(root, "supabase", "RUN_ALL_MIGRATIONS.sql");

const ORDER = [
    "003_upgrade_legacy_admins.sql",
    "001_eaglewood_cms.sql",
    "002_admin_auth_fixes.sql",
    "004_indexes.sql",
    "005_mission_vision_settings.sql",
    "006_legacy_admin_sessions.sql",
    "007_admin_auth_bootstrap.sql",
    "008_bootstrap_cms_content.sql",
    "009_production_stabilize.sql",
    "010_admin_auth_storage_fix.sql",
    "011_client_content_fields.sql",
    "012_create_downloads.sql",
];

const files = ORDER.filter((f) => {
    try {
        readFileSync(join(migrationsDir, f), "utf8");
        return true;
    } catch {
        console.warn(`Missing migration: ${f}`);
        return false;
    }
});

const header = `-- Eaglewood Polytechnic — run ALL migrations in one paste
-- Supabase Dashboard → SQL Editor → New query → Run
-- Order: ${files.join(" → ")}
-- After success: hard-refresh admin + public site, click "Retry connection" in dashboard.

`;

const body = files
    .map((f) => {
        const sql = readFileSync(join(migrationsDir, f), "utf8").trim();
        return `-- ═══════════════════════════════════════════════════════════════════════════\n-- ${f}\n-- ═══════════════════════════════════════════════════════════════════════════\n\n${sql}`;
    })
    .join("\n\n");

writeFileSync(outPath, header + body + "\n", "utf8");
console.log(`Wrote ${outPath} (${files.length} migrations)`);

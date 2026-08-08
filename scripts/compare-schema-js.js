#!/usr/bin/env node
/**
 * Compare JS CMS_TABLES + dashboard module fields against RUN_ALL_MIGRATIONS.sql columns.
 * Usage: node scripts/compare-schema-js.js
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sql = readFileSync(join(root, "supabase", "RUN_ALL_MIGRATIONS.sql"), "utf8");

const CMS_TABLES = [
    "admins", "settings", "home_slides", "updates", "notices", "principal_message",
    "courses", "departments", "faculty", "facilities", "placements", "gallery", "downloads",
    "media_library", "footer_blocks", "inquiries", "admissions", "contacts",
    "ai_knowledge_base", "ai_prompts", "ai_conversations",
];

function extractTableColumns(table) {
    const re = new RegExp(`create table if not exists public\\.${table}\\s*\\(([\\s\\S]*?)\\);`, "i");
    const m = sql.match(re);
    if (!m) return null;
    return [...m[1].matchAll(/^\s*(\w+)\s+/gm)].map((x) => x[1]);
}

console.log("JS table → SQL column check (RUN_ALL_MIGRATIONS.sql)\n");

const missingTables = [];
const columnIssues = [];

for (const table of CMS_TABLES) {
    const cols = extractTableColumns(table);
    if (!cols) {
        missingTables.push(table);
        console.log(`MISSING DDL  ${table} — not in RUN_ALL_MIGRATIONS.sql`);
        continue;
    }
    console.log(`OK DDL       ${table} (${cols.length} columns)`);
}

// Dashboard module fields that must exist on admins after migration 003
const adminsRequired = ["auth_user_id", "permissions", "status", "updated_at"];
const adminsCols = extractTableColumns("admins") || [];
for (const c of adminsRequired) {
    if (!adminsCols.includes(c)) columnIssues.push(`admins.${c}`);
}

console.log("\n--- Summary ---");
console.log(`Tables in JS but missing from SQL: ${missingTables.length ? missingTables.join(", ") : "none"}`);
console.log(`Required admin columns missing from SQL: ${columnIssues.length ? columnIssues.join(", ") : "none"}`);
console.log(missingTables.length || columnIssues.length ? "\nSQL needs update." : "\nRUN_ALL_MIGRATIONS.sql covers all JS tables.");

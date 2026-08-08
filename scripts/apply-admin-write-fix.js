#!/usr/bin/env node
/**
 * Apply supabase/migrations/010_admin_auth_storage_fix.sql then seed via admin REST.
 *
 * Usage:
 *   Copy .env.local.example → .env.local and set SUPABASE_DB_URL or SUPABASE_ACCESS_TOKEN
 *   npm run cms:fix
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { seedViaAdminRest } from "./seed-via-admin-rest.js";
import {
    SUPABASE_URL,
    PROJECT_REF,
    DEFAULT_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD,
    buildAdminAuthHeaders,
    buildAdminJsonHeaders,
    stripBodyHeaders,
    checkAdminWritePermission,
} from "./lib/admin-rest.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rlsSqlPath = join(root, "supabase", "GENERATED_FIX_ADMIN_WRITES.sql");

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

async function verifyAdminInsert() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/home_slides`, {
        method: "POST",
        headers: buildAdminJsonHeaders(DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, {
            Prefer: "return=representation",
        }),
        body: JSON.stringify({
            title: "RLS probe",
            subtitle: "delete me",
            image_url: "assets/images/campus.jpg",
            published: false,
            status: "hidden",
            display_order: 9999,
        }),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, status: res.status, body: text };
    let row = null;
    try {
        row = JSON.parse(text)?.[0];
    } catch {
        /* ignore */
    }
    if (row?.id) {
        await fetch(`${SUPABASE_URL}/rest/v1/home_slides?id=eq.${row.id}`, {
            method: "DELETE",
            headers: stripBodyHeaders(buildAdminAuthHeaders(DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD)),
        });
    }
    return { ok: true };
}

async function countPublished(table) {
    const filter = table === "settings" ? "" : "&published=eq.true";
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1${filter}`, {
        headers: {
            apikey: buildAdminAuthHeaders(DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD).apikey,
            Authorization: buildAdminAuthHeaders(DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD).Authorization,
            Prefer: "count=exact",
        },
    });
    return Number((res.headers.get("content-range") || "").split("/")[1] || 0);
}

async function verifyCmsContent() {
    const tables = ["home_slides", "principal_message", "updates", "notices", "courses", "departments", "facilities", "placements", "gallery", "footer_blocks"];
    const counts = {};
    for (const table of tables) {
        counts[table] = await countPublished(table);
    }
    return counts;
}

async function applyViaPg(dbUrl, file) {
    const pg = await import("pg");
    const sql = readFileSync(file, "utf8");
    const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
        console.log(`Applying ${file}...`);
        await client.query(sql);
    } finally {
        await client.end();
    }
}

async function applyViaManagementApi(accessToken, file) {
    const sql = readFileSync(file, "utf8");
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
}

async function main() {
    console.log("CMS production fix — RLS auth + admin REST seed\n");

    const permission = await checkAdminWritePermission();
    let counts = await verifyCmsContent();
    const contentEmpty = Object.values(counts).every((n) => n === 0);

    if (permission.admin && !contentEmpty) {
        console.log("Admin writes OK and CMS content already seeded.");
        Object.entries(counts).forEach(([t, n]) => console.log(`  ${t}: ${n}`));
        return;
    }

    if (!permission.admin) {
        console.log(`Admin writes blocked (is_admin=${permission.admin}) — applying GENERATED_FIX_ADMIN_WRITES.sql`);

        let dbUrl = loadEnvValue("SUPABASE_DB_URL") || loadEnvValue("DATABASE_URL");
        const accessToken = loadEnvValue("SUPABASE_ACCESS_TOKEN");

        if (!dbUrl && !accessToken && process.stdin.isTTY) {
            dbUrl = await promptDbUrl();
        }

        if (dbUrl) {
            await applyViaPg(dbUrl, rlsSqlPath);
        } else if (accessToken) {
            await applyViaManagementApi(accessToken, rlsSqlPath);
        } else {
            console.error("\nCannot apply migration automatically:");
            console.error("  • No SUPABASE_DB_URL or SUPABASE_ACCESS_TOKEN in environment or .env.local");
            console.error("  • Supabase MCP is not authenticated in this session");
            console.error("\nFix: copy .env.local.example → .env.local, add your database URL from");
            console.error("Supabase Dashboard → Project Settings → Database → Connection string (URI),");
            console.error("then run: npm run cms:fix");
            process.exit(1);
        }
    }

    const afterPermission = await checkAdminWritePermission();
    if (!afterPermission.admin) {
        console.error("Admin write permission still blocked after migration (is_admin=false).");
        process.exit(1);
    }
    console.log("✓ is_admin() returns true with admin headers\n");

    const afterWrite = await verifyAdminInsert();
    if (!afterWrite.ok) {
        console.error(`Admin INSERT still blocked: ${afterWrite.status} ${afterWrite.body || ""}`);
        process.exit(1);
    }
    console.log("✓ Admin REST INSERT verified\n");

    counts = await verifyCmsContent();
    if (Object.values(counts).every((n) => n === 0)) {
        console.log("Seeding CMS content via admin REST...");
        await seedViaAdminRest();
    }

    counts = await verifyCmsContent();
    const stillEmpty = Object.entries(counts).filter(([, n]) => n === 0);
    if (stillEmpty.length) {
        console.error("\nContent still empty after seed:");
        stillEmpty.forEach(([t]) => console.error(`  ${t}`));
        process.exit(1);
    }

    console.log("\nPASS: Admin CRUD + CMS content verified.");
    Object.entries(counts).forEach(([t, n]) => console.log(`  ✓ ${t}: ${n}`));
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});

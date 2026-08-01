#!/usr/bin/env node
/**
 * Apply supabase/APPLY_ADMIN_WRITE_FIX.sql to enable admin writes.
 *
 * Usage (any one):
 *   set SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@...
 *   set SUPABASE_ACCESS_TOKEN=sbp_...
 *   npm run admin:fix
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rlsSqlPath = join(root, "supabase", "migrations", "009_production_stabilize.sql");
const seedSqlPath = join(root, "supabase", "default_content.sql");
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

async function verifyAdminInsert() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/home_slides`, {
        method: "POST",
        headers: {
            apikey: KEY,
            Authorization: `Bearer ${KEY}`,
            "Content-Type": "application/json",
            "x-admin-email": "admin@eaglewoodpoly.in",
            "x-admin-password": "admin123",
            Prefer: "return=representation",
        },
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
            headers: {
                apikey: KEY,
                Authorization: `Bearer ${KEY}`,
                "x-admin-email": "admin@eaglewoodpoly.in",
                "x-admin-password": "admin123",
            },
        });
    }
    return { ok: true };
}

function updateRpcCapabilities() {
    const capsPath = join(root, "assets", "data", "rpc-capabilities.json");
    const caps = {
        verify_legacy_admin: true,
        create_legacy_admin_session: false,
        validate_legacy_admin_session: false,
        revoke_legacy_admin_session: false,
        destroy_legacy_admin_session: false,
        bootstrap_cms_default_content: false,
        seed_cms_as_admin: false,
        get_admin_login_route: true,
        bootstrap_admin_auth_links: false,
    };
    writeFileSync(capsPath, `${JSON.stringify(caps, null, 2)}\n`, "utf8");
    console.log("Updated assets/data/rpc-capabilities.json");
}

async function countPublished(table) {
    const filter = table === "settings" ? "" : "&published=eq.true";
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1${filter}`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "count=exact" },
    });
    return Number((res.headers.get("content-range") || "").split("/")[1] || 0);
}

async function verifyCmsContent() {
    const tables = ["home_slides", "principal_message", "updates", "notices", "courses", "departments", "gallery", "footer_blocks"];
    const counts = {};
    for (const table of tables) {
        counts[table] = await countPublished(table);
    }
    return counts;
}

async function applySqlFiles(dbUrl, files) {
    const pg = await import("pg");
    const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
        for (const file of files) {
            console.log(`Applying ${file}...`);
            await client.query(readFileSync(file, "utf8"));
        }
    } finally {
        await client.end();
    }
}

async function applyViaPg(dbUrl, files) {
    await applySqlFiles(dbUrl, files);
    console.log("Applied successfully.");
}

async function applyViaManagementApi(accessToken, files) {
    for (const file of files) {
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
            throw new Error(`Management API ${res.status} (${file}): ${text}`);
        }
        console.log(`Applied ${file} via Management API.`);
    }
}

async function main() {
    console.log("CMS production fix — RLS auth + default content seed\n");

    const writeProbe = await verifyAdminInsert();
    let counts = await verifyCmsContent();
    const contentEmpty = Object.values(counts).every((n) => n === 0);

    if (writeProbe.ok && !contentEmpty) {
        console.log("Admin writes OK and CMS content already seeded.");
        Object.entries(counts).forEach(([t, n]) => console.log(`  ${t}: ${n}`));
        updateRpcCapabilities();
        return;
    }

    const dbUrl = loadEnvValue("SUPABASE_DB_URL") || loadEnvValue("DATABASE_URL");
    const accessToken = loadEnvValue("SUPABASE_ACCESS_TOKEN");
    const sqlFiles = [];

    if (!writeProbe.ok) {
        console.log(`Admin writes blocked (${writeProbe.status || "error"}) — need 009_production_stabilize.sql`);
        sqlFiles.push(rlsSqlPath);
    }
    if (contentEmpty) {
        console.log("CMS content tables empty — need default_content.sql");
        sqlFiles.push(seedSqlPath);
    }

    if (sqlFiles.length) {
        if (dbUrl) {
            await applyViaPg(dbUrl, sqlFiles);
        } else if (accessToken) {
            await applyViaManagementApi(accessToken, sqlFiles);
        } else {
            console.error("\nCannot apply automatically — set SUPABASE_DB_URL in .env.local");
            console.error("Or paste these files in Supabase SQL Editor (in order):");
            console.error("  supabase/migrations/009_production_stabilize.sql");
            console.error("  supabase/default_content.sql");
            process.exit(1);
        }
    }

    const afterWrite = await verifyAdminInsert();
    if (!afterWrite.ok) {
        console.error(`Admin write still blocked: ${afterWrite.status} ${afterWrite.body || ""}`);
        process.exit(1);
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
    updateRpcCapabilities();
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});

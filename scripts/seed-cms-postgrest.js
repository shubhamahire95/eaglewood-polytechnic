#!/usr/bin/env node
/**
 * Seed CMS tables via Supabase PostgREST (service role bypasses RLS).
 *
 * Usage:
 *   set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 *   npm run seed:rest
 *
 * Or set SUPABASE_DB_URL and run: npm run db:seed
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const jsonPath = join(root, "scripts", "cms-seed-data.json");
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

async function countTable(key) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${key}?select=id&limit=1`, {
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            Prefer: "count=exact",
        },
    });
    const range = res.headers.get("content-range") || "";
    return Number(range.split("/")[1] || 0);
}

async function seedViaSql(dbUrl) {
    const pg = await import("pg");
    const sql = readFileSync(sqlPath, "utf8");
    const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
        await client.query(sql);
    } finally {
        await client.end();
    }
    return { via: "sql" };
}

async function insertRows(table, rows, serviceKey) {
    if (!rows?.length) return { table, inserted: 0 };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
        },
        body: JSON.stringify(rows),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`${table}: ${res.status} ${text}`);
    }
    return { table, inserted: rows.length };
}

async function seedViaRest(serviceKey) {
    if (!existsSync(jsonPath)) {
        throw new Error(`Missing ${jsonPath}. Run: npm run db:seed:generate`);
    }
    const data = JSON.parse(readFileSync(jsonPath, "utf8"));
    const order = [
        "home_slides", "principal_message", "updates", "notices", "courses",
        "departments", "faculty", "facilities", "placements", "gallery",
        "footer_blocks", "ai_prompts", "ai_knowledge_base",
    ];
    const results = [];
    for (const table of order) {
        const rows = data[table];
        if (!rows) continue;
        const payload = Array.isArray(rows) ? rows : [rows];
        const probe = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, {
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Prefer: "count=exact" },
        });
        const range = probe.headers.get("content-range") || "";
        const existing = Number(range.split("/")[1] || 0);
        if (existing > 0) {
            results.push({ table, inserted: 0, skipped: true });
            continue;
        }
        results.push(await insertRows(table, payload, serviceKey));
    }
    return { via: "rest", results };
}

async function main() {
    console.log("CMS REST seed\n");

    const dbUrl = loadDbUrl();
    if (dbUrl) {
        console.log("Seeding via Postgres...");
        await seedViaSql(dbUrl);
        console.log("Done.");
        return;
    }

    const serviceKey = loadServiceRoleKey();
    if (!serviceKey) {
        console.error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_DB_URL.");
        console.error("Or run supabase/APPLY_CMS_SYNC.sql in Supabase SQL Editor.");
        process.exit(1);
    }

    console.log("Seeding via PostgREST...");
    const result = await seedViaRest(serviceKey);
    result.results.forEach((r) => {
        console.log(`${r.skipped ? "skip" : "ok"} ${r.table}: ${r.inserted || 0} row(s)`);
    });
    console.log("\nVerify: npm run verify:cms");
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});

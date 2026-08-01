#!/usr/bin/env node
/**
 * Seed all CMS tables via admin REST (x-admin-email / x-admin-password headers).
 * Requires 009_production_stabilize.sql applied first.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";
const EMAIL = process.env.ADMIN_EMAIL || "admin@eaglewoodpoly.in";
const PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const SEED_ORDER = [
    "home_slides", "principal_message", "updates", "notices", "courses",
    "departments", "faculty", "facilities", "placements", "gallery",
    "footer_blocks", "ai_prompts", "ai_knowledge_base",
];

function adminHeaders(extra = {}) {
    return {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        "x-admin-email": EMAIL,
        "x-admin-password": PASSWORD,
        Prefer: "return=minimal",
        ...extra,
    };
}

async function countTable(table) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, {
        headers: { ...adminHeaders(), Prefer: "count=exact" },
    });
    return Number((res.headers.get("content-range") || "").split("/")[1] || 0);
}

async function insertRow(table, row) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(row),
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`${table}: ${res.status} ${text}`);
    }
}

export async function seedViaAdminRest({ force = false } = {}) {
    const jsonPath = join(root, "assets", "data", "cms-seed-data.json");
    const data = JSON.parse(readFileSync(jsonPath, "utf8"));

    let inserted = 0;
    const tables = [];

    for (const table of SEED_ORDER) {
        const existing = await countTable(table);
        if (existing > 0 && !force) {
            console.log(`skip ${table}: ${existing} row(s)`);
            continue;
        }
        const raw = data[table];
        const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
        if (!rows.length) continue;

        for (const row of rows) {
            await insertRow(table, row);
            inserted += 1;
        }
        tables.push(table);
        console.log(`ok ${table}: ${rows.length} row(s)`);
    }

    return { inserted, tables };
}

async function main() {
    console.log("CMS seed via admin REST\n");
    const probe = await fetch(`${SUPABASE_URL}/rest/v1/principal_message`, {
        method: "POST",
        headers: adminHeaders({ Prefer: "return=representation" }),
        body: JSON.stringify({
            name: "Write probe",
            message: "delete me",
            published: false,
            status: "hidden",
            display_order: 9999,
        }),
    });
    const probeText = await probe.text();
    if (!probe.ok) {
        console.error(`Admin writes blocked (${probe.status}): ${probeText}`);
        console.error("Run: npm run cms:fix");
        process.exit(1);
    }
    const probeRow = JSON.parse(probeText)?.[0];
    if (probeRow?.id) {
        await fetch(`${SUPABASE_URL}/rest/v1/principal_message?id=eq.${probeRow.id}`, {
            method: "DELETE",
            headers: adminHeaders(),
        });
    }
    console.log("✓ Admin write probe OK\n");

    const result = await seedViaAdminRest();
    console.log(`\nDone: ${result.inserted} row(s) across ${result.tables.length} table(s)`);
}

if (process.argv[1] && process.argv[1].includes("seed-via-admin-rest")) {
    main().catch((err) => {
        console.error(err.message || err);
        process.exit(1);
    });
}

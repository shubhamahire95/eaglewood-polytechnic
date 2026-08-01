#!/usr/bin/env node
/**
 * Diagnose and fix admin Supabase Auth linkage.
 *
 * Usage:
 *   node scripts/setup-admin-auth.js
 *   node scripts/setup-admin-auth.js --email admin@eaglewoodpoly.in --password 'YourPassword'
 *
 * With database URL (applies migration 007 bootstrap):
 *   SUPABASE_DB_URL=postgresql://... node scripts/setup-admin-auth.js
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";

function loadEnv(key) {
    if (process.env[key]) return process.env[key];
    for (const file of [".env.local", ".env"]) {
        const path = join(root, file);
        if (!existsSync(path)) continue;
        const match = readFileSync(path, "utf8").match(new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'\\n#]+)`, "m"));
        if (match) return match[1].trim();
    }
    return "";
}

function parseArgs() {
    const args = process.argv.slice(2);
    const out = { email: "", password: "" };
    for (let i = 0; i < args.length; i += 1) {
        if (args[i] === "--email") out.email = args[++i] || "";
        if (args[i] === "--password") out.password = args[++i] || "";
    }
    return out;
}

async function probeAdmins() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/admins?select=id,email,auth_user_id,status,role&order=email`, {
        headers: {
            apikey: PUBLISHABLE_KEY,
            Authorization: `Bearer ${PUBLISHABLE_KEY}`,
        },
    });
    return res.json();
}

async function probeLogin(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
            apikey: PUBLISHABLE_KEY,
            Authorization: `Bearer ${PUBLISHABLE_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
}

async function runBootstrapSql() {
    const dbUrl = loadEnv("SUPABASE_DB_URL") || loadEnv("DATABASE_URL");
    if (!dbUrl) return false;

    const pg = await import("pg");
    const sqlPath = join(root, "supabase", "migrations", "007_admin_auth_bootstrap.sql");
    const sql = readFileSync(sqlPath, "utf8");
    const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
        await client.query(sql);
        console.log("✓ Applied 007_admin_auth_bootstrap.sql");
        return true;
    } finally {
        await client.end();
    }
}

async function main() {
    const { email, password } = parseArgs();
    console.log("=== Admin Auth Setup ===\n");
    console.log("Supabase URL:", SUPABASE_URL);
    console.log("Publishable key:", `${PUBLISHABLE_KEY.slice(0, 20)}…`);

    const admins = await probeAdmins();
    console.log("\nAdmins table:");
    if (Array.isArray(admins)) {
        admins.forEach((row) => {
            console.log(`  • ${row.email} | auth_user_id=${row.auth_user_id || "NULL"} | status=${row.status}`);
        });
    } else {
        console.log("  (could not read admins)", admins);
    }

    if (email && password) {
        const login = await probeLogin(email, password);
        console.log("\nLogin probe:", login.status, login.body?.error_code || login.body?.msg || "");
        if (login.body?.error_code === "email_not_confirmed") {
            console.log("\nROOT CAUSE: Auth user exists but email is NOT confirmed.");
            console.log("FIX: Run supabase/fix_admin_login.sql in Supabase SQL Editor.");
        } else if (login.body?.error_code === "invalid_credentials") {
            console.log("\nROOT CAUSE: Wrong password OR no Auth user for this email.");
            console.log("FIX: Create user in Dashboard → Authentication → Users, then run fix_admin_login.sql");
        } else if (login.status === 200) {
            const row = Array.isArray(admins) ? admins.find((a) => a.email?.toLowerCase() === email.toLowerCase()) : null;
            if (!row?.auth_user_id) {
                console.log("\nROOT CAUSE: Auth login works but admins.auth_user_id is NULL.");
                console.log("FIX: Run supabase/fix_admin_login.sql in Supabase SQL Editor.");
            } else {
                console.log("\n✓ Login and admin link look correct.");
            }
        }
    } else {
        console.log("\nTip: node scripts/setup-admin-auth.js --email admin@eaglewoodpoly.in --password 'your-password'");
    }

    const bootstrapped = await runBootstrapSql();
    if (!bootstrapped) {
        console.log("\nTo auto-fix via database, set SUPABASE_DB_URL in .env.local and re-run.");
        console.log("Or paste supabase/fix_admin_login.sql into Supabase SQL Editor.");
    } else {
        const refreshed = await probeAdmins();
        console.log("\nAdmins after bootstrap:");
        refreshed.forEach((row) => {
            console.log(`  • ${row.email} | auth_user_id=${row.auth_user_id || "NULL"}`);
        });
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

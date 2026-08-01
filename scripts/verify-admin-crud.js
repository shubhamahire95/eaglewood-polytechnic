#!/usr/bin/env node
/**
 * End-to-end admin CRUD verification (requires APPLY_ADMIN_WRITE_FIX.sql applied).
 * Usage: node scripts/verify-admin-crud.js
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";
const EMAIL = process.env.ADMIN_EMAIL || "admin@eaglewoodpoly.in";
const PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const MODULES = [
    {
        name: "principal_message",
        create: {
            name: "Principal",
            designation: "Principal, Eaglewood Polytechnic Institute",
            message: "E2E principal message",
            published: true,
            status: "published",
            display_order: 1,
        },
        update: { message: "E2E principal message (updated)" },
    },
    {
        name: "notices",
        create: {
            title: "E2E Notice",
            description: "Test notice body",
            date: new Date().toISOString().slice(0, 10),
            published: true,
            status: "published",
            display_order: 1,
        },
        update: { title: "E2E Notice (updated)" },
    },
    {
        name: "updates",
        create: {
            title: "E2E Update",
            description: "Test update body",
            date: new Date().toISOString().slice(0, 10),
            published: true,
            status: "published",
            display_order: 1,
        },
        update: { title: "E2E Update (updated)" },
    },
    {
        name: "gallery",
        create: {
            title: "E2E Gallery",
            album: "Campus",
            category: "campus",
            image_url: "assets/images/campus.jpg",
            published: true,
            status: "published",
            display_order: 1,
        },
        update: { title: "E2E Gallery (updated)" },
    },
    {
        name: "courses",
        create: {
            title: "E2E Course",
            department: "Computer",
            duration: "3 Years",
            published: true,
            status: "published",
            display_order: 1,
        },
        update: { title: "E2E Course (updated)" },
    },
    {
        name: "departments",
        create: {
            title: "E2E Department",
            description: "Test department",
            published: true,
            status: "published",
            display_order: 1,
        },
        update: { title: "E2E Department (updated)" },
    },
    {
        name: "footer_blocks",
        create: {
            block_key: `e2e_footer_${Date.now()}`,
            title: "E2E Footer",
            content: { text: "Footer test" },
            published: true,
            status: "published",
            display_order: 1,
        },
        update: { title: "E2E Footer (updated)" },
    },
    {
        name: "settings",
        create: {
            key: `e2e_setting_${Date.now()}`,
            value: { test: true },
            published: true,
            status: "published",
            display_order: 999,
        },
        update: { value: { test: true, updated: true } },
    },
];

async function rpc(fn, params, extraHeaders = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: { ...headers, ...extraHeaders },
        body: JSON.stringify(params),
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, text };
}

async function rest(method, table, path, body, extraHeaders = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path || table}`, {
        method,
        headers: {
            ...headers,
            Prefer: method === "DELETE" ? "" : "return=representation",
            ...extraHeaders,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data, text };
}

async function crudModule(table, spec, sessionHeaders) {
    const stamp = Date.now();
    const createPayload = { ...spec.create };
    if (createPayload.key) createPayload.key = createPayload.key.replace(String(stamp), String(stamp));
    if (table === "footer_blocks" && createPayload.block_key) {
        createPayload.block_key = `e2e_footer_${stamp}`;
    }
    if (table === "settings" && createPayload.key) {
        createPayload.key = `e2e_setting_${stamp}`;
    }

    const insert = await rest("POST", table, table, createPayload, sessionHeaders);
    if (insert.status >= 400) {
        throw new Error(`CREATE ${table} ${insert.status}: ${insert.text}`);
    }
    const row = Array.isArray(insert.data) ? insert.data[0] : insert.data;
    if (!row?.id) throw new Error(`CREATE ${table} returned no id`);

    const update = await rest("PATCH", table, `${table}?id=eq.${row.id}`, spec.update, sessionHeaders);
    if (update.status >= 400) {
        throw new Error(`UPDATE ${table} ${update.status}: ${update.text}`);
    }

    const del = await rest("DELETE", table, `${table}?id=eq.${row.id}`, null, sessionHeaders);
    if (del.status >= 400) {
        throw new Error(`DELETE ${table} ${del.status}: ${del.text}`);
    }

    console.log(`✓ ${table} CREATE / UPDATE / DELETE`);
}

async function main() {
    console.log("Admin CRUD verification\n");

    const probe = await rpc("create_legacy_admin_session", { p_email: "x", p_password: "x" });
    if (probe.text.includes("PGRST202")) {
        console.error("FAIL: Migration 006 not deployed. Run: npm run admin:fix");
        process.exit(1);
    }

    const login = await rpc("verify_legacy_admin", { p_email: EMAIL, p_password: PASSWORD });
    const token = login.data?.session_token;
    if (!token) {
        console.error("FAIL: verify_legacy_admin did not return session_token.", login.data || login.text);
        process.exit(1);
    }
    console.log("✓ Legacy login + session token");

    const sessionHeaders = { "x-legacy-admin-session": token };

    for (const mod of MODULES) {
        await crudModule(mod.name, mod, sessionHeaders);
    }

    console.log("\nPASS: All CMS write modules verified.");
}

main().catch((err) => {
    console.error("FAIL:", err.message || err);
    process.exit(1);
});

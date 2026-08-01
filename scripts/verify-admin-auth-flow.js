#!/usr/bin/env node
/**
 * Verifies legacy-only admin auth flow (no Supabase Auth).
 * Usage: node scripts/verify-admin-auth-flow.js
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8791;
const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";

function startServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const path = req.url === "/" ? "/admin/login.html" : req.url;
            const filePath = join(root, decodeURIComponent(path.split("?")[0]));
            try {
                const data = readFileSync(filePath);
                const ext = filePath.split(".").pop();
                const types = { html: "text/html", js: "text/javascript", css: "text/css", jpg: "image/jpeg" };
                res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
                res.end(data);
            } catch {
                res.writeHead(404);
                res.end("Not found");
            }
        });
        server.listen(PORT, "127.0.0.1", () => resolve(server));
    });
}

async function probeLegacy(email, password) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/verify_legacy_admin`, {
        method: "POST",
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_email: email, p_password: password }),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function main() {
    const email = process.env.ADMIN_EMAIL || "admin@eaglewoodpoly.in";
    const password = process.env.ADMIN_PASSWORD || "admin123";

    console.log("=== Legacy Admin Auth Verification ===\n");

    const legacy = await probeLegacy(email, password);
    console.log("verify_legacy_admin:", legacy.status, legacy.body?.email || legacy.body);

    const { chromium } = await import("playwright");
    const server = await startServer();
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    const badRequests = [];

    page.on("pageerror", (err) => errors.push(String(err)));
    page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        if (text.includes("[Auth]")) return;
        errors.push(text);
    });
    page.on("response", (res) => {
        const url = res.url();
        if (url.includes("/auth/v1/")) badRequests.push(`${res.status()} ${url}`);
        if (url.includes("create_legacy_admin_session")) badRequests.push(`${res.status()} ${url}`);
    });

    await page.goto(`http://127.0.0.1:${PORT}/admin/login.html`, { waitUntil: "load" });
    await page.waitForTimeout(500);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click("#loginBtn");

    try {
        await page.waitForURL(/index\.html/, { timeout: 8000 });
    } catch {
        await page.waitForTimeout(1500);
    }

    const storage = await page.evaluate(() => ({
        admin: localStorage.getItem("admin"),
        localSession: sessionStorage.getItem("ew_local_admin_session"),
    }));

    const msg = await page.locator("#msg").textContent().catch(() => "");
    const url = page.url();

    console.log("\nBrowser login result:");
    console.log("  URL:", url);
    console.log("  Message:", msg?.trim() || "(none)");
    console.log("  admin stored:", Boolean(storage.admin));
    console.log("  local session:", Boolean(storage.localSession));

    let failed = false;
    if (errors.length) {
        console.error("\nConsole errors:", errors);
        failed = true;
    }
    if (badRequests.length) {
        console.error("\nBlocked auth/RPC requests:", badRequests);
        failed = true;
    }
    if (!url.includes("index.html") || !storage.admin || !storage.localSession) {
        console.error("\nFAIL: expected dashboard redirect with local admin session.");
        failed = true;
    } else {
        console.log("\n✓ Legacy login redirected to dashboard.");
        console.log("✓ No Supabase Auth or missing-RPC calls from admin UI.");
    }

    await browser.close();
    server.close();
    if (failed) process.exit(1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

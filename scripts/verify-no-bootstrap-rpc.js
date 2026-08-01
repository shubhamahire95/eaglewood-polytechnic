#!/usr/bin/env node
/**
 * Verify bootstrap/session RPCs do not return 404 when deployed.
 * Skips bootstrap check when PRODUCTION_STABILIZE.sql has not been applied yet.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const PORT = 8879;
const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";
const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
};

const WATCH_RPC = [
    "bootstrap_cms_default_content",
    "seed_cms_as_admin",
    "create_legacy_admin_session",
    "validate_legacy_admin_session",
];

function startServer() {
    return new Promise((resolve) => {
        const server = createServer(async (req, res) => {
            const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
            let filePath = join(ROOT, decodeURIComponent(url.pathname.replace(/^\//, "")));
            if (!existsSync(filePath)) {
                res.writeHead(404);
                res.end();
                return;
            }
            res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
            res.end(await readFile(filePath));
        });
        server.listen(PORT, "127.0.0.1", () => resolve(server));
    });
}

async function main() {
    const probe = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bootstrap_cms_default_content`, {
        method: "POST",
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: "{}",
    });
    const probeText = await probe.text();
    const bootstrapDeployed = probe.status !== 404 && !probeText.includes("PGRST202");
    const pages = bootstrapDeployed ? ["index.html", "admin/index.html"] : ["admin/index.html"];

    const { chromium } = await import("playwright");
    const server = await startServer();
    const browser = await chromium.launch({ headless: true });
    const bad = [];

    if (!bootstrapDeployed) {
        console.log("○ bootstrap_cms_default_content not deployed — skipping homepage RPC check");
    }

    for (const path of pages) {
        const page = await browser.newPage();
        page.on("response", (res) => {
            const url = res.url();
            if (!WATCH_RPC.some((fn) => url.includes(`/rpc/${fn}`))) return;
            if (res.status() === 404) {
                bad.push(`${path}: 404 ${url}`);
            }
        });
        await page.goto(`http://127.0.0.1:${PORT}/${path}`, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(2500);
        await page.close();
    }

    await browser.close();
    server.close();

    if (bad.length) {
        console.error("FAIL: Missing RPC responses (404):");
        bad.forEach((line) => console.error(`  ${line}`));
        console.error("\nRun supabase/PRODUCTION_STABILIZE.sql in Supabase SQL Editor once.");
        process.exit(1);
    }
    console.log("PASS: No 404 bootstrap/session RPC responses.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

#!/usr/bin/env node
/**
 * Verify homepage and admin do not call missing bootstrap/session RPCs.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const PORT = 8879;
const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
};

const BLOCKED = [
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
    const { chromium } = await import("playwright");
    const server = await startServer();
    const browser = await chromium.launch({ headless: true });
    const bad = [];

    for (const path of ["index.html", "admin/index.html"]) {
        const page = await browser.newPage();
        page.on("request", (req) => {
            const url = req.url();
            if (BLOCKED.some((fn) => url.includes(`/rpc/${fn}`))) {
                bad.push(`${path}: ${url}`);
            }
        });
        await page.goto(`http://127.0.0.1:${PORT}/${path}`, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(2500);
        await page.close();
    }

    await browser.close();
    server.close();

    if (bad.length) {
        console.error("FAIL: Missing RPC calls detected:");
        bad.forEach((line) => console.error(`  ${line}`));
        process.exit(1);
    }
    console.log("PASS: No bootstrap/session RPC calls in runtime.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

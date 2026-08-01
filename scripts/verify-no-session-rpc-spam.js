#!/usr/bin/env node
/**
 * Verify admin dashboard does not call create_legacy_admin_session.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const PORT = 8881;
const MIME = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".jpg": "image/jpeg",
    ".png": "image/png",
};

const server = await new Promise((resolve) => {
    const s = createServer(async (req, res) => {
        let p = join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname.replace(/^\//, "")));
        if (!existsSync(p)) {
            res.writeHead(404);
            res.end();
            return;
        }
        res.writeHead(200, { "Content-Type": MIME[extname(p)] || "application/octet-stream" });
        res.end(await readFile(p));
    });
    s.listen(PORT, "127.0.0.1", () => resolve(s));
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const badRpc = [];
const pageErrors = [];

page.on("request", (req) => {
    if (req.url().includes("create_legacy_admin_session")) {
        badRpc.push(`${req.method()} ${req.url()}`);
    }
});
page.on("pageerror", (err) => pageErrors.push(err.message));
page.on("console", (msg) => {
    if (msg.type() === "error" && !msg.text().includes("favicon")) {
        pageErrors.push(msg.text());
    }
});

await page.goto(`http://127.0.0.1:${PORT}/admin/login.html`);
await page.fill("#email", "admin@eaglewoodpoly.in");
await page.fill("#password", "admin123");
await page.click("#loginBtn");
await page.waitForURL(/admin\/index/);
await page.waitForTimeout(2000);

for (const key of ["principal_message", "updates", "notices", "home_slides"]) {
    await page.locator(`[data-key="${key}"]`).first().click();
    await page.waitForTimeout(1500);
}

await browser.close();
server.close();

console.log("Session RPC calls:", badRpc.length ? badRpc.join("\n") : "NONE");
console.log("Page/console errors:", pageErrors.length ? [...new Set(pageErrors)].join("\n") : "NONE");

if (badRpc.length || pageErrors.filter((e) => !/401|42501|policy/i.test(e)).length) {
    process.exit(1);
}
console.log("PASS: No create_legacy_admin_session spam.");

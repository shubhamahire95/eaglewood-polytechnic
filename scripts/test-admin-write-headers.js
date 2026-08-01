#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const PORT = 8880;
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
const writes = [];

page.on("request", (req) => {
    if (req.method() === "POST" && req.url().includes("home_slides")) {
        const h = req.headers();
        writes.push({
            url: req.url(),
            "x-admin-email": h["x-admin-email"],
            "x-admin-password": h["x-admin-password"] ? "***" : undefined,
            "x-legacy-admin-session": h["x-legacy-admin-session"],
        });
    }
});

await page.goto(`http://127.0.0.1:${PORT}/admin/login.html`);
await page.fill("#email", "admin@eaglewoodpoly.in");
await page.fill("#password", "admin123");
await page.click("#loginBtn");
await page.waitForURL(/admin\/index/);
await page.locator('[data-key="home_slides"]').first().click();
await page.waitForTimeout(1000);
await page.click("#addRecordBtn");
await page.waitForTimeout(500);

const title = page.locator('[name="title"], #field-title').first();
if (await title.count()) {
    await title.fill("Header Test Slide");
    await page.locator('#editorForm button[type="submit"]').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(3000);
}

console.log(JSON.stringify(writes, null, 2));
await browser.close();
server.close();

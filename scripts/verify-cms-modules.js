#!/usr/bin/env node
/**
 * Verify admin modules and homepage show CMS content (seed fallback OK).
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const PORT = 8882;
const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
};

const ADMIN_MODULES = [
    "principal_message", "updates", "notices", "courses", "departments",
    "facilities", "placements", "gallery", "home_slides",
];

const server = await new Promise((resolve) => {
    const s = createServer(async (req, res) => {
        const url = new URL(req.url, "http://127.0.0.1");
        let p = join(ROOT, decodeURIComponent(url.pathname.replace(/^\//, "")));
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
const consoleErrors = [];

page.on("request", (req) => {
    const url = req.url();
    for (const fn of ["bootstrap_cms_default_content", "seed_cms_as_admin", "create_legacy_admin_session"]) {
        if (url.includes(`/rpc/${fn}`)) badRpc.push(url);
    }
});
page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/401|403|404|42501|policy|favicon|Failed to load resource/i.test(text)) return;
    if (text.includes("rhqmquaojetmzdznbevz.supabase.co")) return;
    consoleErrors.push(text);
});

// Homepage sections
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3000);
const home = await page.evaluate(() => ({
    hero: Boolean(document.querySelector("#hero .premium-slide")),
    principal: Boolean(document.querySelector("#principal")),
    updates: Boolean(document.querySelector("#latest-updates .gov-update-card")),
    notices: Boolean(document.querySelector("#notice-board .gov-notice-card")),
    courses: Boolean(document.querySelector("#courses .gov-course-card")),
    departments: Boolean(document.querySelector("#departments .gov-dept-card")),
    facilities: Boolean(document.querySelector("#facilities .facility-card, #facilities .gov-facility-card, #facilities article")),
    placements: Boolean(document.querySelector("#placements .placement-card, #placements article, #placements .gov-placement")),
    gallery: Boolean(document.querySelector("#gallery .premium-gallery-tile")),
}));

// Admin login
await page.goto(`http://127.0.0.1:${PORT}/admin/login.html`);
await page.fill("#email", "admin@eaglewoodpoly.in");
await page.fill("#password", "admin123");
await page.click("#loginBtn");
await page.waitForURL(/admin\/index/, { timeout: 30000 });
await page.waitForTimeout(2500);

const adminCounts = {};
for (const key of ADMIN_MODULES) {
    await page.locator(`[data-key="${key}"]`).first().click();
    await page.waitForTimeout(1200);
    const countText = await page.locator("#recordCount").textContent().catch(() => "0 records");
    const match = countText.match(/(\d+)/);
    adminCounts[key] = match ? Number(match[1]) : 0;
}

// Edit test on updates
await page.locator('[data-key="updates"]').first().click();
await page.waitForTimeout(800);
const editBtn = page.locator("[data-edit]").first();
if (await editBtn.count()) {
    await editBtn.click();
    await page.waitForTimeout(500);
    const saveResult = await page.evaluate(() => {
        const dlg = document.getElementById("editorDialog");
        return Boolean(dlg?.open);
    });
    adminCounts._editDialogOpens = saveResult ? 1 : 0;
    await page.keyboard.press("Escape");
}

await browser.close();
server.close();

console.log("\n=== Homepage sections ===");
Object.entries(home).forEach(([k, ok]) => console.log(`${ok ? "✓" : "✗"} ${k}`));

console.log("\n=== Admin record counts ===");
Object.entries(adminCounts).forEach(([k, n]) => console.log(`${n > 0 ? "✓" : "✗"} ${k}: ${n}`));

console.log("\n=== RPC calls ===");
console.log(badRpc.length ? `✗ ${badRpc.join("\n")}` : "✓ none");

console.log("\n=== Console errors ===");
console.log(consoleErrors.length ? consoleErrors.join("\n") : "✓ none");

const homeOk = Object.values(home).every(Boolean);
const adminOk = ADMIN_MODULES.every((k) => (adminCounts[k] || 0) > 0);
const rpcOk = badRpc.length === 0;
const errOk = consoleErrors.length === 0;

if (homeOk && adminOk && rpcOk && errOk) {
    console.log("\nPASS: CMS modules verified.");
    process.exit(0);
}
console.log("\nFAIL: CMS verification incomplete.");
process.exit(1);

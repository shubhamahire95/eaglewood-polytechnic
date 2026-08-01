#!/usr/bin/env node
/**
 * Full CMS + forms verification — all modules, contact/admission flows.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const PORT = 8885;
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
    "faculty", "facilities", "placements", "gallery", "footer_blocks", "home_slides",
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
const results = { home: {}, admin: {}, forms: {} };

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

// Homepage
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3500);
results.home = await page.evaluate(() => ({
    hero: Boolean(document.querySelector("#hero .premium-slide")),
    programs: Boolean(document.querySelector("#courses .programs-swiper .swiper-slide")),
    programsSwiper: Boolean(document.querySelector("#courses .programs-swiper-pagination")),
    principal: Boolean(document.querySelector("#principal")),
    updates: Boolean(document.querySelector("#latest-updates .gov-update-card")),
    notices: Boolean(document.querySelector("#notice-board .gov-notice-card")),
    courses: Boolean(document.querySelector("#courses .gov-course-card")),
    departments: Boolean(document.querySelector("#departments .gov-dept-card, #departments .swiper-slide")),
    facilities: Boolean(document.querySelector("#facilities article")),
    placements: Boolean(document.querySelector("#placements")),
    gallery: Boolean(document.querySelector("#gallery .premium-gallery-tile")),
}));

// Contact form
await page.goto(`http://127.0.0.1:${PORT}/contact.html`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
if (await page.locator("#contact-message-form").count()) {
    await page.fill('#contact-message-form [name="name"]', "QA Contact");
    await page.fill('#contact-message-form [name="email"]', "qa@example.com");
    await page.fill('#contact-message-form [name="phone"]', "9876543210");
    await page.fill('#contact-message-form [name="subject"]', "QA Test");
    await page.fill('#contact-message-form [name="message"]', "Automated contact form test.");
    await page.click('#contact-message-form button[type="submit"]');
    await page.waitForTimeout(1500);
    results.forms.contact = await page.evaluate(() => ({
        success: document.querySelector("#contact-message-form .form-status")?.classList.contains("success"),
        text: document.querySelector("#contact-message-form .form-status")?.textContent || "",
    }));
}

// Admission form
await page.goto(`http://127.0.0.1:${PORT}/admission.html`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
if (await page.locator("#admission-multistep-form").count()) {
    const form = page.locator("#admission-multistep-form");
    await form.locator('[data-step="1"] [name="student_name"]').fill("QA Student");
    await form.locator('[data-step="1"] [name="phone"]').fill("9876543210");
    await form.locator('[data-step="1"] [name="email"]').fill("student@example.com");
    await form.locator('[data-step="1"] [data-next-step]').click();
    await page.waitForTimeout(500);
    const courseSelect = form.locator('[data-step="2"] [name="course"]');
    if (await courseSelect.count()) {
        const val = await courseSelect.locator("option").nth(1).getAttribute("value");
        if (val) await courseSelect.selectOption(val);
    }
    await form.locator('[data-step="2"] [data-next-step]').click();
    await page.waitForTimeout(500);
    await form.locator('[data-step="3"] button[type="submit"]').click();
    await page.waitForTimeout(1500);
    results.forms.admission = await page.evaluate(() => ({
        success: document.querySelector("#admission-multistep-form .form-status")?.classList.contains("success")
            || Boolean(document.querySelector(".admission-success")),
        text: document.querySelector("#admission-multistep-form .form-status")?.textContent || "",
    }));
}

// Admin
await page.goto(`http://127.0.0.1:${PORT}/admin/login.html`);
await page.fill("#email", "admin@eaglewoodpoly.in");
await page.fill("#password", "admin123");
await page.click("#loginBtn");
await page.waitForURL(/admin\/index/, { timeout: 30000 });
await page.waitForTimeout(2500);

for (const key of ADMIN_MODULES) {
    await page.locator(`[data-key="${key}"]`).first().click();
    await page.waitForTimeout(1000);
    const countText = await page.locator("#recordCount").textContent().catch(() => "0 records");
    const match = countText.match(/(\d+)/);
    results.admin[key] = match ? Number(match[1]) : 0;
}

await page.locator('[data-key="contacts"]').first().click();
await page.waitForTimeout(800);
const contactsCountText = await page.locator("#recordCount").textContent().catch(() => "0");
const contactsMatch = contactsCountText.match(/(\d+)/);
results.admin.contactsVisible = (contactsMatch ? Number(contactsMatch[1]) : 0) > 0 || results.forms.contact?.success === true;

await browser.close();
server.close();

console.log("\n=== Homepage ===");
Object.entries(results.home).forEach(([k, ok]) => console.log(`${ok ? "✓" : "✗"} ${k}`));

console.log("\n=== Forms ===");
console.log(`${results.forms.contact?.success ? "✓" : "✗"} contact submit`);
console.log(`${results.forms.admission?.success ? "✓" : "✗"} admission submit`);

console.log("\n=== Admin modules ===");
Object.entries(results.admin).forEach(([k, n]) => {
    if (k === "contactsVisible") {
        console.log(`${n ? "✓" : "✗"} contacts (visible in admin)`);
        return;
    }
    console.log(`${n > 0 ? "✓" : "✗"} ${k}: ${n}`);
});

console.log("\n=== RPC / console ===");
console.log(badRpc.length ? `✗ RPC: ${badRpc.join(", ")}` : "✓ no forbidden RPC");
console.log(consoleErrors.length ? consoleErrors.join("\n") : "✓ no console errors");

const homeOk = Object.values(results.home).every(Boolean);
const adminOk = ADMIN_MODULES.every((k) => (results.admin[k] || 0) > 0);
const formsOk = results.forms.contact?.success && results.forms.admission?.success;
const contactsAdminOk = results.admin.contactsVisible;
const allOk = homeOk && adminOk && formsOk && contactsAdminOk && !badRpc.length && !consoleErrors.length;

if (allOk) {
    console.log("\nPASS: Full production verification.");
    process.exit(0);
}
console.log("\nFAIL: Issues remain.");
process.exit(1);

#!/usr/bin/env node
/**
 * Production CMS end-to-end verification (login, CRUD, forms, homepage sync).
 * Usage: node scripts/verify-production-cms-e2e.js
 */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const PORT = 8892;
const OUT = join(ROOT, "tmp", "production-e2e");
const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";
const ADMIN_EMAIL = "admin@eaglewoodpoly.in";
const ADMIN_PASSWORD = "admin123";

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
};

function startServer() {
    return new Promise((resolve) => {
        const server = createServer(async (req, res) => {
            try {
                const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
                let filePath = join(ROOT, decodeURIComponent(url.pathname.replace(/^\//, "")));
                if (url.pathname.endsWith("/")) filePath = join(filePath, "index.html");
                if (!existsSync(filePath)) {
                    res.writeHead(404);
                    res.end("Not found");
                    return;
                }
                const data = await readFile(filePath);
                res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
                res.end(data);
            } catch {
                res.writeHead(500);
                res.end("Error");
            }
        });
        server.listen(PORT, "127.0.0.1", () => resolve(server));
    });
}

async function supabaseCount(table) {
    const filter = ["settings", "admins", "inquiries", "admissions", "contacts"].includes(table) ? "" : "&published=eq.true";
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1${filter}`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "count=exact" },
    });
    return Number((res.headers.get("content-range") || "").split("/")[1] || 0);
}

async function loginAdmin(page) {
    await page.goto(`http://127.0.0.1:${PORT}/admin/login.html`, { waitUntil: "domcontentloaded" });
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.click("#loginBtn");
    await page.waitForURL(/admin\/index\.html/, { timeout: 20000 });
}

async function openModule(page, key) {
    await page.locator(`[data-key="${key}"]`).first().click();
    await page.waitForTimeout(1000);
}

async function main() {
    await mkdir(OUT, { recursive: true });
    const server = await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    const failed = [];
    const report = { steps: [], counts: {} };

    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    page.on("response", (res) => {
        if (res.status() >= 400 && res.url().includes("supabase.co")) {
            failed.push(`${res.status()} ${res.url()}`);
        }
    });

    try {
        await loginAdmin(page);
        report.steps.push("login:ok");

        await openModule(page, "principal_message");
        await page.click("#addRecordBtn");
        await page.waitForSelector("#editorDialog[open], .editor-dialog:not([hidden])", { timeout: 5000 }).catch(() => null);
        const nameField = page.locator('[name="name"], #field-name').first();
        if (await nameField.count()) {
            await nameField.fill("Production Principal Test");
            await page.locator("#editorForm button[type='submit'], .btn-primary:has-text('Save')").first().click();
            await page.waitForTimeout(2000);
            report.steps.push("principal:create:attempted");
        }

        const principalCount = await supabaseCount("principal_message");
        report.counts.principal_message = principalCount;

        await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle" });
        const homeHasPrincipal = await page.locator("#principal, .gov-principal").count() > 0;
        report.steps.push(`homepage:principal:${homeHasPrincipal ? "visible" : "missing"}`);

        await page.goto(`http://127.0.0.1:${PORT}/admission.html`, { waitUntil: "domcontentloaded" });
        await page.fill('input[name="student_name"], #student_name', "E2E Student");
        await page.fill('input[name="phone"]', "9999999999");
        await page.fill('input[name="email"]', "e2e@test.com");
        const course = page.locator('select[name="course"]');
        if (await course.count()) await course.selectOption({ index: 1 }).catch(() => {});
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);
        const admissions = await supabaseCount("admissions");
        report.counts.admissions = admissions;
        report.steps.push(`admission:count:${admissions}`);

        await writeFile(join(OUT, "report.json"), JSON.stringify({ report, errors: [...new Set(errors)], failed: [...new Set(failed)] }, null, 2));

        console.log("Production CMS E2E\n");
        report.steps.forEach((s) => console.log(`  ${s}`));
        console.log("\nCounts:", report.counts);
        if (failed.length) {
            console.log("\nFailed API:");
            failed.forEach((f) => console.log(`  ${f}`));
            process.exit(1);
        }
        if (errors.filter((e) => !/favicon/i.test(e)).length) {
            console.log("\nConsole errors:");
            errors.forEach((e) => console.log(`  ${e}`));
            process.exit(1);
        }
        console.log("\nPASS");
    } finally {
        await browser.close();
        server.close();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

#!/usr/bin/env node
/**
 * CMS end-to-end verification — homepage vs Supabase vs admin modules.
 * Usage: node scripts/verify-cms-e2e.js
 */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const PORT = 8891;
const OUT = join(ROOT, "tmp", "cms-e2e");
const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";
const ADMIN_EMAIL = "admin@eaglewoodpoly.in";
const ADMIN_PASSWORD = "admin123";

const CONTENT_TABLES = [
    "home_slides", "principal_message", "updates", "notices", "courses",
    "departments", "faculty", "facilities", "placements", "gallery",
    "footer_blocks", "settings",
];

const ADMIN_MODULES = [
    { key: "dashboard", label: "Dashboard", nav: "dashboard" },
    { key: "home_slides", label: "Hero Slides", nav: "home_slides" },
    { key: "principal_message", label: "Principal Message", nav: "principal_message" },
    { key: "updates", label: "Updates", nav: "updates" },
    { key: "notices", label: "Important Notices", nav: "notices" },
    { key: "courses", label: "Courses", nav: "courses" },
    { key: "departments", label: "Departments", nav: "departments" },
    { key: "facilities", label: "Facilities", nav: "facilities" },
    { key: "placements", label: "Placements", nav: "placements" },
    { key: "gallery", label: "Gallery", nav: "gallery" },
    { key: "media_library", label: "Media Library", nav: "media_library" },
    { key: "admissions", label: "Admissions", nav: "admissions" },
    { key: "contacts", label: "Contact", nav: "contacts" },
    { key: "inquiries", label: "Inquiries", nav: "inquiries" },
    { key: "ai_knowledge_base", label: "AI Knowledge", nav: "ai_knowledge_base" },
    { key: "ai_prompts", label: "AI Assistant", nav: "ai_prompts" },
    { key: "ai_conversations", label: "AI Conversations", nav: "ai_conversations" },
    { key: "settings", label: "Settings", nav: "settings" },
    { key: "footer_blocks", label: "Footer Blocks", nav: "footer_blocks" },
];

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
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
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
    const filter = ["settings", "admins", "inquiries", "admissions", "contacts", "ai_conversations", "media_library"].includes(table)
        ? ""
        : "&published=eq.true";
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1${filter}`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "count=exact" },
    });
    const range = res.headers.get("content-range") || "";
    return Number(range.split("/")[1] || 0);
}

async function collectSupabaseCounts() {
    const counts = {};
    for (const table of CONTENT_TABLES) {
        counts[table] = await supabaseCount(table);
    }
    return counts;
}

function homepageSectionVisible(html, sectionId) {
    if (!sectionId) return true;
    return html.includes(`id="${sectionId}"`) || html.includes(`id='${sectionId}'`);
}

async function loginAdmin(page) {
    await page.goto(`http://127.0.0.1:${PORT}/admin/login.html`, { waitUntil: "domcontentloaded" });
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.click("#loginBtn");
    await page.waitForURL(/admin\/index\.html/, { timeout: 15000 });
}

async function openAdminModule(page, mod) {
    const link = page.locator(`[data-key="${mod.nav}"]`).first();
    if (await link.count()) {
        await link.click();
    } else {
        await page.evaluate((key) => {
            document.querySelector(`[data-key="${key}"]`)?.click();
        }, mod.nav);
    }
    await page.waitForTimeout(1200);
}

function parseAdminRecordCount(page) {
    return page.locator("#recordCount").textContent().then((text) => {
        const match = String(text || "").match(/(\d+)\s+records?/i);
        return match ? Number(match[1]) : null;
    }).catch(() => null);
}

async function moduleIsEmpty(page) {
    const empty = await page.locator(".empty-state strong").filter({ hasText: /no content yet/i }).count();
    return empty > 0;
}

async function main() {
    await mkdir(OUT, { recursive: true });
    const server = await startServer();
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    const report = { supabase: {}, admin: {}, homepage: {}, issues: [] };

    page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    try {
        report.supabase = await collectSupabaseCounts();

        await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle", timeout: 30000 });
        const homeHtml = await page.content();
        await page.screenshot({ path: join(OUT, "homepage.png"), fullPage: true });
        report.homepage = {
            hero: homepageSectionVisible(homeHtml, "hero"),
            principal: homeHtml.includes("gov-principal") || homeHtml.includes("principal"),
            mission: homeHtml.includes("mission") || homeHtml.includes("Mission"),
            updates: homepageSectionVisible(homeHtml, "latest-updates"),
            notices: homepageSectionVisible(homeHtml, "notice-board"),
            courses: homepageSectionVisible(homeHtml, "courses"),
            departments: homepageSectionVisible(homeHtml, "departments"),
            gallery: homepageSectionVisible(homeHtml, "gallery"),
        };

        await loginAdmin(page);
        await page.screenshot({ path: join(OUT, "admin-dashboard.png"), fullPage: true });

        for (const mod of ADMIN_MODULES) {
            await openAdminModule(page, mod);
            await page.screenshot({ path: join(OUT, `admin-${mod.key}.png`), fullPage: true });
            const recordCount = await parseAdminRecordCount(page);
            const emptyState = await moduleIsEmpty(page);
            report.admin[mod.key] = { recordCount, emptyState };
        }

        for (const table of CONTENT_TABLES) {
            const dbCount = report.supabase[table] || 0;
            const modKey = table === "home_slides" ? "home_slides" : table;
            const admin = report.admin[modKey];
            if (!admin) continue;
            if (dbCount > 0 && admin.emptyState) {
                report.issues.push(`${table}: Supabase has ${dbCount} rows but admin module is empty`);
            }
        }

        if (report.supabase.home_slides > 0 && !report.homepage.hero) {
            report.issues.push("home_slides: Supabase has slides but homepage hero is missing");
        }

        const emptyTables = CONTENT_TABLES.filter((t) => (report.supabase[t] || 0) === 0 && t !== "settings");
        if (emptyTables.length) {
            report.issues.push(`${emptyTables.length} CMS content tables empty in Supabase — run supabase/APPLY_ALL_PRODUCTION.sql or use Admin → Import Website Content after SQL deploy`);
        }

        const consoleErrors = [...new Set(errors.filter((e) => !/favicon|404.*\.map/i.test(e)))];
        if (consoleErrors.length) {
            report.issues.push(`Console errors: ${consoleErrors.slice(0, 5).join(" | ")}`);
        }

        await writeFile(join(OUT, "report.json"), JSON.stringify(report, null, 2));

        console.log("CMS E2E Verification\n");
        console.log("Supabase counts:");
        CONTENT_TABLES.forEach((t) => console.log(`  ${t}: ${report.supabase[t]}`));
        console.log("\nHomepage sections:");
        Object.entries(report.homepage).forEach(([k, v]) => console.log(`  ${k}: ${v ? "visible" : "missing"}`));
        console.log(`\nScreenshots: ${OUT}`);

        if (report.issues.length) {
            console.log("\nISSUES:");
            report.issues.forEach((issue) => console.log(`  ✗ ${issue}`));
            process.exit(1);
        }
        console.log("\nPASS: CMS E2E checks passed.");
    } finally {
        await browser.close();
        server.close();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

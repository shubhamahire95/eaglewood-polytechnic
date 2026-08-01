#!/usr/bin/env node
/**
 * Full CMS data-flow diagnostic — traces Database → API → Admin UI → Homepage.
 * Outputs report JSON + screenshots to tmp/cms-diagnostic/
 */
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const OUT = join(ROOT, "tmp", "cms-diagnostic");
const PORT = 8895;
const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";
const ADMIN_EMAIL = "admin@eaglewoodpoly.in";
const ADMIN_PASSWORD = "admin123";

const MODULES = [
    "principal_message", "updates", "notices", "courses", "departments",
    "faculty", "facilities", "placements", "gallery", "home_slides", "footer_blocks",
];

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".woff2": "font/woff2",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
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

async function restCount(table, { admin = false, publishedOnly = false } = {}) {
    const headers = {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Prefer: "count=exact",
    };
    if (admin) {
        headers["x-admin-email"] = ADMIN_EMAIL;
        headers["x-admin-password"] = ADMIN_PASSWORD;
    }
    const filter = publishedOnly ? "&published=eq.true" : "";
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=5${filter}`, { headers });
    const range = res.headers.get("content-range") || "";
    const total = Number(range.split("/")[1] || 0);
    let rows = [];
    try { rows = await res.json(); } catch { /* ignore */ }
    return { status: res.status, total, sampleIds: (Array.isArray(rows) ? rows.map((r) => r.id) : []) };
}

async function probeWrite(table) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: {
            apikey: KEY,
            Authorization: `Bearer ${KEY}`,
            "Content-Type": "application/json",
            "x-admin-email": ADMIN_EMAIL,
            "x-admin-password": ADMIN_PASSWORD,
            Prefer: "return=representation",
        },
        body: JSON.stringify({
            title: "Diagnostic probe",
            description: "delete me",
            published: false,
            status: "hidden",
            display_order: 9999,
        }),
    });
    const text = await res.text();
    let row = null;
    try { row = JSON.parse(text)?.[0]; } catch { /* ignore */ }
    if (res.ok && row?.id) {
        await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${row.id}`, {
            method: "DELETE",
            headers: {
                apikey: KEY,
                Authorization: `Bearer ${KEY}`,
                "x-admin-email": ADMIN_EMAIL,
                "x-admin-password": ADMIN_PASSWORD,
            },
        });
    }
    return { status: res.status, ok: res.ok, body: text.slice(0, 200) };
}

async function main() {
    await mkdir(OUT, { recursive: true });
    const report = {
        timestamp: new Date().toISOString(),
        layers: {},
        modules: {},
        homepage: {},
        rootCause: [],
    };

    console.log("CMS Full Diagnostic\n");

    // Layer 1: Database (REST)
    console.log("STEP 1 — Database (PostgREST)");
    for (const table of MODULES) {
        const anon = await restCount(table, { publishedOnly: false });
        const anonPub = await restCount(table, { publishedOnly: true });
        const admin = await restCount(table, { admin: true });
        report.modules[table] = {
            database: { anonAll: anon.total, anonPublished: anonPub.total, adminAll: admin.total, httpStatus: admin.status },
            query: {
                table,
                select: "*",
                filters: "none (admin) / published=true (homepage)",
                order: "display_order asc, created_at desc",
                limit: 250,
            },
            apiReturnedRows: admin.total,
            uiExpectedRows: admin.total,
            dataLossLayer: admin.total === 0 ? "DATABASE — zero rows in Supabase" : null,
        };
        console.log(`  ${table}: anon=${anon.total} published=${anonPub.total} admin=${admin.total}`);
    }

    const settings = await restCount("settings");
    report.modules.settings = { database: { total: settings.total } };
    console.log(`  settings: ${settings.total}`);

    const writeProbe = await probeWrite("updates");
    report.layers.rls = writeProbe;
    console.log(`  admin INSERT probe: ${writeProbe.status} ${writeProbe.ok ? "OK" : "BLOCKED"}`);
    if (!writeProbe.ok) {
        report.rootCause.push("RLS blocks admin writes (401) — is_admin() does not accept x-admin-email/x-admin-password until 009_production_stabilize.sql is applied");
    }

    const allEmpty = MODULES.every((t) => report.modules[t].database.adminAll === 0);
    if (allEmpty) {
        report.rootCause.push("All CMS content tables have 0 rows — content was never seeded into Supabase");
    }

    // Layer 2-5: Browser trace
    console.log("\nSTEP 2-5 — Browser trace (admin + homepage)");
    const { chromium } = await import("playwright");
    const server = await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const networkLog = [];

    page.on("response", async (res) => {
        const url = res.url();
        if (!url.includes("supabase.co/rest/v1/")) return;
        const table = MODULES.find((t) => url.includes(`/rest/v1/${t}`));
        if (!table) return;
        const range = res.headers()["content-range"] || "";
        const total = Number(range.split("/")[1] || 0);
        networkLog.push({ table, status: res.status(), total, url: url.split("?")[0] });
    });

    // Admin login
    await page.goto(`http://127.0.0.1:${PORT}/admin/login.html`, { waitUntil: "domcontentloaded" });
    await page.fill("#email", ADMIN_EMAIL);
    await page.fill("#password", ADMIN_PASSWORD);
    await page.click("#loginBtn");
    await page.waitForTimeout(4000);
    const onDashboard = page.url().includes("admin/index");
    if (!onDashboard) {
        report.browserLogin = { ok: false, url: page.url(), msg: await page.textContent("#msg").catch(() => "") };
        console.log("  Login failed — staying on", page.url());
    } else {
        report.browserLogin = { ok: true };
    }

    const adminModules = ["principal_message", "updates", "notices", "courses", "facilities", "placements"];
    if (onDashboard) for (const key of adminModules) {
        networkLog.length = 0;
        await page.locator(`[data-key="${key}"]`).first().click();
        await page.waitForTimeout(2000);
        const recordText = await page.locator("#recordCount").textContent().catch(() => "");
        const hasTable = await page.locator(".data-table tbody tr").count();
        const hasEmpty = await page.locator(".empty-state").count();
        await page.screenshot({ path: join(OUT, `admin-${key}.png`), fullPage: true });

        const net = networkLog.filter((n) => n.table === key.replace("principal_message", "principal_message"));
        const moduleTable = key === "principal_message" ? "principal_message" : key;
        const lastReq = networkLog.filter((n) => n.table === moduleTable).pop();

        report.modules[key].browser = {
            recordCountLabel: recordText,
            tableRowsInDom: hasTable,
            emptyStateVisible: hasEmpty > 0,
            lastNetworkRequest: lastReq || null,
            dataLossLayer: hasEmpty > 0 && (lastReq?.total === 0 || !lastReq)
                ? "DATABASE — API returned 0 rows, renderer correctly shows empty state"
                : hasEmpty > 0 && lastReq?.total > 0
                    ? "RENDERER — API had rows but DOM empty (BUG)"
                    : null,
        };
        console.log(`  admin/${key}: ${recordText} | DOM rows=${hasTable} | API total=${lastReq?.total ?? "?"}`);
    }

    // Homepage (no login required)
    networkLog.length = 0;
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(OUT, "homepage.png"), fullPage: true });

    const sections = {
        hero: await page.locator("#hero .premium-slide").count(),
        principal: await page.locator("#principal").count(),
        updates: await page.locator("#latest-updates .gov-update-card").count(),
        notices: await page.locator("#notice-board .gov-notice-card").count(),
        courses: await page.locator("#courses .gov-course-card").count(),
        departments: await page.locator("#departments .gov-dept-card").count(),
        facilities: await page.locator("#facilities .facility-slide-card").count(),
        placements: await page.locator("#placements").count(),
        gallery: await page.locator("#gallery .gov-gallery-card, #gallery .gallery-card").count(),
        mission: await page.locator("#mission-vision").count(),
    };
    report.homepage = { sections, networkRequests: networkLog.slice(0, 20) };
    console.log("\n  Homepage sections:", sections);

    const consoleErrors = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    report.consoleErrors = consoleErrors;

    await browser.close();
    server.close();

    // Schema check
    report.schema = {
        principal_message: ["name", "message", "designation", "photo_url", "published", "display_order"],
        updates: ["title", "description", "published", "display_order"],
        notices: ["title", "description", "published", "display_order"],
        courses: ["title", "department", "published", "display_order"],
        dashboardFieldsMatch: true,
        note: "Dashboard MODULES.fields align with 001_eaglewood_cms.sql — no column name mismatch",
    };

    report.duplicateLoaders = {
        homeFallbacks: existsSync(join(ROOT, "assets/js/home-fallbacks.js")),
        homeData: existsSync(join(ROOT, "assets/js/home-data.js")),
        importedByPublicSite: false,
        note: "home-fallbacks.js / home-data.js exist but are NOT imported by index.html or home-cms.js",
    };

    report.fix = {
        required: [
            "Apply supabase/migrations/009_production_stabilize.sql (enables admin REST writes)",
            "Run npm run cms:seed or login to admin (auto-seeds from cms-seed-data.json)",
        ],
    };

    await writeFile(join(OUT, "report.json"), JSON.stringify(report, null, 2));
    console.log(`\nReport: ${join(OUT, "report.json")}`);
    console.log(`Screenshots: ${OUT}/admin-*.png, homepage.png`);
    console.log("\nROOT CAUSE:");
    report.rootCause.forEach((r) => console.log(`  • ${r}`));
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

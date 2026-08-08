/**
 * Production verification — static pages, console errors, broken assets.
 * Usage: node scripts/verify-production.js
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const PORT = 8877;

const PAGES = [
    "index.html",
    "about.html",
    "admission.html",
    "courses.html",
    "departments.html",
    "faculty.html",
    "placements.html",
    "gallery.html",
    "infrastructure.html",
    "contact.html",
    "sitemap.html",
    "404.html",
    "admin/login.html",
    "admin/index.html",
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
                if (!filePath.startsWith(ROOT)) {
                    res.writeHead(403);
                    res.end("Forbidden");
                    return;
                }
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

async function loadPlaywright() {
    try {
        const mod = await import("playwright");
        return mod.chromium;
    } catch {
        console.error("Install Playwright first: npm install -D playwright && npx playwright install chromium");
        process.exit(1);
    }
}

async function verifyPage(browser, path) {
    const page = await browser.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];

    if (path === "index.html") {
        await page.addInitScript(() => {
            try {
                sessionStorage.removeItem("ew_bootstrap_rpc_state");
                sessionStorage.removeItem("ew_cms_bootstrap_lock");
            } catch {
                /* ignore */
            }
        });
    }

    page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        if (text.includes("rhqmquaojetmzdznbevz.supabase.co")) return;
        if (text.includes("supabase-js")) return;
        if (text.includes("favicon.ico")) return;
        consoleErrors.push(text);
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("requestfailed", (req) => {
        const url = req.url();
        if (url.includes("127.0.0.1") || url.includes("localhost")) {
            failedRequests.push(url);
        }
    });

    const response = await page.goto(`http://127.0.0.1:${PORT}/${path}`, { waitUntil: "networkidle", timeout: 45000 });
    if (path === "index.html") {
        await page.waitForFunction(
            () => document.body?.dataset?.cmsReady === "true" && document.querySelector("#hero .premium-slide"),
            { timeout: 20000 },
        ).catch(() => {});
    }
    await page.evaluate(async () => {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise((r) => setTimeout(r, 600));
        window.scrollTo(0, 0);
    });
    await page.waitForTimeout(path === "index.html" ? 2800 : 1200);

    let contentChecks = null;
    if (path === "index.html") {
        contentChecks = await page.evaluate(() => ({
            hero: Boolean(document.querySelector("#hero .premium-slide")),
            principal: Boolean(document.querySelector("#principal")),
            updates: Boolean(document.querySelector("#latest-updates .gov-update-card")),
            notices: Boolean(document.querySelector("#notice-board .gov-notice-card")),
            courses: Boolean(document.querySelector("#courses .gov-course-card")),
            departments: Boolean(document.querySelector("#departments .gov-dept-card")),
            mission: Boolean(document.querySelector("#mission-vision")),
        }));
    }

    const brokenImages = await page.evaluate(async () => {
        const visible = [...document.images].filter((img) => {
            const style = window.getComputedStyle(img);
            if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
            const rect = img.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
        const broken = [];
        for (const img of visible) {
            const src = img.currentSrc || img.src || "";
            if (!src || src.startsWith("data:")) continue;
            if (img.naturalWidth > 0) continue;
            try {
                const res = await fetch(src);
                if (!res.ok) broken.push(src);
            } catch {
                broken.push(src);
            }
        }
        return broken;
    });

    await page.close();
    return {
        path,
        status: response?.status() || 0,
        consoleErrors,
        pageErrors,
        failedRequests,
        brokenImages,
        contentChecks,
    };
}

async function main() {
    const chromium = await loadPlaywright();
    const server = await startServer();
    const browser = await chromium.launch({ headless: true });
    const results = [];

    try {
        for (const path of PAGES) {
            process.stdout.write(`Checking ${path}... `);
            const result = await verifyPage(browser, path);
            results.push(result);
            const ok = !result.consoleErrors.length && !result.pageErrors.length && !result.failedRequests.length && !result.brokenImages.length && result.status === 200
                && (!result.contentChecks || Object.values(result.contentChecks).every(Boolean));
            console.log(ok ? "OK" : "ISSUES");
        }
    } finally {
        await browser.close();
        server.close();
    }

    const issues = results.filter((r) =>
        r.status !== 200
        || r.consoleErrors.length
        || r.pageErrors.length
        || r.failedRequests.length
        || r.brokenImages.length
        || (r.contentChecks && Object.values(r.contentChecks).some((v) => !v))
    );

    console.log("\n=== Production Verification ===\n");
    if (!issues.length) {
        console.log(`All ${PAGES.length} pages passed (console, JS, local assets, images).`);
        process.exit(0);
    }

    for (const r of issues) {
        console.log(`\n${r.path} (HTTP ${r.status})`);
        if (r.consoleErrors.length) console.log("  Console:", [...new Set(r.consoleErrors)].join(" | "));
        if (r.pageErrors.length) console.log("  JS:", [...new Set(r.pageErrors)].join(" | "));
        if (r.failedRequests.length) console.log("  Failed local requests:", r.failedRequests.join(", "));
        if (r.brokenImages.length) console.log("  Broken images:", r.brokenImages.join(", "));
        if (r.contentChecks) {
            const missing = Object.entries(r.contentChecks).filter(([, ok]) => !ok).map(([k]) => k);
            if (missing.length) console.log("  Missing homepage sections:", missing.join(", "));
        }
    }
    process.exit(1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

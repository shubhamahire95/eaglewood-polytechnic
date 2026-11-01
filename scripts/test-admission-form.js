/**
 * Admission guidance page and inquiry-flow browser checks.
 * Uses a local PostgREST fixture; no production inquiries are created.
 * Usage: node scripts/test-admission-form.js
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, relative, isAbsolute, extname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const PORT = 8881;
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
    return new Promise((resolveServer, reject) => {
        const server = createServer(async (req, res) => {
            try {
                const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
                const requestPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
                const filePath = resolve(ROOT, requestPath || "index.html");
                const localPath = relative(ROOT, filePath);
                if ((localPath.startsWith("..") || isAbsolute(localPath)) || !existsSync(filePath)) {
                    res.writeHead(404);
                    res.end("Not found");
                    return;
                }
                const data = await readFile(filePath);
                res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
                res.end(data);
            } catch (error) {
                reject(error);
                res.writeHead(500);
                res.end("Server error");
            }
        });
        server.once("error", reject);
        server.listen(PORT, "127.0.0.1", () => resolveServer(server));
    });
}

async function fillGuidanceForm(page, prefix) {
    await page.locator('#admission-help-form [name="name"]').fill(`${prefix} Student`);
    await page.locator('#admission-help-form [name="phone"]').fill("9423716230");
    await page.locator('#admission-help-form [name="email"]').fill(`${prefix.toLowerCase()}@example.com`);
    await page.locator('#admission-help-form [name="course"]').selectOption({ index: 1 });
    await page.locator('#admission-help-form [name="qualification"]').selectOption("SSC / 10th passed");
    await page.locator('#admission-help-form [name="message"]').fill("Please explain the CAP counselling process and eligibility.");
}

async function checkNoHorizontalOverflow(page, width, height) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(100);
    const metrics = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
        form: document.querySelector("#admission-help-form")?.getBoundingClientRect().width || 0,
    }));
    if (metrics.page > metrics.viewport + 1) {
        throw new Error(`${width}px layout overflows horizontally (${metrics.page}px scroll width).`);
    }
    if (metrics.form && metrics.form > metrics.viewport) {
        throw new Error(`${width}px form is wider than the viewport (${metrics.form}px).`);
    }
    return metrics;
}

async function run() {
    const server = await startServer();
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
        const page = await context.newPage();
        const consoleErrors = [];
        const capturedPosts = [];
        page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
        page.on("pageerror", (err) => consoleErrors.push(err.message));

        await page.route("https://rhqmquaojetmzdznbevz.supabase.co/**", async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            if (request.method() === "OPTIONS") {
                await route.fulfill({ status: 204, headers: {
                    "access-control-allow-origin": "*",
                    "access-control-allow-methods": "GET,POST,OPTIONS",
                    "access-control-allow-headers": "*",
                } });
                return;
            }
            if (request.method() === "POST" && url.pathname === "/rest/v1/inquiries") {
                capturedPosts.push({
                    path: url.pathname,
                    payload: request.postDataJSON(),
                    headers: request.headers(),
                });
                await route.fulfill({ status: 201, body: "", headers: { "access-control-allow-origin": "*" } });
                return;
            }
            const rows = url.pathname === "/rest/v1/courses"
                ? [{ title: "Computer Engineering" }, { title: "Civil Engineering" }]
                : [];
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                headers: { "access-control-allow-origin": "*" },
                body: JSON.stringify(rows),
            });
        });

        await page.goto(`http://127.0.0.1:${PORT}/admission.html`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("#admission-help-form", { state: "attached", timeout: 20000 }).catch(async () => {
            const slotHtml = await page.locator("#admission-form-slot").innerHTML().catch(() => "<slot missing>");
            throw new Error(`Admission form did not initialize. Browser errors: ${consoleErrors.join(" | ") || "none"}. Slot: ${slotHtml.slice(0, 500)}`);
        });

        for (const width of [360, 390, 768, 1024, 1366, 1920]) {
            await checkNoHorizontalOverflow(page, width, width <= 768 ? 900 : 960);
        }
        const forms = await page.evaluate(() => ({
            heading: document.querySelector("#admission-help-title")?.textContent.trim(),
            fields: [...document.querySelectorAll("#admission-help-form input, #admission-help-form select, #admission-help-form textarea")].map((field) => field.name),
            hasFileUpload: Boolean(document.querySelector('#admission-help-form input[type="file"]')),
            hasFakeApplication: Boolean(document.querySelector("#admission-multistep-form")),
            capPortalLinks: [...document.querySelectorAll(".admission-portal-card")].map((link) => link.href),
        }));
        for (const field of ["name", "phone", "email", "course", "qualification", "message"]) {
            if (!forms.fields.includes(field)) throw new Error(`Required inquiry field missing: ${field}`);
        }
        if (forms.hasFileUpload || forms.hasFakeApplication) throw new Error("Admission guidance form contains application or document-upload UI.");
        if (forms.capPortalLinks.length < 4 || forms.capPortalLinks.some((href) => !href.startsWith("https://"))) {
            throw new Error("Official CAP portal links are missing or invalid.");
        }

        for (const section of await page.locator(".admission-page > section").all()) {
            await section.scrollIntoViewIfNeeded();
            await page.waitForTimeout(100);
        }
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.waitForTimeout(250);
        await page.screenshot({ path: join(tmpdir(), `eaglewood-admission-${process.pid}-desktop.png`), fullPage: true });
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.locator('#admission-help-form [name="phone"]').fill("12345");
        await page.locator('#admission-help-form [name="name"]').fill("Desktop Student");
        await page.locator('#admission-help-form [name="course"]').selectOption({ index: 1 });
        await page.locator('#admission-help-form [name="qualification"]').selectOption("SSC / 10th passed");
        await page.locator('#admission-help-form [name="message"]').fill("CAP guidance request");
        await page.locator('#admission-help-form button[type="submit"]').click();
        if (capturedPosts.length) throw new Error("Invalid mobile number was submitted to the backend.");

        await fillGuidanceForm(page, "Desktop");
        await page.locator('#admission-help-form button[type="submit"]').click();
        await page.waitForFunction(() => document.querySelector("#admission-help-form .form-status")?.classList.contains("success"));
        const desktopStatus = await page.locator("#admission-help-form .form-status").textContent();
        if (!desktopStatus.includes("sent securely")) throw new Error(`Unexpected desktop success status: ${desktopStatus}`);
        if (capturedPosts.length !== 1) throw new Error(`Expected one desktop inquiry POST, received ${capturedPosts.length}.`);

        const inquiry = capturedPosts[0];
        if (inquiry.path !== "/rest/v1/inquiries") throw new Error(`Inquiry posted to unexpected endpoint: ${inquiry.path}`);
        for (const key of ["name", "phone", "email", "course", "message", "status", "reply_status"]) {
            if (!(key in inquiry.payload)) throw new Error(`Inquiry payload missing ${key}.`);
        }
        if ("qualification" in inquiry.payload) throw new Error("Payload contains a column that does not exist in inquiries schema.");
        if (!inquiry.payload.message.includes("Qualification: SSC / 10th passed") || !inquiry.payload.message.includes("Please explain the CAP counselling process and eligibility.")) {
            throw new Error("Qualification or student message was not preserved in the inquiry record.");
        }
        if (!inquiry.headers.apikey || inquiry.headers.authorization?.includes("admin")) {
            throw new Error("Inquiry did not use the public Supabase API credential path.");
        }

        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForSelector("#admission-help-form");
        await page.setViewportSize({ width: 390, height: 844 });
        for (const section of await page.locator(".admission-page > section").all()) {
            await section.scrollIntoViewIfNeeded();
            await page.waitForTimeout(100);
        }
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.waitForTimeout(250);
        await page.screenshot({ path: join(tmpdir(), `eaglewood-admission-${process.pid}-mobile.png`), fullPage: true });
        await fillGuidanceForm(page, "Mobile");
        await page.locator('#admission-help-form button[type="submit"]').click();
        await page.waitForFunction(() => document.querySelector("#admission-help-form .form-status")?.classList.contains("success"));
        if (capturedPosts.length !== 2) throw new Error(`Expected desktop and mobile inquiries; received ${capturedPosts.length}.`);

        if (consoleErrors.length) throw new Error(`Console errors: ${consoleErrors.join(" | ")}`);
        console.log("PASS: CAP admission guidance page layout at 360, 390, 768, 1024, 1366, and 1920px.");
        console.log("PASS: Desktop and mobile inquiry submissions hit the existing inquiries endpoint.");
        console.log("PASS: Invalid phone rejected; qualification stored in message; no document upload/application flow.");
        console.log("PASS: No browser console errors.");
    } finally {
        await browser?.close();
        await new Promise((resolveClose) => server.close(resolveClose));
    }
}

run().catch((err) => {
    console.error("FAIL:", err.message);
    process.exitCode = 1;
});

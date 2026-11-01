/**
 * Local mocked integration test for public Contact/Admission forms and Admin display.
 * Every Supabase request is intercepted; the production database is never read or written.
 * Usage: node scripts/test-inquiry-admin-display.js
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, relative, isAbsolute, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const PORT = 8894;
const SUPABASE_HOST = "https://rhqmquaojetmzdznbevz.supabase.co";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".woff2": "font/woff2" };
const records = { contacts: [], inquiries: [], admissions: [] };
const publicPosts = [];
let denyNextTable = "";
const adminAuthCalls = [];

function startServer() {
    return new Promise((resolveServer, reject) => {
        const server = createServer(async (req, res) => {
            try {
                const pathname = decodeURIComponent(new URL(req.url || "/", `http://127.0.0.1:${PORT}`).pathname).replace(/^\/+/, "") || "index.html";
                const file = resolve(ROOT, pathname);
                const local = relative(ROOT, file);
                if (local.startsWith("..") || isAbsolute(local) || !existsSync(file)) {
                    res.writeHead(404);
                    res.end("Not found");
                    return;
                }
                res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
                res.end(await readFile(file));
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

function corsHeaders() {
    return {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": "apikey,authorization,content-type,prefer,x-admin-email,x-admin-password,x-legacy-admin-session",
        "access-control-expose-headers": "content-range,content-location",
    };
}

async function mockSupabase(route) {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split("/").pop();
    const headers = corsHeaders();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });

    if (url.pathname.includes("/rpc/")) {
        if (url.pathname.endsWith("/verify_legacy_admin")) adminAuthCalls.push(request.postDataJSON());
        const body = url.pathname.endsWith("/verify_legacy_admin")
            ? { id: "fixture-admin", email: "admin@example.test", name: "Fixture Admin", role: "admin", status: "active" }
            : true;
        return route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(body) });
    }

    if (request.method() === "POST" && ["contacts", "inquiries", "admissions"].includes(table)) {
        if (denyNextTable === table) {
            denyNextTable = "";
            return route.fulfill({ status: 403, contentType: "application/json", headers, body: JSON.stringify({ code: "42501", message: "row-level security policy denied insert" }) });
        }
        const payload = request.postDataJSON();
        publicPosts.push({ table, payload, headers: request.headers() });
        const row = {
            ...payload,
            id: `${table}-fixture-${records[table].length + 1}`,
            created_at: "2026-11-01T15:30:00.000Z",
            updated_at: "2026-11-01T15:30:00.000Z",
        };
        records[table].unshift(row);
        return route.fulfill({ status: 201, headers, body: "" });
    }

    if (["PATCH", "DELETE"].includes(request.method())) {
        return route.fulfill({ status: 204, headers, body: "" });
    }

    if (request.method() === "POST") {
        return route.fulfill({ status: 201, contentType: "application/json", headers, body: "[]" });
    }

    const data = records[table] || [];
    return route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify(data) });
}

async function fillAndSubmitContact(page) {
    await page.locator('#contact-message-form [name="name"]').fill("Fixture Contact");
    await page.locator('#contact-message-form [name="phone"]').fill("9876543210");
    await page.locator('#contact-message-form [name="email"]').fill("contact@example.test");
    await page.locator('#contact-message-form [name="subject"]').fill("Course information");
    await page.locator('#contact-message-form [name="message"]').fill("Please share the course details.");
    await page.locator('#contact-message-form button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector("#contact-message-form .form-status")?.classList.contains("success"));
}

async function assertFormResponsive(page, selector) {
    for (const width of [360, 390, 768, 1024, 1366, 1920]) {
        await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
        const metrics = await page.evaluate((formSelector) => {
            const form = document.querySelector(formSelector);
            const bounds = form?.getBoundingClientRect();
            return {
                viewport: document.documentElement.clientWidth,
                document: document.documentElement.scrollWidth,
                formRight: bounds?.right || 0,
                formLeft: bounds?.left || 0,
            };
        }, selector);
        if (metrics.document > metrics.viewport + 1 || metrics.formLeft < -1 || metrics.formRight > width + 1) {
            throw new Error(selector + " overflows at " + width + "px: " + JSON.stringify(metrics));
        }
    }
    await page.setViewportSize({ width: 1366, height: 900 });
}

async function fillAndSubmitAdmission(page) {
    await page.locator('#admission-help-form [name="name"]').fill("Fixture Student");
    await page.locator('#admission-help-form [name="phone"]').fill("9123456789");
    await page.locator('#admission-help-form [name="email"]').fill("student@example.test");
    await page.locator('#admission-help-form [name="course"]').selectOption({ index: 1 });
    await page.locator('#admission-help-form [name="qualification"]').selectOption("SSC / 10th passed");
    await page.locator('#admission-help-form [name="message"]').fill("Please explain CAP counselling.");
    await page.locator('#admission-help-form button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector("#admission-help-form .form-status")?.classList.contains("success"));
}

async function run() {
    const server = await startServer();
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
        await context.addInitScript(() => {
            window.supabase = {
                createClient() {
                    const makeQuery = () => {
                        const result = { data: [], error: null, count: 0 };
                        const query = {
                            select() { return this; }, eq() { return this; }, neq() { return this; },
                            order() { return this; }, limit() { return this; }, range() { return this; },
                            insert() { return this; }, update() { return this; }, upsert() { return this; },
                            delete() { return this; }, maybeSingle() { return Promise.resolve({ data: null, error: null }); },
                            single() { return Promise.resolve({ data: null, error: null }); },
                            then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
                        };
                        return query;
                    };
                    return {
                        from: makeQuery,
                        rpc: async () => ({ data: true, error: null }),
                        auth: { signOut: async () => ({ error: null }), getSession: async () => ({ data: { session: null }, error: null }) },
                        storage: { from: () => ({ list: async () => ({ data: [], error: null }), upload: async () => ({ data: null, error: null }), remove: async () => ({ data: null, error: null }) }) },
                    };
                },
            };
        });
        const page = await context.newPage();
        const pageErrors = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        await page.route(`${SUPABASE_HOST}/**`, mockSupabase);

        await page.goto(`http://127.0.0.1:${PORT}/contact.html`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("#contact-message-form", { timeout: 20000 });
        await assertFormResponsive(page, "#contact-message-form");
        await fillAndSubmitContact(page);
        if (publicPosts.length !== 1 || publicPosts[0].table !== "contacts") throw new Error("Contact message did not reach the existing contacts endpoint.");

        await page.goto(`http://127.0.0.1:${PORT}/admission.html`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("#admission-help-form", { timeout: 20000 });
        await fillAndSubmitAdmission(page);
        if (publicPosts.length !== 2 || publicPosts[1].table !== "inquiries") throw new Error("Admission guidance did not reach the existing inquiries endpoint.");
        const admissionPayload = publicPosts[1].payload;
        if ("qualification" in admissionPayload || !admissionPayload.message.includes("Qualification: SSC / 10th passed") || !admissionPayload.message.includes("Please explain CAP counselling.")) {
            throw new Error("Admission qualification/message mapping does not match the existing inquiries schema.");
        }
        for (const post of publicPosts) {
            if (!post.headers.apikey || post.headers["x-admin-email"] || post.headers["x-admin-password"]) {
                throw new Error(`${post.table} public form used admin credentials or missed the public API key.`);
            }
        }

        denyNextTable = "contacts";
        await page.goto("http://127.0.0.1:" + PORT + "/contact.html", { waitUntil: "domcontentloaded" });
        await page.waitForSelector("#contact-message-form", { timeout: 20000 });
        await page.locator('#contact-message-form [name="name"]').fill("Fixture Contact");
        await page.locator('#contact-message-form [name="phone"]').fill("9876543210");
        await page.locator('#contact-message-form [name="email"]').fill("contact@example.test");
        await page.locator('#contact-message-form [name="subject"]').fill("Course information");
        await page.locator('#contact-message-form [name="message"]').fill("Please share the course details.");
        await page.locator('#contact-message-form button[type="submit"]').click();
        await page.waitForFunction(() => document.querySelector("#contact-message-form .form-status")?.classList.contains("error"));
        const queuedState = await page.evaluate(() => ({
            message: document.querySelector("#contact-message-form .form-status")?.textContent || "",
            status: document.querySelector("#contact-message-form .form-status")?.className || "",
            name: document.querySelector('#contact-message-form [name="name"]')?.value || "",
            queue: JSON.parse(localStorage.getItem("ew_public_form_queue") || "{}").contacts || [],
        }));
        if (!queuedState.message.includes("has not reached the college") || !queuedState.status.includes("error") || queuedState.name !== "Fixture Contact" || queuedState.queue.length !== 1) {
            throw new Error("Permission-denied Contact submission was not clearly reported and retained in the local queue.");
        }

        await page.setViewportSize({ width: 1366, height: 900 });
        await page.goto("http://127.0.0.1:" + PORT + "/admin/login.html", { waitUntil: "domcontentloaded" });
        await page.locator("#email").fill("admin@example.test");
        await page.locator("#password").fill("fixture-only");
        await page.locator("#loginBtn").click();
        await page.waitForURL((url) => url.pathname.endsWith("/admin/index.html"), { timeout: 25000 });
        if (adminAuthCalls.length !== 1 || adminAuthCalls[0].p_email !== "admin@example.test" || adminAuthCalls[0].p_password !== "fixture-only") {
            throw new Error("Admin login did not use the existing verify_legacy_admin flow in the isolated fixture.");
        }
        await page.goto(`http://127.0.0.1:${PORT}/admin/index.html`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector('#adminNav [data-key="contacts"]', { timeout: 25000 });
        await page.locator('#adminNav [data-key="contacts"]').click();
        await page.waitForFunction(() => document.querySelector(".admin-inquiry-table")?.textContent.includes("Fixture Contact"), null, { timeout: 25000 });
        const contactDisplay = await page.locator(".admin-inquiry-table").innerText();
        const queueAfterAdminSync = await page.evaluate(() => JSON.parse(localStorage.getItem("ew_public_form_queue") || "{}").contacts || []);
        if ((await page.locator(".admin-inquiry-table tbody tr").count()) !== 2 || queueAfterAdminSync.length !== 0) {
            throw new Error("Admin did not sync the retained Contact inquiry exactly once.");
        }
        for (const value of ["9876543210", "contact@example.test", "Course information", "Please share the course details.", "pending"]) {
            if (!contactDisplay.toLowerCase().includes(value.toLowerCase())) throw new Error(`Contact inquiry display is missing: ${value}.`);
        }
        if (!await page.locator('.admin-inquiry-table a[href="tel:9876543210"]').count()) throw new Error("Contact inquiry phone is not a working tel link.");
        if (!await page.locator('.admin-inquiry-table a[href="mailto:contact@example.test"]').count()) throw new Error("Contact inquiry email is not a working mailto link.");
        if (!await page.locator(".admin-inquiry-table time").first().textContent().then((value) => /\d{2}:\d{2}/.test(value || ""))) throw new Error("Contact inquiry submission date/time is missing.");

        await page.locator("#statusFilter").selectOption("pending");
        await page.waitForTimeout(80);
        if (!await page.locator("#moduleTable").textContent().then((value) => value.includes("Fixture Contact"))) throw new Error("Pending status filter did not match the contact reply status.");
        await page.locator("#statusFilter").selectOption("replied");
        await page.waitForTimeout(80);
        if (await page.locator("#moduleTable").textContent().then((value) => value.includes("Fixture Contact"))) throw new Error("Reply status filter did not exclude a pending contact.");
        await page.locator("#statusFilter").selectOption("");

        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(350);
        await page.waitForSelector(".admin-inquiry-card", { timeout: 5000 });
        const adminMobileWidth = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
        if (adminMobileWidth.document > adminMobileWidth.viewport + 1) throw new Error("Admin inquiry card layout has horizontal overflow on mobile: " + JSON.stringify(adminMobileWidth));
        const mobileContact = await page.locator(".admin-inquiry-card").first().innerText();
        if (!mobileContact.includes("Fixture Contact") || !mobileContact.includes("9876543210") || !mobileContact.includes("Course information")) {
            throw new Error("Mobile Contact inquiry card is missing key details.");
        }

        await page.setViewportSize({ width: 1366, height: 900 });
        await page.goto("http://127.0.0.1:" + PORT + "/admin/index.html", { waitUntil: "domcontentloaded" });
        await page.waitForSelector('#adminNav [data-key="courses"]', { timeout: 25000 });
        await page.locator('#adminNav [data-key="courses"]').click();
        await page.waitForFunction(() => document.querySelector("#moduleTitle")?.textContent.includes("Courses"), null, { timeout: 25000 });
        await page.locator("#statusFilter").selectOption("published");
        await page.waitForSelector('#adminNav [data-key="inquiries"]', { timeout: 25000 });
        await page.locator('#adminNav [data-key="inquiries"]').click();
        await page.waitForFunction(() => document.querySelector(".admin-inquiry-table")?.textContent.includes("Fixture Student"), null, { timeout: 25000 });
        if (await page.locator("#statusFilter").inputValue() !== "") throw new Error("A status filter from another Admin module leaked into Inquiries.");
        const admissionDisplay = await page.locator(".admin-inquiry-table").innerText();
        for (const value of ["9123456789", "student@example.test", "SSC / 10th passed", "Please explain CAP counselling.", "pending"]) {
            if (!admissionDisplay.toLowerCase().includes(value.toLowerCase())) throw new Error(`Admission inquiry display is missing: ${value}`);
        }
        if (!await page.locator('.admin-inquiry-table a[href="tel:9123456789"]').count()) throw new Error("Admission inquiry phone is not a working tel link.");
        if (!await page.locator(".admin-inquiry-table time").first().textContent().then((value) => /\d{2}:\d{2}/.test(value || ""))) throw new Error("Admission inquiry date/time is missing.");

        if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(" | ")}`);
        console.log("PASS: Fixture Admin login uses the existing legacy verification flow without contacting production.");
        console.log("PASS: Contact and admission forms posted once to the existing Supabase table endpoints using public credentials only.");
        console.log("PASS: Admission qualification stays mapped to the existing message column; no schema changes.");
        console.log("PASS: Admin Contact and Inquiries lists show details, clickable phone/email, status, date/time and mobile cards.");
        console.log("PASS: Admin status filtering covers reply status, resets incompatible filters when changing modules, and reports no browser page errors.");
        console.log("PASS: RLS-denied Contact submission stays local with a clear warning, then syncs to Admin once public insert access is available.");
    } finally {
        await browser?.close();
        await new Promise((resolveClose) => server.close(resolveClose));
    }
}

run().catch((error) => {
    console.error("FAIL:", error.message);
    process.exitCode = 1;
});

/**
 * Admission form validation tests
 * Usage: node scripts/test-admission-form.js
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const PORT = 8881;
const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".ico": "image/x-icon",
};

function startServer() {
    return new Promise((resolve) => {
        const server = createServer(async (req, res) => {
            const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
            let filePath = join(ROOT, decodeURIComponent(url.pathname.replace(/^\//, "")));
            if (url.pathname.endsWith("/")) filePath = join(filePath, "index.html");
            if (!filePath.startsWith(ROOT) || !existsSync(filePath)) {
                res.writeHead(404);
                res.end("Not found");
                return;
            }
            const data = await readFile(filePath);
            res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
            res.end(data);
        });
        server.listen(PORT, "127.0.0.1", () => resolve(server));
    });
}

async function run() {
    const server = await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    await page.goto(`http://127.0.0.1:${PORT}/admission.html`, { waitUntil: "networkidle" });
    await page.waitForSelector("#admission-multistep-form");

    const overviewVisible = await page.locator(".admission-steps .admission-step").first().isVisible();
    if (!overviewVisible) throw new Error("Overview admission steps are hidden");

    const deptTitle = await page.locator("#dept-support-title").textContent();
    if (!deptTitle) throw new Error("Department Support section missing");

    // Step 2: course required before preview
    await page.fill('input[name="student_name"]', "Test Student");
    await page.fill('input[name="phone"]', "9423716230");
    await page.locator(".admission-form-step.active [data-next-step]").click();
    await page.locator(".admission-form-step.active [data-next-step]").click();
    const step2Active = await page.locator('.admission-form-step[data-step="2"]').evaluate((el) => el.classList.contains("active"));
    if (!step2Active) throw new Error("Should remain on step 2 when course is empty");

    // Reach step 3, clear course, submit — must not trigger native validation error
    await page.selectOption('select[name="course"]', { index: 1 });
    await page.locator(".admission-form-step.active [data-next-step]").click();
    const activeStep = await page.evaluate(() => document.querySelector(".admission-form-step.active")?.dataset.step);
    if (activeStep !== "3") throw new Error(`Expected step 3, got step ${activeStep}`);

    await page.evaluate(() => { document.querySelector('select[name="course"]').value = ""; });
    await page.evaluate(() => {
        document.querySelector('.admission-form-step[data-step="3"] button[type="submit"]').click();
    });

    const invalidMsg = consoleErrors.find((e) => e.includes("not focusable") || e.includes("invalid form control"));
    if (invalidMsg) throw new Error(`Browser validation error: ${invalidMsg}`);

    const courseVisible = await page.locator('select[name="course"]').isVisible();
    if (!courseVisible) throw new Error("Course field not visible after failed submit");

    // Valid submission
    await page.selectOption('select[name="course"]', { index: 1 });
    await page.evaluate(() => {
        document.querySelector('.admission-form-step[data-step="3"] button[type="submit"]').click();
    });
    await page.waitForTimeout(1200);

    const statusText = await page.locator(".form-status").textContent();
    if (!statusText?.includes("Submitted") && !statusText?.includes("not configured")) {
        throw new Error(`Expected success or CMS fallback message, got: ${statusText}`);
    }

    if (consoleErrors.length) throw new Error(`Console errors: ${consoleErrors.join(" | ")}`);

    console.log("PASS: Admission form validation tests");
    await browser.close();
    server.close();
}

run().catch((err) => {
    console.error("FAIL:", err.message);
    process.exit(1);
});

import { safeFetch, safeInsert, isCmsAvailable } from "./supabase.js";

export async function initDynamicPages() {
    const page = location.pathname.split("/").pop() || "index.html";
    if (page === "contact.html") await enhanceContactPage();
    if (page === "admission.html") await enhanceAdmissionPage();
}

async function enhanceContactPage() {
    const settings = await loadSettings();
    updateContactText(settings);
    const main = document.getElementById("main");
    if (!main || document.getElementById("contact-message-form")) return;

    main.insertAdjacentHTML("beforeend", `
        <section class="section contact-form-section" id="contact-form">
            <div class="container contact-form-grid">
                <div class="contact-form-cards">
                    <article class="contact-mini-card glass-card">
                        <span>Admission Office</span>
                        <strong>${escapeHtml(settings.phone || "+91 94237 16230")}</strong>
                        <a href="tel:+919423716230">Call Now</a>
                    </article>
                    <article class="contact-mini-card glass-card">
                        <span>Email</span>
                        <strong>${escapeHtml(settings.email || "eaglewoodpoly@gmail.com")}</strong>
                        <a href="mailto:eaglewoodpoly@gmail.com">Send Email</a>
                    </article>
                    <article class="contact-mini-card glass-card">
                        <span>Office Hours</span>
                        <strong>${escapeHtml(settings.office_hours || "Mon - Sat, 9:30 AM - 5:30 PM")}</strong>
                        <a href="admission.html">Admission Info</a>
                    </article>
                </div>
                <form id="contact-message-form" class="cms-form route-form glass-card">
                    <p class="eyebrow">Contact Message</p>
                    <h2>Send a message to Eaglewood</h2>
                    <p class="section-lead">Our team will respond regarding admissions, courses, hostel or campus visits.</p>
                    <div class="form-field-grid">
                        <label><span>Name</span><input name="name" type="text" autocomplete="name" required></label>
                        <label><span>Phone</span><input name="phone" type="tel" autocomplete="tel"></label>
                        <label><span>Email</span><input name="email" type="email" autocomplete="email"></label>
                        <label><span>Subject</span><input name="subject" type="text" placeholder="Admission / Course / Hostel"></label>
                        <label class="full"><span>Message</span><textarea name="message" required placeholder="How can we help you?"></textarea></label>
                    </div>
                    <button class="btn btn-primary" type="submit">Submit Message</button>
                    <p class="form-status" aria-live="polite"></p>
                </form>
            </div>
        </section>
    `);
    bindForm("contact-message-form", "contacts");
}

async function enhanceAdmissionPage() {
    const main = document.getElementById("main");
    if (!main || document.getElementById("admission-multistep-form")) return;
    const courses = await loadCourses();
    const options = courses.map((c) => `<option value="${escapeHtml(c.title)}">${escapeHtml(c.title)}</option>`).join("");

    main.insertAdjacentHTML("beforeend", `
        <section class="section admission-form-section" id="admission-form">
            <div class="container">
                <div class="admission-form-shell glass-card">
                    <div class="admission-progress" aria-hidden="true">
                        <div class="admission-progress-bar"><span id="admissionProgressFill"></span></div>
                        <ol class="admission-steps-nav">
                            <li class="active" data-step-nav="1">Personal</li>
                            <li data-step-nav="2">Academic</li>
                            <li data-step-nav="3">Review</li>
                        </ol>
                    </div>
                    <form id="admission-multistep-form" class="cms-form route-form admission-multistep" data-table="admissions">
                        <div class="admission-step active" data-step="1">
                            <p class="eyebrow">Step 1 of 3</p>
                            <h2>Student Details</h2>
                            <div class="form-field-grid">
                                <label><span>Student Name</span><input name="student_name" type="text" required></label>
                                <label><span>Phone</span><input name="phone" type="tel" required></label>
                                <label><span>Email</span><input name="email" type="email"></label>
                                <label><span>Address</span><input name="address" type="text"></label>
                            </div>
                            <button class="btn btn-primary" type="button" data-next-step>Continue</button>
                        </div>
                        <div class="admission-step" data-step="2">
                            <p class="eyebrow">Step 2 of 3</p>
                            <h2>Academic Information</h2>
                            <div class="form-field-grid">
                                <label><span>Select Course</span><select name="course" required><option value="">Select Course</option>${options}</select></label>
                                <label><span>Previous School / College</span><input name="previous_school" type="text"></label>
                                <label class="full"><span>Additional Notes</span><textarea name="message" placeholder="Eligibility, category, scholarship or other details"></textarea></label>
                            </div>
                            <div class="admission-step-actions">
                                <button class="btn btn-secondary" type="button" data-prev-step>Back</button>
                                <button class="btn btn-primary" type="button" data-next-step>Preview Application</button>
                            </div>
                        </div>
                        <div class="admission-step" data-step="3">
                            <p class="eyebrow">Step 3 of 3</p>
                            <h2>Review & Submit</h2>
                            <div id="admissionPreview" class="admission-preview"></div>
                            <div class="admission-step-actions">
                                <button class="btn btn-secondary" type="button" data-prev-step>Back</button>
                                <button class="btn btn-primary" type="submit">Submit Application</button>
                            </div>
                        </div>
                        <p class="form-status" aria-live="polite"></p>
                    </form>
                </div>
            </div>
        </section>
    `);

    initAdmissionMultistep();
    bindForm("admission-multistep-form", "admissions");
}

function initAdmissionMultistep() {
    const form = document.getElementById("admission-multistep-form");
    if (!form) return;
    let step = 1;

    const showStep = (next) => {
        step = Math.min(3, Math.max(1, next));
        form.querySelectorAll(".admission-step").forEach((panel) => {
            panel.classList.toggle("active", Number(panel.dataset.step) === step);
        });
        form.querySelectorAll("[data-step-nav]").forEach((item) => {
            item.classList.toggle("active", Number(item.dataset.stepNav) === step);
            item.classList.toggle("done", Number(item.dataset.stepNav) < step);
        });
        document.getElementById("admissionProgressFill").style.width = `${(step / 3) * 100}%`;
        if (step === 3) renderAdmissionPreview(form);
    };

    form.querySelectorAll("[data-next-step]").forEach((btn) => btn.addEventListener("click", () => {
        const panel = form.querySelector(`.admission-step[data-step="${step}"]`);
        const required = [...panel.querySelectorAll("[required]")];
        if (required.some((field) => !field.value.trim())) {
            panel.querySelector(".form-status")?.remove();
            panel.insertAdjacentHTML("beforeend", '<p class="form-status error">Please complete all required fields.</p>');
            return;
        }
        showStep(step + 1);
    }));

    form.querySelectorAll("[data-prev-step]").forEach((btn) => btn.addEventListener("click", () => showStep(step - 1)));
    showStep(1);
}

function renderAdmissionPreview(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const preview = document.getElementById("admissionPreview");
    if (!preview) return;
    preview.innerHTML = `
        <dl class="preview-grid">
            <div><dt>Student Name</dt><dd>${escapeHtml(data.student_name || "—")}</dd></div>
            <div><dt>Phone</dt><dd>${escapeHtml(data.phone || "—")}</dd></div>
            <div><dt>Email</dt><dd>${escapeHtml(data.email || "—")}</dd></div>
            <div><dt>Course</dt><dd>${escapeHtml(data.course || "—")}</dd></div>
            <div><dt>Previous School</dt><dd>${escapeHtml(data.previous_school || "—")}</dd></div>
            <div class="full"><dt>Address</dt><dd>${escapeHtml(data.address || "—")}</dd></div>
            <div class="full"><dt>Notes</dt><dd>${escapeHtml(data.message || "—")}</dd></div>
        </dl>
    `;
}

async function loadSettings() {
    const result = await safeFetch("settings", (q) => q.select("key,value").eq("published", true).order("display_order", { ascending: true }), [], "pages:settings");
    return Object.fromEntries((result.data || []).map((row) => [row.key, row.value]));
}

async function loadCourses() {
    const result = await safeFetch("courses", (q) => q.select("title").eq("published", true).order("display_order", { ascending: true }), [
        { title: "Civil Engineering" },
        { title: "Computer Engineering" },
        { title: "Electrical Engineering" },
        { title: "AI & Machine Learning" },
    ], "pages:courses");
    return result.data || [];
}

function updateContactText(settings) {
    const map = document.querySelector(".map-embed iframe");
    if (map && settings.google_map) map.src = settings.google_map;
}

function bindForm(id, table) {
    const form = document.getElementById(id);
    form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = form.querySelector(".form-status");
        const button = form.querySelector("button[type=\"submit\"]");
        status.textContent = "Submitting...";
        if (button) button.disabled = true;

        const payload = Object.fromEntries(new FormData(form).entries());
        try {
            const result = await safeInsert(table, payload);
            if (!result.ok) {
                if (result.reason === "not_configured") {
                    throw new Error("CMS not configured");
                }
                throw new Error(result.reason);
            }
            form.reset();
            status.textContent = "Submitted successfully. Our admission team will contact you soon.";
            form.classList.add("submitted");
            if (form.id === "admission-multistep-form") {
                form.querySelectorAll(".admission-step").forEach((panel) => panel.classList.remove("active"));
                form.insertAdjacentHTML("beforeend", '<div class="admission-success"><strong>Application Received</strong><p>Thank you for applying to Eaglewood Polytechnic Institute.</p></div>');
            }
        } catch (err) {
            status.textContent = err?.message === "CMS not configured"
                ? "Online submission is not configured yet. Please call +91 94237 16230."
                : "Could not submit online. Please call +91 94237 16230.";
            console.warn("[SUPABASE]", err?.message || err);
        } finally {
            if (button) button.disabled = false;
        }
    });
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

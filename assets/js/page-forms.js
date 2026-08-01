import { safeFetch, isCmsAvailable } from "./supabase.js";
import { renderFacultyPage, renderPlacementsPage, renderAboutPrincipal } from "./pages-cms.js";
import { submitPublicForm } from "./form-store.js";
import { fetchCmsRows } from "./cms-store.js";

export async function initDynamicPages() {
    const page = location.pathname.split("/").pop() || "index.html";
    if (page === "contact.html") await enhanceContactPage();
    if (page === "admission.html") await enhanceAdmissionPage();
    if (page === "faculty.html") await renderFacultyPage();
    if (page === "placements.html") await renderPlacementsPage();
    if (page === "about.html") await renderAboutPrincipal();
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
                <form id="contact-message-form" class="cms-form route-form glass-card" novalidate>
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
    const slot = document.getElementById("admission-form-slot");
    if (!slot || document.getElementById("admission-multistep-form")) return;

    const courses = await loadCourses();
    const options = courses.map((c) => `<option value="${escapeHtml(c.title)}">${escapeHtml(c.title)}</option>`).join("");

    slot.innerHTML = `
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
                    <form id="admission-multistep-form" class="cms-form route-form admission-multistep" data-table="admissions" novalidate>
                        <div class="admission-form-step active" data-step="1">
                            <p class="eyebrow">Step 1 of 3</p>
                            <h2>Student Details</h2>
                            <div class="form-field-grid">
                                <label class="field-block"><span>Student Name</span><input name="student_name" type="text" autocomplete="name" required data-label="Student Name"></label>
                                <label class="field-block"><span>Phone</span><input name="phone" type="tel" autocomplete="tel" required inputmode="tel" data-label="Phone"></label>
                                <label class="field-block"><span>Email</span><input name="email" type="email" autocomplete="email" data-label="Email"></label>
                                <label class="field-block"><span>Address</span><input name="address" type="text" autocomplete="street-address" data-label="Address"></label>
                            </div>
                            <p class="form-step-status" aria-live="polite"></p>
                            <button class="btn btn-primary" type="button" data-next-step>Continue</button>
                        </div>
                        <div class="admission-form-step" data-step="2">
                            <p class="eyebrow">Step 2 of 3</p>
                            <h2>Academic Information</h2>
                            <div class="form-field-grid">
                                <label class="field-block field-block--course">
                                    <span>Select Course</span>
                                    <select name="course" required data-label="Course">
                                        <option value="">Select Course</option>
                                        ${options}
                                    </select>
                                    <small class="field-hint">Choose the diploma or degree program you wish to apply for.</small>
                                </label>
                                <label class="field-block"><span>Previous School / College</span><input name="previous_school" type="text" data-label="Previous School"></label>
                                <label class="field-block full"><span>Additional Notes</span><textarea name="message" placeholder="Eligibility, category, scholarship or other details" data-label="Notes"></textarea></label>
                            </div>
                            <p class="form-step-status" aria-live="polite"></p>
                            <div class="admission-step-actions">
                                <button class="btn btn-secondary" type="button" data-prev-step>Back</button>
                                <button class="btn btn-primary" type="button" data-next-step>Preview Application</button>
                            </div>
                        </div>
                        <div class="admission-form-step" data-step="3">
                            <p class="eyebrow">Step 3 of 3</p>
                            <h2>Review & Submit</h2>
                            <div id="admissionPreview" class="admission-preview"></div>
                            <p class="form-step-status" aria-live="polite"></p>
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
    `;

    initAdmissionMultistep();
    bindForm("admission-multistep-form", "admissions");
}

function initAdmissionMultistep() {
    const form = document.getElementById("admission-multistep-form");
    if (!form) return;
    let step = 1;

    const showStep = (next) => {
        step = Math.min(3, Math.max(1, next));
        form.querySelectorAll(".admission-form-step").forEach((panel) => {
            panel.classList.toggle("active", Number(panel.dataset.step) === step);
        });
        form.querySelectorAll("[data-step-nav]").forEach((item) => {
            item.classList.toggle("active", Number(item.dataset.stepNav) === step);
            item.classList.toggle("done", Number(item.dataset.stepNav) < step);
        });
        const fill = document.getElementById("admissionProgressFill");
        if (fill) fill.style.width = `${(step / 3) * 100}%`;
        if (step === 3) renderAdmissionPreview(form);
        clearFieldErrors(form);
    };

    form.querySelectorAll("[data-next-step]").forEach((btn) => btn.addEventListener("click", () => {
        const panel = form.querySelector(`.admission-form-step[data-step="${step}"]`);
        const result = validatePanel(panel, { focus: true });
        if (!result.valid) return;
        showStep(step + 1);
    }));

    form.querySelectorAll("[data-prev-step]").forEach((btn) => btn.addEventListener("click", () => showStep(step - 1)));

    form.__admissionGoToStep = showStep;
    showStep(1);
}

function validateAdmissionForm(form, options = {}) {
    const panels = [...form.querySelectorAll(".admission-form-step")];
    for (const panel of panels) {
        const result = validatePanel(panel, options);
        if (!result.valid) {
            return { valid: false, step: Number(panel.dataset.step), field: result.field, message: result.message };
        }
    }
    return { valid: true };
}

function validatePanel(panel, options = {}) {
    if (!panel) return { valid: true };
    clearFieldErrors(panel.closest("form") || panel);

    const fields = [...panel.querySelectorAll("input, select, textarea")].filter((el) => el.hasAttribute("required"));
    for (const field of fields) {
        const message = fieldValidationMessage(field);
        if (message) {
            markFieldInvalid(field, message);
            const status = panel.querySelector(".form-step-status");
            if (status) status.textContent = message;
            if (options.focus) focusField(field);
            return { valid: false, field, message };
        }
    }

    const emailField = panel.querySelector('input[type="email"]');
    if (emailField?.value.trim() && !emailField.checkValidity()) {
        const message = "Enter a valid email address.";
        markFieldInvalid(emailField, message);
        const status = panel.querySelector(".form-step-status");
        if (status) status.textContent = message;
        if (options.focus) focusField(emailField);
        return { valid: false, field: emailField, message };
    }

    const status = panel.querySelector(".form-step-status");
    if (status) status.textContent = "";
    return { valid: true };
}

function fieldValidationMessage(field) {
    const label = field.dataset.label || field.name || "This field";
    const value = String(field.value || "").trim();

    if (field.hasAttribute("required") && !value) {
        return `${label} is required.`;
    }

    if (field.type === "tel" && value && value.replace(/\D/g, "").length < 10) {
        return "Enter a valid 10-digit phone number.";
    }

    return "";
}

function markFieldInvalid(field, message) {
    const label = field.closest(".field-block") || field.closest("label");
    label?.classList.add("is-invalid");
    field.setAttribute("aria-invalid", "true");
    let hint = label?.querySelector(".field-error");
    if (!hint && label) {
        hint = document.createElement("small");
        hint.className = "field-error";
        label.appendChild(hint);
    }
    if (hint) hint.textContent = message;
}

function clearFieldErrors(root) {
    root.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
    root.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    root.querySelectorAll(".field-error").forEach((el) => el.remove());
    root.querySelectorAll(".form-step-status").forEach((el) => { el.textContent = ""; });
}

function focusField(field) {
    if (!field) return;
    field.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => field.focus({ preventScroll: true }), 280);
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
    const result = await fetchCmsRows("courses", { admin: false, publishedOnly: true, limit: 50 });
    const rows = result.data?.length ? result.data : [
        { title: "Civil Engineering" },
        { title: "Computer Engineering" },
        { title: "Electrical Engineering" },
        { title: "Artificial Intelligence" },
        { title: "AI & Machine Learning" },
    ];
    return rows;
}

function updateContactText(settings) {
    const map = document.querySelector(".map-embed iframe");
    if (map && settings.google_map) map.src = settings.google_map;
}

export function bindHomeInquiryForm(courses = []) {
    const form = document.getElementById("home-inquiry-form");
    if (!form || form.dataset.bound === "true") return;
    form.dataset.bound = "true";
    const select = form.querySelector('select[name="course"]');
    if (select && courses.length) {
        select.innerHTML = `<option value="">Select Course</option>${courses.map((c) => `<option value="${escapeHtml(c.title)}">${escapeHtml(c.title)}</option>`).join("")}`;
    }
    bindForm("home-inquiry-form", "inquiries");
}

function bindForm(id, table) {
    const form = document.getElementById(id);
    form?.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (form.id === "admission-multistep-form") {
            const check = validateAdmissionForm(form, { focus: true });
            if (!check.valid) {
                form.__admissionGoToStep?.(check.step);
                if (check.field) focusField(check.field);
                return;
            }
        } else {
            const firstInvalid = form.querySelector(":invalid");
            if (firstInvalid) {
                firstInvalid.reportValidity();
                return;
            }
        }

        const status = form.querySelector(".form-status");
        const button = form.querySelector("button[type=\"submit\"]");
        status.textContent = "Submitting...";
        status.classList.remove("error", "success");
        if (button) button.disabled = true;

        const payload = Object.fromEntries(new FormData(form).entries());
        if (table === "admissions") {
            payload.status = payload.status || "new";
            payload.application_status = payload.application_status || "pending";
            payload.payment_status = payload.payment_status || "pending";
        } else if (table === "contacts") {
            payload.status = payload.status || "new";
            payload.reply_status = payload.reply_status || "pending";
        } else if (table === "inquiries") {
            payload.status = payload.status || "new";
            payload.reply_status = payload.reply_status || "pending";
        }
        try {
            const result = await submitPublicForm(table, payload);
            if (!result.ok) {
                if (result.reason === "not_configured") {
                    throw new Error("CMS not configured");
                }
                throw new Error(result.reason);
            }

            const toastMessage = form.id === "home-inquiry-form"
                ? "Inquiry submitted successfully. Our team will contact you shortly."
                : form.id === "contact-message-form"
                    ? "Message sent successfully. Our team will respond soon."
                    : "Application submitted successfully. Our team will contact you shortly.";
            status.textContent = result.queued
                ? "Submitted successfully. Our team will contact you soon."
                : "Submitted successfully. Our admission team will contact you soon.";
            status.classList.add("success");
            showFormToast(toastMessage, "success");

            if (form.id === "admission-multistep-form") {
                form.querySelectorAll(".admission-form-step").forEach((panel) => panel.classList.remove("active"));
                form.querySelector(".admission-progress")?.setAttribute("hidden", "");
                const existing = form.querySelector(".admission-success");
                if (!existing) {
                    form.insertAdjacentHTML("beforeend", '<div class="admission-success"><strong>Application Received</strong><p>Thank you for applying to Eaglewood Polytechnic Institute. Our admissions office will contact you soon.</p></div>');
                }
                form.reset();
                form.classList.add("submitted");
            } else {
                form.reset();
                form.classList.add("submitted");
            }
        } catch (err) {
            const message = err?.message === "CMS not configured"
                ? "Online submission is not configured yet. Please call +91 94237 16230."
                : "Could not submit online. Please call +91 94237 16230.";
            status.textContent = message;
            status.classList.add("error");
            showFormToast(message, "error");
        } finally {
            if (button) button.disabled = false;
        }
    });
}

function showFormToast(message, tone = "success") {
    let region = document.getElementById("form-toast-region");
    if (!region) {
        region = document.createElement("div");
        region.id = "form-toast-region";
        region.className = "form-toast-region";
        region.setAttribute("aria-live", "polite");
        document.body.appendChild(region);
    }
    const toast = document.createElement("div");
    toast.className = `form-toast form-toast--${tone}`;
    toast.textContent = message;
    region.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 320);
    }, 4200);
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

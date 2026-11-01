import { safeFetch, isCmsAvailable } from "./supabase.js";
import { renderFacultyPage, renderDepartmentsPage, renderPlacementsPage, renderAboutPrincipal, renderCommitteePage, renderAlumniPage } from "./pages-cms.js";
import { submitPublicForm } from "./form-store.js";
import { fetchCmsRows } from "./cms-store.js";
import { parseContactPhones, parseInstituteEmails, parseSettingValue, telHref } from "./site-settings.js";

export async function initDynamicPages() {
    const page = location.pathname.split("/").pop() || "index.html";
    if (page === "contact.html") await enhanceContactPage();
    if (page === "admission.html") await enhanceAdmissionPage();
    if (page === "departments.html") await renderDepartmentsPage();
    if (page === "faculty.html") await renderFacultyPage();
    if (page === "committee.html") await renderCommitteePage();
    if (page === "alumni.html") await renderAlumniPage();
    if (page === "placements.html") await renderPlacementsPage();
    if (page === "about.html") await renderAboutPrincipal();
}

async function enhanceContactPage() {
    const settings = await loadSettings();
    updateContactText(settings);
    const main = document.getElementById("main");
    if (!main || document.getElementById("contact-message-form")) return;

    const phones = parseContactPhones(settings);
    const primaryPhone = phones[0] || parseSettingValue(settings.phone) || "+91 94237 16230";
    const emails = parseInstituteEmails(settings);
    const primaryEmail = emails[0]?.value || parseSettingValue(settings.email) || "eaglewoodpoly@gmail.com";

    const contactFormMarkup = `
        <section class="section contact-form-section" id="contact-form">
            <div class="container contact-form-grid">
                <div class="contact-form-cards">
                    <article class="contact-mini-card glass-card">
                        <span>Admission Office</span>
                        <strong>${escapeHtml(primaryPhone)}</strong>
                        <a href="${telHref(primaryPhone)}">Call Now</a>
                    </article>
                    <article class="contact-mini-card glass-card">
                        <span>Email</span>
                        <strong>${escapeHtml(primaryEmail)}</strong>
                        <a href="mailto:${escapeHtml(primaryEmail)}">Send Email</a>
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
    `;
    const contactSection = main.querySelector("#contact-details");
    if (contactSection) contactSection.insertAdjacentHTML("afterend", contactFormMarkup);
    else main.insertAdjacentHTML("beforeend", contactFormMarkup);
    bindForm("contact-message-form", "contacts");
}

async function enhanceAdmissionPage() {
    const slot = document.getElementById("admission-form-slot");
    if (!slot || document.getElementById("admission-help-form")) return;

    const courses = await loadCourses();
    const options = courses.map((c) => `<option value="${escapeHtml(c.title)}">${escapeHtml(c.title)}</option>`).join("");

    slot.innerHTML = `
        <section class="admission-form-card" id="admission-form">
            <div class="admission-form-card__intro">
                <p class="admission-kicker">Guidance request</p>
                <h3>How can we help you?</h3>
                <p>Share your contact details and question. This is an enquiry to the college, not a CAP application.</p>
            </div>
            <form id="admission-help-form" class="admission-help-form route-form" novalidate>
                <div class="admission-form-grid">
                    <label class="admission-form-field">
                        <span>Student Name <b aria-hidden="true">*</b></span>
                        <input name="name" type="text" autocomplete="name" maxlength="120" placeholder="Your full name" required>
                    </label>
                    <label class="admission-form-field">
                        <span>Mobile Number <b aria-hidden="true">*</b></span>
                        <input name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" pattern="[0-9]{10}" maxlength="10" placeholder="10-digit mobile number" aria-describedby="admission-phone-hint" required>
                        <small id="admission-phone-hint">Enter a 10-digit number so our team can call you.</small>
                    </label>
                    <label class="admission-form-field">
                        <span>Email</span>
                        <input name="email" type="email" autocomplete="email" maxlength="254" placeholder="you@example.com">
                    </label>
                    <label class="admission-form-field">
                        <span>Interested Course <b aria-hidden="true">*</b></span>
                        <select name="course" required>
                            <option value="">Choose a course</option>
                            ${options}
                        </select>
                    </label>
                    <label class="admission-form-field admission-form-field--full">
                        <span>10th/12th Qualification <b aria-hidden="true">*</b></span>
                        <select name="qualification" required>
                            <option value="">Select your latest qualification</option>
                            <option value="SSC / 10th passed">SSC / 10th passed</option>
                            <option value="HSC / 12th passed">HSC / 12th passed</option>
                            <option value="Diploma completed">Diploma completed</option>
                            <option value="Currently appearing / result awaited">Currently appearing / result awaited</option>
                            <option value="Other / need help confirming eligibility">Other / need help confirming eligibility</option>
                        </select>
                    </label>
                    <label class="admission-form-field admission-form-field--full">
                        <span>Message <b aria-hidden="true">*</b></span>
                        <textarea name="message" rows="4" maxlength="1200" placeholder="Tell us what you would like guidance about." required></textarea>
                    </label>
                </div>
                <p class="admission-form-card__privacy"><span aria-hidden="true">●</span> We use these details only to respond to your enquiry. Please do not include Aadhaar numbers or attach document copies.</p>
                <div class="admission-form-card__actions">
                    <button class="admission-submit" type="submit">Send guidance request <span aria-hidden="true">→</span></button>
                    <span class="admission-submit-note">Our admission team will contact you.</span>
                </div>
                <p class="form-status admission-form-status" role="status" aria-live="polite"></p>
            </form>
        </section>
    `;

    bindForm("admission-help-form", "inquiries");
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
    if (map && settings.google_map) map.src = parseSettingValue(settings.google_map);

    const phonesHost = document.querySelector("[data-contact-phones]");
    const emailsHost = document.querySelector("[data-contact-emails]");
    const phones = parseContactPhones(settings);
    const emails = parseInstituteEmails(settings);

    if (phonesHost && phones.length) {
        phonesHost.innerHTML = phones.map((phone) =>
            `<a href="${telHref(phone)}">${escapeHtml(phone)}</a>`
        ).join("");
    }

    if (emailsHost && emails.length) {
        emailsHost.innerHTML = emails.map((row) =>
            `<div><span class="contact-email-label">${escapeHtml(row.label)}</span><a href="mailto:${escapeHtml(row.value)}">${escapeHtml(row.value)}</a></div>`
        ).join("");
    }

    const callBtn = document.querySelector("[data-contact-call]");
    const primaryPhone = phones[0] || parseSettingValue(settings.phone);
    if (callBtn && primaryPhone) {
        callBtn.href = telHref(primaryPhone);
        callBtn.textContent = "Call Now";
    }

    const emailBtn = document.querySelector("[data-contact-email]");
    const primaryEmail = emails[0]?.value || parseSettingValue(settings.email);
    if (emailBtn && primaryEmail) {
        emailBtn.href = `mailto:${primaryEmail}`;
        emailBtn.textContent = "Email Us";
    }
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
        if (form.dataset.submitting === "true") return;

        const firstInvalid = form.querySelector(":invalid");
        if (firstInvalid) {
            firstInvalid.reportValidity();
            return;
        }

        const status = form.querySelector(".form-status");
        const button = form.querySelector("button[type=\"submit\"]");
        form.dataset.submitting = "true";
        form.setAttribute("aria-busy", "true");
        status.textContent = "Submitting...";
        status.classList.remove("error", "success");
        if (button) {
            button.disabled = true;
            button.dataset.loading = "true";
            button.setAttribute("aria-busy", "true");
        }

        const payload = Object.fromEntries(new FormData(form).entries());
        if (form.id === "admission-help-form") {
            const qualification = payload.qualification;
            const question = String(payload.message || "").trim();
            delete payload.qualification;
            payload.message = `Qualification: ${qualification}\n\n${question}`;
        }
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

            if (result.queued) {
                const message = form.id === "admission-help-form"
                    ? "Your request is saved only on this device and has not reached the admission team. Please call +91 94237 16230 while we restore online submission."
                    : "Your message is saved only on this device and has not reached the college. Please call +91 94237 16230 while we restore online submission.";
                status.textContent = message;
                status.classList.add("error");
                showFormToast("Online delivery is unavailable. Your message remains saved on this device.", "error");
                return;
            }

            const toastMessage = form.id === "admission-help-form"
                ? "Your guidance request has been sent. The admission team will contact you soon."
                : form.id === "home-inquiry-form"
                ? "Inquiry submitted successfully. Our team will contact you shortly."
                : form.id === "contact-message-form"
                    ? "Message sent successfully. Our team will respond soon."
                    : "Inquiry submitted successfully. Our team will contact you shortly.";
            status.textContent = form.id === "admission-help-form"
                ? "Request sent securely. Our admission team will contact you soon."
                : form.id === "contact-message-form"
                    ? "Message sent successfully. Our team will respond soon."
                    : "Inquiry submitted successfully. Our team will contact you shortly.";
            status.classList.add("success");
            showFormToast(toastMessage, "success");

            form.reset();
            form.classList.add("submitted");
        } catch (err) {
            const message = err?.message === "CMS not configured"
                ? "Online submission is not configured yet. Please call +91 94237 16230."
                : "Could not send your request. Please try again or call +91 94237 16230.";
            status.textContent = message;
            status.classList.add("error");
            showFormToast(message, "error");
        } finally {
            form.dataset.submitting = "false";
            form.removeAttribute("aria-busy");
            if (button) {
                button.disabled = false;
                delete button.dataset.loading;
                button.removeAttribute("aria-busy");
            }
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

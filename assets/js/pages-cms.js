/**
 * CMS-driven inner pages: Faculty, Placements, About Principal
 */
import { ensureCmsReady, isCmsStrictMode } from "./supabase.js";
import { fetchCmsRows, isContentTable } from "./cms-store.js";
import { ensureMediaMap, resolveAdminPreviewUrl } from "./media-url.js";
import {
    fetchPrincipalMessage,
    principalPhotoMarkup,
    principalMessageParagraphs,
} from "./principal-content.js";

async function loadPublished(table) {
    await ensureCmsReady({ verifyFull: true });
    if (isContentTable(table)) {
        const result = await fetchCmsRows(table, { admin: false, publishedOnly: true, limit: 500 });
        return result.data || [];
    }
    return [];
}

function emptyState(label) {
    return `<div class="empty-state"><strong>No ${esc(label)} published yet</strong><p>Content will appear here after records are created and published in the admin panel.</p></div>`;
}

export async function renderAboutPrincipal() {
    const host = document.getElementById("principal-about-root");
    if (!host) return;

    await ensureCmsReady({ verifyFull: true });
    await ensureMediaMap();
    const principal = await fetchPrincipalMessage({ admin: false });
    if (!principal) return;

    const name = principal.name || "Principal";
    const designation = principal.designation || "Principal, Eaglewood Polytechnic Institute";
    const qualification = principal.qualification
        ? `<span class="principal-about-qual">${esc(principal.qualification)}</span>`
        : "";
    const signature = principal.signature || name;
    const paragraphs = principalMessageParagraphs(principal.message);
    if (!paragraphs.length) return;

    const photo = principalPhotoMarkup({
        photoUrl: principal.photo_url,
        name,
        className: "principal-about-photo",
        placeholderClass: "principal-about-fallback",
        loading: "eager",
    });

    host.innerHTML = `
        <div class="principal-about-portrait reveal">
            <div class="principal-about-frame">
                <div class="principal-about-ring" aria-hidden="true"></div>
                ${photo}
                <span class="principal-about-badge">Principal</span>
            </div>
        </div>
        <article class="content-copy reveal">
            <p class="eyebrow">Leadership</p>
            <h2>Principal's Message</h2>
            ${paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}
            <p class="principal-about-signoff">
                <strong>${esc(name)}</strong>
                ${qualification}
                <span>${esc(designation)}</span>
                ${signature !== name ? `<em>${esc(signature)}</em>` : ""}
            </p>
        </article>`;
}

export async function renderFacultyPage() {
    const host = document.getElementById("faculty-grid");
    if (!host) return;
    const rows = await loadPublished("faculty");
    if (!rows.length) {
        host.innerHTML = isCmsStrictMode() ? emptyState("faculty") : host.innerHTML;
        return;
    }
    host.innerHTML = rows.map((f) => {
        const photo = resolveAdminPreviewUrl(f.photo_url || "");
        return `<article class="faculty-card card reveal">
        <div class="faculty-photo">${photo ? `<img loading="lazy" decoding="async" src="${esc(photo)}" alt="${esc(f.name)}">` : `<div class="faculty-photo-fallback" aria-hidden="true">${esc((f.name || "F").charAt(0))}</div>`}</div>
        <div class="faculty-body">
            <span class="faculty-dept">${esc(f.department || "Engineering")}</span>
            <h3>${esc(f.name)}</h3>
            <p class="faculty-qual">${esc(f.qualification || "")}${f.experience ? ` · ${esc(f.experience)}` : ""}</p>
            ${f.subjects ? `<p>${esc(stripHtml(f.subjects))}</p>` : ""}
            ${f.email ? `<a href="mailto:${esc(f.email)}">${esc(f.email)}</a>` : ""}
        </div>
    </article>`;
    }).join("");
}

export async function renderPlacementsPage() {
    const statsHost = document.getElementById("placement-stats");
    const storiesHost = document.getElementById("placement-stories");
    if (!statsHost || !storiesHost) return;
    const rows = await loadPublished("placements");
    if (!rows.length) {
        const empty = emptyState("placement highlights");
        statsHost.innerHTML = isCmsStrictMode() ? empty : statsHost.innerHTML;
        storiesHost.innerHTML = isCmsStrictMode() ? empty : storiesHost.innerHTML;
        return;
    }
    const top = rows[0] || {};
    const stats = [
        [top.highest_package || "—", "Highest Package"],
        [top.average_package || "—", "Average Package"],
        [`${top.placed_students || 0}+`, "Students Trained"],
        [top.package || "—", "Placement Focus"],
    ];
    statsHost.innerHTML = stats.map(([value, label]) => `<article class="highlight-stat"><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`).join("");
    const recruiters = [...new Set(rows.map((r) => r.recruiter).filter(Boolean))];
    const recruiterHtml = recruiters.length
        ? `<div class="recruiter-strip">${recruiters.map((r) => `<span>${esc(r)}</span>`).join("")}</div>`
        : "";
    storiesHost.innerHTML = `${recruiterHtml}${rows.map((p) => {
        const image = resolveAdminPreviewUrl(p.image_url || p.company_logo_url || "");
        return `<article class="placement-story card reveal">
        ${image ? `<img loading="lazy" decoding="async" src="${esc(image)}" alt="${esc(p.title)}">` : ""}
        <div>
            <h3>${esc(p.title || "Placement Highlight")}</h3>
            ${p.testimonial ? `<blockquote>${esc(stripHtml(p.testimonial))}</blockquote><footer><strong>${esc(p.student_name || "Student")}</strong> · ${esc(p.course || "Alumni")}</footer>` : `<p>${esc(stripHtml(p.training_activities || ""))}</p>`}
        </div>
    </article>`;
    }).join("")}`;
}

function stripHtml(value) {
    return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function esc(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

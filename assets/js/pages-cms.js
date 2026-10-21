/**
 * CMS-driven inner pages: Faculty, Placements, About Principal
 */
import { ensureCmsReady, isCmsStrictMode } from "./supabase.js";
import { fetchCmsRows, isContentTable } from "./cms-store.js";
import { ensureMediaMap, resolveAdminPreviewUrl } from "./media-url.js";
import {
    fetchPrincipalMessages,
    principalPhotoMarkup,
    principalMessageParagraphs,
    principalAnchorId,
    principalProgramLabel,
    sortPrincipalRows,
} from "./principal-content.js";
import { instituteLabel } from "./site-settings.js";

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

function renderAboutPrincipalCard(principal) {
    const name = principal.name || "Principal";
    const program = principalProgramLabel(principal);
    const designation = principal.designation || `Principal - ${program}`;
    const qualification = principal.qualification
        ? `<span class="principal-about-qual">${esc(principal.qualification)}</span>`
        : "";
    const signature = principal.signature || name;
    const paragraphs = principalMessageParagraphs(principal.message);
    if (!paragraphs.length) return "";
    const anchor = principalAnchorId(principal);

    const photo = principalPhotoMarkup({
        photoUrl: principal.photo_url,
        name,
        className: "principal-about-photo",
        placeholderClass: "principal-about-fallback",
        loading: "lazy",
    });

    return `<div class="principal-about-block reveal" id="${esc(anchor)}">
        <div class="principal-about-portrait">
            <div class="principal-about-frame">
                <div class="principal-about-ring" aria-hidden="true"></div>
                ${photo}
                <span class="principal-about-badge gov-program-badge gov-program-badge--${program === "Degree" ? "degree" : "diploma"}">${esc(program)}</span>
            </div>
        </div>
        <article class="content-copy">
            <p class="eyebrow">Leadership</p>
            <h2>${esc(designation)}</h2>
            <p class="principal-about-institute">${esc(instituteLabel(principal.institute))}</p>
            ${paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}
            <p class="principal-about-signoff">
                <strong>${esc(name)}</strong>
                ${qualification}
                <span>${esc(designation)}</span>
                ${signature !== name ? `<em>${esc(signature)}</em>` : ""}
            </p>
        </article>
    </div>`;
}

export async function renderAboutPrincipal() {
    const host = document.getElementById("principal-about-root");
    if (!host) return;

    await ensureCmsReady({ verifyFull: true });
    await ensureMediaMap();
    const principals = sortPrincipalRows(await fetchPrincipalMessages({ admin: false, limit: 2 }));
    if (!principals.length) {
        host.innerHTML = emptyState("principal messages");
        return;
    }

    const cards = principals.map((principal) => renderAboutPrincipalCard(principal)).filter(Boolean);
    if (!cards.length) {
        host.innerHTML = emptyState("principal messages");
        return;
    }

    host.className = "container principals-about-grid";
    host.innerHTML = cards.join("");
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

export async function renderCommitteePage() {
    const host = document.getElementById("committee-grid");
    if (!host) return;
    try {
        const rows = await loadPublished("committee_members");
        host.innerHTML = rows.length ? rows.map((member, index) => {
            const photo = resolveAdminPreviewUrl(member.photo_url || "");
            const senior = index < 2 ? " committee-card--senior" : "";
            return `<article class="committee-card${senior} reveal">
                <div class="committee-portrait">${photo ? `<img loading="lazy" decoding="async" src="${esc(photo)}" alt="${esc(member.full_name)}">` : `<span aria-hidden="true">${esc((member.full_name || "M").charAt(0))}</span>`}</div>
                <div class="committee-card__body"><p class="committee-role">${esc(member.designation || "Committee Member")}</p><h2>${esc(member.full_name)}</h2>${member.qualification ? `<p class="committee-qualification">${esc(member.qualification)}</p>` : ""}${member.description ? `<p>${esc(stripHtml(member.description))}</p>` : ""}</div>
            </article>`;
        }).join("") : emptyState("committee members");
    } catch { host.innerHTML = `<div class="empty-state"><strong>Committee information is temporarily unavailable</strong><p>Please try again shortly.</p></div>`; }
}

export async function renderAlumniPage() {
    const host = document.getElementById("alumni-grid");
    const departmentFilter = document.getElementById("alumni-department");
    const yearFilter = document.getElementById("alumni-year");
    if (!host) return;
    try {
        const rows = await loadPublished("alumni");
        const render = () => {
            const department = departmentFilter?.value || "";
            const year = yearFilter?.value || "";
            const visible = rows.filter((alumnus) => (!department || alumnus.department === department) && (!year || String(alumnus.passing_year || "") === year));
            host.innerHTML = visible.length ? visible.map((alumnus) => {
                const photo = resolveAdminPreviewUrl(alumnus.photo_url || "");
                return `<article class="alumni-card reveal"><div class="alumni-portrait">${photo ? `<img loading="lazy" decoding="async" src="${esc(photo)}" alt="${esc(alumnus.full_name)}">` : `<span aria-hidden="true">${esc((alumnus.full_name || "A").charAt(0))}</span>`}</div><div class="alumni-card__body"><p class="alumni-meta">${esc(alumnus.department || "Eaglewood Alumni")}${alumnus.passing_year ? ` <span>&middot;</span> ${esc(alumnus.passing_year)}` : ""}</p><h2>${esc(alumnus.full_name)}</h2>${alumnus.current_designation ? `<p class="alumni-title">${esc(alumnus.current_designation)}${alumnus.company ? `, ${esc(alumnus.company)}` : ""}</p>` : alumnus.company ? `<p class="alumni-title">${esc(alumnus.company)}</p>` : ""}${alumnus.biography ? `<p>${esc(stripHtml(alumnus.biography))}</p>` : ""}</div></article>`;
            }).join("") : `<div class="empty-state"><strong>No alumni match these filters</strong><p>Try selecting a different department or passing year.</p></div>`;
        };
        const departments = [...new Set(rows.map((row) => row.department).filter(Boolean))].sort();
        const years = [...new Set(rows.map((row) => row.passing_year).filter(Boolean))].sort((a, b) => b - a);
        if (departmentFilter) departmentFilter.innerHTML = `<option value="">All departments</option>${departments.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}`;
        if (yearFilter) yearFilter.innerHTML = `<option value="">All passing years</option>${years.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}`;
        departmentFilter?.addEventListener("change", render); yearFilter?.addEventListener("change", render); render();
    } catch { host.innerHTML = `<div class="empty-state"><strong>Alumni stories are temporarily unavailable</strong><p>Please try again shortly.</p></div>`; }
}

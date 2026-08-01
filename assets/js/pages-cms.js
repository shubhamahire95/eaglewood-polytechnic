/**
 * CMS-driven inner pages: Faculty, Placements
 */
import { safeFetch, ensureCmsReady, isCmsStrictMode } from "./supabase.js";

async function loadPublished(table) {
    await ensureCmsReady({ verifyFull: true });
    const result = await safeFetch(
        table,
        (q) => q.select("*").eq("published", true).order("display_order", { ascending: true }),
        [],
        `pages:${table}`,
    );
    return result.ok ? (result.data || []) : [];
}

function emptyState(label) {
    return `<div class="empty-state"><strong>No ${esc(label)} published yet</strong><p>Content will appear here after records are created and published in the admin panel.</p></div>`;
}

export async function renderFacultyPage() {
    const host = document.getElementById("faculty-grid");
    if (!host) return;
    const rows = await loadPublished("faculty");
    if (!rows.length) {
        host.innerHTML = isCmsStrictMode() ? emptyState("faculty") : host.innerHTML;
        return;
    }
    host.innerHTML = rows.map((f) => `<article class="faculty-card card reveal">
        <div class="faculty-photo"><img loading="lazy" src="${esc(f.photo_url || "assets/images/logo-official.jpg")}" alt="${esc(f.name)}" onerror="this.onerror=null;this.src='assets/images/logo-official.jpg'"></div>
        <div class="faculty-body">
            <span class="faculty-dept">${esc(f.department || "Engineering")}</span>
            <h3>${esc(f.name)}</h3>
            <p class="faculty-qual">${esc(f.qualification || "")}${f.experience ? ` · ${esc(f.experience)}` : ""}</p>
            ${f.subjects ? `<p>${esc(stripHtml(f.subjects))}</p>` : ""}
            ${f.email ? `<a href="mailto:${esc(f.email)}">${esc(f.email)}</a>` : ""}
        </div>
    </article>`).join("");
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
    storiesHost.innerHTML = `${recruiterHtml}${rows.map((p) => `<article class="placement-story card reveal">
        ${p.image_url ? `<img loading="lazy" src="${esc(p.image_url)}" alt="${esc(p.title)}">` : ""}
        <div>
            <h3>${esc(p.title || "Placement Highlight")}</h3>
            ${p.testimonial ? `<blockquote>${esc(stripHtml(p.testimonial))}</blockquote><footer><strong>${esc(p.student_name || "Student")}</strong> · ${esc(p.course || "Alumni")}</footer>` : `<p>${esc(stripHtml(p.training_activities || ""))}</p>`}
        </div>
    </article>`).join("")}`;
}

function stripHtml(value) {
    return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function esc(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

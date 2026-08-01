import { safeFetch, ensureCmsReady, isCmsStrictMode, clearCmsQueryCache } from "./supabase.js";
import { injectSiteChrome, initHomeUI, initFooterSettings } from "./ui.js";
import { bindHomeInquiryForm } from "./page-forms.js";

const CMS_SYNC_KEY = "ew_cms_updated_at";

if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
        if (event.key === CMS_SYNC_KEY) {
            clearCmsQueryCache();
            void renderCmsHome();
        }
    });
    window.addEventListener("focus", () => {
        const stamp = localStorage.getItem(CMS_SYNC_KEY);
        if (stamp && stamp !== window.__ewLastCmsSync) {
            window.__ewLastCmsSync = stamp;
            clearCmsQueryCache();
            void renderCmsHome();
        }
    });
}

export const FALLBACK_IMAGE = "assets/images/campus.jpg";

const TABLES = ["home_slides", "updates", "notices", "principal_message", "courses", "departments", "faculty", "facilities", "placements", "gallery"];

const HIGHLIGHT_ICONS = {
    students: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    departments: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>',
    faculty: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14l9-5-9-5-9 5 9 5z"/><path d="M12 14l6.16-3.422a12.083 12.083 0 0 1 .665 6.479A11.952 11.952 0 0 0 12 20.055a11.952 11.952 0 0 0-6.824-2.998 12.078 12.078 0 0 1 .665-6.479L12 14z"/></svg>',
    placement: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
    hostel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/></svg>',
    transport: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3V7.5a2 2 0 0 0-2-2h-1"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h1"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
    library: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M8 7h8M8 11h8"/></svg>',
    lab: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 2h6M10 2v6l-5 9a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V2"/></svg>',
    scholarship: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-7z"/></svg>',
};

export async function renderCmsHome() {
    injectSiteChrome();
    const data = await loadHomeData();
    renderTopUtility(data.settings, data.cmsOnly);
    renderBreakingNews(data.notices);
    const main = document.getElementById("main");
    main.className = "premium-home eaglewood-home gov-home";
    main.innerHTML = `
        ${hero(data)}
        ${statsBand(data)}
        ${quickHighlights(data)}
        ${missionVision(data.settings, data.cmsOnly)}
        ${principal(data.principal, data.cmsOnly)}
        ${updates(data.updates)}
        ${notices(data.notices)}
        ${courses(data.courses)}
        ${departments(data.departments)}
        ${facilities(data.facilities)}
        ${placements(data.placements)}
        ${achievements(data, data.cmsOnly)}
        ${campusHighlights(data, data.cmsOnly)}
        ${gallery(data.gallery)}
        ${admissionProcess(data, data.cmsOnly)}
        ${inquirySection(data)}
        ${studentResources()}
        ${premiumCta(data.settings)}
    `;
    initSlider();
    initLightbox();
    initPremiumReveal();
    initPremiumInteractions();
    initHighlightCounters();
    initHomeGalleryFilters();
    initHomeCarousels();
    initFacilitiesSlider();
    initHeroAiButton();
    bindHomeInquiryForm(data.courses);
    runInit("departmentsSwiper", initDepartmentsSwiper);
    initHomeUI();
    void initFooterSettings();
}

async function loadHomeData() {
    clearCmsQueryCache();
    window.__ewLastCmsSync = localStorage.getItem("ew_cms_updated_at") || "";
    await ensureCmsReady({ verifyFull: true });

    const result = { settings: await settings() };
    const fetchMeta = {};
    await Promise.allSettled(TABLES.map(async (table) => {
        const key = keyFor(table);
        const loaded = await rows(table);
        result[key] = loaded.data;
        fetchMeta[key] = loaded.ok;
    }));
    TABLES.forEach((table) => { result[keyFor(table)] ||= []; });

    const settingsMerged = { ...result.settings };
    const cmsOnly = isCmsStrictMode();

    return {
        settings: settingsMerged,
        slides: result.slides,
        updates: result.updates,
        notices: result.notices,
        principal: result.principal[0] || null,
        courses: result.courses,
        departments: result.departments,
        faculty: result.faculty,
        facilities: result.facilities,
        placements: result.placements,
        gallery: result.gallery,
        achievements: parseAdmissionSteps(settingsMerged.achievements) || [],
        admissionSteps: parseAdmissionSteps(settingsMerged.admission_steps) || [],
        campusFacts: parseCampusFacts(settingsMerged.campus_facts),
        cmsOnly,
    };
}

function parseCampusFacts(value) {
    const raw = parseSettingValue(value);
    if (Array.isArray(raw) && raw.length) return raw;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        return Object.entries(raw).map(([label, val]) => ({ label, value: String(val) }));
    }
    return [];
}

function parseAdmissionSteps(value) {
    const raw = parseSettingValue(value);
    if (Array.isArray(raw) && raw.length) return raw;
    return null;
}

async function rows(table) {
    const result = await safeFetch(table, (q) => q.select("*").eq("published", true).order("display_order", { ascending: true }).order("created_at", { ascending: false }), [], `home:${table}`);
    return { data: result.data || [], ok: result.ok === true };
}

async function settings() {
    const result = await safeFetch("settings", (q) => q.select("key,value").eq("published", true).order("display_order", { ascending: true }), [], "home:settings");
    return Object.fromEntries((result.data || []).map((row) => [row.key, typeof row.value === "string" ? row.value : row.value]));
}

function runInit(name, fn) {
    try { fn(); } catch { /* non-critical init */ }
}
function localDebounce(fn, wait = 100) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}
function keyFor(table) {
    if (table === "home_slides") return "slides";
    if (table === "principal_message") return "principal";
    if (table === "faculty") return "faculty";
    return table;
}
function img(src) {
    const value = (src && String(src).trim()) ? String(src).trim() : FALLBACK_IMAGE;
    return value.startsWith("http") || value.startsWith("assets/") || value.startsWith("/") ? value : FALLBACK_IMAGE;
}

function imgTag(src, alt = "", lazy = true) {
    const safe = esc(img(src));
    const lazyAttrs = lazy ? 'loading="lazy" decoding="async"' : "";
    return `<img ${lazyAttrs} src="${safe}" alt="${esc(alt)}" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';">`;
}
function esc(v) { const div = document.createElement("div"); div.textContent = v ?? ""; return div.innerHTML; }
function date(v) { return v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""; }
function iconFor(value) {
    const text = String(value || "").toLowerCase();
    if (text.includes("civil") || text.includes("survey")) return "🏗";
    if (text.includes("computer") || text.includes("ai") || text.includes("wifi")) return "💻";
    if (text.includes("electrical")) return "⚡";
    if (text.includes("hostel")) return "🏠";
    if (text.includes("sport")) return "🏅";
    if (text.includes("library")) return "📚";
    if (text.includes("transport")) return "🚌";
    return "🎓";
}
function facilityIcon(value) {
    const text = String(value || "").toLowerCase();
    if (text.includes("lab") || text.includes("flask") || text.includes("tool")) return "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9 2h6M10 2v6l-5 9a3 3 0 0 0 2.6 4.5h8.8A3 3 0 0 0 19 17l-5-9V2\"/><path d=\"M7 15h10\"/></svg>";
    if (text.includes("book") || text.includes("library")) return "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z\"/><path d=\"M8 7h8M8 11h8\"/></svg>";
    if (text.includes("hostel") || text.includes("building")) return "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 21V5l8-3 8 3v16\"/><path d=\"M9 21v-6h6v6M8 8h.01M12 8h.01M16 8h.01M8 12h.01M16 12h.01\"/></svg>";
    if (text.includes("sport") || text.includes("trophy")) return "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 4h8v5a4 4 0 0 1-8 0z\"/><path d=\"M6 6H3a5 5 0 0 0 5 5M18 6h3a5 5 0 0 1-5 5M12 13v5M9 21h6\"/></svg>";
    if (text.includes("computer") || text.includes("monitor")) return "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"12\" rx=\"2\"/><path d=\"M8 21h8M12 16v5\"/></svg>";
    if (text.includes("auditorium") || text.includes("mic")) return "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z\"/><path d=\"M19 11a7 7 0 0 1-14 0M12 18v4\"/></svg>";
    if (text.includes("cafe") || text.includes("coffee")) return "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 8h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z\"/><path d=\"M16 10h2a3 3 0 0 1 0 6h-2M7 3v2M11 3v2\"/></svg>";
    return "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 3l8 4v10l-8 4-8-4V7z\"/><path d=\"M12 12l8-5M12 12v9M12 12L4 7\"/></svg>";
}

function categoryFor(value) {
    const text = String(value || "Campus").trim();
    return text.length > 18 ? text.slice(0, 18) : text;
}
function plain(v) { return esc(String(v || "").replace(/<[^>]+>/g, "")); }
function initials(value) { return String(value || "Principal").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "EP"; }
function usablePrincipalPhoto(src) { return Boolean(src && !/logo|placeholder|default/i.test(String(src))); }
function listBits(value) {
    if (Array.isArray(value)) return value;
    return String(value || "").replace(/[?;]+/g, ",").split(/\n|,/).map((item) => item.trim()).filter(Boolean).slice(0, 4);
}

function renderBreakingNews(notices = []) {
    const host = document.getElementById("breaking-news");
    if (!host) return;
    const items = notices.slice(0, 6);
    if (!items.length) { host.remove(); return; }
    host.className = "breaking-news";
    host.innerHTML = `<div class="container breaking-news-inner"><span class="breaking-news-label">Latest</span><div class="breaking-news-track" id="breakingNewsTrack">${items.map((n) => `<a href="${esc(n.attachment_url || n.pdf_url || n.file_url || "index.html#notice-board")}">${esc(n.title)}</a>`).join('<span class="breaking-news-sep">|</span>')}</div></div>`;
    const track = document.getElementById("breakingNewsTrack");
    if (track) track.innerHTML = `${track.innerHTML} <span class="breaking-news-sep">|</span> ${track.innerHTML}`;
}

function renderTopUtility(settings, cmsOnly = false) {
    const top = document.getElementById("top-bar");
    if (!top) return;
    const phone = settings.phone || "";
    const email = settings.email || "";
    const approval = parseSettingValue(settings.approval) || "Approved by AICTE, DTE & Govt. of Maharashtra";
    const affiliation = parseSettingValue(settings.affiliation) || "Affiliated to MSBTE & DBATU";
    const dte = parseSettingValue(settings.dte_code) || "2634";
    const msbte = parseSettingValue(settings.msbte_code) || "51307";
    if (cmsOnly && !phone && !email && !approval) {
        top.remove();
        return;
    }
    top.className = "top-bar premium-topbar";
    top.innerHTML = `<div class="container top-inner"><div class="top-left"><span>${esc(approval)}</span><span>${esc(affiliation)}</span><span>DTE ${esc(dte)} | MSBTE ${esc(msbte)}</span></div><div class="top-right">${phone ? `<a href="tel:${esc(phone)}">${esc(phone)}</a>` : ""}${email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : ""}<a href="contact.html">Contact Office</a></div></div>`;
}

function sectionHead(kicker, title, lead = "") {
    return `<div class="section-head-pro premium-reveal"><span>${kicker}</span><h2>${title}</h2>${lead ? `<p>${lead}</p>` : ""}</div>`;
}

function hero(data) {
    const items = data.slides || [];
    if (!items.length) return "";
    const stats = [
        ["600+", "Students"],
        ["5", "Departments"],
        ["85%", "Placement Focus"],
        ["12+", "Bus Routes"],
    ];
    return `<section class="premium-hero gov-hero" id="hero" aria-label="Eaglewood Polytechnic Institute">
        <div class="hero-pattern" aria-hidden="true"></div>
        <div class="hero-orbit one" aria-hidden="true"></div>
        <div class="hero-orbit two" aria-hidden="true"></div>
        <div class="hero-slider-shell">${items.map((slide, i) => `<article class="premium-slide ${i === 0 ? "active" : ""}" aria-hidden="${i === 0 ? "false" : "true"}">
            <img ${i === 0 ? "" : "loading=\"lazy\" decoding=\"async\""} src="${esc(img(slide.image_url))}" alt="${esc(slide.title)}" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}';">
            <div class="hero-copy premium-reveal">
                <div class="hero-badge">Admissions Open 2026-27</div>
                <div class="hero-trust-badges"><span>AICTE Approved</span><span>DTE 2634</span><span>MSBTE 51307</span><span>Govt. of Maharashtra</span></div>
                <h1>${esc(slide.title)}</h1>
                <p class="animated-subtitle">${esc(slide.subtitle)}</p>
                <div class="hero-actions">
                    <a class="btn btn-primary btn-ripple" href="${esc(slide.button_primary_url || "admission.html")}">${esc(slide.button_primary_label || "Apply for Admission")}</a>
                    <a class="btn btn-secondary btn-ripple" href="${esc(slide.button_secondary_url || "#notice-board")}">${esc(slide.button_secondary_label || "Important Notices")}</a>
                    <button class="btn btn-secondary btn-ripple" type="button" data-open-ai-assistant>Ask AI Assistant</button>
                </div>
            </div>
        </article>`).join("")}
        <div class="hero-float-grid premium-reveal" aria-hidden="true">${stats.map(([value, label]) => `<div class="hero-float-card"><strong data-count="${String(value).replace(/[^0-9]/g, "") || 0}" data-suffix="${String(value).replace(/[0-9]/g, "") || ""}">${esc(value)}</strong><span>${esc(label)}</span></div>`).join("")}</div>
        <button class="slide-nav prev" data-prev type="button" aria-label="Previous slide">‹</button>
        <button class="slide-nav next" data-next type="button" aria-label="Next slide">›</button>
        <div class="slide-dots">${items.map((_, i) => `<button class="${i === 0 ? "active" : ""}" data-dot="${i}" type="button" aria-label="Show slide ${i + 1}"></button>`).join("")}</div>
        <a class="scroll-indicator" href="#highlights" aria-label="Scroll to highlights"></a>
        <div class="wave-divider"></div>
        </div></section>`;
}

function statsBand(data) {
    const facultyCount = data.faculty?.length || data.departments.reduce((s, d) => s + Number(d.faculty_count || 0), 0);
    const students = data.departments.reduce((s, d) => s + Number(d.students_count || 0), 0);
    const dteCode = parseSettingValue(data.settings?.dte_code) || "";
    const rows = [
        [students, "", "Students Enrolled"],
        [data.departments.length, "", "Departments"],
        [facultyCount, "", "Faculty Members"],
        [dteCode || "—", "", "DTE Institute Code"],
    ];
    if (data.cmsOnly && !students && !data.departments.length && !facultyCount && !dteCode) return "";
    return `<section class="stats-band" id="stats-band" aria-label="Institute statistics"><div class="container"><div class="stats-premium-grid premium-reveal">${rows.map(([value, suffix, label]) => `<div><strong data-count="${value}" data-suffix="${suffix}">${value}${suffix}</strong><span>${esc(label)}</span></div>`).join("")}</div></div></section>`;
}

function initHeroAiButton() {
    document.querySelectorAll("[data-open-ai-assistant]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const { openAiAssistant } = await import("./ai-assistant.js");
            openAiAssistant();
        });
    });
}

function quickHighlights(data) {
    const facultyCount = data.faculty?.length || data.departments.reduce((s, d) => s + Number(d.faculty_count || 0), 0);
    const students = data.departments.reduce((s, d) => s + Number(d.students_count || 0), 0);
    const placementPct = data.placements[0]?.placement_percentage || data.placements[0]?.package || "";
    const cards = [
        ["students", students, "Students"],
        ["departments", data.departments.length, "Departments"],
        ["faculty", facultyCount, "Faculty"],
        ["placement", placementPct, "Placement Focus"],
        ["hostel", parseSettingValue(data.settings?.hostel_status) || "", "Hostel"],
        ["transport", parseSettingValue(data.settings?.transport_routes) || "", "Bus Routes"],
        ["library", parseSettingValue(data.settings?.library_status) || "", "Library"],
        ["lab", parseSettingValue(data.settings?.computer_labs) || "", "Computer Labs"],
        ["lab", parseSettingValue(data.settings?.tech_labs) || "", "AI & Tech Labs"],
        ["scholarship", parseSettingValue(data.settings?.scholarship_status) || "", "Scholarships"],
    ].filter(([, value]) => value !== "" && value !== 0);
    if (data.cmsOnly && !cards.length) return "";
    return `<section class="gov-highlights premium-section white" id="highlights" aria-labelledby="highlights-title">
        <div class="container">
            ${sectionHead("Institute at a Glance", "Quick Highlights", "Key academic strengths, student support and campus infrastructure at Eaglewood Polytechnic Institute.")}
            <div class="gov-highlight-grid premium-reveal">${cards.map(([icon, value, label]) => `<article class="gov-highlight-card glass-card">
                <span class="gov-highlight-icon">${HIGHLIGHT_ICONS[icon] || HIGHLIGHT_ICONS.lab}</span>
                <strong class="gov-highlight-value" data-count="${String(value).replace(/[^0-9]/g, "") || 0}" data-suffix="${String(value).replace(/[0-9]/g, "")}">${esc(value)}</strong>
                <span class="gov-highlight-label">${esc(label)}</span>
            </article>`).join("")}</div>
        </div></section>`;
}

function parseSettingValue(value) {
    if (value == null) return "";
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return typeof parsed === "string" ? parsed : parsed;
        } catch {
            return value;
        }
    }
    return value;
}

function parseSettingList(value) {
    const raw = parseSettingValue(value);
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") return raw.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
    return [];
}

function missionVision(settings = {}, cmsOnly = false) {
    const mission = parseSettingValue(settings.mission);
    const vision = parseSettingValue(settings.vision);
    const objectives = parseSettingList(settings.objectives);
    const values = parseSettingList(settings.core_values);
    if (cmsOnly && !mission && !vision && !objectives.length && !values.length) return "";
    return `<section class="premium-section gov-mission-section" id="mission-vision" aria-labelledby="mission-title">
        <div class="container">
            ${sectionHead("Institute", "Mission & Vision", "Our purpose, direction and values that guide every student at Eaglewood.")}
            <div class="gov-mission-grid premium-reveal">
                <article class="gov-mission-card glass-card"><span class="gov-mission-icon" aria-hidden="true">◎</span><h3 id="mission-title">Mission</h3><p>${esc(mission)}</p></article>
                <article class="gov-mission-card glass-card"><span class="gov-mission-icon" aria-hidden="true">◇</span><h3>Vision</h3><p>${esc(vision)}</p></article>
                <article class="gov-mission-card glass-card"><span class="gov-mission-icon" aria-hidden="true">▣</span><h3>Objectives</h3><ul>${objectives.map((o) => `<li>${esc(o)}</li>`).join("")}</ul></article>
                <article class="gov-mission-card glass-card"><span class="gov-mission-icon" aria-hidden="true">✦</span><h3>Core Values</h3><ul>${values.map((v) => `<li>${esc(v)}</li>`).join("")}</ul></article>
            </div>
        </div></section>`;
}

function principal(p, cmsOnly = false) {
    if (!p) return "";
    const name = p.name || "Principal";
    const designation = p.designation || "Principal, Eaglewood Polytechnic Institute";
    const qualification = p.qualification ? `<span class="gov-principal-qual">${esc(p.qualification)}</span>` : "";
    const hasPhoto = usablePrincipalPhoto(p.photo_url);
    const message = String(p.message || "").replace(/<[^>]+>/g, " ").trim();
    if (!message) return "";
    const excerpt = message.length > 320 ? `${message.slice(0, 320)}…` : message;
    const signature = p.signature || name;
    return `<section class="premium-section gray gov-principal-section" id="principal" aria-labelledby="principal-title">
        <div class="container">
            ${sectionHead("Leadership", "Principal's Message", "A message from the academic leadership guiding Eaglewood Polytechnic Institute.")}
            <div class="gov-principal-layout premium-reveal">
                <div class="gov-principal-frame">
                    <div class="gov-principal-ring" aria-hidden="true"></div>
                    ${hasPhoto
        ? `<img loading="lazy" decoding="async" src="${esc(img(p.photo_url))}" alt="${esc(name)}" class="gov-principal-photo">`
        : `<div class="gov-principal-fallback" aria-hidden="true">${initials(name)}</div>`}
                    <span class="gov-principal-badge">Principal</span>
                </div>
                <article class="gov-principal-content glass-card">
                    <blockquote><p id="principal-title">${esc(excerpt)}</p></blockquote>
                    <footer class="gov-principal-meta">
                        <div><strong>${esc(name)}</strong>${qualification}<span>${esc(designation)}</span></div>
                        <em class="gov-principal-signature">${esc(signature)}</em>
                    </footer>
                    <a class="btn btn-primary btn-ripple" href="about.html#principal">Read Full Message</a>
                </article>
            </div>
        </div></section>`;
}

function departments(items) {
    if (!items?.length) return "";
    return `<section class="premium-section blue gov-departments-section" id="departments" aria-labelledby="departments-title">
        <div class="container">
            ${sectionHead("Academics", "Engineering Departments", "Specialized departments with laboratories, mentoring and practical learning pathways.")}
            <div class="dept-swiper-shell premium-reveal">
                <div class="swiper dept-swiper" id="deptSwiper" aria-label="Engineering departments carousel">
                    <div class="swiper-wrapper">
                        ${items.map((d) => `<div class="swiper-slide">
                            <article class="gov-dept-card glass-card">
                                <div class="gov-dept-media"><img loading="lazy" decoding="async" src="${esc(img(d.department_image_url))}" alt="${esc(d.title)}"></div>
                                <div class="gov-dept-body">
                                    <span class="gov-dept-tag">Department</span>
                                    <h3 id="${d.id === items[0]?.id ? "departments-title" : ""}">${esc(d.title)}</h3>
                                    <p class="gov-dept-hod">${esc(d.hod_name || "Head of Department")}</p>
                                    <p>${plain(d.description)}</p>
                                    <div class="gov-dept-stats">
                                        <span>${esc(d.faculty_count || 0)} Faculty</span>
                                        <span>${esc(d.students_count || 0)} Students</span>
                                        <span class="gov-dept-labs">${esc(d.labs || "Dedicated Labs")}</span>
                                    </div>
                                    <a class="btn btn-teal btn-ripple" href="${esc(d.button_url || "departments.html")}">${esc(d.button_label || "Explore Department")}</a>
                                </div>
                            </article>
                        </div>`).join("")}
                    </div>
                    <button class="dept-swiper-prev" type="button" aria-label="Previous department">‹</button>
                    <button class="dept-swiper-next" type="button" aria-label="Next department">›</button>
                    <div class="dept-swiper-pagination" role="tablist" aria-label="Department slides"></div>
                </div>
            </div>
        </div></section>`;
}
function updates(items) {
    if (!items?.length) return "";
    const images = ["assets/images/induction-programme.jpg", "assets/images/drone-workshop.jpg", "assets/images/industrial-visit-plant.jpg", "assets/images/annual-gathering.jpg", "assets/images/placement-guidance.jpg"];
    return `<section class="premium-section blue updates-section gov-updates-section" id="latest-updates"><div class="container"><div class="section-split-head">${sectionHead("Latest Updates", "Recent campus events and academic highlights", "Official institute updates presented as a live academic news desk.")}<a class="section-view-all" href="index.html#latest-updates">View All</a></div><div class="swiper gov-swiper gov-updates-carousel premium-reveal" data-gov-slider data-autoplay="5000" data-loop="true"><button class="gov-slider-arrow prev" type="button" data-slider-prev aria-label="Previous update">&lt;</button><div class="swiper-wrapper gov-slider-track">${items.slice(0, 9).map((u, index) => `<article class="swiper-slide gov-update-card"><a class="gov-update-media" href="${esc(u.button_url || "index.html#latest-updates")}"><img loading="lazy" decoding="async" src="${esc(img(u.image_url || images[index % images.length]))}" alt="${esc(u.title)}"><span>${esc(u.category || u.icon || "Campus Update")}</span></a><div class="gov-update-body"><div class="gov-update-meta"><time>${date(u.date || u.created_at)}</time><span>${esc(u.category || "Update")}</span></div><h3>${esc(u.title)}</h3><p>${plain(u.description)}</p><div class="gov-update-actions"><a href="${esc(u.button_url || "index.html#latest-updates")}">${esc(u.button_label || "Read More")}</a></div></div></article>`).join("")}</div><button class="gov-slider-arrow next" type="button" data-slider-next aria-label="Next update">&gt;</button><div class="swiper-pagination gov-slider-dots" data-slider-dots></div></div></div></section>`;
}
function notices(items) {
    if (!items?.length) return "";
    return `<section class="premium-section white notices-section gov-notices-section" id="notice-board"><div class="container"><div class="section-split-head">${sectionHead("Important Notices", "Official notice board and downloads", "Pinned notices, deadlines and attachments remain easy to scan for students and parents.")}<a class="section-view-all" href="admission.html">Admission Info</a></div><div class="swiper gov-swiper gov-notices-carousel premium-reveal" data-gov-slider data-autoplay="5000" data-loop="true"><button class="gov-slider-arrow prev" type="button" data-slider-prev aria-label="Previous notice">&lt;</button><div class="swiper-wrapper gov-slider-track">${items.slice(0, 10).map((n, i) => { const file = n.attachment_url || n.pdf_url || n.file_url || ""; const priority = n.priority || (n.important ? "Important" : "General"); return `<article class="swiper-slide gov-notice-card ${i === 0 || n.important ? "is-pinned" : ""}"><div class="gov-notice-strip"></div><div class="gov-notice-head"><div class="gov-notice-badges">${i === 0 || n.important ? `<span class="pin">Pinned</span>` : ""}<span class="priority">${esc(priority)}</span>${n.is_new ? `<span class="new">New</span>` : ""}<span class="status">${esc(n.status || (n.published === false ? "Draft" : "Published"))}</span></div><time>${date(n.date || n.created_at)}</time></div><h3>${esc(n.title)}</h3><p>${plain(n.description)}</p><div class="gov-notice-foot"><span>${n.expiry_date ? `Valid till ${date(n.expiry_date)}` : "Official notice"}</span><span>${Number(n.download_count || n.views || 0)} downloads</span></div><div class="gov-notice-actions">${file ? `<a class="download" href="${esc(file)}" target="_blank" rel="noopener noreferrer"><b>PDF</b> Download</a>` : ""}<a href="${esc(file ? file : "index.html#notice-board")}"${file ? ' target="_blank" rel="noopener noreferrer"' : ""}>${file ? "Open PDF" : "View Notice"}</a></div></article>`; }).join("")}</div><button class="gov-slider-arrow next" type="button" data-slider-next aria-label="Next notice">&gt;</button><div class="swiper-pagination gov-slider-dots" data-slider-dots></div></div>        </div></section>`;
}

function courses(items) {
    if (!items?.length) return "";
    const rows = items.slice(0, 6);
    return `<section class="premium-section white gov-courses-section" id="courses">
        <div class="container">
            <div class="section-split-head">${sectionHead("Programs", "Engineering Courses", "Diploma and degree pathways with practical training, laboratories and industry exposure.")}<a class="section-view-all" href="courses.html">All Courses</a></div>
            <div class="gov-course-grid premium-course-grid premium-reveal">${rows.map((c) => `<article class="gov-course-card premium-course glass-card">
                <a class="gov-course-media course-image" href="${esc(c.button_url || "courses.html")}">${imgTag(c.image_url, c.title)}</a>
                <div class="gov-course-body">
                    <span class="gov-course-meta">${esc(c.duration || "3 Years")} · ${esc(c.seats || 60)} Seats</span>
                    <h3>${esc(c.title)}</h3>
                    <p>${plain(c.description)}</p>
                    <ul>
                        <li><span>Eligibility</span><strong>${esc(c.eligibility || "As per DTE norms")}</strong></li>
                        <li><span>Code</span><strong>${esc(c.code || "—")}</strong></li>
                    </ul>
                    <a class="btn btn-teal btn-sm btn-ripple" href="${esc(c.button_url || "courses.html")}">${esc(c.button_label || "Read More")}</a>
                </div>
            </article>`).join("")}</div>
        </div></section>`;
}

function facilities(items) {
    if (!items?.length) return "";
    const rows = items.slice(0, 10);
    return `<section class="premium-section gray facilities-section facilities-slider-section" id="facilities"><div class="container"><div class="facilities-slider-head premium-reveal"><div><span>CAMPUS FACILITIES</span><h2>Everything Students Need to Succeed</h2><p>Modern infrastructure, practical learning spaces and student-focused campus facilities.</p></div><div class="facilities-slider-controls"><button type="button" data-facility-prev aria-label="Previous facility">&lt;</button><button type="button" data-facility-next aria-label="Next facility">&gt;</button></div></div><div class="facilities-slider premium-reveal" data-facilities-slider data-autoplay="4500"><div class="facilities-track">${rows.map((f) => `<article class="facility-slide-card"><a class="facility-media" href="${esc(f.link || f.button_url || "infrastructure.html")}"><img loading="lazy" decoding="async" src="${esc(img(f.image_url))}" alt="${esc(f.title)}" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'"><span class="facility-overlay"></span></a><div class="facility-card-body"><span class="facility-badge">${facilityIcon(f.icon || f.title)}${esc(f.short_title || f.category || "Facility")}</span><h3>${esc(f.title)}</h3><p>${plain(f.description)}</p><a class="facility-link" href="${esc(f.link || f.button_url || "infrastructure.html")}">Explore Facility</a></div></article>`).join("")}</div><div class="facilities-dots" data-facility-dots></div></div></div></section>`;
}

function placements(items) {
    if (!items?.length) return "";
    const top = items[0] || {};
    const placementImage = top.image_url || "assets/images/placement-interview.jpg";
    const highest = top.highest_package || "₹6 LPA";
    const average = top.average_package || "₹3.2 LPA";
    const placed = top.placed_students || 120;
    const recruiters = [top.recruiter, top.company_logo_url, top.student_name].filter(Boolean);
    const recruiterLabels = recruiters.length ? recruiters : [];
    const testimonials = items.filter((p) => p.testimonial).slice(0, 2);
    const testimonialCards = testimonials.length
        ? testimonials.map((t) => `<blockquote class="gov-placement-quote glass-card"><p>${plain(t.testimonial)}</p><footer><strong>${esc(t.student_name || "Student")}</strong><span>${esc(t.course || "Alumni")}</span></footer></blockquote>`).join("")
        : "";
    return `<section class="premium-section white gov-placement-section" id="placements">
        <div class="container">
            ${sectionHead("Training & Placement", "Placement Highlights", "Career readiness through aptitude training, technical skills and industry interaction.")}
            <div class="gov-placement-grid premium-reveal">
                <div class="gov-placement-stats">
                    <article class="glass-card"><span>Highest Package</span><strong data-count="${String(highest).replace(/[^0-9.]/g, "") || 6}" data-suffix=" LPA">${esc(highest)}</strong></article>
                    <article class="glass-card"><span>Average Package</span><strong data-count="${String(average).replace(/[^0-9.]/g, "") || 3}" data-suffix=" LPA">${esc(average)}</strong></article>
                    <article class="glass-card"><span>Students Trained</span><strong data-count="${placed}">${placed}+</strong></article>
                    <article class="glass-card"><span>Placement Guidance</span><strong data-count="100" data-suffix="%">100%</strong></article>
                </div>
                <div class="gov-placement-visual"><img loading="lazy" decoding="async" src="${esc(placementImage)}" alt="Placement activity at Eaglewood Polytechnic"></div>
            </div>
            <div class="gov-recruiter-row premium-reveal"><span>Recruiters & Partners</span><div>${recruiterLabels.map((r) => `<strong>${esc(String(r).slice(0, 24))}</strong>`).join("")}</div></div>
            <div class="gov-placement-testimonials premium-reveal">${testimonialCards}</div>
            <div class="gov-placement-actions"><a class="btn btn-primary btn-ripple" href="placements.html">Placement Details</a><a class="btn btn-secondary btn-ripple" href="contact.html">Contact Placement Cell</a></div>
        </div></section>`;
}

function studentResources() {
    const resources = [
        ["Time Table", "contact.html", "calendar"],
        ["Syllabus", "courses.html", "book"],
        ["Exam Notices", "index.html#notice-board", "bell"],
        ["Results", "contact.html", "chart"],
        ["Downloads", "admission.html", "download"],
        ["Scholarships", "admission.html", "scholarship"],
        ["Academic Calendar", "contact.html", "calendar"],
        ["Anti Ragging", "contact.html", "shield"],
    ];
    const icons = { calendar: "📅", book: "📘", bell: "🔔", chart: "📊", download: "⬇", scholarship: "⭐", shield: "🛡" };
    return `<section class="premium-section gray gov-resources-section" id="student-resources">
        <div class="container">
            ${sectionHead("Student Services", "Student Resources", "Quick access to academic documents, notices and student support services.")}
            <div class="gov-resource-grid premium-reveal">${resources.map(([title, href, icon]) => `<a class="gov-resource-card glass-card" href="${esc(href)}"><span class="gov-resource-icon" aria-hidden="true">${icons[icon] || "📄"}</span><strong>${esc(title)}</strong><span class="gov-resource-link">Open</span></a>`).join("")}</div>
        </div></section>`;
}
function gallery(items) {
    if (!items?.length) return "";
    const categories = ["All", ...new Set(items.map((g) => categoryFor(g.category || "Campus")).filter(Boolean))].slice(0, 6);
    return `<section class="premium-section blue gallery-section" id="gallery"><div class="container"><div class="section-split-head">${sectionHead("Gallery", "Campus life, workshops and student moments", "Filterable masonry preview with lightbox interactions and editorial overlays.")}<a class="section-view-all" href="gallery.html">Open Gallery</a></div><div class="home-gallery-filters" aria-label="Filter gallery preview">${categories.map((cat, i) => `<button type="button" class="${i === 0 ? "active" : ""}" data-home-gallery-filter="${esc(cat)}">${esc(cat)}</button>`).join("")}</div><div class="premium-gallery-grid">${items.slice(0, 9).map((g, i) => `<button class="premium-gallery-tile premium-reveal ${i === 0 ? "large" : ""}" data-category="${esc(categoryFor(g.category || "Campus"))}" data-full="${esc(img(g.image_url))}" type="button"><img loading="lazy" src="${esc(img(g.image_url))}" alt="${esc(g.alt || g.title)}"><span>${esc(g.category || "Campus")}</span><strong>${esc(g.title)}</strong></button>`).join("")}</div></div></section>`;
}

function achievements(data, cmsOnly = false) {
    const items = data.achievements || [];
    if (!items.length) return cmsOnly ? "" : "";
    return `<section class="premium-section white gov-achievements-section" id="achievements">
        <div class="container">
            ${sectionHead("Recognition", "Achievements & Milestones", "Awards, affiliations, rankings and student accomplishments that reflect Eaglewood's academic excellence.")}
            <div class="gov-achievement-grid premium-reveal">${items.map((item) => `<article class="gov-achievement-card glass-card">
                <span class="gov-achievement-icon" aria-hidden="true">${esc(item.icon || "★")}</span>
                <span class="gov-achievement-year">${esc(item.year || "2025")}</span>
                <h3>${esc(item.title)}</h3>
                <p>${plain(item.description)}</p>
            </article>`).join("")}</div>
        </div></section>`;
}

function campusHighlights(data, cmsOnly = false) {
    const galleryItems = data.gallery || [];
    const images = galleryItems.slice(0, 3).map((g) => g.image_url).filter(Boolean);
    if (cmsOnly && !images.length && !data.campusFacts?.length && !parseSettingValue(data.settings?.about_summary)) return "";
    const displayImages = images.length
        ? images
        : (cmsOnly ? [] : ["assets/images/campus.jpg", "assets/images/annual-gathering.jpg", "assets/images/workshop.jpg"]);
    const videoUrl = parseSettingValue(data.settings?.campus_video_url) || "";
    const facts = data.campusFacts || [];
    return `<section class="premium-section gray gov-campus-section" id="campus-highlights">
        <div class="container">
            ${sectionHead("Campus", "Campus Highlights", "Explore our disciplined campus environment, modern infrastructure and vibrant student life.")}
            <div class="gov-campus-grid premium-reveal">
                <div class="gov-campus-media">
                    <div class="gov-campus-images">${displayImages.map((src, i) => `<img loading="lazy" decoding="async" src="${esc(img(src))}" alt="Campus view ${i + 1}" class="${i === 0 ? "primary" : ""}">`).join("")}</div>
                    ${videoUrl ? `<a class="gov-campus-video glass-card" href="${esc(videoUrl)}" target="_blank" rel="noopener noreferrer"><span>▶</span><strong>Campus Video Tour</strong><small>Watch on YouTube</small></a>` : `<div class="gov-campus-video glass-card is-static"><span>🏫</span><strong>Visit Our Campus</strong><small>Majalgaon, District Beed</small></div>`}
                </div>
                <div class="gov-campus-facts glass-card">
                    <h3>Quick Facts</h3>
                    <ul>${facts.map((f) => `<li><span>${esc(f.label)}</span><strong>${esc(f.value)}</strong></li>`).join("")}</ul>
                    <p>${plain(parseSettingValue(data.settings?.about_summary) || "")}</p>
                    <a class="btn btn-primary btn-ripple" href="infrastructure.html">Explore Infrastructure</a>
                </div>
            </div>
        </div></section>`;
}

function admissionProcess(data, cmsOnly = false) {
    const steps = data.admissionSteps || [];
    if (!steps.length) return cmsOnly ? "" : "";
    return `<section class="premium-section blue gov-admission-section" id="admission-process">
        <div class="container">
            <div class="section-split-head">${sectionHead("Admissions", "Admission Process", "A clear step-by-step pathway from eligibility check to joining campus.")}<a class="section-view-all" href="admission.html">Full Admission Guide</a></div>
            <div class="timeline-list premium-reveal">${steps.map((step) => `<article class="timeline-item premium-card glass-card">
                <div class="timeline-dot" aria-hidden="true">${esc(String(step.icon || step.step || ""))}</div>
                <div>
                    <time>Step ${esc(String(step.step || ""))}</time>
                    <h3>${esc(step.title)}</h3>
                    <p>${plain(step.description)}</p>
                </div>
            </article>`).join("")}</div>
            <div class="section-link premium-reveal"><a class="btn btn-primary btn-ripple" href="admission.html">Apply for Admission</a></div>
        </div></section>`;
}

function inquirySection(data) {
    const courseOptions = (data.courses || []).slice(0, 8);
    const phone = parseSettingValue(data.settings?.phone) || "+91 94237 16230";
    const email = parseSettingValue(data.settings?.email) || "eaglewoodpoly@gmail.com";
    return `<section class="premium-section white inquiry-section" id="inquiry">
        <div class="container">
            ${sectionHead("Contact", "Admission Inquiry", "Submit your question and our admissions team will respond with course details, eligibility and next steps.")}
            <div class="inquiry-grid premium-reveal">
                <aside class="inquiry-info glass-card">
                    <img loading="lazy" decoding="async" src="assets/images/campus.jpg" alt="Eaglewood Polytechnic campus">
                    <div>
                        <h3>Talk to Admissions</h3>
                        <p>Call <a href="tel:+919423716230">${esc(phone)}</a> or email <a href="mailto:eaglewoodpoly@gmail.com">${esc(email)}</a> for admission guidance.</p>
                        <ul>
                            <li>Course eligibility &amp; seats</li>
                            <li>Document checklist</li>
                            <li>Hostel &amp; transport</li>
                            <li>Scholarship information</li>
                        </ul>
                    </div>
                </aside>
                <form id="home-inquiry-form" class="premium-form form-glass glass-card" novalidate>
                    <h3>Quick Inquiry Form</h3>
                    <label><span class="sr-only">Name</span><input name="name" type="text" placeholder="Your Name" autocomplete="name" required></label>
                    <label><span class="sr-only">Phone</span><input name="phone" type="tel" placeholder="Phone Number" autocomplete="tel" required></label>
                    <label><span class="sr-only">Email</span><input name="email" type="email" placeholder="Email (optional)" autocomplete="email"></label>
                    <label><span class="sr-only">Course</span><select name="course"><option value="">Select Course</option>${courseOptions.map((c) => `<option value="${esc(c.title)}">${esc(c.title)}</option>`).join("")}</select></label>
                    <label class="full"><span class="sr-only">Message</span><textarea name="message" placeholder="Your question about admission, courses or campus" required></textarea></label>
                    <button class="btn btn-primary btn-ripple full" type="submit">Submit Inquiry</button>
                    <p class="form-status" aria-live="polite"></p>
                </form>
            </div>
        </div></section>`;
}

function premiumCta(settings = {}) {
    const heading = parseSettingValue(settings.cta_heading) || "Your engineering journey starts at Eaglewood.";
    const text = parseSettingValue(settings.cta_text) || "Apply for admission, explore courses and speak with our academic team for guidance on diploma and degree pathways.";
    return `<section class="premium-cta" id="premium-cta" aria-label="Call to action">
        <div class="container premium-reveal">
            <div>
                <p class="eyebrow">Admissions 2026-27</p>
                <h2>${esc(heading)}</h2>
                <p>${esc(text)}</p>
            </div>
            <div class="hero-actions">
                <a class="btn btn-secondary btn-ripple" href="admission.html">Apply Now</a>
                <a class="btn btn-secondary btn-ripple" href="contact.html">Contact Office</a>
            </div>
        </div></section>`;
}

function initSlider() {
    const slides = [...document.querySelectorAll(".premium-slide")];
    if (!slides.length) return;
    const dots = [...document.querySelectorAll("[data-dot]")];
    let index = 0;
    const show = (next) => { index = (next + slides.length) % slides.length; slides.forEach((s, i) => s.classList.toggle("active", i === index)); dots.forEach((d, i) => d.classList.toggle("active", i === index)); };
    document.querySelector("[data-prev]")?.addEventListener("click", () => show(index - 1));
    document.querySelector("[data-next]")?.addEventListener("click", () => show(index + 1));
    dots.forEach((dot) => dot.addEventListener("click", () => show(Number(dot.dataset.dot))));
    setInterval(() => show(index + 1), 6500);
}

function initLightbox() {
    document.querySelectorAll(".premium-gallery-tile").forEach((tile) => tile.addEventListener("click", () => {
        const overlay = document.createElement("div");
        overlay.className = "lightbox";
        overlay.innerHTML = `<button aria-label="Close">x</button><img src="${esc(tile.dataset.full)}" alt="Gallery image">`;
        overlay.addEventListener("click", () => overlay.remove());
        document.body.appendChild(overlay);
    }));
}

function initHighlightCounters() {
    const counters = document.querySelectorAll("[data-count]");
    if (!counters.length) return;
    const animate = (el) => {
        const target = Number(el.dataset.count || 0);
        const suffix = el.dataset.suffix || "";
        if (!target) return;
        const duration = 1200;
        const start = performance.now();
        const tick = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const value = Math.round(target * (1 - Math.pow(1 - progress, 3)));
            el.textContent = `${value}${suffix}`;
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            animate(entry.target);
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.35 });
    counters.forEach((el) => observer.observe(el));
}

function initPremiumReveal() {
    const items = document.querySelectorAll(".premium-reveal");
    if (!items.length) return;
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
        }
    }), { threshold: 0.12 });
    items.forEach((item) => observer.observe(item));
}




function initPremiumInteractions() {
    document.addEventListener("click", (event) => {
        const button = event.target.closest(".btn");
        if (!button) return;
        const ripple = document.createElement("span");
        const rect = button.getBoundingClientRect();
        ripple.className = "ew-ripple";
        ripple.style.left = `${event.clientX - rect.left}px`;
        ripple.style.top = `${event.clientY - rect.top}px`;
        button.appendChild(ripple);
        ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
    });

    const hero = document.querySelector(".premium-hero");
    if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    window.addEventListener("scroll", () => {
        const y = Math.min(scrollY, innerHeight);
        hero.style.setProperty("--hero-parallax", `${y * 0.08}px`);
        document.querySelectorAll(".premium-slide img").forEach((image) => {
            image.style.transform = `translateY(${y * 0.04}px) scale(1.04)`;
        });
    }, { passive: true });
}




function initDepartmentsSwiper() {
    const el = document.querySelector(".dept-swiper");
    if (!el) return;
    const boot = () => {
        if (!window.Swiper) return false;
        new window.Swiper(el, {
            slidesPerView: 1,
            spaceBetween: 20,
            loop: true,
            speed: 650,
            grabCursor: true,
            autoplay: { delay: 4800, disableOnInteraction: false, pauseOnMouseEnter: true },
            keyboard: { enabled: true, onlyInViewport: true },
            a11y: { enabled: true },
            pagination: { el: ".dept-swiper-pagination", clickable: true },
            navigation: { nextEl: ".dept-swiper-next", prevEl: ".dept-swiper-prev" },
            breakpoints: {
                640: { slidesPerView: 1.12, spaceBetween: 18 },
                900: { slidesPerView: 2, spaceBetween: 22 },
                1200: { slidesPerView: 3, spaceBetween: 24 },
            },
        });
        return true;
    };
    if (!boot()) {
        const wait = setInterval(() => { if (boot()) clearInterval(wait); }, 60);
        setTimeout(() => clearInterval(wait), 8000);
    }
}

function initHomeCarousels() {
    document.querySelectorAll("[data-gov-slider]").forEach((slider) => {
        const track = slider.querySelector(".gov-slider-track");
        const slides = [...slider.querySelectorAll(".swiper-slide")];
        const prev = slider.querySelector("[data-slider-prev]");
        const next = slider.querySelector("[data-slider-next]");
        const dots = slider.querySelector("[data-slider-dots]");
        if (!track || !slides.length) return;
        slider.classList.toggle("is-single", slides.length === 1);
        let index = 0;
        let timer;
        let startX = 0;
        const perView = () => window.matchMedia("(max-width: 640px)").matches ? 1 : window.matchMedia("(max-width: 1024px)").matches ? 2 : 3;
        const maxIndex = () => Math.max(0, slides.length - perView());
        const renderDots = () => { if (!dots) return; dots.innerHTML = Array.from({ length: maxIndex() + 1 }, (_, i) => `<button type="button" class="${i === index ? "active" : ""}" data-slide-dot="${i}" aria-label="Go to slide ${i + 1}"></button>`).join(""); };
        const update = (nextIndex = index) => {
            index = maxIndex() ? (nextIndex < 0 ? maxIndex() : nextIndex > maxIndex() ? 0 : nextIndex) : 0;
            const gap = parseFloat(getComputedStyle(track).gap || "24") || 24;
            const width = slides[0].getBoundingClientRect().width + gap;
            track.style.transform = `translate3d(${-index * width}px,0,0)`;
            renderDots();
        };
        const stop = () => { if (timer) clearInterval(timer); };
        const play = () => { stop(); const ms = Number(slider.dataset.autoplay || 0); if (ms && slides.length > perView()) timer = setInterval(() => update(index + 1), ms); };
        prev?.addEventListener("click", () => { update(index - 1); play(); });
        next?.addEventListener("click", () => { update(index + 1); play(); });
        dots?.addEventListener("click", (event) => { const dot = event.target.closest("[data-slide-dot]"); if (!dot) return; update(Number(dot.dataset.slideDot)); play(); });
        slider.addEventListener("pointerdown", (event) => { startX = event.clientX; stop(); }, { passive: true });
        slider.addEventListener("pointerup", (event) => { const dx = event.clientX - startX; if (Math.abs(dx) > 45) update(index + (dx < 0 ? 1 : -1)); play(); }, { passive: true });
        slider.addEventListener("keydown", (event) => {
            if (event.key === "ArrowLeft") { event.preventDefault(); update(index - 1); play(); }
            if (event.key === "ArrowRight") { event.preventDefault(); update(index + 1); play(); }
        });
        slider.setAttribute("tabindex", "0");
        slider.addEventListener("mouseenter", stop);
        slider.addEventListener("mouseleave", play);
        window.addEventListener("resize", () => update(index), { passive: true });
        update(0);
        play();
    });
}

function initFacilitiesSlider() {
    document.querySelectorAll("[data-facilities-slider]").forEach((slider) => {
        const track = slider.querySelector(".facilities-track");
        const slides = [...slider.querySelectorAll(".facility-slide-card")];
        const prev = document.querySelector("[data-facility-prev]");
        const next = document.querySelector("[data-facility-next]");
        const dots = slider.querySelector("[data-facility-dots]");
        if (!track || !slides.length) return;

        let index = 0;
        let timer;
        let isDragging = false;
        let startX = 0;
        let startLeft = 0;
        const perView = () => window.matchMedia("(max-width: 640px)").matches ? 1 : window.matchMedia("(max-width: 900px)").matches ? 2 : window.matchMedia("(max-width: 1200px)").matches ? 3 : 4;
        const maxIndex = () => Math.max(0, slides.length - perView());
        const clamp = (value) => Math.min(Math.max(value, 0), maxIndex());
        const cardStep = () => {
            const gap = parseFloat(getComputedStyle(track).gap || "20") || 20;
            return slides[0].getBoundingClientRect().width + gap;
        };
        const renderDots = () => {
            if (!dots) return;
            dots.innerHTML = Array.from({ length: maxIndex() + 1 }, (_, i) => `<button type="button" class="${i === index ? "active" : ""}" data-facility-dot="${i}" aria-label="Go to facility slide ${i + 1}"></button>`).join("");
        };
        const go = (nextIndex) => {
            index = clamp(nextIndex);
            track.scrollTo({ left: index * cardStep(), behavior: "smooth" });
            renderDots();
        };
        const stop = () => { if (timer) clearInterval(timer); };
        const play = () => {
            stop();
            const ms = Number(slider.dataset.autoplay || 4500);
            if (slides.length > perView()) timer = setInterval(() => go(index >= maxIndex() ? 0 : index + 1), ms);
        };
        const sync = () => {
            index = clamp(Math.round(track.scrollLeft / Math.max(cardStep(), 1)));
            renderDots();
        };

        prev?.addEventListener("click", () => { go(index <= 0 ? maxIndex() : index - 1); play(); });
        next?.addEventListener("click", () => { go(index >= maxIndex() ? 0 : index + 1); play(); });
        dots?.addEventListener("click", (event) => {
            const dot = event.target.closest("[data-facility-dot]");
            if (!dot) return;
            go(Number(dot.dataset.facilityDot));
            play();
        });
        track.addEventListener("scroll", localDebounce(sync, 80), { passive: true });
        track.addEventListener("pointerdown", (event) => { isDragging = true; startX = event.clientX; startLeft = track.scrollLeft; track.setPointerCapture?.(event.pointerId); stop(); });
        track.addEventListener("pointermove", (event) => { if (!isDragging) return; track.scrollLeft = startLeft - (event.clientX - startX); });
        track.addEventListener("pointerup", () => { isDragging = false; sync(); play(); });
        track.addEventListener("pointercancel", () => { isDragging = false; play(); });
        slider.addEventListener("mouseenter", stop);
        slider.addEventListener("mouseleave", play);
        slider.addEventListener("focusin", stop);
        slider.addEventListener("focusout", play);
        window.addEventListener("resize", localDebounce(() => go(index), 120), { passive: true });
        renderDots();
        play();
    });
}
function initHomeGalleryFilters() {
    const buttons = [...document.querySelectorAll("[data-home-gallery-filter]")];
    const tiles = [...document.querySelectorAll(".premium-gallery-tile[data-category]")];
    if (!buttons.length || !tiles.length) return;
    buttons.forEach((button) => button.addEventListener("click", () => {
        const category = button.dataset.homeGalleryFilter;
        buttons.forEach((item) => item.classList.toggle("active", item === button));
        tiles.forEach((tile) => {
            const show = category === "All" || tile.dataset.category === category;
            tile.hidden = !show;
            if (show) requestAnimationFrame(() => tile.classList.add("is-visible"));
        });
    }));
}



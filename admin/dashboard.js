import { safeDelete, safeFetch, safeInsert, safeUpdate, supabase, connectCms, safeAdminSelect, safeCount, getCmsStatusLabel, resetCmsStatus, isCmsAvailable, getMissingTables, getCmsTableStats, getLastConnectionDiagnostics, hasAdminSession, ensureAdminWriteSession, ensureAdminWriteSessionOnLoad, getAdminWriteCapability, mapCrudReason, setCmsAdminMode, getTableStatus, clearCmsQueryCache, signOutAdmin, getAdminWriteClient, loadLegacyCredentials } from "../assets/js/supabase.js";
import { bootstrapCmsContentIfNeeded, isCmsContentEmpty } from "../assets/js/cms-bootstrap.js";

const localAdmin = await bootstrapAdminAccess();
if (!localAdmin) {
    location.replace("login.html");
    await new Promise(() => {});
}

async function bootstrapAdminAccess() {
    const cached = JSON.parse(localStorage.getItem("admin") || "null");
    const creds = loadLegacyCredentials();
    if (!cached?.id || cached.status !== "active" || !creds?.email || !creds?.password) {
        localStorage.removeItem("admin");
        return null;
    }
    if (!(await hasAdminSession())) {
        localStorage.removeItem("admin");
        return null;
    }
    return cached;
}

const MODULES = [
    { key: "dashboard", label: "Dashboard", group: "Overview" },

    { key: "principal_message", label: "Principal Message", table: "principal_message", folder: "principal", group: "Website", fields: ["photo_url:image", "name", "qualification", "designation", "message:rich", "signature", "published:boolean", "status:select", "display_order:number"] },
    { key: "updates", label: "Updates", table: "updates", folder: "updates", group: "Website", fields: ["icon", "title", "description:rich", "image_url:image", "date:date", "category", "pinned:boolean", "button_label", "button_url", "color:color", "published:boolean", "status:select", "display_order:number"] },
    { key: "notices", label: "Important Notices", table: "notices", folder: "notices", group: "Website", fields: ["title", "description:rich", "pdf_url:file", "attachment_url:file", "image_url:image", "date:date", "expiry_date:date", "priority:priority", "important:boolean", "is_new:boolean", "published:boolean", "status:select", "display_order:number"] },

    { key: "courses", label: "Courses", table: "courses", folder: "courses", group: "Website", fields: ["department", "image_url:image", "title", "duration", "fees", "seats:number", "code", "description:rich", "eligibility:rich", "syllabus_pdf_url:file", "button_label", "button_url", "published:boolean", "status:select", "display_order:number"] },
    { key: "departments", label: "Departments", table: "departments", folder: "departments", group: "Website", fields: ["title", "hod_name", "hod_photo_url:image", "department_image_url:image", "description:rich", "labs:rich", "faculty_count:number", "students_count:number", "button_label", "button_url", "published:boolean", "status:select", "display_order:number"] },
    { key: "faculty", label: "Faculty", table: "faculty", folder: "faculty", group: "Website", fields: ["photo_url:image", "name", "qualification", "experience", "department", "subjects:rich", "email", "social_links:json", "published:boolean", "status:select", "display_order:number"] },
    { key: "facilities", label: "Facilities", table: "facilities", folder: "facilities", group: "Website", fields: ["title", "icon", "image_url:image", "description:rich", "category", "published:boolean", "status:select", "display_order:number"] },
    { key: "placements", label: "Placements", table: "placements", folder: "placements", group: "Website", fields: ["title", "recruiter", "company_logo_url:image", "image_url:image", "package", "highest_package", "average_package", "placed_students:number", "training_activities:rich", "testimonial:rich", "student_name", "course", "published:boolean", "status:select", "display_order:number"] },
    { key: "gallery", label: "Gallery", table: "gallery", folder: "gallery", group: "Website", fields: ["title", "album", "category:selectCategory", "image_url:image", "alt", "description:rich", "featured:boolean", "published:boolean", "status:select", "display_order:number"] },
    { key: "media_library", label: "Media Library", table: "media_library", folder: "media", group: "System", fields: ["file_url:file", "thumbnail_url:image", "title", "file_type:mediaType", "folder", "alt", "tags", "published:boolean", "status:select", "display_order:number"] },

    { key: "inquiries", label: "Inquiries", table: "inquiries", group: "Forms", export: true, fields: ["name", "phone", "email", "course", "message:rich", "assigned_to", "reply_status:reply", "status:lead"] },
    { key: "admissions", label: "Admissions", table: "admissions", group: "Forms", export: true, fields: ["student_name", "phone", "email", "course", "previous_school", "address:rich", "message:rich", "application_status:applicationStatus", "payment_status:paymentStatus", "status:lead"] },
    { key: "contacts", label: "Contact", table: "contacts", group: "Forms", export: true, fields: ["name", "email", "phone", "subject", "message:rich", "reply_status:reply", "assigned_to", "status:lead"] },

    { key: "ai_knowledge_base", label: "AI Knowledge", table: "ai_knowledge_base", group: "AI Assistant", fields: ["question", "answer:rich", "category", "keywords", "version:number", "published:boolean", "status:select", "display_order:number"] },
    { key: "ai_prompts", label: "AI Assistant", table: "ai_prompts", group: "AI Assistant", fields: ["name", "prompt:rich", "greeting_message:rich", "fallback_response:rich", "quick_replies:json", "suggested_questions:json", "temperature:number", "token_limit:number", "response_delay:number", "published:boolean", "status:select", "display_order:number"] },
    { key: "ai_conversations", label: "AI Conversations", table: "ai_conversations", group: "AI Assistant", export: true, readonly: true, fields: ["session_id", "visitor_name", "question:rich", "answer:rich", "rating:number", "status:select", "metadata:json"] },

    { key: "settings", label: "Settings", table: "settings", group: "System", fields: ["key", "value:json", "published:boolean", "status:select", "display_order:number"] },
    { key: "home_slides", label: "Hero Slides", table: "home_slides", folder: "hero", group: "System", fields: ["title", "subtitle:rich", "image_url:image", "button_primary_label", "button_primary_url", "button_secondary_label", "button_secondary_url", "published:boolean", "status:select", "display_order:number"] },
    { key: "footer_blocks", label: "Footer Blocks", table: "footer_blocks", group: "System", fields: ["block_key", "title", "content:json", "published:boolean", "status:select", "display_order:number"] },
    { key: "admins", label: "Admin Users", table: "admins", group: "System", fields: ["auth_user_id", "name", "email", "role:role", "permissions:json", "status:userStatus"] },
];

/** Modules shown on the dashboard home grid (real CMS modules only). */
const DASHBOARD_MODULE_KEYS = [
    "principal_message", "courses", "departments", "faculty", "facilities", "gallery", "placements", "home_slides", "footer_blocks",
    "admissions", "notices", "updates", "ai_prompts", "media_library", "contacts",
    "settings", "admins",
];

const DASHBOARD_MODULES = DASHBOARD_MODULE_KEYS
    .map((key) => MODULES.find((m) => m.key === key))
    .filter(Boolean);

let currentModule = MODULES[0];
let rows = [];
let page = 1;
const pageSize = 10;
let editingRow = null;
let editorDirty = false;
const $ = (id) => document.getElementById(id);

const NAV_ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    cms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    academics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5"/></svg>',
    campus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>',
    media: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    ai: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4Z"/><path d="M6 10h12v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V10Z"/></svg>',
    admissions: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>',
};

const NAV_SECTIONS = [
    { id: "overview", label: "Overview", icon: "dashboard", keys: ["dashboard"] },
    { id: "website", label: "Website", icon: "cms", keys: [
        "principal_message", "updates", "notices",
        "courses", "departments", "faculty",
        "facilities", "placements", "gallery",
    ] },
    { id: "forms", label: "Admissions", icon: "admissions", keys: ["admissions", "contacts", "inquiries"] },
    { id: "ai", label: "AI Assistant", icon: "ai", keys: ["ai_knowledge_base", "ai_prompts", "ai_conversations"] },
    { id: "system", label: "System", icon: "system", keys: ["settings", "home_slides", "footer_blocks", "media_library", "admins"] },
];

let cmsConnection = { connected: false };
let chromeInitialized = false;

document.addEventListener("DOMContentLoaded", async () => {
    setCmsAdminMode(true);
    await ensureAdminWriteSessionOnLoad();
    cmsConnection = await connectCms();
    initChrome();
    await refreshPendingBar();
    renderNav();
    loadDashboard();
    await refreshPendingBar();
    updateSystemStatus();
    setInterval(updateLiveClock, 1000);
    updateLiveClock();

    document.addEventListener("visibilitychange", async () => {
        if (document.visibilityState !== "visible") return;
        clearCmsQueryCache();
        if (!isCmsAvailable()) {
            cmsConnection = await connectCms();
            if (!cmsConnection.connected) return;
        }
        await refreshPendingBar();
        loadDashboard();
        updateSystemStatus();
    });
});

async function refreshPendingBar() {
    const bar = $("pendingBar");
    if (bar) bar.hidden = true;
}

function updateConnectionBanner() {
    /* pending bar content is managed by refreshPendingBar() */
}

function initChrome() {
    if (chromeInitialized) return;
    chromeInitialized = true;

    const name = localAdmin.name || localAdmin.email || "Admin";
    $("adminName").textContent = name;
    $("adminAvatar").textContent = name.charAt(0).toUpperCase();
    $("currentDate").textContent = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    document.body.dataset.theme = localStorage.getItem("admin-theme") || "light";
    document.body.dataset.sidebar = localStorage.getItem("admin-sidebar") || "expanded";

    $("logoutBtn").addEventListener("click", logout);
    $("menuToggle")?.addEventListener("click", () => document.body.classList.add("sidebar-open"));
    $("sidebarClose")?.addEventListener("click", () => document.body.classList.remove("sidebar-open"));
    $("sidebarOverlay")?.addEventListener("click", () => document.body.classList.remove("sidebar-open"));
    $("sidebarCollapse")?.addEventListener("click", toggleSidebarCollapse);
    $("addRecordBtn")?.addEventListener("click", () => openEditor());
    $("cancelEditBtn")?.addEventListener("click", closeEditor);
    document.querySelector(".dialog-close")?.addEventListener("click", closeEditor);
    $("editorForm").addEventListener("submit", saveRecord);
    $("globalSearch")?.addEventListener("input", () => { page = 1; renderTable(); });
    $("statusFilter")?.addEventListener("change", (e) => { window.__statusFilter = e.target.value; page = 1; renderTable(); });
    $("sortFilter")?.addEventListener("change", () => { page = 1; renderTable(); });
    $("exportCsvBtn")?.addEventListener("click", exportCsv);
    $("bulkPublishBtn")?.addEventListener("click", bulkPublish);
    $("bulkUnpublishBtn")?.addEventListener("click", bulkUnpublish);
    $("bulkDeleteBtn")?.addEventListener("click", bulkDelete);
    $("themeToggle")?.addEventListener("click", toggleTheme);
    $("notificationBtn")?.addEventListener("click", () => switchModule("inquiries"));
    $("commandBtn")?.addEventListener("click", openCommandPalette);
    $("commandSearch")?.addEventListener("input", renderCommandResults);
    $("commandDialog")?.addEventListener("click", (event) => { if (event.target.id === "commandDialog") $("commandDialog").close(); });
    $("sidebarSearch")?.addEventListener("input", () => renderNav($("sidebarSearch").value.trim().toLowerCase()));
    $("quickCreateBtn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        const menu = $("quickCreateMenu");
        menu.hidden = !menu.hidden;
    });
    document.addEventListener("click", () => { if ($("quickCreateMenu")) $("quickCreateMenu").hidden = true; });
    document.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openCommandPalette(); }
    });
    document.querySelectorAll("[data-jump]").forEach((btn) => btn.addEventListener("click", () => switchModule(btn.dataset.jump)));
    initQuickCreateMenu();
    initEditorDirtyTracking();
}

function toggleSidebarCollapse() {
    const next = document.body.dataset.sidebar === "collapsed" ? "expanded" : "collapsed";
    document.body.dataset.sidebar = next;
    localStorage.setItem("admin-sidebar", next);
}

function initQuickCreateMenu() {
    const menu = $("quickCreateMenu");
    if (!menu) return;
    const quickKeys = ["notices", "updates", "courses", "gallery", "admissions", "inquiries", "ai_knowledge_base", "media_library"];
    menu.innerHTML = quickKeys.map((key) => {
        const mod = MODULES.find((m) => m.key === key);
        return `<button type="button" data-key="${key}">${mod?.label || key}</button>`;
    }).join("");
    menu.querySelectorAll("button").forEach((btn) => btn.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.hidden = true;
        switchModule(btn.dataset.key);
        if (btn.dataset.key !== "dashboard") openEditor();
    }));
}

function initEditorDirtyTracking() {
    $("editorForm")?.addEventListener("input", () => {
        editorDirty = true;
        $("autosaveStatus").textContent = "Unsaved changes";
    });
}

async function closeEditor() {
    if (editorDirty && !(await confirmAction("Discard changes?", "You have unsaved changes in this editor."))) return;
    editorDirty = false;
    $("autosaveStatus").textContent = "";
    $("editorDialog").close();
}

function updateLiveClock() {
    const el = $("liveClock");
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

async function updatePendingBar() {
    const bar = $("pendingBar");
    if (!bar) return;
    if (!isCmsAvailable()) return;
    const [inq, contact] = await Promise.all([
        adminTableCount("inquiries"),
        adminTableCount("contacts"),
    ]);
    const pendingInq = inq.ok ? Math.min(inq.count || 0, 99) : 0;
    const pendingContact = contact.ok ? Math.min(contact.count || 0, 99) : 0;
    const total = pendingInq + pendingContact;
    $("notificationBtn")?.setAttribute("data-count", String(total));
    if (!total) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.innerHTML = [
        pendingInq ? `<button type="button" data-key="inquiries">Pending Inquiries <span class="count">${pendingInq}</span></button>` : "",
        pendingContact ? `<button type="button" data-key="contacts">Contact Messages <span class="count">${pendingContact}</span></button>` : "",
    ].filter(Boolean).join("");
    bar.querySelectorAll("button").forEach((btn) => btn.addEventListener("click", () => switchModule(btn.dataset.key)));
}

async function updateSystemStatus() {
    const label = getCmsStatusLabel();
    const online = label === "Connected";
    $("dbStatus")?.classList.toggle("online", online);
    $("dbStatus").textContent = label;
    const media = await adminTableCount("media_library");
    $("storageStatus").textContent = media.ok ? `${media.count || 0} files` : "—";
}

async function logout() {
    await signOutAdmin();
    location.href = "login.html";
}

function renderNav(filter = "") {
    const collapsed = JSON.parse(localStorage.getItem("admin-nav-collapsed") || "{}");
    $("adminNav").innerHTML = NAV_SECTIONS.map((section) => {
        const items = section.keys
            .map((key) => MODULES.find((m) => m.key === key))
            .filter(Boolean)
            .filter((m) => !filter || `${m.label} ${m.group} ${m.table}`.toLowerCase().includes(filter));
        if (!items.length) return "";
        const isCollapsed = collapsed[section.id];
        return `<div class="nav-group ${isCollapsed ? "collapsed" : ""}" data-section="${section.id}">
            <button class="nav-group-title" type="button" data-toggle-section="${section.id}">
                <span class="nav-label">${section.label}</span>
                <svg class="nav-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <div class="nav-group-items">${items.map((m) => navItemHtml(m)).join("")}</div>
        </div>`;
    }).join("");
    $("adminNav").querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => switchModule(button.dataset.key)));
    $("adminNav").querySelectorAll("[data-toggle-section]").forEach((button) => button.addEventListener("click", () => {
        const id = button.dataset.toggleSection;
        const state = JSON.parse(localStorage.getItem("admin-nav-collapsed") || "{}");
        state[id] = !state[id];
        localStorage.setItem("admin-nav-collapsed", JSON.stringify(state));
        renderNav(filter);
    }));
}

function navItemHtml(m) {
    const icon = NAV_ICONS[m.key] || NAV_ICONS.default;
    return `<button class="nav-item ${m.key === currentModule.key ? "active" : ""}" data-key="${m.key}" type="button">
        <span class="nav-icon">${icon}</span>
        <span class="nav-label">${m.label}</span>
    </button>`;
}

function switchModule(key) {
    currentModule = MODULES.find((m) => m.key === key) || MODULES[0];
    page = 1;
    renderNav($("sidebarSearch")?.value.trim().toLowerCase() || "");
    document.body.classList.remove("sidebar-open");
    $("pageTitle").textContent = currentModule.label;
    const isDashboard = key === "dashboard";
    $("dashboardView").classList.toggle("active", isDashboard);
    $("moduleView").classList.toggle("active", !isDashboard);
    if (isDashboard) loadDashboard();
    else loadModule();
}

async function loadDashboard() {
    const name = localAdmin.name || localAdmin.email || "Admin";
    $("dashGreeting").textContent = `Signed in as ${name}`;

    if (!isCmsAvailable()) {
        renderCmsSetupCard();
        $("dashRefreshed").textContent = "";
        bindDashboardLinks();
        return;
    }

    document.querySelector(".cms-setup-card")?.remove();

    showDashboardSkeletons();

    const cmsReady = isCmsAvailable();
    const statuses = [];
    for (const mod of DASHBOARD_MODULES) {
        statuses.push({ mod, ...(await adminTableCount(mod.table)) });
    }

    const [
        inquiriesProbe,
        admissionsProbe,
        mediaProbe,
        notices,
        admissions,
        inquiries,
        aiPromptsProbe,
        aiKnowledgeProbe,
        aiConversationsProbe,
        mediaFiles,
        recentChanges,
    ] = await Promise.all([
        adminTableCount("inquiries"),
        adminTableCount("admissions"),
        adminTableCount("media_library"),
        selectRows("notices", 5),
        selectRows("admissions", 5),
        selectRows("inquiries", 50),
        adminTableCount("ai_prompts"),
        adminTableCount("ai_knowledge_base"),
        adminTableCount("ai_conversations"),
        fetchMediaStorage(),
        fetchRecentChanges(),
    ]);

    const summary = resolveDashboardSummary(statuses);
    const pendingInquiries = inquiries.filter(isPendingInquiry);

    renderOverviewCards({ summary, statuses, inquiriesProbe, admissionsProbe, mediaProbe, pendingCount: pendingInquiries.length, cmsReady });
    renderQuickActions();
    renderRecentChanges(recentChanges, cmsReady);
    renderDatabaseHealth({ summary, statuses, cmsReady });
    renderStatusCards({ summary, mediaProbe, mediaFiles, aiPromptsProbe, aiKnowledgeProbe, aiConversationsProbe, cmsReady });
    renderLatestNotices(notices, cmsReady);
    renderLatestAdmissions(admissions, cmsReady);
    renderPendingInquiries(pendingInquiries, inquiriesProbe, cmsReady);
    renderContentImportBanner(statuses);
    await renderWriteCapabilityBanner();

    $("dashRefreshed").textContent = `Updated ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
    bindDashboardLinks();
}

function showDashboardSkeletons() {
    $("overviewCards").innerHTML = Array.from({ length: 4 }, () => `<div class="overview-card skeleton"></div>`).join("");
    $("quickActions").innerHTML = `<div class="skeleton"></div>`.repeat(4);
    ["recentChanges", "databaseHealth", "statusCards", "latestNotices", "latestAdmissions", "pendingInquiries"].forEach((id) => {
        const el = $(id);
        if (el) el.innerHTML = `<div class="skeleton"></div>`.repeat(3);
    });
}

function renderCmsSetupCard() {
    const missing = getMissingTables();
    const stats = getCmsTableStats();
    const detail = missing.length
        ? `The database is missing <strong>${missing.length}</strong> CMS table${missing.length === 1 ? "" : "s"}${missing.includes("settings") ? " (including <code>settings</code>)" : ""}.`
        : "The CMS connection could not be verified. Click <strong>Check connection</strong> to retry.";

    $("overviewCards").innerHTML = "";
    $("quickActions").innerHTML = "";
    ["recentChanges", "databaseHealth", "statusCards", "latestNotices", "latestAdmissions", "pendingInquiries"].forEach((id) => {
        const el = $(id);
        if (el) el.innerHTML = "";
    });

    const setupHost = $("dashboardView");
    let card = setupHost.querySelector(".cms-setup-card");
    if (!card) {
        card = document.createElement("div");
        card.className = "glass-card cms-setup-card";
        setupHost.insertBefore(card, setupHost.querySelector(".overview-grid"));
    }
    const diag = getLastConnectionDiagnostics();
    const probeMeta = diag
        ? `Tables found: ${stats.found}/${stats.total} · Storage: ${diag.storage?.ok ? "ready" : "unavailable"} · RPC: ${diag.rpc?.ok ? "ready" : "unavailable"}`
        : `Tables found: ${stats.found}/${stats.total}`;
    card.innerHTML = `
        <div class="cms-setup-inner">
            <p class="eyebrow accent">Database setup</p>
            <h2>Install the CMS schema</h2>
            <p class="dash-lead">${detail} Check your connection and try again.</p>
            <div class="cms-setup-actions">
                <button type="button" class="btn-primary" id="retryCmsBtn">Retry connection</button>
            </div>
            <p class="muted cms-setup-meta">Project: rhqmquaojetmzdznbevz.supabase.co · ${esc(probeMeta)}</p>
        </div>`;
}

function bindDashboardLinks() {
    document.querySelectorAll("#dashboardView [data-key]").forEach((btn) => {
        btn.onclick = () => switchModule(btn.dataset.key);
    });
    const retry = $("retryCmsBtn");
    if (retry) {
        retry.onclick = async () => {
            resetCmsStatus();
            cmsConnection = await connectCms({ force: true });
            updateConnectionBanner();
            loadDashboard();
            updatePendingBar();
            updateSystemStatus();
        };
    }
}

function renderOverviewCards({ summary, statuses, inquiriesProbe, admissionsProbe, mediaProbe, pendingCount, cmsReady }) {
    const configured = summary.configured;
    const reachable = statuses.filter((s) => s.ok).length;
    const missing = statuses.filter((s) => s.reason === "missing_table").length;
    const cards = [
        {
            label: "Configured Modules",
            value: cmsReady ? String(configured) : String(reachable),
            meta: cmsReady
                ? `${statuses.length} CMS modules tracked`
                : (missing ? `${missing} table(s) missing — run migration` : `${reachable}/${statuses.length} modules reachable`),
            tone: cmsReady && configured > 0 ? "ok" : cmsReady ? "neutral" : reachable > 0 ? "warn" : "setup",
        },
        {
            label: "Pending Inquiries",
            value: inquiriesProbe.ok ? String(pendingCount) : "—",
            meta: inquiriesProbe.ok ? (pendingCount ? "Awaiting response" : "No pending inquiries") : unavailableMeta(inquiriesProbe),
            tone: pendingCount > 0 ? "warn" : inquiriesProbe.ok ? "ok" : "setup",
        },
        {
            label: "Admission Forms",
            value: admissionsProbe.ok ? String(admissionsProbe.count || 0) : "—",
            meta: admissionsProbe.ok
                ? ((admissionsProbe.count || 0) ? "Submitted applications" : "No applications yet")
                : unavailableMeta(admissionsProbe),
            tone: admissionsProbe.ok && (admissionsProbe.count || 0) > 0 ? "ok" : "neutral",
        },
        {
            label: "Media Assets",
            value: mediaProbe.ok ? String(mediaProbe.count || 0) : "—",
            meta: mediaProbe.ok
                ? ((mediaProbe.count || 0) ? "Files in media library" : "Library is empty")
                : unavailableMeta(mediaProbe),
            tone: mediaProbe.ok && (mediaProbe.count || 0) > 0 ? "ok" : "neutral",
        },
    ];

    $("overviewCards").innerHTML = cards.map((card) => `
        <article class="overview-card tone-${card.tone}">
            <p class="overview-label">${esc(card.label)}</p>
            <p class="overview-value">${esc(card.value)}</p>
            <p class="overview-meta muted">${esc(card.meta)}</p>
        </article>
    `).join("");
}

function renderQuickActions() {
    if (!isCmsAvailable()) {
        $("quickActions").innerHTML = "";
        return;
    }
    const actions = [
        { key: "notices", label: "Add Notice", hint: "Publish announcements" },
        { key: "updates", label: "Post Update", hint: "Homepage timeline" },
        { key: "admissions", label: "Review Admissions", hint: "Application queue" },
        { key: "inquiries", label: "Reply Inquiries", hint: "Pending messages" },
        { key: "media_library", label: "Upload Media", hint: "Images & documents" },
        { key: "settings", label: "Website Settings", hint: "Appearance & info" },
    ];
    $("quickActions").innerHTML = actions.map((action) => `
        <button type="button" class="quick-action-btn" data-key="${action.key}">
            <strong>${esc(action.label)}</strong>
            <span>${esc(action.hint)}</span>
        </button>
    `).join("");
}

async function fetchRecentChanges() {
    if (!isCmsAvailable()) return [];
    const tables = [
        { table: "updates", label: "Update", titleKey: "title" },
        { table: "notices", label: "Notice", titleKey: "title" },
        { table: "courses", label: "Course", titleKey: "title" },
        { table: "admissions", label: "Admission", titleKey: "student_name" },
        { table: "inquiries", label: "Inquiry", titleKey: "name" },
        { table: "contacts", label: "Contact", titleKey: "name" },
    ];
    const batches = await Promise.all(tables.map(async ({ table, label, titleKey }) => {
        const rows = await selectRows(table, 4);
        return rows.map((row) => ({
            table,
            label,
            title: row[titleKey] || row.title || row.name || row.student_name || "Untitled",
            when: row.updated_at || row.created_at,
            status: row.status || (row.published === false ? "draft" : "published"),
        }));
    }));
    return batches.flat().sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0)).slice(0, 8);
}

function renderRecentChanges(items, cmsReady) {
    const target = $("recentChanges");
    if (!cmsReady) {
        target.innerHTML = emptyState("Connect CMS to see recent content changes.");
        return;
    }
    if (!items.length) {
        target.innerHTML = emptyState("No content changes recorded yet.");
        return;
    }
    target.innerHTML = items.map((item) => `
        <div class="activity-item">
            <strong>${esc(item.title)}</strong>
            <span class="muted">${esc(item.label)} · ${esc(item.status)} · ${formatDate(item.when)}</span>
        </div>
    `).join("");
}

function renderContentImportBanner() {
    const banner = $("contentImportBanner");
    if (banner) banner.hidden = true;
}

function bindContentImportActions() {
    const importBtn = $("importDefaultContentBtn");
    const copyBtn = $("copyCmsSqlBtn");
    if (importBtn && !importBtn.dataset.bound) {
        importBtn.dataset.bound = "1";
        importBtn.addEventListener("click", async () => {
            importBtn.disabled = true;
            importBtn.textContent = "Importing…";
            try {
                const result = await bootstrapCmsContentIfNeeded({ force: true });
                if (result.seeded || result.reason === "already_has_content" || result.reason === "already_seeded") {
                    clearCmsQueryCache();
                    await loadDashboard();
                    if (!isCmsAvailable()) return;
                    const moduleKey = currentModule?.key;
                    if (moduleKey && moduleKey !== "dashboard") await loadModule();
                    return;
                }
                const msg = $("contentImportMessage");
                if (msg) {
                    msg.textContent = result.reason === "permission"
                        ? "Could not import — sign in again, then retry."
                        : `Import failed: ${mapCrudReason(result.reason || "error")}`;
                }
            } finally {
                importBtn.disabled = false;
                importBtn.textContent = "Import Website Content";
            }
        });
    }
    if (copyBtn && !copyBtn.dataset.bound) {
        copyBtn.dataset.bound = "1";
        copyBtn.hidden = true;
    }
}

async function renderWriteCapabilityBanner() {
    const bar = $("pendingBar");
    if (bar) bar.hidden = true;
}

async function importDefaultWebsiteContent() {
    const btn = $("importDefaultContentBtn");
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Importing…";
    }
    try {
        const result = await bootstrapCmsContentIfNeeded({ force: true });
        if (result.seeded || result.reason === "already_has_content" || result.reason === "already_seeded") {
            clearCmsQueryCache();
            toast(result.seeded ? "Website content imported successfully." : "CMS content is already in Supabase.");
            await loadDashboard();
            if (isCmsAvailable() && currentModule?.key && currentModule.key !== "dashboard") {
                await loadModule();
            }
            return;
        }
        const hint = mapCrudReason(result.reason || "error");
        toast(hint, true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Import Website Content";
        }
    }
}

function renderDatabaseHealth({ summary, statuses, cmsReady }) {
    const stats = getCmsTableStats();
    const missing = getMissingTables();
    const ready = statuses.filter((s) => s.ok).length;
    const diag = getLastConnectionDiagnostics();
    const rows = [
        ["Connection", cmsReady ? "Connected" : summary.database],
        ["Tables found", `${stats.found} / ${stats.total}`],
        ["Missing tables", missing.length ? missing.slice(0, 5).join(", ") + (missing.length > 5 ? ` +${missing.length - 5}` : "") : "None"],
        ["Storage", diag?.storage?.ok ? "Ready" : (cmsReady ? "Ready" : "—")],
        ["Configured modules", cmsReady ? String(summary.configured) : String(statuses.filter((s) => (s.count || 0) > 0).length)],
        ["Needs attention", cmsReady ? String(summary.attention) : String(missing.length || summary.attention)],
    ];
    $("databaseHealth").innerHTML = rows.map(([label, value]) => `
        <div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>
    `).join("");
}

function renderStatusCards({ summary, mediaProbe, mediaFiles, aiPromptsProbe, aiKnowledgeProbe, aiConversationsProbe, cmsReady }) {
    const stats = getCmsTableStats();
    const diag = getLastConnectionDiagnostics();
    const storageReady = diag?.storage?.ok || mediaProbe.ok;
    const cmsLabel = cmsReady ? "Connected" : getCmsStatusLabel();
    const cmsDetail = cmsReady
        ? `✓ Connected · ✓ ${stats.found}/${stats.total} Tables Found · ✓ ${storageReady ? "Storage Ready" : "Storage —"} · ✓ Database Ready`
        : (getMissingTables().length
            ? `${getMissingTables().length} modules unavailable`
            : "Checking database…");

    const storageValue = mediaProbe.ok && mediaFiles.totalBytes > 0
        ? formatBytes(mediaFiles.totalBytes)
        : mediaProbe.ok && (mediaProbe.count || 0) > 0
        ? `${mediaProbe.count} files`
        : mediaProbe.ok
        ? "Empty"
        : "—";
    const storageDetail = mediaProbe.ok
        ? ((mediaProbe.count || 0) ? `${mediaProbe.count} assets indexed` : "No uploads yet")
        : unavailableMeta(mediaProbe);

    const aiConfigured = aiPromptsProbe.ok && (aiPromptsProbe.count || 0) > 0;
    const aiDetail = !aiPromptsProbe.ok
        ? unavailableMeta(aiPromptsProbe)
        : aiConfigured
        ? `${aiKnowledgeProbe.ok ? aiKnowledgeProbe.count || 0 : 0} knowledge entries`
        : "No prompts configured";

    const cards = [
        { title: "CMS Status", value: cmsLabel, detail: cmsDetail, tone: cmsReady ? "ok" : "setup" },
        { title: "Storage Usage", value: storageValue, detail: storageDetail, tone: mediaProbe.ok && (mediaProbe.count || 0) > 0 ? "ok" : "neutral" },
        {
            title: "AI Status",
            value: !aiPromptsProbe.ok ? "—" : aiConfigured ? "Configured" : "Not configured",
            detail: aiDetail + (aiConversationsProbe.ok ? ` · ${aiConversationsProbe.count || 0} chats` : ""),
            tone: aiConfigured ? "ok" : aiPromptsProbe.ok ? "neutral" : "setup",
        },
        {
            title: "System Status",
            value: "Online",
            detail: `${localAdmin.role || "admin"} · ${document.body.dataset.theme || "light"} theme`,
            tone: "ok",
        },
    ];

    $("statusCards").innerHTML = cards.map((card) => `
        <article class="status-card tone-${card.tone}">
            <p class="status-card-label">${esc(card.title)}</p>
            <p class="status-card-value">${esc(card.value)}</p>
            <p class="status-card-detail muted">${esc(card.detail)}</p>
        </article>
    `).join("");
}

function renderLatestNotices(notices, cmsReady) {
    const target = $("latestNotices");
    if (!cmsReady) {
        target.innerHTML = emptyState("CMS not connected.");
        return;
    }
    if (!notices.length) {
        target.innerHTML = emptyState("No notices published yet.");
        return;
    }
    target.innerHTML = notices.map((row) => `
        <div class="list-item">
            <strong>${esc(row.title || "Untitled notice")}</strong>
            <span class="muted">${formatDate(row.date || row.created_at)}${row.important ? " · Important" : ""}</span>
        </div>
    `).join("");
}

function renderLatestAdmissions(admissions, cmsReady) {
    const target = $("latestAdmissions");
    if (!cmsReady) {
        target.innerHTML = emptyState("CMS not connected.");
        return;
    }
    if (!admissions.length) {
        target.innerHTML = emptyState("No admission applications yet.");
        return;
    }
    target.innerHTML = admissions.map((row) => `
        <div class="list-item">
            <strong>${esc(row.student_name || "Applicant")}</strong>
            <span class="muted">${esc(row.course || "Course pending")} · ${esc(row.application_status || row.status || "new")} · ${formatDate(row.created_at)}</span>
        </div>
    `).join("");
}

function renderPendingInquiries(inquiries, probe, cmsReady) {
    const target = $("pendingInquiries");
    if (!cmsReady) {
        target.innerHTML = emptyState("CMS not connected.");
        return;
    }
    if (!probe.ok) {
        target.innerHTML = emptyState(unavailableMeta(probe));
        return;
    }
    if (!inquiries.length) {
        target.innerHTML = emptyState("No pending inquiries.");
        return;
    }
    target.innerHTML = inquiries.slice(0, 6).map((row) => `
        <div class="list-item">
            <strong>${esc(row.name || "Inquiry")}</strong>
            <span class="muted">${esc(row.course || row.phone || row.email || "No contact")} · ${esc(row.reply_status || row.status || "pending")} · ${formatDate(row.created_at)}</span>
        </div>
    `).join("");
}

async function fetchMediaStorage() {
    const result = await safeFetch("media_library", (q) => q.select("size_bytes"), []);
    if (!result.ok || !result.data?.length) return { totalBytes: 0 };
    const totalBytes = result.data.reduce((sum, row) => sum + Number(row.size_bytes || 0), 0);
    return { totalBytes };
}

function isPendingInquiry(row) {
    const reply = String(row.reply_status || "").toLowerCase();
    const status = String(row.status || "").toLowerCase();
    return reply === "pending" || status === "new" || status === "assigned" || status === "follow-up";
}

function unavailableMeta(probe) {
    if (probe.reason === "missing_table") return "Table missing";
    if (probe.reason === "not_configured") return "Not configured";
    return "Unavailable";
}

function emptyState(message) {
    return `<p class="empty-state">${esc(message)}</p>`;
}

async function adminTableCount(table) {
    const result = await safeCount(table, `admin:count:${table}`);
    if (result.ok) {
        return { count: result.count ?? 0, ok: true };
    }
    return { count: null, ok: false, reason: result.reason || "error" };
}

function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (!value) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
    const size = value / 1024 ** index;
    return `${size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
}

function resolveModuleStatus({ ok, reason, count }) {
    if (reason === "not_configured") {
        return { label: "Needs Setup", class: "status-setup" };
    }
    if (!ok && reason === "missing_table") {
        return { label: "Missing Table", class: "status-missing" };
    }
    if (!ok) {
        return { label: "Needs Setup", class: "status-setup" };
    }
    if ((count || 0) > 0) {
        return { label: "Configured", class: "status-ok" };
    }
    return { label: "Empty", class: "status-empty" };
}

function resolveDashboardSummary(statuses) {
    let configured = 0;
    let empty = 0;
    let attention = 0;
    statuses.forEach((s) => {
        const { label } = resolveModuleStatus(s);
        if (label === "Configured") configured += 1;
        else if (label === "Empty") empty += 1;
        else attention += 1;
    });
    const database = getCmsStatusLabel();
    return { database, configured, empty, attention };
}

async function loadModule() {
    $("moduleKicker").textContent = currentModule.group || "CMS Module";
    $("moduleTitle").textContent = currentModule.label;
    $("exportCsvBtn").hidden = !currentModule.export;
    $("bulkPublishBtn").hidden = !currentModule.fields?.some((f) => f.includes("published"));
    $("bulkUnpublishBtn").hidden = $("bulkPublishBtn").hidden;
    $("bulkDeleteBtn").hidden = Boolean(currentModule.readonly);
    $("addRecordBtn").style.display = currentModule.readonly ? "none" : "";
    $("moduleTable").innerHTML = skeletonTable();
    renderModuleContext();

    if (!isCmsAvailable()) {
        const missing = getTableStatus(currentModule.table) === "missing" || getMissingTables().includes(currentModule.table);
        $("moduleTable").innerHTML = `<div class="empty-state setup-state"><strong>${missing ? "Module unavailable" : "CMS unavailable"}</strong><p>${missing ? `The <code>${esc(currentModule.table)}</code> table is not available.` : "Check your connection and try again."}</p><button class="btn-primary" type="button" id="moduleSetupRetry">Retry</button></div>`;
        $("moduleSetupRetry")?.addEventListener("click", async () => {
            resetCmsStatus();
            cmsConnection = await connectCms({ force: true });
            updateConnectionBanner();
            updateSystemStatus();
            if (isCmsAvailable()) loadModule();
            else switchModule("dashboard");
        });
        return;
    }

    const probe = await adminTableCount(currentModule.table);
    if (!probe.ok && (probe.reason === "missing_table" || probe.reason === "not_configured")) {
        $("moduleTable").innerHTML = `<div class="empty-state setup-state"><strong>Module unavailable</strong><p>The <code>${esc(currentModule.table)}</code> table could not be reached. Check your connection and try again.</p><button class="btn-primary" type="button" id="moduleSetupRetry">Retry</button></div>`;
        return;
    }
    rows = await selectRows(currentModule.table, 250, false);
    renderTable();
}


function renderModuleContext() {
    const target = $("moduleContext");
    if (!target) return;

    if (currentModule.key === "settings") {
        target.innerHTML = `<div class="context-card appearance-card">
            <div>
                <p class="eyebrow">Website Settings</p>
                <h3>Mission, Vision & Branding</h3>
                <p>Edit institute mission, vision, objectives and footer developer credits via settings keys.</p>
            </div>
            <div class="appearance-actions">
                <button type="button" class="btn-ghost" data-settings-key="mission">Mission</button>
                <button type="button" class="btn-ghost" data-settings-key="vision">Vision</button>
                <button type="button" class="btn-ghost" data-settings-key="objectives">Objectives</button>
                <button type="button" class="btn-ghost" data-settings-key="core_values">Core Values</button>
                <button type="button" class="btn-ghost" data-appearance="home_slides">Hero Slides</button>
                <button type="button" class="btn-ghost" data-appearance="footer_blocks">Footer Blocks</button>
            </div>
        </div>
        <div class="context-card">
            <div><p class="eyebrow">System</p><h3>Institute Settings</h3><p>Contact info, social links, office hours and site metadata.</p></div>
            <div><span>Institute Info</span><span>Contact</span><span>Social</span><span>Map</span></div>
        </div>`;
        target.querySelectorAll("[data-appearance]").forEach((btn) => btn.addEventListener("click", () => switchModule(btn.dataset.appearance)));
        target.querySelectorAll("[data-settings-key]").forEach((btn) => btn.addEventListener("click", () => {
            $("globalSearch").value = btn.dataset.settingsKey;
            page = 1;
            renderTable();
        }));
        return;
    }

    const templates = {
        ai_knowledge_base: ["Knowledge Base", "Categories", "Publish", "Search"],
        ai_prompts: ["Greeting", "Fallback", "Quick Replies", "Response Delay"],
        ai_conversations: ["Chat History", "Ratings", "Export", "Review"],
        media_library: ["Upload", "Folders", "Preview", "Replace"],
        gallery: ["Albums", "Featured", "Categories", "Publish"],
        notices: ["Pinned", "Priority", "Expiry", "Attachments"],
        updates: ["Timeline", "Categories", "Featured", "Publish"],
        admissions: ["Review", "Status", "Export", "Contact"],
        settings: ["Institute Info", "Contact", "Social", "Map"],
    };
    const items = templates[currentModule.key] || ["Draft / Publish", "Search", "Export"];
    target.innerHTML = `<div class="context-card"><div><p class="eyebrow">${esc(currentModule.group || "Module")}</p><h3>${esc(currentModule.label)}</h3><p>Manage records, publishing state, and metadata from Supabase.</p></div><div>${items.map((item) => `<span>${item}</span>`).join("")}</div></div>`;
}
async function selectRows(table, limit = 250, publishedOnly = false) {
    const result = await safeAdminSelect(table, (q) => {
        let query = q.select("*").limit(limit);
        if (publishedOnly) query = query.eq("published", true);
        if (hasDisplayOrder(table)) query = query.order("display_order", { ascending: true, nullsFirst: false });
        return query.order("created_at", { ascending: false });
    }, []);
    if (result.ok && Array.isArray(result.data)) {
        return result.data;
    }
    if (result.reason === "permission") {
        const fallback = await safeFetch(table, (q) => {
            let query = q.select("*").limit(limit);
            if (publishedOnly) query = query.eq("published", true);
            if (hasDisplayOrder(table)) query = query.order("display_order", { ascending: true, nullsFirst: false });
            return query.order("created_at", { ascending: false });
        }, [], `admin:fallback:${table}`);
        if (fallback.ok && Array.isArray(fallback.data)) return fallback.data;
    }
    if (!result.ok) {
        console.error(`[CMS] Admin read failed for ${table}:`, result.reason || "unknown");
    }
    return [];
}

function renderTable() {
    const filtered = filterRows(rows);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, totalPages);
    const data = filtered.slice((page - 1) * pageSize, page * pageSize);
    $("recordCount") && ($("recordCount").textContent = `${filtered.length} record${filtered.length === 1 ? "" : "s"}`);
    if (!data.length) {
        $("moduleTable").innerHTML = `<div class="empty-state setup-state"><strong>No content yet</strong><p>Create your first ${esc(currentModule.label)} record. Published items appear on the public website automatically.</p><button class="btn-primary" type="button" id="emptyAddBtn">Create New</button></div>`;
        $("emptyAddBtn")?.addEventListener("click", () => openEditor());
        return;
    }
    const keys = visibleKeys(data[0]);
    const hasPublish = currentModule.fields?.some((f) => f.includes("published"));
    const canReorder = hasDisplayOrder(currentModule.table);
    $("moduleTable").innerHTML = `<table class="data-table"><thead><tr>${canReorder ? "<th>Order</th>" : ""}${keys.map((k) => `<th>${label(k)}</th>`).join("")}<th>Actions</th></tr></thead><tbody>${data.map((row) => `<tr>${canReorder ? `<td class="reorder-cell"><button class="mini-btn" data-move-up="${row.id}" title="Move up">↑</button><button class="mini-btn" data-move-down="${row.id}" title="Move down">↓</button><span class="muted">${esc(String(row.display_order ?? ""))}</span></td>` : ""}${keys.map((k) => cell(row, k)).join("")}<td><div class="table-actions">
        <button class="mini-btn" data-edit="${row.id}">Edit</button>
        <button class="mini-btn" data-preview="${row.id}">Preview</button>
        ${hasPublish ? `<button class="mini-btn" data-toggle="${row.id}">${row.published ? "Unpublish" : "Publish"}</button>` : ""}
        <button class="mini-btn" data-dup="${row.id}">Duplicate</button>
        <button class="mini-btn danger" data-delete="${row.id}">Delete</button>
    </div></td></tr>`).join("")}</tbody></table>
    <div class="pagination"><button class="mini-btn" id="prevPage" ${page === 1 ? "disabled" : ""}>Prev</button><span>Page ${page} of ${totalPages}</span><button class="mini-btn" id="nextPage" ${page === totalPages ? "disabled" : ""}>Next</button></div>`;
    $("moduleTable").querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => openEditor(rows.find((r) => String(r.id) === b.dataset.edit))));
    $("moduleTable").querySelectorAll("[data-preview]").forEach((b) => b.addEventListener("click", () => previewRecord(b.dataset.preview)));
    $("moduleTable").querySelectorAll("[data-move-up]").forEach((b) => b.addEventListener("click", () => reorderRecord(b.dataset.moveUp, -1)));
    $("moduleTable").querySelectorAll("[data-move-down]").forEach((b) => b.addEventListener("click", () => reorderRecord(b.dataset.moveDown, 1)));
    $("moduleTable").querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", () => togglePublished(b.dataset.toggle)));
    $("moduleTable").querySelectorAll("[data-dup]").forEach((b) => b.addEventListener("click", () => duplicateRecord(b.dataset.dup)));
    $("moduleTable").querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => deleteRecord(b.dataset.delete)));
    $("prevPage")?.addEventListener("click", () => { page--; renderTable(); });
    $("nextPage")?.addEventListener("click", () => { page++; renderTable(); });
}

function filterRows(source) {
    const q = ($("globalSearch")?.value || "").trim().toLowerCase();
    const status = window.__statusFilter || $("statusFilter")?.value || "";
    const sort = $("sortFilter")?.value || "newest";
    let result = source.filter((row) => {
        if (q && !JSON.stringify(row).toLowerCase().includes(q)) return false;
        if (!status) return true;
        if (status === "published") return row.published !== false;
        if (status === "draft") return row.published === false;
        return row.status === status || String(row.published) === status;
    });
    if (sort === "oldest") result = [...result].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    else if (sort === "order") result = [...result].sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
    else result = [...result].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return result;
}

function visibleKeys(row) {
    const preferred = currentModule.fields.map((f) => f.split(":")[0]).filter((k) => k in row && !k.endsWith("_url"));
    const media = currentModule.fields.map((f) => f.split(":")[0]).find((k) => k.includes("image_url") || k.includes("photo_url") || k.includes("pdf_url"));
    return [media, ...preferred, "created_at"].filter(Boolean).filter((k, i, arr) => arr.indexOf(k) === i).slice(0, 8);
}

function cell(row, key) {
    const value = row[key];
    if (key.includes("image_url") || key.includes("photo_url")) return `<td>${value ? `<img class="thumb" src="${esc(value)}" alt="Preview">` : "-"}</td>`;
    if (key.includes("pdf_url")) return `<td>${value ? `<a href="${esc(value)}" target="_blank">PDF</a>` : "-"}</td>`;
    if (key === "status" || key === "published") return `<td><span class="status-pill ${value === false || value === "draft" ? "badge-warn" : ""}">${esc(String(value ?? "new"))}</span></td>`;
    if (key === "created_at" || key === "date") return `<td><span class="muted">${formatDate(value)}</span></td>`;
    return `<td class="${key.includes("title") || key.includes("name") ? "row-title" : ""}">${esc(String(value ?? "")).slice(0, 140)}</td>`;
}

function openEditor(row = null) {
    if (!currentModule.fields?.length) return toast("This module is read-only.", true);
    editingRow = row;
    editorDirty = false;
    $("dialogTitle").textContent = row ? `Edit ${currentModule.label}` : `Add ${currentModule.label}`;
    $("dialogKicker").textContent = currentModule.table;
    $("autosaveStatus").textContent = "";
    $("editorFields").innerHTML = currentModule.fields.map((field) => renderField(field, row)).join("");
    $("editorDialog").showModal();
    $("editorFields").querySelectorAll("input[type=file]").forEach((input) => input.addEventListener("change", previewUpload));
    bindRichTextTools();
    bindDropZones();
}

function renderField(def, row) {
    const [name, type = "text"] = def.split(":");
    const value = row?.[name] ?? defaultValue(name, type);
    const full = ["rich", "json", "image", "file"].includes(type) || name === "value" ? " full" : "";
    if (type === "rich") return `<label class="field${full}"><span>${label(name)}</span><div class="rich-tools"><button type="button" data-wrap="strong">B</button><button type="button" data-wrap="em">I</button></div><textarea name="${name}">${esc(value)}</textarea></label>`;
    if (type === "json") return `<label class="field full"><span>${label(name)}</span><textarea name="${name}">${esc(typeof value === "object" ? JSON.stringify(value, null, 2) : value)}</textarea></label>`;
    if (type === "image" || type === "file") return `<label class="field${full} upload-field"><span>${label(name)}</span>${value ? `<a href="${esc(value)}" target="_blank">Current file</a><img class="preview ${type === "file" ? "hide" : ""}" src="${esc(value)}" alt="Preview">` : `<img class="preview hide" alt="Preview">`}<input name="${name}" type="hidden" value="${esc(value)}"><input data-upload-for="${name}" type="file" accept="${type === "file" ? "application/pdf" : "image/*"}"><small>Drag/drop supported by browser file picker. Old Storage objects are deleted after replacement when they are in the cms bucket.</small></label>`;
    if (["select", "selectCategory", "reply", "lead", "role", "userStatus", "priority", "applicationStatus", "paymentStatus", "mediaType"].includes(type)) return selectField(name, type, value);
    if (type === "boolean") return `<label class="field"><span>${label(name)}</span><select name="${name}"><option value="true" ${value !== false ? "selected" : ""}>Publish / Yes</option><option value="false" ${value === false ? "selected" : ""}>Hide / No</option></select></label>`;
    return `<label class="field${full}"><span>${label(name)}</span><input name="${name}" type="${type}" value="${esc(value)}"></label>`;
}

function selectField(name, type, value) {
    const sets = { select: ["published", "draft", "scheduled", "archived", "hidden"], selectCategory: ["Campus", "Labs", "Sports", "Events", "Workshops", "Industrial Visits", "Functions"], reply: ["pending", "replied", "follow-up", "archived"], lead: ["new", "assigned", "read", "approved", "rejected", "closed"], role: ["super_admin", "admin", "editor", "staff"], userStatus: ["active", "inactive", "suspended"], priority: ["low", "normal", "high", "urgent"], applicationStatus: ["new", "under_review", "approved", "rejected", "waitlisted"], paymentStatus: ["pending", "paid", "failed", "refunded"], mediaType: ["image", "video", "pdf", "document", "other"] };
    return `<label class="field"><span>${label(name)}</span><select name="${name}">${sets[type].map((o) => `<option value="${o}" ${String(value) === o ? "selected" : ""}>${o}</option>`).join("")}</select></label>`;
}

function bindRichTextTools() {
    $("editorFields").querySelectorAll("[data-wrap]").forEach((button) => button.addEventListener("click", () => {
        const textarea = button.closest(".field").querySelector("textarea");
        const tag = button.dataset.wrap;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value.slice(start, end) || "text";
        textarea.setRangeText(`<${tag}>${text}</${tag}>`, start, end, "end");
        textarea.focus();
    }));
}

function bindDropZones() {
    $("editorFields").querySelectorAll(".upload-field").forEach((zone) => {
        const input = zone.querySelector("input[type=file]");
        ["dragenter", "dragover"].forEach((type) => zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.add("drag-over"); }));
        ["dragleave", "drop"].forEach((type) => zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.remove("drag-over"); }));
        zone.addEventListener("drop", (event) => {
            if (!event.dataTransfer.files.length) return;
            input.files = event.dataTransfer.files;
            input.dispatchEvent(new Event("change", { bubbles: true }));
        });
    });
}
async function previewUpload(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    const field = input.dataset.uploadFor;
    const hidden = input.parentElement.querySelector(`input[name="${field}"]`);
    const preview = input.parentElement.querySelector(".preview");
    if (preview && file.type.startsWith("image/")) { preview.src = URL.createObjectURL(file); preview.classList.remove("hide"); }
    hidden.dataset.fileName = file.name;
    hidden.dataset.pendingUpload = "true";
}

async function saveRecord(event) {
    event.preventDefault();
    if (!(await requireWriteSession())) return;
    const form = event.target;
    const allowed = new Set(currentModule.fields.map((f) => f.split(":")[0]));
    const payload = {};
    for (const fieldDef of currentModule.fields) {
        const [name, type = "text"] = fieldDef.split(":");
        const hidden = form.querySelector(`input[name="${name}"][type="hidden"]`);
        const control = form.querySelector(`[name="${name}"]`);
        if (!control && !hidden) continue;

        const hiddenPending = hidden?.dataset.pendingUpload === "true";
        if (hiddenPending) {
            const fileInput = form.querySelector(`[data-upload-for="${name}"]`);
            const file = fileInput?.files?.[0];
            payload[name] = await uploadFile(name, file, editingRow?.[name]);
            if (currentModule.table === "media_library" && file && name === "file_url") {
                payload.size_bytes = file.size;
            }
        } else if (type === "boolean") {
            payload[name] = control.value === "true";
        } else if (type === "number") {
            payload[name] = Number(control.value || 0);
        } else if (type === "json") {
            try { payload[name] = JSON.parse(control.value); } catch { payload[name] = control.value || ""; }
        } else {
            payload[name] = control.value ?? "";
        }
    }

    Object.keys(payload).forEach((key) => {
        if (!allowed.has(key)) delete payload[key];
    });

    if (!editingRow?.id) {
        if (allowed.has("status") && (!payload.status || payload.status === "draft")) payload.status = "published";
        if (allowed.has("published") && payload.published !== false) payload.published = true;
        if (allowed.has("display_order") && !Number(payload.display_order)) {
            const maxOrder = rows.reduce((max, row) => Math.max(max, Number(row.display_order || 0)), 0);
            payload.display_order = maxOrder + 1;
        }
    }

    try {
        let result;
        if (editingRow?.id) {
            result = await safeUpdate(currentModule.table, payload, { id: editingRow.id });
        } else {
            result = await safeInsert(currentModule.table, payload);
        }
        if (!result.ok) throw new Error(mapCrudReason(result.reason));
        editorDirty = false;
        $("autosaveStatus").textContent = "Saved";
        toast("Record saved successfully.");
        $("editorDialog").close();
        await loadModule();
    } catch (err) {
        toast(err?.message || `Could not save ${currentModule.label}.`, true);
    }
}

async function uploadFile(field, file, oldUrl) {
    if (!(await requireWriteSession())) throw new Error("Permission denied. Sign in again.");
    const client = await getAdminWriteClient();
    if (!client) throw new Error("Permission denied. Sign in again.");
    const folder = currentModule.folder || currentModule.key;
    const ext = file.name.split(".").pop();
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await client.storage.from("cms").upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data } = client.storage.from("cms").getPublicUrl(path);
    await deleteOldStorageObject(oldUrl);
    return data.publicUrl;
}

async function deleteOldStorageObject(url) {
    if (!url || !url.includes("/storage/v1/object/public/cms/")) return;
    const path = decodeURIComponent(url.split("/storage/v1/object/public/cms/")[1]);
    try {
        const client = await getAdminWriteClient();
        if (client) await client.storage.from("cms").remove([path]);
    } catch {}
}

async function togglePublished(id) {
    if (!(await requireWriteSession())) return;
    const row = rows.find((r) => String(r.id) === String(id));
    if (!row) return;
    const result = await safeUpdate(currentModule.table, { published: !row.published, status: !row.published ? "published" : "hidden" }, { id });
    if (!result.ok) return toast(mapCrudReason(result.reason), true);
    clearCmsQueryCache();
    toast(!row.published ? "Published." : "Unpublished.");
    await loadModule();
}

async function deleteRecord(id) {
    if (!(await requireWriteSession())) return;
    const row = rows.find((r) => String(r.id) === String(id));
    if (!(await confirmAction("Delete record?", "This will permanently delete the selected record and related CMS storage files."))) return;
    try {
        for (const key of Object.keys(row || {})) if (key.endsWith("_url")) await deleteOldStorageObject(row[key]);
        const result = await safeDelete(currentModule.table, { id });
        if (!result.ok) throw new Error(mapCrudReason(result.reason));
        clearCmsQueryCache();
        toast("Record deleted.");
        rows = rows.filter((r) => String(r.id) !== String(id));
        renderTable();
    } catch (err) { toast(err?.message || "Delete failed.", true); }
}

function exportCsv() {
    const data = filterRows(rows);
    const keys = [...new Set(data.flatMap(Object.keys))];
    const csv = [keys.join(","), ...data.map((row) => keys.map((k) => csvCell(row[k])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentModule.table}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function hasDisplayOrder(table) { return ["settings", "home_slides", "updates", "notices", "principal_message", "courses", "departments", "faculty", "facilities", "placements", "gallery", "ai_knowledge_base", "ai_prompts", "footer_blocks", "media_library"].includes(table); }
function csvCell(value) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
function showSkeleton(id, count) { $(id).innerHTML = Array.from({ length: count }, () => `<div class="skeleton"></div>`).join(""); }
function skeletonTable() { return `<div class="skeleton table-skeleton"></div><div class="skeleton table-skeleton"></div><div class="skeleton table-skeleton"></div>`; }
function defaultValue(name, type) { if (type === "select") return "published"; if (type === "boolean") return true; if (type === "number") return 0; if (type === "date") return new Date().toISOString().slice(0, 10); if (type === "color") return "#005b5b"; return ""; }
function formatDate(value) { return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-"; }
function label(key) { return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function esc(value) { const div = document.createElement("div"); div.textContent = value ?? ""; return div.innerHTML; }
function toast(message, error = false) {
    const region = $("toastRegion") || document.body;
    const el = document.createElement("div");
    el.className = `toast ${error ? "error" : ""}`;
    el.textContent = message;
    region.appendChild(el);
    setTimeout(() => el.remove(), 3200);
}

function previewRecord(id) {
    const row = rows.find((r) => String(r.id) === String(id));
    if (!row) return;
    const image = row.image_url || row.photo_url || row.department_image_url || row.file_url || row.thumbnail_url;
    if (image) {
        window.open(image.startsWith("http") || image.startsWith("assets/") ? (image.startsWith("http") ? image : `../${image}`) : image, "_blank");
        return;
    }
    const sectionMap = {
        home_slides: "../index.html#hero",
        updates: "../index.html#latest-updates",
        notices: "../index.html#notice-board",
        principal_message: "../index.html#principal",
        courses: "../index.html#courses",
        departments: "../index.html#departments",
        facilities: "../index.html#facilities",
        placements: "../index.html#placements",
        gallery: "../index.html#gallery",
        settings: "../index.html",
        footer_blocks: "../index.html",
        ai_knowledge_base: "../index.html",
        ai_prompts: "../index.html",
    };
    const url = sectionMap[currentModule.table] || "../index.html";
    window.open(url, "_blank");
}

async function reorderRecord(id, direction) {
    if (!(await requireWriteSession())) return;
    const sorted = [...filterRows(rows)].sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
    const index = sorted.findIndex((r) => String(r.id) === String(id));
    const target = index + direction;
    if (index < 0 || target < 0 || target >= sorted.length) return;
    const current = sorted[index];
    const swap = sorted[target];
    const currentOrder = Number(current.display_order ?? index);
    const swapOrder = Number(swap.display_order ?? target);
    try {
        await Promise.all([
            safeUpdate(currentModule.table, { display_order: swapOrder }, { id: current.id }),
            safeUpdate(currentModule.table, { display_order: currentOrder }, { id: swap.id }),
        ]);
        toast("Order updated.");
        await loadModule();
    } catch (err) {
        toast(err?.message || "Could not reorder.", true);
    }
}

async function duplicateRecord(id) {
    if (!(await requireWriteSession())) return;
    const row = rows.find((r) => String(r.id) === String(id));
    if (!row) return;
    const copy = { ...row };
    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;
    if ("title" in copy) copy.title = `${copy.title} (Copy)`;
    if ("name" in copy) copy.name = `${copy.name} (Copy)`;
    copy.published = false;
    copy.status = "draft";
    try {
        const result = await safeInsert(currentModule.table, copy);
        if (!result.ok) throw new Error(mapCrudReason(result.reason));
        toast("Record duplicated.");
        await loadModule();
    } catch (err) {
        toast(err?.message || "Duplicate failed.", true);
    }
}

async function bulkPublish() {
    if (!(await requireWriteSession())) return;
    const draftRows = filterRows(rows).filter((r) => r.published === false);
    if (!draftRows.length) return toast("No draft records to publish.");
    if (!(await confirmAction("Bulk publish?", `Publish ${draftRows.length} draft record(s)?`))) return;
    try {
        await Promise.all(draftRows.map((r) => safeUpdate(currentModule.table, { published: true, status: "published" }, { id: r.id })));
        clearCmsQueryCache();
        toast(`${draftRows.length} record(s) published.`);
        await loadModule();
    } catch (err) {
        toast(err?.message || "Bulk publish failed.", true);
    }
}

async function bulkUnpublish() {
    if (!(await requireWriteSession())) return;
    if (!currentModule.fields?.some((f) => f.includes("published"))) return;
    const publishedRows = filterRows(rows).filter((r) => r.published !== false);
    if (!publishedRows.length) return toast("No published records to unpublish.");
    if (!(await confirmAction("Bulk unpublish?", `Unpublish ${publishedRows.length} record(s)?`))) return;
    try {
        await Promise.all(publishedRows.map((r) => safeUpdate(currentModule.table, { published: false, status: "hidden" }, { id: r.id })));
        clearCmsQueryCache();
        toast(`${publishedRows.length} record(s) unpublished.`);
        await loadModule();
    } catch (err) {
        toast(err?.message || "Bulk unpublish failed.", true);
    }
}

async function bulkDelete() {
    if (!(await requireWriteSession())) return;
    if (currentModule.readonly) return;
    const targets = filterRows(rows);
    if (!targets.length) return toast("No records to delete.");
    if (!(await confirmAction("Bulk delete?", `Permanently delete ${targets.length} record(s)?`))) return;
    try {
        await Promise.all(targets.map((r) => safeDelete(currentModule.table, { id: r.id })));
        clearCmsQueryCache();
        toast(`${targets.length} record(s) deleted.`);
        await loadModule();
    } catch (err) {
        toast(err?.message || "Bulk delete failed.", true);
    }
}

async function requireWriteSession() {
    if (await ensureAdminWriteSession()) return true;
    toast("Sign in again to continue.", true);
    return false;
}

function showPendingBarMessage(message) {
    const bar = $("pendingBar");
    if (!bar) return;
    bar.hidden = false;
    bar.innerHTML = `<span class="count">${esc(message)}</span>`;
}

function toggleTheme() {
    const next = document.body.dataset.theme === "dark" ? "light" : "dark";
    document.body.dataset.theme = next;
    localStorage.setItem("admin-theme", next);
}

function openCommandPalette() {
    $("commandDialog").showModal();
    $("commandSearch").value = "";
    renderCommandResults();
    setTimeout(() => $("commandSearch").focus(), 30);
}

function renderCommandResults() {
    const q = ($("commandSearch")?.value || "").toLowerCase();
    const items = MODULES.filter((m) => m.key !== "dashboard" && (!q || `${m.label} ${m.group} ${m.table}`.toLowerCase().includes(q))).slice(0, 18);
    $("commandResults").innerHTML = items.map((m) => `<button type="button" data-key="${m.key}"><span>${m.icon}</span><strong>${m.label}</strong><small>${m.group || "CMS"}</small></button>`).join("") || `<p class="empty-state">No modules found.</p>`;
    $("commandResults").querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { $("commandDialog").close(); switchModule(button.dataset.key); }));
}

function confirmAction(title, message) {
    const dialog = $("confirmDialog");
    if (!dialog) return Promise.resolve(confirm(message));
    $("confirmTitle").textContent = title;
    $("confirmMessage").textContent = message;
    dialog.showModal();
    return new Promise((resolve) => {
        const done = (value) => {
            $("confirmCancel").removeEventListener("click", cancel);
            $("confirmOk").removeEventListener("click", ok);
            dialog.close();
            resolve(value);
        };
        const cancel = () => done(false);
        const ok = () => done(true);
        $("confirmCancel").addEventListener("click", cancel, { once: true });
        $("confirmOk").addEventListener("click", ok, { once: true });
    });
}

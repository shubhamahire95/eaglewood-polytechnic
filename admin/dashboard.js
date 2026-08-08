import { safeDelete, safeFetch, safeInsert, safeUpdate, supabase, connectCms, safeAdminSelect, safeCount, getCmsStatusLabel, resetCmsStatus, isCmsAvailable, getMissingTables, getCmsTableStats, getLastConnectionDiagnostics, hasAdminSession, ensureAdminWriteSession, ensureAdminWriteSessionOnLoad, getAdminWriteCapability, mapCrudReason, setCmsAdminMode, getTableStatus, clearCmsQueryCache, signOutAdmin, loadLegacyCredentials, tableHasDisplayOrder, adminStorageUpload, adminStorageRemove, getCmsStoragePublicUrl, notifyCmsDataChanged } from "../assets/js/supabase.js";
import { bootstrapCmsContentIfNeeded, isCmsContentEmpty } from "../assets/js/cms-bootstrap.js";
import { fetchCmsRows, cmsTableCount, cmsInsert, cmsUpdate, cmsDelete, cmsUpsert, bootstrapTableIfEmpty, bootstrapAllContentTables, clearCmsLocalCache, isContentTable, isUuid } from "../assets/js/cms-store.js";
import { fetchFormRows, formTableCount, isPublicFormTable, flushFormQueue } from "../assets/js/form-store.js";
import { initAdminUiPolish } from "../assets/js/ui-polish.js";
import { installGlobalErrorHandlers, mapApiError } from "../assets/js/errors.js";
import { openModal, closeModal, closeAllModals, isModalOpen } from "./modal-manager.js";
import { ensureMediaMap, getMediaMap, resolveAdminPreviewUrl, isRenderableImageUrl } from "../assets/js/media-url.js";
import { principalInstituteKey, principalProgramLabel } from "../assets/js/principal-content.js";

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

    { key: "principal_message", label: "Principal Message", table: "principal_message", folder: "principal", group: "Website", fields: ["photo_url:image", "name", "qualification", "designation", "institute:instituteType", "message:rich", "published:boolean", "display_order:number", "status:select"] },
    { key: "updates", label: "Updates", table: "updates", folder: "updates", group: "Website", fields: ["icon", "title", "description:rich", "image_url:image", "date:date", "category", "pinned:boolean", "button_label", "button_url", "color:color", "published:boolean", "status:select", "display_order:number"] },
    { key: "notices", label: "Important Notices", table: "notices", folder: "notices", group: "Website", fields: ["title", "description:rich", "pdf_url:file", "attachment_url:file", "image_url:image", "date:date", "expiry_date:date", "priority:priority", "important:boolean", "is_new:boolean", "published:boolean", "status:select", "display_order:number"] },
    { key: "downloads", label: "Downloads", table: "downloads", folder: "downloads", group: "Website", fields: ["title", "description:rich", "file_url:file", "file_type:downloadType", "category:downloadCategory", "published:boolean", "status:select", "display_order:number"] },

    { key: "courses", label: "Courses", table: "courses", folder: "courses", group: "Website", fields: ["department", "image_url:image", "title", "program_type:programType", "duration", "fees", "seats:number", "code", "description:rich", "eligibility:rich", "syllabus_pdf_url:file", "button_label", "button_url", "published:boolean", "status:select", "display_order:number"] },
    { key: "departments", label: "Departments", table: "departments", folder: "departments", group: "Website", fields: ["title", "program_type:programType", "hod_name", "hod_photo_url:image", "department_image_url:image", "description:rich", "labs:rich", "faculty_count:number", "students_count:number", "button_label", "button_url", "published:boolean", "status:select", "display_order:number"] },
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
    "admissions", "notices", "downloads", "updates", "ai_prompts", "media_library", "contacts",
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
let saveInFlight = false;
let selectedRowIds = new Set();
let searchDebounceTimer = null;
let activeActionMenuId = null;
const $ = (id) => document.getElementById(id);

const ACTION_ICONS = {
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    preview: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    duplicate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    publish: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    unpublish: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
    delete: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
};

const EMPTY_ILLUSTRATION = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 7h16M4 12h10M4 17h7"/><rect x="3" y="3" width="18" height="18" rx="3"/></svg>';

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
        "principal_message", "updates", "notices", "downloads",
        "courses", "departments", "faculty",
        "facilities", "placements", "gallery",
    ] },
    { id: "forms", label: "Admissions", icon: "admissions", keys: ["admissions", "contacts", "inquiries"] },
    { id: "ai", label: "AI Assistant", icon: "ai", keys: ["ai_knowledge_base", "ai_prompts", "ai_conversations"] },
    { id: "system", label: "System", icon: "system", keys: ["settings", "home_slides", "footer_blocks", "media_library", "admins"] },
];

let cmsConnection = { connected: false };
let chromeInitialized = false;
let dashboardLoadPromise = null;
let dashboardVisibilityTimer = null;
let contentBootstrapDone = false;

function settled(result, fallback) {
    return result.status === "fulfilled" ? result.value : fallback;
}

/** Dedupe identical in-flight dashboard API calls within one load cycle. */
function createDashboardRequestCache() {
    const cache = new Map();
    return {
        count(table) {
            const key = `count:${table}`;
            if (!cache.has(key)) cache.set(key, adminTableCount(table));
            return cache.get(key);
        },
        rows(table, limit = 250) {
            const key = `rows:${table}:${limit}`;
            if (!cache.has(key)) cache.set(key, selectRows(table, limit));
            return cache.get(key);
        },
    };
}

document.addEventListener("DOMContentLoaded", async () => {
    installGlobalErrorHandlers();
    setCmsAdminMode(true);
    clearCmsLocalCache();
    await ensureAdminWriteSessionOnLoad();
    cmsConnection = await connectCms();
    initChrome();

    const writeCap = await getAdminWriteCapability();
    if (writeCap.canWrite) {
        await bootstrapAllContentTables();
    } else if (writeCap.message) {
        console.error("[CMS] Admin writes unavailable:", writeCap.message);
    }
    contentBootstrapDone = true;
    void flushFormQueue().catch(() => {});

    await refreshPendingBar();
    renderNav();
    void loadDashboard().catch(handleModuleLoadError);
    updateSystemStatus();
    setInterval(updateLiveClock, 1000);
    updateLiveClock();

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState !== "visible") return;
        clearTimeout(dashboardVisibilityTimer);
        dashboardVisibilityTimer = setTimeout(async () => {
            if (!isCmsAvailable()) {
                cmsConnection = await connectCms();
                if (!cmsConnection.connected) return;
            }
            await refreshPendingBar();
            if (currentModule?.key === "dashboard") void loadDashboard();
            else updateSystemStatus();
        }, 500);
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
    $("editorForm").addEventListener("submit", saveRecord, { capture: true });
    $("editorDialog")?.addEventListener("click", handleEditorUploadAction);
    $("globalSearch")?.addEventListener("input", debouncedRenderTable);
    $("statusFilter")?.addEventListener("change", (e) => { window.__statusFilter = e.target.value; page = 1; renderTable(); });
    $("departmentFilter")?.addEventListener("change", () => { page = 1; renderTable(); });
    $("priorityFilter")?.addEventListener("change", () => { page = 1; renderTable(); });
    $("sortFilter")?.addEventListener("change", () => { page = 1; renderTable(); });
    $("exportCsvBtn")?.addEventListener("click", exportCsv);
    $("bulkPublishBtn")?.addEventListener("click", bulkPublish);
    $("bulkUnpublishBtn")?.addEventListener("click", bulkUnpublish);
    $("bulkDeleteBtn")?.addEventListener("click", bulkDelete);
    $("bulkExportBtn")?.addEventListener("click", exportSelectedCsv);
    $("bulkClearBtn")?.addEventListener("click", () => { clearSelection(); renderTable(); });
    $("themeToggle")?.addEventListener("click", toggleTheme);
    $("notificationBtn")?.addEventListener("click", () => switchModule("inquiries"));
    $("commandBtn")?.addEventListener("click", () => {
        if (isModalOpen()) return;
        openCommandPalette();
    });
    $("commandSearch")?.addEventListener("input", renderCommandResults);
    $("commandDialog")?.addEventListener("click", (event) => { if (event.target.id === "commandDialog") closeModal($("commandDialog")); });
    $("sidebarSearch")?.addEventListener("input", () => renderNav($("sidebarSearch").value.trim().toLowerCase()));
    $("quickCreateBtn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        const menu = $("quickCreateMenu");
        menu.hidden = !menu.hidden;
    });
    document.addEventListener("click", () => { if ($("quickCreateMenu")) $("quickCreateMenu").hidden = true; });
    document.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
            if (isModalOpen()) return;
            event.preventDefault();
            openCommandPalette();
        }
        if (event.key === "Escape" && !isModalOpen()) closeActionMenus();
    });
    document.addEventListener("click", (event) => {
        if (!event.target.closest(".action-menu")) closeActionMenus();
    });
    document.querySelectorAll("[data-jump]").forEach((btn) => btn.addEventListener("click", () => switchModule(btn.dataset.jump)));
    initQuickCreateMenu();
    initEditorDirtyTracking();
    initAdminUiPolish();
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
    if (editorDirty) {
        const snapshotRow = editingRow;
        const confirmed = await confirmAction("Discard changes?", "You have unsaved changes in this editor.");
        if (!confirmed) {
            if (!isModalOpen()) openEditor(snapshotRow);
            return;
        }
    }
    editorDirty = false;
    $("autosaveStatus").textContent = "";
    closeModal($("editorDialog"));
}

function updateLiveClock() {
    const el = $("liveClock");
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

async function updatePendingBar() {
    const bar = $("pendingBar");
    if (!bar) return;

    const capability = await getAdminWriteCapability();
    if (!capability.canWrite) {
        await renderWriteCapabilityBanner();
        return;
    }

    if (!isCmsAvailable()) return;
    const [inqResult, contactResult] = await Promise.allSettled([
        adminTableCount("inquiries"),
        adminTableCount("contacts"),
    ]);
    const inq = settled(inqResult, { ok: false, count: 0 });
    const contact = settled(contactResult, { ok: false, count: 0 });
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

function handleModuleLoadError(err) {
    const message = mapApiError(err, "Could not load this module. Please try again.");
    toast(message, true);
}

function bindModuleSetupRetry() {
    $("moduleSetupRetry")?.addEventListener("click", async () => {
        resetCmsStatus();
        cmsConnection = await connectCms({ force: true });
        updateConnectionBanner();
        updateSystemStatus();
        if (isCmsAvailable()) void loadModule().catch(handleModuleLoadError);
        else switchModule("dashboard");
    });
}

function switchModule(key) {
    closeAllModals();
    currentModule = MODULES.find((m) => m.key === key) || MODULES[0];
    page = 1;
    clearSelection();
    closeActionMenus();
    if (window.matchMedia("(max-width: 780px)").matches) {
        document.body.classList.remove("sidebar-open");
    }
    renderNav($("sidebarSearch")?.value.trim().toLowerCase() || "");
    document.body.classList.remove("sidebar-open");
    $("pageTitle").textContent = currentModule.label;
    const isDashboard = key === "dashboard";
    $("dashboardView").classList.toggle("active", isDashboard);
    $("moduleView").classList.toggle("active", !isDashboard);
    if (isDashboard) void loadDashboard().catch(handleModuleLoadError);
    else void loadModule().catch(handleModuleLoadError);
}

async function loadDashboard() {
    if (dashboardLoadPromise) return dashboardLoadPromise;
    dashboardLoadPromise = loadDashboardInner().finally(() => {
        dashboardLoadPromise = null;
    });
    return dashboardLoadPromise;
}

async function loadDashboardInner() {
    const name = (localAdmin.name || localAdmin.email || "Admin").split(" ")[0];
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

    if (!isCmsAvailable()) {
        renderDashboardHero({ name, greeting, cmsReady: false });
        renderCmsSetupCard();
        bindDashboardLinks();
        return;
    }

    document.querySelector(".cms-setup-card")?.remove();
    showDashboardSkeletons();
    renderDashboardHero({ name, greeting, cmsReady: true, loading: true });

    const cmsReady = isCmsAvailable();
    const requests = createDashboardRequestCache();

    const moduleResults = await Promise.allSettled(
        DASHBOARD_MODULES.map(async (mod) => ({ mod, ...(await requests.count(mod.table)) })),
    );
    const statuses = moduleResults.map((result, index) => (
        settled(result, { mod: DASHBOARD_MODULES[index], count: null, ok: false, reason: "error" })
    ));

    const [
        inquiriesProbeResult,
        admissionsProbeResult,
        mediaProbeResult,
        noticesResult,
        admissionsResult,
        inquiriesResult,
        aiPromptsProbeResult,
        aiKnowledgeProbeResult,
        aiConversationsProbeResult,
        mediaFilesResult,
        recentChangesResult,
    ] = await Promise.allSettled([
        requests.count("inquiries"),
        requests.count("admissions"),
        requests.count("media_library"),
        requests.rows("notices", 5),
        requests.rows("admissions", 5),
        requests.rows("inquiries", 50),
        requests.count("ai_prompts"),
        requests.count("ai_knowledge_base"),
        requests.count("ai_conversations"),
        fetchMediaStorage(),
        fetchRecentChanges(requests),
    ]);

    const inquiriesProbe = settled(inquiriesProbeResult, { ok: false, count: 0 });
    const admissionsProbe = settled(admissionsProbeResult, { ok: false, count: 0 });
    const mediaProbe = settled(mediaProbeResult, { ok: false, count: 0 });
    const notices = settled(noticesResult, []);
    const admissions = settled(admissionsResult, []);
    const inquiries = settled(inquiriesResult, []);
    const aiPromptsProbe = settled(aiPromptsProbeResult, { ok: false, count: 0 });
    const aiKnowledgeProbe = settled(aiKnowledgeProbeResult, { ok: false, count: 0 });
    const aiConversationsProbe = settled(aiConversationsProbeResult, { ok: false, count: 0 });
    const mediaFiles = settled(mediaFilesResult, { ok: false, count: 0, bytes: 0 });
    const recentChanges = settled(recentChangesResult, []);

    const summary = resolveDashboardSummary(statuses);
    const pendingInquiries = inquiries.filter(isPendingInquiry);

    renderOverviewCards({ summary, statuses, inquiriesProbe, admissionsProbe, mediaProbe, pendingCount: pendingInquiries.length, cmsReady });
    renderDashboardHero({
        name,
        greeting,
        cmsReady,
        inquiriesProbe,
        admissionsProbe,
        mediaProbe,
        mediaFiles,
        pendingCount: pendingInquiries.length,
        recentChanges,
        aiPromptsProbe,
        summary,
    });
    renderQuickActions();
    renderRecentChanges(recentChanges, cmsReady);
    renderDatabaseHealth({ summary, statuses, cmsReady });
    renderStatusCards({ summary, mediaProbe, mediaFiles, aiPromptsProbe, aiKnowledgeProbe, aiConversationsProbe, cmsReady });
    renderLatestNotices(notices, cmsReady);
    renderLatestAdmissions(admissions, cmsReady);
    renderPendingInquiries(pendingInquiries, inquiriesProbe, cmsReady);
    renderContentImportBanner(statuses);
    await updatePendingBar();

    bindDashboardLinks();
}

function renderDashboardHero({
    name,
    greeting,
    cmsReady = false,
    loading = false,
    inquiriesProbe,
    admissionsProbe,
    mediaProbe,
    mediaFiles,
    pendingCount = 0,
    recentChanges = [],
    aiPromptsProbe,
    summary,
}) {
    const host = $("dashboardHero");
    if (!host) return;
    const diag = getLastConnectionDiagnostics();
    const websiteStatus = cmsReady ? "✓ Connected" : "Setup required";
    const storageStatus = diag?.storage?.ok || mediaProbe?.ok ? "✓ Ready" : "—";
    const aiStatus = aiPromptsProbe?.ok && (aiPromptsProbe.count || 0) > 0 ? "✓ Active" : aiPromptsProbe?.ok ? "Configured" : "—";
    const todayActivity = recentChanges.filter((item) => {
        const when = new Date(item.when || 0);
        const now = new Date();
        return when.toDateString() === now.toDateString();
    }).length;
    const lastSync = new Date().toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

    host.innerHTML = `
        <div class="dash-hero-premium__inner">
            <div>
                <img class="dash-hero-premium__logo" src="../assets/images/logo.jpg" alt="Eaglewood Polytechnic Institute" width="72" height="72">
                <p class="eyebrow" style="opacity:.85;margin:0">${loading ? "Loading dashboard…" : "Institute CMS"}</p>
                <h2>${esc(greeting)}, ${esc(name)} 👋</h2>
                <p class="dash-hero-premium__lead">Welcome back. Manage website content, admissions, and institute operations from one place.</p>
                <div class="dash-hero-premium__chips">
                    <span class="dash-hero-chip">Website ${esc(websiteStatus)}</span>
                    <span class="dash-hero-chip">Storage ${esc(storageStatus)}</span>
                    <span class="dash-hero-chip">AI ${esc(aiStatus)}</span>
                    <span class="dash-hero-chip">Pending Admissions ${esc(String(admissionsProbe?.count || 0))}</span>
                    <span class="dash-hero-chip">Pending Inquiries ${esc(String(pendingCount))}</span>
                    <span class="dash-hero-chip">Today's Activity ${esc(String(todayActivity))}</span>
                    <span class="dash-hero-chip">Last Sync ${esc(lastSync)}</span>
                </div>
                <div class="dash-hero-premium__actions">
                    <button type="button" data-hero-key="notices">+ New Notice</button>
                    <button type="button" data-hero-key="admissions">Review Admissions</button>
                    <button type="button" data-hero-key="media_library">Upload Media</button>
                    <button type="button" data-hero-key="settings">Settings</button>
                </div>
            </div>
            <div class="dash-hero-premium__meta">
                <div><strong>${esc(localAdmin.name || localAdmin.email || "Admin")}</strong></div>
                <div>CMS v2 · ${cmsReady ? `${summary?.configured || 0} modules` : "Offline"}</div>
                <div>${mediaFiles?.totalBytes ? formatBytes(mediaFiles.totalBytes) + " storage" : (mediaProbe?.count ? `${mediaProbe.count} media files` : "Storage empty")}</div>
            </div>
        </div>`;
    host.querySelectorAll("[data-hero-key]").forEach((btn) => btn.addEventListener("click", () => switchModule(btn.dataset.heroKey)));
}

function showDashboardSkeletons() {
    $("overviewCards").innerHTML = Array.from({ length: 8 }, () => `<div class="overview-card skeleton"></div>`).join("");
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
    const countFor = (table) => statuses.find((s) => s.mod.table === table)?.count ?? 0;
    const cards = [
        { label: "Notices", value: countFor("notices"), meta: "Important announcements", tone: "ok", key: "notices" },
        { label: "Courses", value: countFor("courses"), meta: "Academic programs", tone: "ok", key: "courses" },
        { label: "Admissions", value: admissionsProbe.ok ? (admissionsProbe.count || 0) : 0, meta: "Today's applications", tone: "neutral", key: "admissions" },
        { label: "Gallery", value: countFor("gallery"), meta: "Campus photos", tone: "ok", key: "gallery" },
        { label: "Facilities", value: countFor("facilities"), meta: "Infrastructure items", tone: "ok", key: "facilities" },
        { label: "Pending Inquiries", value: inquiriesProbe.ok ? pendingCount : 0, meta: pendingCount ? "Awaiting response" : "Inbox clear", tone: pendingCount > 0 ? "warn" : "ok", key: "inquiries" },
        { label: "Media", value: mediaProbe.ok ? (mediaProbe.count || 0) : 0, meta: "Library assets", tone: "neutral", key: "media_library" },
        { label: "Modules", value: cmsReady ? (summary?.configured || 0) : statuses.filter((s) => s.ok).length, meta: "CMS modules configured", tone: cmsReady ? "ok" : "setup", key: "dashboard" },
    ];

    $("overviewCards").innerHTML = cards.map((card, index) => `
        <article class="overview-card tone-${card.tone}" data-key="${card.key}" role="button" tabindex="0">
            <div class="overview-icon">${NAV_ICONS.cms}</div>
            <p class="overview-label">${esc(card.label)}</p>
            <p class="overview-value" data-counter="${card.value}">0</p>
            <p class="overview-meta muted">${esc(card.meta)}</p>
            <div class="mini-chart" aria-hidden="true">${[40, 65, 50, 80, 55, 70, 45].map((h, i) => `<span style="height:${h - (index % 3) * 5}%"></span>`).join("")}</div>
        </article>
    `).join("");
    $("overviewCards").querySelectorAll(".overview-card[data-key]").forEach((card) => {
        const go = () => { if (card.dataset.key !== "dashboard") switchModule(card.dataset.key); };
        card.addEventListener("click", go);
        card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); go(); } });
    });
    $("overviewCards").querySelectorAll("[data-counter]").forEach((el) => animateCounter(el, Number(el.dataset.counter) || 0));
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

async function fetchRecentChanges(requests = null) {
    if (!isCmsAvailable()) return [];
    const cache = requests || createDashboardRequestCache();
    const tables = [
        { table: "updates", label: "Update", titleKey: "title" },
        { table: "notices", label: "Notice", titleKey: "title" },
        { table: "courses", label: "Course", titleKey: "title" },
        { table: "admissions", label: "Admission", titleKey: "student_name" },
        { table: "inquiries", label: "Inquiry", titleKey: "name" },
        { table: "contacts", label: "Contact", titleKey: "name" },
    ];
    const batches = await Promise.allSettled(tables.map(async ({ table, label, titleKey }) => {
        const rows = await cache.rows(table, 4);
        return rows.map((row) => ({
            table,
            label,
            title: row[titleKey] || row.title || row.name || row.student_name || "Untitled",
            when: row.updated_at || row.created_at,
            status: row.status || (row.published === false ? "draft" : "published"),
        }));
    }));
    return batches
        .map((result) => settled(result, []))
        .flat()
        .sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0))
        .slice(0, 8);
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
    return `<div class="empty-illustration">${EMPTY_ILLUSTRATION}<p>${esc(message)}</p></div>`;
}

async function adminTableCount(table) {
    if (isContentTable(table)) {
        return cmsTableCount(table);
    }
    if (isPublicFormTable(table)) {
        return formTableCount(table);
    }
    const result = await safeCount(table, `admin:count:${table}`);
    if (result.ok) {
        return { count: result.count ?? 0, ok: true };
    }
    return { count: null, ok: false, reason: result.reason || "error" };
}

/** Route save to INSERT or UPDATE using real database UUIDs only. */
async function writeSave(table, payload, existingRow = null) {
    if (isContentTable(table)) {
        return cmsUpsert(table, payload, existingRow);
    }
    const rowId = existingRow?.id;
    if (isUuid(rowId)) {
        return safeUpdate(table, payload, { id: rowId });
    }
    return safeInsert(table, payload);
}

async function writeInsert(table, payload) {
    return isContentTable(table) ? cmsInsert(table, payload) : safeInsert(table, payload);
}

async function writeUpdate(table, payload, match) {
    if (isContentTable(table)) {
        return cmsUpdate(table, payload, match);
    }
    const rowId = match?.id;
    if (!isUuid(rowId)) {
        return safeInsert(table, payload);
    }
    return safeUpdate(table, payload, match);
}

function crudErrorMessage(result) {
    return result?.message || mapApiError(result?.error, mapCrudReason(result?.reason, result?.error));
}

async function writeDelete(table, match) {
    return isContentTable(table) ? cmsDelete(table, match) : safeDelete(table, match);
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
    const canPublish = currentModule.fields?.some((f) => f.includes("published"));
    $("bulkPublishBtn").hidden = !canPublish;
    $("bulkUnpublishBtn").hidden = !canPublish;
    $("bulkDeleteBtn").hidden = Boolean(currentModule.readonly);
    $("bulkExportBtn").hidden = !currentModule.export;
    $("addRecordBtn").style.display = currentModule.readonly ? "none" : "";
    clearSelection();
    syncModuleFilters();
    $("moduleTable").innerHTML = skeletonTable();
    renderModuleContext();

    if (!isCmsAvailable()) {
        const missing = getTableStatus(currentModule.table) === "missing" || getMissingTables().includes(currentModule.table);
        $("moduleTable").innerHTML = `<div class="empty-state setup-state"><strong>${missing ? "Module unavailable" : "CMS unavailable"}</strong><p>${missing ? `The <code>${esc(currentModule.table)}</code> table is not available.` : "Check your connection and try again."}</p><button class="btn-primary" type="button" id="moduleSetupRetry">Retry</button></div>`;
        bindModuleSetupRetry();
        return;
    }

    const probe = await adminTableCount(currentModule.table);
    if (!probe.ok && (probe.reason === "missing_table" || probe.reason === "not_configured")) {
        $("moduleTable").innerHTML = `<div class="empty-state setup-state"><strong>Module unavailable</strong><p>The <code>${esc(currentModule.table)}</code> table could not be reached. Check your connection and try again.</p><button class="btn-primary" type="button" id="moduleSetupRetry">Retry</button></div>`;
        bindModuleSetupRetry();
        return;
    }
    if (isContentTable(currentModule.table) && !contentBootstrapDone) {
        await bootstrapTableIfEmpty(currentModule.table);
    }
    rows = await selectRows(currentModule.table, 250, false);
    syncModuleFilters();
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
                <button type="button" class="btn-ghost" data-settings-key="stat_departments">Stat: Departments</button>
                <button type="button" class="btn-ghost" data-settings-key="stat_placements">Stat: Placements</button>
                <button type="button" class="btn-ghost" data-settings-key="stat_faculty">Stat: Faculty</button>
                <button type="button" class="btn-ghost" data-settings-key="stat_institute_code">Stat: Institute Code</button>
                <button type="button" class="btn-ghost" data-settings-key="contact_phones">Contact Phones</button>
                <button type="button" class="btn-ghost" data-settings-key="email_polytechnic">Polytechnic Email</button>
                <button type="button" class="btn-ghost" data-settings-key="email_engineering">Engineering Email</button>
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

    if (currentModule.key === "principal_message") {
        target.innerHTML = `<div class="context-card appearance-card">
            <div>
                <p class="eyebrow">Dual Principals</p>
                <h3>Diploma &amp; Degree</h3>
                <p>Maintain one published record for Eaglewood Polytechnic (Diploma) and one for Eaglewood College of Engineering (Degree). Edit by UUID — new records are inserted only when you explicitly create them.</p>
            </div>
            <div class="appearance-actions">
                <button type="button" class="btn-ghost" data-principal-preset="polytechnic">Diploma Principal</button>
                <button type="button" class="btn-ghost" data-principal-preset="engineering">Degree Principal</button>
                <button type="button" class="btn-ghost" data-preview-site="../index.html#principal">Preview Homepage</button>
                <button type="button" class="btn-ghost" data-preview-site="../about.html#principal-diploma">Preview About</button>
            </div>
        </div>`;
        target.querySelectorAll("[data-principal-preset]").forEach((btn) => {
            btn.addEventListener("click", () => openPrincipalEditor(btn.dataset.principalPreset));
        });
        target.querySelectorAll("[data-preview-site]").forEach((btn) => {
            btn.addEventListener("click", () => window.open(btn.dataset.previewSite, "_blank", "noopener"));
        });
        return;
    }

    const templates = {
        ai_knowledge_base: ["Knowledge Base", "Categories", "Publish", "Search"],
        ai_prompts: ["Greeting", "Fallback", "Quick Replies", "Response Delay"],
        ai_conversations: ["Chat History", "Ratings", "Export", "Review"],
        media_library: ["Upload", "Folders", "Preview", "Replace"],
        gallery: ["Albums", "Featured", "Categories", "Publish"],
        notices: ["Pinned", "Priority", "Expiry", "Attachments"],
        downloads: ["Admission Forms", "Circulars", "Prospectus", "PDF/DOC"],
        updates: ["Timeline", "Categories", "Featured", "Publish"],
        admissions: ["Review", "Status", "Export", "Contact"],
        settings: ["Institute Info", "Contact", "Social", "Map"],
    };
    const items = templates[currentModule.key] || ["Draft / Publish", "Search", "Export"];
    target.innerHTML = `<div class="context-card"><div><p class="eyebrow">${esc(currentModule.group || "Module")}</p><h3>${esc(currentModule.label)}</h3><p>Manage records, publishing state, and metadata from Supabase.</p></div><div>${items.map((item) => `<span>${item}</span>`).join("")}</div></div>`;
}
function buildAdminListQuery(table, limit, publishedOnly) {
    return (q) => {
        let query = q.select("*").limit(limit);
        if (publishedOnly) query = query.eq("published", true);
        if (hasDisplayOrder(table)) query = query.order("display_order", { ascending: true, nullsFirst: false });
        return query.order("created_at", { ascending: false });
    };
}

async function selectRowsWithFallback(table, limit = 250, publishedOnly = false) {
    const builder = buildAdminListQuery(table, limit, publishedOnly);
    const result = await safeAdminSelect(table, builder, []);
    if (result.ok && Array.isArray(result.data) && result.data.length) {
        return result.data;
    }
    if (!result.ok || !result.data?.length) {
        const fallback = await safeFetch(table, builder, [], `admin:fallback:${table}`);
        if (fallback.ok && Array.isArray(fallback.data) && fallback.data.length) {
            return fallback.data;
        }
    }
    if (!result.ok) {
        console.error(`[CMS] Admin read failed for ${table}:`, result.reason || "unknown");
    }
    return Array.isArray(result.data) ? result.data : [];
}

async function selectRows(table, limit = 250, publishedOnly = false) {
    if (isPublicFormTable(table)) {
        const result = await fetchFormRows(table, { admin: true, limit });
        return result.data || [];
    }
    if (isContentTable(table)) {
        const result = await fetchCmsRows(table, { admin: true, publishedOnly, limit });
        if (result.data?.length) return result.data;
        return selectRowsWithFallback(table, limit, publishedOnly);
    }
    return selectRowsWithFallback(table, limit, publishedOnly);
}

function debouncedRenderTable() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => { page = 1; renderTable(); }, 220);
}

let storageImageMap = {};

async function refreshStorageImageMap() {
    await ensureMediaMap();
    storageImageMap = getMediaMap();
    return storageImageMap;
}

void refreshStorageImageMap();

function resolvePreviewUrl(url) {
    return resolveAdminPreviewUrl(url, storageImageMap);
}

function animateCounter(el, target) {
    const duration = 900;
    const start = performance.now();
    const from = 0;
    const tick = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        const value = Math.round(from + (target - from) * (1 - Math.pow(1 - progress, 3)));
        el.textContent = String(value);
        if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

function bindPreviewImages(root = document) {
    root.querySelectorAll(".preview-shell img.preview").forEach((img) => {
        refreshPreviewImage(img);
    });
}

function refreshPreviewImage(img) {
    const shell = img.closest(".preview-shell");
    const loading = shell?.querySelector(".preview-loading");
    const fallback = shell?.querySelector(".preview-fallback");
    const retryBtn = shell?.querySelector("[data-retry-preview]");

    const showError = () => {
        shell?.classList.add("is-error");
        shell?.classList.remove("is-loaded");
        if (loading) loading.hidden = true;
        if (fallback) fallback.hidden = false;
    };

    const showLoaded = () => {
        shell?.classList.add("is-loaded");
        shell?.classList.remove("is-error");
        if (loading) loading.hidden = true;
        if (fallback) fallback.hidden = true;
    };

    const load = () => {
        shell?.classList.remove("is-error", "is-loaded");
        if (loading) loading.hidden = false;
        if (fallback) fallback.hidden = true;

        const raw = img.getAttribute("data-src") || img.getAttribute("src") || "";
        if (!raw) return showError();

        const resolved = resolvePreviewUrl(raw);
        if (!resolved) return showError();

        const finalize = () => {
            if (img.complete && img.naturalWidth > 0) showLoaded();
            else if (img.complete) showError();
        };

        img.onload = showLoaded;
        img.onerror = showError;
        if (retryBtn) {
            retryBtn.onclick = (event) => {
                event.preventDefault();
                load();
            };
        }

        if (img.getAttribute("src") !== resolved) {
            img.src = resolved;
        }
        finalize();
    };

    load();
}

function ensureUploadPlaceholder(zone) {
    let placeholder = zone.querySelector(".upload-placeholder");
    if (!placeholder) {
        placeholder = document.createElement("div");
        placeholder.className = "upload-placeholder";
        placeholder.innerHTML = "<strong>Drag image here</strong><span>OR</span><span class=\"btn-ghost upload-browse-btn\">Browse</span>";
        const fileInput = zone.querySelector("input[type=file]");
        zone.insertBefore(placeholder, fileInput || null);
    }
    placeholder.classList.remove("hide");
    return placeholder;
}

function ensureUploadActions(zone, fieldName) {
    let actions = zone.querySelector(".upload-actions");
    if (!actions) {
        actions = document.createElement("div");
        actions.className = "upload-actions";
        zone.appendChild(actions);
    }
    actions.innerHTML = `<button type="button" class="btn-ghost" data-replace-upload="${fieldName}">Replace image</button><button type="button" class="btn-danger" data-clear-upload="${fieldName}">Delete image</button>`;
    return actions;
}

function setUploadPreview(zone, url, fieldName, fieldType = "image") {
    if (!zone) return;
    const shell = zone.querySelector(".preview-shell");
    const img = zone.querySelector(".preview");
    const hidden = zone.querySelector(`input[name="${fieldName}"]`);
    const showImage = Boolean(url) && isRenderableImageUrl(url, fieldType);

    if (showImage && shell && img) {
        shell.classList.remove("hide");
        img.setAttribute("data-src", url);
        img.removeAttribute("src");
        zone.classList.add("has-preview");
        zone.querySelector(".upload-placeholder")?.classList.add("hide");
        ensureUploadActions(zone, fieldName);
        refreshPreviewImage(img);
        return;
    }

    shell?.classList.add("hide");
    zone.classList.remove("has-preview");
    if (hidden && !hidden.dataset.pendingUpload) {
        ensureUploadPlaceholder(zone);
    }
}

function handleEditorUploadAction(event) {
    const clearBtn = event.target.closest("[data-clear-upload]");
    if (clearBtn) {
        event.preventDefault();
        const field = clearBtn.dataset.clearUpload;
        const zone = clearBtn.closest(".upload-zone");
        const hidden = zone?.querySelector(`input[name="${field}"]`);
        const fileInput = zone?.querySelector(`[data-upload-for="${field}"]`);
        if (hidden) {
            hidden.value = "";
            delete hidden.dataset.pendingUpload;
            delete hidden.dataset.fileName;
        }
        if (fileInput) fileInput.value = "";
        zone?.querySelector(".preview-shell")?.classList.add("hide");
        zone?.querySelector(".upload-actions")?.replaceChildren();
        zone?.classList.remove("has-preview");
        ensureUploadPlaceholder(zone);
        editorDirty = true;
        return;
    }

    const replaceBtn = event.target.closest("[data-replace-upload]");
    if (replaceBtn) {
        event.preventDefault();
        const field = replaceBtn.dataset.replaceUpload;
        replaceBtn.closest(".upload-zone")?.querySelector(`[data-upload-for="${field}"]`)?.click();
    }
}

function getSearchQuery() {
    return ($("globalSearch")?.value || "").trim().toLowerCase();
}

function highlightMatch(text) {
    const raw = String(text ?? "");
    const query = getSearchQuery();
    if (!query) return esc(raw);
    const lower = raw.toLowerCase();
    const idx = lower.indexOf(query);
    if (idx < 0) return esc(raw);
    return `${esc(raw.slice(0, idx))}<mark>${esc(raw.slice(idx, idx + query.length))}</mark>${esc(raw.slice(idx + query.length))}`;
}

function getRowTitle(row) {
    const base = row.title || row.name || row.student_name || row.question || row.key || row.block_key || `Record #${row.id}`;
    if (currentModule?.key === "principal_message" && row.institute) {
        return `${base} (${principalProgramLabel(row)})`;
    }
    return base;
}

function getRowImage(row) {
    for (const key of ["image_url", "photo_url", "department_image_url", "company_logo_url", "thumbnail_url", "hod_photo_url", "file_url"]) {
        if (row[key]) return row[key];
    }
    return "";
}

function hasPublishField() {
    return currentModule.fields?.some((f) => f.includes("published"));
}

function getSelectedRows() {
    const filtered = filterRows(rows);
    return filtered.filter((r) => selectedRowIds.has(String(r.id)));
}

function clearSelection() {
    selectedRowIds.clear();
    updateBulkBar();
}

function toggleRowSelection(id, checked) {
    const sid = String(id);
    if (checked) selectedRowIds.add(sid);
    else selectedRowIds.delete(sid);
    updateBulkBar();
}

function updateBulkBar() {
    const bar = $("bulkBar");
    if (!bar) return;
    const count = selectedRowIds.size;
    bar.hidden = count === 0;
    const countEl = $("bulkCount");
    if (countEl) countEl.textContent = `${count} Selected`;
}

function syncModuleFilters() {
    const deptFilter = $("departmentFilter");
    const priorityFilter = $("priorityFilter");
    const hasDept = currentModule.fields?.some((f) => f.startsWith("department"));
    const hasPriority = currentModule.fields?.some((f) => f.includes("priority"));
    if (deptFilter) {
        deptFilter.hidden = !hasDept;
        if (hasDept) {
            const departments = [...new Set(rows.map((r) => r.department).filter(Boolean))].sort();
            const current = deptFilter.value;
            deptFilter.innerHTML = `<option value="">All departments</option>${departments.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join("")}`;
            deptFilter.value = current;
        }
    }
    if (priorityFilter) priorityFilter.hidden = !hasPriority;
}

function closeActionMenus() {
    document.querySelectorAll(".action-menu-dropdown").forEach((menu) => { menu.hidden = true; });
    document.querySelectorAll(".action-menu-trigger").forEach((btn) => btn.setAttribute("aria-expanded", "false"));
    activeActionMenuId = null;
}

function renderActionMenu(row) {
    const hasPublish = hasPublishField();
    const published = row.published !== false;
    return `<div class="action-menu" data-action-menu="${row.id}">
        <button type="button" class="action-menu-trigger" aria-label="Actions for ${esc(getRowTitle(row))}" aria-haspopup="true" aria-expanded="false" data-menu-toggle="${row.id}">⋮</button>
        <div class="action-menu-dropdown" hidden>
            <button type="button" data-edit="${row.id}">${ACTION_ICONS.edit} Edit</button>
            <button type="button" data-preview="${row.id}">${ACTION_ICONS.preview} Preview</button>
            <button type="button" data-dup="${row.id}">${ACTION_ICONS.duplicate} Duplicate</button>
            ${hasPublish ? `<button type="button" data-toggle="${row.id}">${published ? ACTION_ICONS.unpublish : ACTION_ICONS.publish} ${published ? "Unpublish" : "Publish"}</button>` : ""}
            <button type="button" class="danger" data-delete="${row.id}">${ACTION_ICONS.delete} Delete</button>
        </div>
    </div>`;
}

function renderEmptyIllustration() {
    const label = currentModule.label || "record";
    return `<div class="empty-illustration">${EMPTY_ILLUSTRATION}<h3>No ${esc(label)} yet</h3><p>Create your first ${esc(label.toLowerCase())}. Published items appear on the public website automatically.</p><button class="btn-primary" type="button" id="emptyAddBtn">+ Create ${esc(label)}</button></div>`;
}

function renderTableRow(row) {
    const image = getRowImage(row);
    const title = getRowTitle(row);
    const published = row.published !== false;
    const updated = formatDate(row.updated_at || row.created_at);
    const status = row.status || (published ? "published" : "draft");
    const tone = published === false || status === "draft" ? "badge-warn" : status === "pending" ? "badge-pending" : "badge-ok";
    const selected = selectedRowIds.has(String(row.id));
    return `<tr class="${row._queued ? "row-queued" : ""} ${selected ? "is-selected" : ""}" data-row-id="${row.id}">
        <td class="col-check"><input class="row-check" type="checkbox" data-select="${row.id}" ${selected ? "checked" : ""} aria-label="Select ${esc(title)}"></td>
        <td class="col-image">${image ? `<img class="thumb" src="${esc(resolvePreviewUrl(image))}" alt="" loading="lazy" onerror="this.style.opacity='0.35'">` : `<span class="thumb-placeholder" aria-hidden="true">◌</span>`}</td>
        <td class="row-title-cell">${highlightMatch(title)}</td>
        <td class="hide-tablet"><span class="status-pill ${tone}">${esc(row._queued ? `${status} · queued` : status)}</span></td>
        <td class="col-published hide-mobile"><span class="${published ? "published-yes" : "published-no"}">${published ? "Published ✓" : "Draft"}</span></td>
        <td class="col-updated hide-tablet">${esc(updated)}</td>
        <td class="col-actions">${renderActionMenu(row)}</td>
    </tr>`;
}

function renderMobileCard(row) {
    const image = getRowImage(row);
    const title = getRowTitle(row);
    const published = row.published !== false;
    const updated = formatDate(row.updated_at || row.created_at);
    const priority = row.priority ? `Priority: ${row.priority}` : "";
    const selected = selectedRowIds.has(String(row.id));
    return `<article class="record-card ${selected ? "is-selected" : ""}" data-row-id="${row.id}">
        <label class="record-card__check"><input class="row-check" type="checkbox" data-select="${row.id}" ${selected ? "checked" : ""}><span class="muted">Select</span></label>
        ${image ? `<img class="thumb" src="${esc(resolvePreviewUrl(image))}" alt="" loading="lazy" onerror="this.style.opacity='0.35'">` : `<span class="thumb-placeholder" aria-hidden="true">◌</span>`}
        <div>
            <div class="mobile-card-title row-title-cell">${highlightMatch(title)}</div>
            <div class="record-card__meta">
                <span class="${published ? "published-yes" : "published-no"}">${published ? "Published ✓" : "Draft"}</span>
                <span>${esc(updated)}</span>
                ${priority ? `<span>${esc(priority)}</span>` : ""}
            </div>
        </div>
        ${renderActionMenu(row)}
    </article>`;
}

function bindTableInteractions(data) {
    $("moduleTable").querySelectorAll("[data-menu-toggle]").forEach((btn) => btn.addEventListener("click", (event) => {
        event.stopPropagation();
        const id = btn.dataset.menuToggle;
        const menu = btn.parentElement.querySelector(".action-menu-dropdown");
        const open = menu.hidden;
        closeActionMenus();
        if (open) {
            menu.hidden = false;
            btn.setAttribute("aria-expanded", "true");
            activeActionMenuId = id;
        }
    }));
    $("moduleTable").querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => { closeActionMenus(); openEditor(rows.find((r) => String(r.id) === b.dataset.edit)); }));
    $("moduleTable").querySelectorAll("[data-preview]").forEach((b) => b.addEventListener("click", () => { closeActionMenus(); previewRecord(b.dataset.preview); }));
    $("moduleTable").querySelectorAll("[data-toggle]").forEach((b) => b.addEventListener("click", () => { closeActionMenus(); togglePublished(b.dataset.toggle); }));
    $("moduleTable").querySelectorAll("[data-dup]").forEach((b) => b.addEventListener("click", () => { closeActionMenus(); duplicateRecord(b.dataset.dup); }));
    $("moduleTable").querySelectorAll("[data-delete]").forEach((b) => b.addEventListener("click", () => { closeActionMenus(); deleteRecord(b.dataset.delete); }));
    $("moduleTable").querySelectorAll("[data-select]").forEach((input) => input.addEventListener("change", (event) => {
        event.stopPropagation();
        toggleRowSelection(input.dataset.select, input.checked);
        renderTable();
    }));
    const selectAll = $("moduleTable").querySelector("[data-select-all]");
    selectAll?.addEventListener("change", (event) => {
        data.forEach((row) => toggleRowSelection(row.id, event.target.checked));
        renderTable();
    });
    $("prevPage")?.addEventListener("click", () => { page--; renderTable(); });
    $("nextPage")?.addEventListener("click", () => { page++; renderTable(); });
}

function renderTable() {
    const filtered = filterRows(rows);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, totalPages);
    const data = filtered.slice((page - 1) * pageSize, page * pageSize);
    const start = filtered.length ? (page - 1) * pageSize + 1 : 0;
    const end = Math.min(page * pageSize, filtered.length);
    $("recordCount") && ($("recordCount").textContent = `${filtered.length} record${filtered.length === 1 ? "" : "s"}`);
    if (!data.length) {
        $("moduleTable").innerHTML = renderEmptyIllustration();
        $("emptyAddBtn")?.addEventListener("click", () => openEditor());
        updateBulkBar();
        return;
    }
    const allSelected = data.length > 0 && data.every((row) => selectedRowIds.has(String(row.id)));
    $("moduleTable").innerHTML = `
    <div class="desktop-table-wrap table-scroll">
        <table class="data-table compact-table">
            <thead>
                <tr>
                    <th class="col-check"><input class="row-check" type="checkbox" data-select-all ${allSelected ? "checked" : ""} aria-label="Select all on page"></th>
                    <th class="col-image">Image</th>
                    <th>Title</th>
                    <th class="hide-tablet">Status</th>
                    <th class="hide-mobile">Published</th>
                    <th class="hide-tablet">Updated</th>
                    <th class="col-actions">Actions</th>
                </tr>
            </thead>
            <tbody>${data.map((row) => renderTableRow(row)).join("")}</tbody>
        </table>
    </div>
    <div class="mobile-card-list">${data.map((row) => renderMobileCard(row)).join("")}</div>
    <div class="pagination modern">
        <span class="pagination-info">${filtered.length ? `Showing ${start}–${end} of ${filtered.length}` : "No records"}</span>
        <div class="pagination-controls">
            <button class="btn-ghost" id="prevPage" type="button" ${page === 1 ? "disabled" : ""}>Previous</button>
            <span class="muted">Page ${page} / ${totalPages}</span>
            <button class="btn-ghost" id="nextPage" type="button" ${page === totalPages ? "disabled" : ""}>Next</button>
        </div>
    </div>`;
    bindTableInteractions(data);
    updateBulkBar();
}

function filterRows(source) {
    const q = getSearchQuery();
    const status = window.__statusFilter || $("statusFilter")?.value || "";
    const department = $("departmentFilter")?.value || "";
    const priority = $("priorityFilter")?.value || "";
    const sort = $("sortFilter")?.value || "newest";
    let result = source.filter((row) => {
        if (q && !JSON.stringify(row).toLowerCase().includes(q)) return false;
        if (department && String(row.department || "") !== department) return false;
        if (priority && String(row.priority || "") !== priority) return false;
        if (!status) return true;
        if (status === "published") return row.published !== false;
        if (status === "draft") return row.published === false;
        return row.status === status || String(row.published) === status;
    });
    if (sort === "oldest") result = [...result].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    else if (sort === "order") result = [...result].sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
    else result = [...result].sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
    return result;
}

function visibleKeys(row) {
    const preferred = currentModule.fields.map((f) => f.split(":")[0]).filter((k) => k in row && !k.endsWith("_url"));
    const media = currentModule.fields.map((f) => f.split(":")[0]).find((k) => k.includes("image_url") || k.includes("photo_url") || k.includes("pdf_url"));
    return [media, ...preferred, "created_at"].filter(Boolean).filter((k, i, arr) => arr.indexOf(k) === i).slice(0, 8);
}

function cell(row, key) {
    const value = row[key];
    if (key.includes("image_url") || key.includes("photo_url")) return `<td>${value ? `<img class="thumb" src="${esc(resolvePreviewUrl(value))}" alt="Preview" loading="lazy" onerror="this.style.opacity='0.35'">` : "-"}</td>`;
    if (key.includes("pdf_url")) return `<td>${value ? `<a href="${esc(value)}" target="_blank">PDF</a>` : "-"}</td>`;
    if (key === "status" || key === "published" || key === "reply_status" || key === "application_status") {
        const tone = value === false || value === "draft" || value === "hidden" ? "badge-warn" : value === "pending" ? "badge-pending" : "badge-ok";
        const label = row._queued ? `${value ?? "new"} · queued` : String(value ?? "new");
        return `<td><span class="status-pill ${tone}">${esc(label)}</span></td>`;
    }
    if (key === "created_at" || key === "date") return `<td><span class="muted">${formatDate(value)}</span></td>`;
    return `<td class="${key.includes("title") || key.includes("name") ? "row-title" : ""}">${esc(String(value ?? "")).slice(0, 140)}</td>`;
}

function openPrincipalEditor(instituteKey = "polytechnic") {
    const normalized = instituteKey === "engineering" ? "engineering" : "polytechnic";
    const existing = rows.find((row) => principalInstituteKey(row) === normalized);
    if (existing) {
        openEditor(existing);
        return;
    }
    const program = normalized === "engineering" ? "Degree" : "Diploma";
    openEditor({
        institute: normalized,
        designation: `Principal - ${program}`,
        display_order: normalized === "engineering" ? 2 : 1,
        published: true,
        status: "published",
    });
}

function openEditor(row = null) {
    if (!currentModule.fields?.length) return toast("This module is read-only.", true);
    closeActionMenus();
    if ($("quickCreateMenu")) $("quickCreateMenu").hidden = true;
    editingRow = row;
    editorDirty = false;
    $("dialogTitle").textContent = row ? `Edit ${currentModule.label}` : `Add ${currentModule.label}`;
    $("dialogKicker").textContent = currentModule.table;
    $("autosaveStatus").textContent = "";

    void (async () => {
        await refreshStorageImageMap();
        $("editorFields").innerHTML = currentModule.fields.map((field) => renderField(field, row)).join("");
        openModal($("editorDialog"), { onEscape: () => { void closeEditor(); } });
        $("editorFields").querySelectorAll("input[type=file]").forEach((input) => {
            input.addEventListener("change", (event) => {
                void previewUpload(event).catch((err) => toast(err?.message || "Image preview failed.", true));
            });
        });
        bindRichTextTools();
        bindDropZones();
        bindPreviewImages($("editorFields"));
    })();
}

function renderField(def, row) {
    const [name, type = "text"] = def.split(":");
    const value = row?.[name] ?? defaultValue(name, type);
    const fullWidth = ["rich", "json", "image", "file"].includes(type) || name === "value" || name === "description" || name === "message" || name.includes("description");
    const pairClass = fullWidth ? " full" : " pair";
    const required = ["name", "title", "student_name", "question", "key", "message"].includes(name);
    const req = required ? '<span class="req" aria-label="required">*</span>' : "";
    const labelHtml = `<span class="field-label">${label(name)}${req}</span>`;
    if (type === "rich") {
        return `<label class="field${pairClass}"><span class="editor-section">Content</span>${labelHtml}
            <div class="rich-editor">
                <div class="rich-toolbar">
                    <button type="button" data-wrap="strong" title="Bold"><b>B</b></button>
                    <button type="button" data-wrap="em" title="Italic"><i>I</i></button>
                    <button type="button" data-wrap="u" title="Underline"><u>U</u></button>
                    <button type="button" data-wrap="h2" title="Heading 2">H2</button>
                    <button type="button" data-wrap="h3" title="Heading 3">H3</button>
                    <button type="button" data-list="ul" title="Bullet list">• List</button>
                    <button type="button" data-list="ol" title="Numbered list">1. List</button>
                    <button type="button" data-link title="Link">Link</button>
                    <button type="button" data-table title="Table">Table</button>
                </div>
                <textarea name="${name}" rows="8">${esc(value)}</textarea>
            </div>
            <small class="field-hint">Supports HTML formatting for rich content.</small>
        </label>`;
    }
    if (type === "json") return `<label class="field full"><span class="editor-section">Structured data</span>${labelHtml}<textarea name="${name}" rows="8">${esc(typeof value === "object" ? JSON.stringify(value, null, 2) : value)}</textarea><small class="field-hint">Valid JSON object or array.</small></label>`;
    if (type === "image" || type === "file") {
        const accept = type === "file" ? "application/pdf,image/*" : "image/*";
        const showPreview = Boolean(value) && isRenderableImageUrl(value, type);
        const previewUrl = showPreview ? resolvePreviewUrl(value) : "";
        return `<label class="field full upload-field dropzone">
            <span class="editor-section">Media</span>
            ${labelHtml}
            <div class="upload-zone ${value ? "has-preview" : ""}">
                <div class="preview-shell ${showPreview ? "" : "hide"}">
                    <div class="preview-loading">Loading preview…</div>
                    <img class="preview" data-src="${esc(value)}" ${previewUrl ? `src="${esc(previewUrl)}"` : ""} alt="Preview">
                    <div class="preview-fallback" hidden>Preview unavailable<button type="button" class="btn-ghost" data-retry-preview>Retry</button></div>
                </div>
                ${!value ? `<div class="upload-placeholder"><strong>Drag image here</strong><span>OR</span><span class="btn-ghost upload-browse-btn">Browse</span></div>` : ""}
                <input name="${name}" type="hidden" value="${esc(value)}">
                <input data-upload-for="${name}" type="file" accept="${accept}">
                <div class="upload-progress" hidden><span></span></div>
                <div class="upload-actions">
                    ${value ? `<button type="button" class="btn-ghost" data-replace-upload="${name}">Replace image</button><button type="button" class="btn-danger" data-clear-upload="${name}">Delete image</button>` : ""}
                </div>
            </div>
            <small class="field-hint">Drag and drop or browse. Preview updates immediately.</small>
        </label>`;
    }
    if (["select", "selectCategory", "reply", "lead", "role", "userStatus", "priority", "applicationStatus", "paymentStatus", "mediaType", "programType", "instituteType", "downloadCategory", "downloadType"].includes(type)) return selectField(name, type, value, labelHtml, pairClass);
    if (type === "boolean") return `<label class="field pair"><span class="editor-section">Publishing</span>${labelHtml}<select name="${name}"><option value="true" ${value !== false ? "selected" : ""}>Publish / Yes</option><option value="false" ${value === false ? "selected" : ""}>Hide / No</option></select></label>`;
    return `<label class="field${pairClass}">${labelHtml}<input name="${name}" type="${type === "number" ? "number" : type === "date" ? "date" : "text"}" value="${esc(value)}"></label>`;
}

function selectField(name, type, value, labelHtml = null, pairClass = " pair") {
    const instituteLabels = {
        polytechnic: "Diploma (Polytechnic)",
        engineering: "Degree (Engineering)",
    };
    const sets = { select: ["published", "draft", "scheduled", "archived", "hidden"], selectCategory: ["Campus", "Labs", "Sports", "Events", "Workshops", "Industrial Visits", "Functions"], reply: ["pending", "replied", "follow-up", "archived"], lead: ["new", "assigned", "read", "approved", "rejected", "closed"], role: ["super_admin", "admin", "editor", "staff"], userStatus: ["active", "inactive", "suspended"], priority: ["low", "normal", "high", "urgent"], applicationStatus: ["new", "under_review", "approved", "rejected", "waitlisted"], paymentStatus: ["pending", "paid", "failed", "refunded"], mediaType: ["image", "video", "pdf", "document", "other"], programType: ["diploma", "degree"], instituteType: ["polytechnic", "engineering"], downloadCategory: ["admission_forms", "circulars", "prospectus"], downloadType: ["pdf", "doc", "image"] };
    const lbl = labelHtml || `<span class="field-label">${label(name)}</span>`;
    const options = sets[type] || [];
    const optionHtml = options.map((o) => {
        const labelText = (type === "instituteType" && currentModule?.key === "principal_message")
            ? (instituteLabels[o] || o)
            : o;
        return `<option value="${o}" ${String(value) === o ? "selected" : ""}>${labelText}</option>`;
    }).join("");
    return `<label class="field${pairClass}">${lbl}<select name="${name}">${optionHtml}</select></label>`;
}

function bindRichTextTools() {
    $("editorFields").querySelectorAll("[data-wrap]").forEach((button) => button.addEventListener("click", () => {
        const textarea = button.closest(".rich-editor")?.querySelector("textarea");
        if (!textarea) return;
        const tag = button.dataset.wrap;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value.slice(start, end) || "text";
        textarea.setRangeText(`<${tag}>${text}</${tag}>`, start, end, "end");
        textarea.focus();
        editorDirty = true;
    }));
    $("editorFields").querySelectorAll("[data-list]").forEach((button) => button.addEventListener("click", () => {
        const textarea = button.closest(".rich-editor")?.querySelector("textarea");
        if (!textarea) return;
        const tag = button.dataset.list;
        const start = textarea.selectionStart;
        const text = textarea.value.slice(start, textarea.selectionEnd) || "Item";
        textarea.setRangeText(`<${tag}><li>${text}</li></${tag}>`, start, textarea.selectionEnd, "end");
        textarea.focus();
        editorDirty = true;
    }));
    $("editorFields").querySelectorAll("[data-link]").forEach((button) => button.addEventListener("click", () => {
        const textarea = button.closest(".rich-editor")?.querySelector("textarea");
        if (!textarea) return;
        const url = prompt("Enter URL", "https://");
        if (!url) return;
        const start = textarea.selectionStart;
        const text = textarea.value.slice(start, textarea.selectionEnd) || "link";
        textarea.setRangeText(`<a href="${url}">${text}</a>`, start, textarea.selectionEnd, "end");
        textarea.focus();
        editorDirty = true;
    }));
    $("editorFields").querySelectorAll("[data-table]").forEach((button) => button.addEventListener("click", () => {
        const textarea = button.closest(".rich-editor")?.querySelector("textarea");
        if (!textarea) return;
        const start = textarea.selectionStart;
        const table = "<table><tr><th>Header</th></tr><tr><td>Cell</td></tr></table>";
        textarea.setRangeText(table, start, start, "end");
        textarea.focus();
        editorDirty = true;
    }));
}

function bindUploadActions() {
    /* handled via handleEditorUploadAction delegation on #editorDialog */
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
    const zone = input.closest(".upload-zone");
    const hidden = zone?.querySelector(`input[name="${field}"]`);
    const progress = zone?.querySelector(".upload-progress");
    const fieldDef = currentModule.fields.find((f) => f.split(":")[0] === field) || "";
    const fieldType = fieldDef.split(":")[1] || "image";

    if (file.type.startsWith("image/")) {
        const objectUrl = URL.createObjectURL(file);
        if (hidden) {
            hidden.dataset.fileName = file.name;
            hidden.dataset.pendingUpload = "true";
        }
        setUploadPreview(zone, objectUrl, field, fieldType);
        zone?.querySelector(".upload-placeholder")?.classList.add("hide");
    }
    if (progress) {
        progress.hidden = false;
        const bar = progress.querySelector("span");
        if (bar) {
            bar.style.width = "20%";
            requestAnimationFrame(() => { bar.style.width = "72%"; });
            setTimeout(() => { bar.style.width = "100%"; }, 280);
            setTimeout(() => { progress.hidden = true; bar.style.width = "0"; }, 1100);
        }
    }
    if (hidden && !hidden.dataset.pendingUpload) {
        hidden.dataset.fileName = file.name;
        hidden.dataset.pendingUpload = "true";
    }
    editorDirty = true;
    toast("Image ready — save to upload.", false, "success");
}

async function saveRecord(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (saveInFlight) return;
    if (!(await requireWriteSession())) return;

    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    saveInFlight = true;
    if (submitBtn) submitBtn.disabled = true;

    const allowed = new Set(currentModule.fields.map((f) => f.split(":")[0]));
    const payload = {};

    try {
        for (const fieldDef of currentModule.fields) {
            const [name, type = "text"] = fieldDef.split(":");
            const hidden = form.querySelector(`input[name="${name}"][type="hidden"]`);
            const control = form.querySelector(`[name="${name}"]`);
            if (!control && !hidden) continue;

            const hiddenPending = hidden?.dataset.pendingUpload === "true";
            if (hiddenPending) {
                const fileInput = form.querySelector(`[data-upload-for="${name}"]`);
                const file = fileInput?.files?.[0];
                if (!file) throw new Error(`Select a file for ${label(name)}.`);
                payload[name] = await uploadFile(name, file, editingRow?.[name]);
                if (currentModule.table === "media_library" && name === "file_url") {
                    payload.size_bytes = file.size;
                }
                if (hidden) {
                    delete hidden.dataset.pendingUpload;
                    hidden.dataset.fileName = "";
                }
            } else if (type === "boolean") {
                payload[name] = control.value === "true";
            } else if (type === "number") {
                const num = Number(control.value);
                payload[name] = Number.isFinite(num) ? num : null;
            } else if (type === "date") {
                const raw = String(control.value || "").trim();
                payload[name] = raw || null;
            } else if (type === "json") {
                try { payload[name] = JSON.parse(control.value); } catch { payload[name] = control.value || ""; }
            } else if (type === "image" || type === "file") {
                const val = hidden?.value ?? control?.value ?? "";
                payload[name] = String(val).trim() || null;
            } else {
                payload[name] = control.value ?? "";
            }
        }

        Object.keys(payload).forEach((key) => {
            if (!allowed.has(key)) delete payload[key];
        });

        if (currentModule.key === "principal_message" && payload.institute) {
            const nextKey = principalInstituteKey({ institute: payload.institute });
            const duplicate = rows.find((row) => {
                if (editingRow?.id && String(row.id) === String(editingRow.id)) return false;
                return principalInstituteKey(row) === nextKey;
            });
            if (duplicate) {
                throw new Error(`A ${principalProgramLabel({ institute: payload.institute })} principal already exists. Edit that record instead of creating a duplicate.`);
            }
        }

        if (!editingRow?.id || !isUuid(editingRow?.id)) {
            if (allowed.has("status") && (!payload.status || payload.status === "draft")) payload.status = "published";
            if (allowed.has("published") && payload.published !== false) payload.published = true;
            if (allowed.has("display_order") && !Number(payload.display_order)) {
                const maxOrder = rows.reduce((max, row) => Math.max(max, Number(row.display_order || 0)), 0);
                payload.display_order = maxOrder + 1;
            }
        }

        const result = await writeSave(currentModule.table, payload, editingRow);
        if (!result.ok) throw new Error(crudErrorMessage(result));

        editorDirty = false;
        $("autosaveStatus").textContent = "Saved";
        toast("Saved successfully.", false, "success");
        clearCmsQueryCache();
        notifyCmsDataChanged();
        await refreshStorageImageMap();
        closeModal($("editorDialog"));
        await loadModule();
        if (currentModule?.key === "dashboard") await loadDashboard();
    } catch (err) {
        const message = err?.message || `Could not save ${currentModule.label}.`;
        toast(message, true);
        $("autosaveStatus").textContent = "Save failed";
    } finally {
        saveInFlight = false;
        if (submitBtn) submitBtn.disabled = false;
    }
}

async function renderWriteCapabilityBanner() {
    const bar = $("pendingBar");
    if (!bar) return;
    const capability = await getAdminWriteCapability();
    if (capability.canWrite) {
        bar.hidden = true;
        return;
    }
    bar.hidden = false;
    bar.innerHTML = `<span class="count">${esc(capability.message || "Sign in again to enable saving.")}</span>`;
}

function storagePathFromPublicUrl(url) {
    if (!url || typeof url !== "string") return "";
    const marker = "/storage/v1/object/public/cms/";
    const idx = url.indexOf(marker);
    if (idx === -1) return "";
    return decodeURIComponent(url.slice(idx + marker.length));
}

async function uploadFile(field, file, oldUrl) {
    if (!file) throw new Error("No file selected.");
    if (!(await requireWriteSession())) throw new Error("Permission denied. Sign in again.");
    const folder = currentModule.folder || currentModule.key;
    const ext = (file.name.split(".").pop() || "bin").toLowerCase();
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const result = await adminStorageUpload(path, file, { upsert: false });
    if (!result.ok) {
        throw new Error(result.error?.message || crudErrorMessage(result));
    }
    const oldPath = storagePathFromPublicUrl(oldUrl);
    if (oldPath) {
        const removed = await adminStorageRemove(oldPath);
        if (!removed.ok) {
            console.warn("[CMS] Could not remove previous file:", removed.error?.message);
        }
    }
    await refreshStorageImageMap();
    return result.publicUrl;
}

async function deleteOldStorageObject(url) {
    const path = storagePathFromPublicUrl(url);
    if (!path) return;
    try {
        const result = await adminStorageRemove(path);
        if (!result.ok) {
            console.warn("[CMS] Storage delete failed:", result.error?.message);
        }
    } catch (err) {
        console.warn("[CMS] Storage delete error:", err?.message || err);
    }
}

async function togglePublished(id) {
    if (!(await requireWriteSession())) return;
    const row = rows.find((r) => String(r.id) === String(id));
    if (!row) return;
    const result = await writeSave(currentModule.table, {
        ...row,
        published: !row.published,
        status: !row.published ? "published" : "hidden",
    }, row);
    if (!result.ok) return toast(crudErrorMessage(result), true);
    clearCmsQueryCache();
    toast(!row.published ? "Published." : "Unpublished.", false, "success");
    await loadModule();
}

async function deleteRecord(id) {
    if (!(await requireWriteSession())) return;
    const row = rows.find((r) => String(r.id) === String(id));
    if (!(await confirmAction(`Delete ${currentModule.label.replace(/s$/, "")}?`, "This cannot be undone."))) return;
    try {
        for (const key of Object.keys(row || {})) if (key.endsWith("_url")) await deleteOldStorageObject(row[key]);
        const result = await writeDelete(currentModule.table, { id });
        if (!result.ok) throw new Error(crudErrorMessage(result));
        clearCmsQueryCache();
        toast("Deleted successfully.", false, "success");
        rows = rows.filter((r) => String(r.id) !== String(id));
        renderTable();
    } catch (err) { toast(err?.message || "Delete failed.", true); }
}

function exportCsv() {
    exportRowsToCsv(filterRows(rows));
}

function exportSelectedCsv() {
    const selected = getSelectedRows();
    if (!selected.length) return toast("Select records to export.", true);
    exportRowsToCsv(selected);
}

function exportRowsToCsv(data) {
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

function hasDisplayOrder(table) { return tableHasDisplayOrder(table); }
function csvCell(value) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
function showSkeleton(id, count) { $(id).innerHTML = Array.from({ length: count }, () => `<div class="skeleton"></div>`).join(""); }
function skeletonTable() { return `<div class="skeleton table-skeleton"></div><div class="skeleton table-skeleton"></div><div class="skeleton table-skeleton"></div>`; }
function defaultValue(name, type) { if (type === "select") return "published"; if (type === "boolean") return true; if (type === "number") return 0; if (type === "date") return new Date().toISOString().slice(0, 10); if (type === "color") return "#005b5b"; return ""; }
function formatDate(value) { return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "-"; }
function label(key) {
    if (currentModule?.key === "principal_message") {
        const map = {
            photo_url: "Principal Photo",
            name: "Principal Name",
            qualification: "Qualification",
            designation: "Designation",
            institute: "Program / Institute",
            message: "Principal Message",
            published: "Published",
            display_order: "Display Order",
            status: "Status",
        };
        if (map[key]) return map[key];
    }
    return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function esc(value) { const div = document.createElement("div"); div.textContent = value ?? ""; return div.innerHTML; }
function toast(message, error = false, tone = "") {
    const region = $("toastRegion") || document.body;
    const el = document.createElement("div");
    el.className = `toast ${error ? "error" : tone || "success"}`;
    el.setAttribute("role", "status");
    el.textContent = message;
    region.appendChild(el);
    setTimeout(() => {
        el.style.opacity = "0";
        el.style.transform = "translateY(-6px)";
        setTimeout(() => el.remove(), 220);
    }, 3200);
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
        downloads: "../index.html#student-resources",
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
    const currentId = current.id;
    const swapId = swap.id;
    if (!isUuid(currentId) || !isUuid(swapId)) {
        toast("Records must exist in the database before reordering.", true);
        return;
    }
    const currentOrder = Number(current.display_order ?? index);
    const swapOrder = Number(swap.display_order ?? target);
    try {
        await Promise.all([
            writeUpdate(currentModule.table, { display_order: swapOrder }, { id: currentId }),
            writeUpdate(currentModule.table, { display_order: currentOrder }, { id: swapId }),
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
        const result = await writeInsert(currentModule.table, copy);
        if (!result.ok) throw new Error(crudErrorMessage(result));
        toast("Record duplicated.");
        await loadModule();
    } catch (err) {
        toast(err?.message || "Duplicate failed.", true);
    }
}

async function bulkPublish() {
    if (!(await requireWriteSession())) return;
    const targets = getSelectedRows().filter((r) => r.published === false);
    if (!selectedRowIds.size) return toast("Select records to publish.", true);
    if (!targets.length) return toast("No draft records in selection.", true);
    if (!(await confirmAction("Publish selected?", `Publish ${targets.length} record(s)?`))) return;
    try {
        await Promise.all(targets.map((r) => writeSave(currentModule.table, { ...r, published: true, status: "published" }, r)));
        clearCmsQueryCache();
        toast(`${targets.length} record(s) published.`, false, "success");
        clearSelection();
        await loadModule();
    } catch (err) {
        toast(err?.message || "Bulk publish failed.", true);
    }
}

async function bulkUnpublish() {
    if (!(await requireWriteSession())) return;
    if (!hasPublishField()) return;
    if (!selectedRowIds.size) return toast("Select records to unpublish.", true);
    const targets = getSelectedRows().filter((r) => r.published !== false);
    if (!targets.length) return toast("No published records in selection.", true);
    if (!(await confirmAction("Unpublish selected?", `Unpublish ${targets.length} record(s)?`))) return;
    try {
        await Promise.all(targets.map((r) => writeSave(currentModule.table, { ...r, published: false, status: "hidden" }, r)));
        clearCmsQueryCache();
        toast(`${targets.length} record(s) unpublished.`, false, "success");
        clearSelection();
        await loadModule();
    } catch (err) {
        toast(err?.message || "Bulk unpublish failed.", true);
    }
}

async function bulkDelete() {
    if (!(await requireWriteSession())) return;
    if (currentModule.readonly) return;
    if (!selectedRowIds.size) return toast("Select records to delete.", true);
    const targets = getSelectedRows();
    if (!targets.length) return toast("No records to delete.", true);
    if (!(await confirmAction(`Delete ${targets.length} record(s)?`, "This cannot be undone."))) return;
    try {
        await Promise.all(targets.map((r) => writeDelete(currentModule.table, { id: r.id })));
        clearCmsQueryCache();
        toast(`${targets.length} record(s) deleted.`, false, "success");
        clearSelection();
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
    if (isModalOpen()) return;
    openModal($("commandDialog"), { onEscape: () => closeModal($("commandDialog")) });
    $("commandSearch").value = "";
    renderCommandResults();
    setTimeout(() => $("commandSearch").focus(), 30);
}

function renderCommandResults() {
    const q = ($("commandSearch")?.value || "").toLowerCase();
    const items = MODULES.filter((m) => m.key !== "dashboard" && (!q || `${m.label} ${m.group} ${m.table}`.toLowerCase().includes(q))).slice(0, 18);
    $("commandResults").innerHTML = items.map((m) => `<button type="button" data-key="${m.key}"><span>${m.icon}</span><strong>${m.label}</strong><small>${m.group || "CMS"}</small></button>`).join("") || `<p class="empty-state">No modules found.</p>`;
    $("commandResults").querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { closeModal($("commandDialog")); switchModule(button.dataset.key); }));
}

function confirmAction(title, message) {
    const dialog = $("confirmDialog");
    if (!dialog) return Promise.resolve(confirm(message));
    $("confirmTitle").textContent = title;
    $("confirmMessage").textContent = message;
    $("confirmOk").textContent = title.toLowerCase().includes("delete") ? "Delete" : "Confirm";
    return new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            closeModal(dialog);
            resolve(value);
        };
        const cancel = () => finish(false);
        const ok = () => finish(true);
        $("confirmCancel").addEventListener("click", cancel, { once: true });
        $("confirmOk").addEventListener("click", ok, { once: true });
        openModal(dialog, { onEscape: cancel });
    });
}

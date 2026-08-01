/**
 * Eaglewood Polytechnic - Shared UI Layer
 * Animations, interactions, site chrome, and performance optimizations.
 */

import CONFIG from "./config.js";
import { debounce, throttle } from "./utils.js";
import { safeFetch, ensureCmsReady, isCmsAvailable, isCmsStrictMode } from "./supabase.js";
import { getSiteLogoUrl } from "./page-loader.js";

const FOOTER_DEFAULTS = {
    institute_name: "Eaglewood Polytechnic Institute",
    footer_tagline: "AICTE Approved • MSBTE Affiliated",
    logo_url: getSiteLogoUrl(),
    phone: "+91 94237 16230",
    email: "eaglewoodpoly@gmail.com",
    address: "Majalgaon, Dist. Beed",
    google_map: "https://www.google.com/maps?q=Eaglewood+Polytechnic+Institute+Majalgaon",
    copyright_text: "Eaglewood Polytechnic Institute",
    developer_name: "Shubham Ahire",
    developer_phone: "+91 7249868133",
};

const FOOTER_QUICK_LINKS = [
    { label: "About", href: "about.html" },
    { label: "Courses", href: "courses.html" },
    { label: "Departments", href: "departments.html" },
    { label: "Faculty", href: "faculty.html" },
    { label: "Placements", href: "placements.html" },
    { label: "Gallery", href: "gallery.html" },
    { label: "Admissions", href: "admission.html" },
    { label: "Contact", href: "contact.html" },
];

const FOOTER_BOTTOM_LINKS = [
    { label: "Privacy", href: "contact.html#privacy" },
    { label: "Terms", href: "contact.html#terms" },
    { label: "Accessibility", href: "contact.html#accessibility" },
    { label: "Sitemap", href: "sitemap.html" },
];

const SOCIAL_ICONS = {
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.018 1.792-4.685 4.533-4.685 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.974.975 1.246 2.242 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.308 3.608-.975.974-2.242 1.246-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.308-.974-.975-1.246-2.242-1.308-3.608C2.175 15.747 2.163 15.367 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608.975-.974 2.242-1.246 3.608-1.308C8.416 2.175 8.796 2.163 12 2.163zm0 1.622c-3.157 0-3.528.012-4.768.069-1.07.049-1.652.227-2.038.378-.512.199-.878.437-1.262.821-.384.384-.622.75-.821 1.262-.151.386-.329.968-.378 2.038-.057 1.24-.069 1.611-.069 4.768s.012 3.528.069 4.768c.049 1.07.227 1.652.378 2.038.199.512.437.878.821 1.262.384.384.75.622 1.262.821.386.151.968.329 2.038.378 1.24.057 1.611.069 4.768.069s3.528-.012 4.768-.069c1.07-.049 1.652-.227 2.038-.378.512-.199.878-.437 1.262-.821.384-.384.622-.75.821-1.262.151-.386.329-.968.378-2.038.057-1.24.069-1.611.069-4.768s-.012-3.528-.069-4.768c-.049-1.07-.227-1.652-.378-2.038-.199-.512-.437-.878-.821-1.262-.384-.384-.75-.622-1.262-.821-.386-.151-.968-.329-2.038-.378C15.528 3.797 15.157 3.785 12 3.785zM12 7.351a4.649 4.649 0 1 0 0 9.298 4.649 4.649 0 0 0 0-9.298zm0 7.676a3.027 3.027 0 1 1 0-6.054 3.027 3.027 0 0 1 0 6.054zm5.338-8.884a1.087 1.087 0 1 0 0 2.174 1.087 1.087 0 0 0 0-2.174z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.56V9h3.554v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
    twitter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
};

const FOOTER_ICONS = {
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    email: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="m22 6-10 7L2 6"/></svg>',
    map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
};

let footerInitPromise;
let footerEventsBound = false;

const siteHeader = `
  <div class="topbar">
    <div class="container topbar-inner">
      <span>Approved by AICTE, DTE & Govt. of Maharashtra</span>
      <span class="topbar-affiliation">Affiliated to MSBTE & DBATU</span>
      <div class="topbar-links"><a href="mailto:eaglewoodpoly@gmail.com">eaglewoodpoly@gmail.com</a><a href="tel:+919423716230">+91 94237 16230</a></div>
    </div>
  </div>
  <header class="site-header">
    <nav class="container navbar" aria-label="Main navigation">
      <a class="brand" href="index.html" aria-label="Eaglewood Polytechnic Institute home">
        <img src="${getSiteLogoUrl()}" alt="Eaglewood Polytechnic Institute official logo">
        <span><small>Venkateshwara Manav Vikas Mandal's</small><strong>Eaglewood Polytechnic Institute</strong><em>DTE 2634 | MSBTE 51307</em></span>
      </a>
      <button class="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false"><span></span><span></span><span></span></button>
      <ul class="nav-links">
        <li><a href="index.html">Home</a></li><li><a href="about.html">About</a></li><li><a href="courses.html">Courses</a></li><li><a href="departments.html">Departments</a></li><li><a href="faculty.html">Faculty</a></li><li><a href="placements.html">Placements</a></li><li><a href="infrastructure.html">Infrastructure</a></li><li><a href="gallery.html">Gallery</a></li><li><a href="admission.html">Admission</a></li><li><a href="contact.html">Contact</a></li>
      </ul>
      <a class="btn btn-sm nav-apply" href="admission.html">Admission <span>-&gt;</span></a>
    </nav>
  </header>`;

const siteFooter = `
  <footer class="epi-ft" id="site-footer">
    <div class="epi-ft__ambient" aria-hidden="true"></div>
    <div class="epi-ft__inner">
      <div class="epi-ft__main">
        <section class="epi-ft__brand" aria-label="Institute">
          <a class="epi-ft__brand-link" href="index.html">
            <img data-footer-logo loading="lazy" src="${getSiteLogoUrl()}" alt="Eaglewood Polytechnic Institute logo">
            <div class="epi-ft__brand-text">
              <strong data-footer-name>Eaglewood Polytechnic Institute</strong>
              <span class="epi-ft__tagline" data-footer-tagline>AICTE Approved • MSBTE Affiliated</span>
            </div>
          </a>
        </section>
        <nav class="epi-ft__quick" aria-label="Quick links">
          <h2 class="epi-ft__heading">Quick Links</h2>
          <ul class="epi-ft__quick-list" data-footer-quick-links></ul>
        </nav>
        <section class="epi-ft__contact" aria-label="Contact">
          <h2 class="epi-ft__heading">Contact</h2>
          <ul class="epi-ft__contact-list">
            <li><a data-footer-phone href="tel:+919423716230">${FOOTER_ICONS.phone}<span>+91 94237 16230</span></a></li>
            <li><a data-footer-email href="mailto:eaglewoodpoly@gmail.com">${FOOTER_ICONS.email}<span>eaglewoodpoly@gmail.com</span></a></li>
            <li><a data-footer-map-link href="https://www.google.com/maps?q=Eaglewood+Polytechnic+Institute+Majalgaon" target="_blank" rel="noopener noreferrer">${FOOTER_ICONS.map}<span data-footer-address>Majalgaon, Dist. Beed</span></a></li>
          </ul>
          <div class="epi-ft__social" data-footer-social aria-label="Social media"></div>
        </section>
      </div>
      <div class="epi-ft__bar">
        <div class="epi-ft__bar-left">
          <p class="epi-ft__copyright">© <span data-year></span> <span data-footer-copyright>Eaglewood Polytechnic Institute</span></p>
          <p class="epi-ft__developer">Designed &amp; Developed by <strong data-footer-developer>Shubham Ahire</strong> · <a data-footer-dev-phone href="tel:+917249868133">+91 7249868133</a></p>
        </div>
        <nav class="epi-ft__legal epi-ft__bar-mid" data-footer-bottom-links aria-label="Legal links"></nav>
        <button class="epi-ft__back-top" data-footer-back-top type="button" aria-label="Back to top">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
          Top
        </button>
      </div>
    </div>
  </footer>
  <a class="epi-ft-wa" href="https://wa.me/919423716230" target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
  </a>
  <a class="mobile-apply" href="admission.html">Admission <span>-&gt;</span></a>`;

/** Inject global header and footer templates. */
export function injectSiteChrome() {
    document.querySelector("[data-site-header]")?.insertAdjacentHTML("afterbegin", siteHeader);
    const footerHost = document.querySelector("[data-site-footer]");
    if (footerHost && !footerHost.querySelector("#site-footer")) {
        footerHost.insertAdjacentHTML("afterbegin", siteFooter);
        mountFooterDefaults();
    }
}

function mountFooterDefaults() {
    try {
        applyFooterCMS({}, window.__footerBlocks || {});
    } catch {
        /* footer must always render with built-in defaults */
    }
    document.querySelectorAll(".footer-reveal").forEach((el) => el.classList.add("is-visible"));
    if (!footerEventsBound) {
        footerEventsBound = true;
        initFooterEvents();
        initFooterFloatOffset();
    }
}

export function applyFooterSettings(settings = {}) {
    applyFooterCMS(settings, window.__footerBlocks || {});
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

function parseSettingsRows(rows = []) {
    if (!rows.length) return {};
    return Object.fromEntries(rows.map((row) => [row.key, parseSettingValue(row.value)]));
}

function parseLinkList(value, fallback) {
    const raw = typeof value === "string" ? tryParseJson(value) : value;
    if (Array.isArray(raw) && raw.length) return raw.filter((item) => item?.label && item?.href);
    if (raw && typeof raw === "object" && Array.isArray(raw.links)) return raw.links;
    return fallback;
}

function applyFooterCMS(settings = {}, blocks = {}) {
    document.body.dataset.footerSettingsApplied = "true";
    const cmsOnly = isCmsStrictMode();
    const footerMain = blocks.footer_main || blocks.main || {};
    const contact = blocks.contact_block || {};
    const merged = cmsOnly
        ? { ...contact, ...footerMain, ...settings }
        : { ...FOOTER_DEFAULTS, ...settings, ...footerMain, ...contact };

    const phone = merged.phone || (cmsOnly ? "" : FOOTER_DEFAULTS.phone);
    const email = merged.email || (cmsOnly ? "" : FOOTER_DEFAULTS.email);
    const address = merged.address || (cmsOnly ? "" : FOOTER_DEFAULTS.address);
    const map = merged.google_map || (cmsOnly ? "" : FOOTER_DEFAULTS.google_map);
    const tagline = merged.footer_tagline || merged.footer_approvals || merged.tagline || (cmsOnly ? "" : FOOTER_DEFAULTS.footer_tagline);

    const setText = (sel, val) => document.querySelectorAll(sel).forEach((el) => { el.textContent = val; });

    setText("[data-footer-name]", merged.institute_name || (cmsOnly ? "" : FOOTER_DEFAULTS.institute_name));
    setText("[data-footer-tagline]", tagline);
    setText("[data-footer-copyright]", merged.copyright_text || (cmsOnly ? "" : FOOTER_DEFAULTS.copyright_text));
    setText("[data-footer-developer]", merged.developer_name || (cmsOnly ? "" : FOOTER_DEFAULTS.developer_name));
    setText("[data-footer-address]", address);

    const devPhone = merged.developer_phone || (cmsOnly ? "" : FOOTER_DEFAULTS.developer_phone);
    document.querySelectorAll("[data-footer-dev-phone]").forEach((el) => {
        el.textContent = devPhone;
        el.href = `tel:${String(devPhone).replace(/\s/g, "")}`;
    });

    document.querySelectorAll("[data-footer-logo]").forEach((el) => {
        el.src = merged.logo_url || (cmsOnly ? "assets/images/logo.jpg" : FOOTER_DEFAULTS.logo_url);
        el.alt = `${merged.institute_name || (cmsOnly ? "Eaglewood Polytechnic Institute" : FOOTER_DEFAULTS.institute_name)} logo`;
    });

    document.querySelectorAll("[data-footer-phone]").forEach((el) => {
        const span = el.querySelector("span");
        if (span) span.textContent = phone;
        else el.textContent = phone;
        el.href = `tel:${String(phone).replace(/\s/g, "")}`;
    });
    document.querySelectorAll("[data-footer-email]").forEach((el) => {
        const span = el.querySelector("span");
        if (span) span.textContent = email;
        else el.textContent = email;
        el.href = `mailto:${email}`;
    });
    document.querySelectorAll("[data-footer-map-link]").forEach((el) => {
        el.href = map;
    });

    const quickLinks = parseLinkList(merged.footer_quick_links || blocks.quick_links?.links, FOOTER_QUICK_LINKS);
    const quickHost = document.querySelector("[data-footer-quick-links]");
    if (quickHost) {
        quickHost.innerHTML = quickLinks.map((link) => `<li><a href="${escAttr(link.href)}">${escHtml(link.label)}</a></li>`).join("");
    }

    const bottomLinks = parseLinkList(merged.footer_bottom_links || blocks.bottom_links?.links, FOOTER_BOTTOM_LINKS);
    const bottomHost = document.querySelector("[data-footer-bottom-links]");
    if (bottomHost) {
        bottomHost.innerHTML = bottomLinks.map((link) => `<a href="${escAttr(link.href)}">${escHtml(link.label)}</a>`).join("");
    }

    applyFooterSocial(merged.social_links || merged.social);
}

function applyFooterSocial(links) {
    const social = typeof links === "string" ? tryParseJson(links) : links;
    const defaults = {
        facebook: "https://www.facebook.com/people/Eaglewood-Polytechnic-Institute-Phule-Pimpalgaon-Majalgaon/100094206302049/",
        instagram: "https://www.instagram.com/eaglewood_polytechnic/",
        youtube: "",
        linkedin: "",
        twitter: "https://x.com/eaglewoodpoly",
    };
    const merged = { ...defaults, ...(social || {}) };
    const order = ["facebook", "instagram", "twitter", "youtube", "linkedin"];
    document.querySelectorAll("[data-footer-social]").forEach((container) => {
        container.innerHTML = order
            .filter((key) => merged[key])
            .map((key) => {
                const label = key.charAt(0).toUpperCase() + key.slice(1);
                return `<a href="${escAttr(merged[key])}" target="_blank" rel="noopener noreferrer" aria-label="${label}">${SOCIAL_ICONS[key] || label.slice(0, 1)}</a>`;
            }).join("");
    });
}

function escHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

function escAttr(value) {
    return String(value ?? "").replace(/"/g, "&quot;");
}

function tryParseJson(value) {
    try { return JSON.parse(value); } catch { return null; }
}

function initFooterEvents() {
    document.querySelectorAll("[data-footer-back-top]").forEach((button) => button.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" })));
}

function initFooterFloatOffset() {
    const footer = document.getElementById("site-footer");
    if (!footer) return;
    const update = throttle(() => {
        const rect = footer.getBoundingClientRect();
        const visible = rect.top < window.innerHeight;
        if (visible) {
            const overlap = Math.max(0, window.innerHeight - rect.top + 12);
            document.documentElement.style.setProperty("--epi-ft-float-offset", `${overlap}px`);
            document.body.classList.add("footer-visible");
        } else {
            document.documentElement.style.removeProperty("--epi-ft-float-offset");
            document.body.classList.remove("footer-visible");
        }
    }, 80);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
}

async function loadFooterCMS() {
    await ensureCmsReady({ verifyFull: true });
    if (!isCmsStrictMode()) {
        return;
    }
    try {
        const [settingsResult, blocksResult] = await Promise.all([
            safeFetch("settings", (q) => q.select("key,value").eq("published", true).order("display_order", { ascending: true }), [], "footer:settings"),
            safeFetch("footer_blocks", (q) => q.select("block_key,title,content").eq("published", true).order("display_order", { ascending: true }), [], "footer:blocks"),
        ]);
        const settings = parseSettingsRows(settingsResult.data || []);
        const blocks = Object.fromEntries((blocksResult.data || []).map((row) => {
            const content = typeof row.content === "string" ? tryParseJson(row.content) || {} : (row.content || {});
            return [row.block_key, content];
        }));
        window.__footerBlocks = blocks;
        applyFooterCMS(settings, blocks);
    } catch {
        applyFooterCMS({}, window.__footerBlocks || {});
    }
    document.querySelectorAll(".footer-reveal").forEach((el) => el.classList.add("is-visible"));
}

export function initFooterSettings() {
    if (!document.querySelector("#site-footer")) mountFooterDefaults();
    if (!footerInitPromise) {
        footerInitPromise = loadFooterCMS().catch(() => applyFooterCMS({}, {}));
    }
    return footerInitPromise;
}

/** Mobile navigation toggle. */
function initNavigation() {
    const navToggle = document.querySelector(".nav-toggle");
    const navLinks = document.querySelector(".nav-links");
    const currentPage = location.pathname.split("/").pop() || "index.html";

    navToggle?.addEventListener("click", () => {
        const open = navLinks.classList.toggle("open");
        navToggle.classList.toggle("open", open);
        navToggle.setAttribute("aria-expanded", String(open));
    });

    navLinks?.querySelectorAll("a").forEach((link) =>
        link.addEventListener("click", () => {
            navLinks.classList.remove("open");
            navToggle?.classList.remove("open");
            navToggle?.setAttribute("aria-expanded", "false");
        })
    );

    document.addEventListener("click", (event) => {
        if (navLinks?.classList.contains("open") && !event.target.closest(".navbar")) {
            navLinks.classList.remove("open");
            navToggle?.classList.remove("open");
            navToggle?.setAttribute("aria-expanded", "false");
        }
    });

    document.querySelectorAll(".nav-links a").forEach((link) => {
        if (link.getAttribute("href") === currentPage) {
            link.classList.add("active");
            link.setAttribute("aria-current", "page");
        }
    });
}

/** Hero image slider with auto-play. */
function initHeroSlider() {
    const slides = [...document.querySelectorAll(".hero-slide")];
    const sliderDots = [...document.querySelectorAll(".hero-dot")];
    if (!slides.length) return;

    let currentSlide = 0;
    let sliderTimer;

    const showSlide = (nextIndex) => {
        const index = (nextIndex + slides.length) % slides.length;
        slides.forEach((slide, i) => slide.classList.toggle("active", i === index));
        sliderDots.forEach((dot, i) => {
            dot.classList.toggle("active", i === index);
            dot.setAttribute("aria-current", i === index ? "true" : "false");
        });
    };

    const restartSlider = () => {
        clearInterval(sliderTimer);
        sliderTimer = setInterval(() => {
            currentSlide = (currentSlide + 1) % slides.length;
            showSlide(currentSlide);
        }, CONFIG.animation.heroSlideInterval);
    };

    sliderDots.forEach((dot, index) =>
        dot.addEventListener("click", () => {
            currentSlide = index;
            showSlide(index);
            restartSlider();
        })
    );

    document.querySelector("[data-slide-prev]")?.addEventListener("click", () => {
        currentSlide = (currentSlide - 1 + slides.length) % slides.length;
        showSlide(currentSlide);
        restartSlider();
    });

    document.querySelector("[data-slide-next]")?.addEventListener("click", () => {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
        restartSlider();
    });

    showSlide(0);
    restartSlider();
}

/** Intersection Observer - scroll reveal for .reveal elements. */
function initScrollReveal() {
    const observer = new IntersectionObserver(
        (entries) =>
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("revealed");
                    observer.unobserve(entry.target);
                }
            }),
        { threshold: CONFIG.animation.revealThreshold }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}

/** Animated number counters for statistics section. */
function initCounterAnimation() {
    const counters = document.querySelectorAll("[data-count]");
    if (!counters.length) return;

    const animateCounter = (el) => {
        const target = parseInt(el.dataset.count, 10);
        const suffix = el.dataset.suffix || "";
        const duration = CONFIG.animation.counterDuration;
        const start = performance.now();

        const step = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.floor(target * eased) + suffix;
            if (progress < 1) requestAnimationFrame(step);
            else el.textContent = target + suffix;
        };

        requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
        (entries) =>
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    observer.unobserve(entry.target);
                }
            }),
        { threshold: 0.4 }
    );

    counters.forEach((el) => observer.observe(el));
}

/** Intersection Observer - scroll reveal for .reveal elements. */
function initLazyImages() {
    document.querySelectorAll("img[loading='lazy']").forEach((img) => {
        img.decoding = "async";
    });

    const lazyImages = document.querySelectorAll("img[data-src]");
    if (!lazyImages.length) return;

    const observer = new IntersectionObserver(
        (entries) =>
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute("data-src");
                    observer.unobserve(img);
                }
            }),
        { rootMargin: CONFIG.lazyLoad.rootMargin, threshold: CONFIG.lazyLoad.threshold }
    );

    lazyImages.forEach((img) => observer.observe(img));
}

/** Material-style ripple on buttons. */
function initButtonRipple() {
    document.addEventListener("click", (event) => {
        const btn = event.target.closest(".btn-ripple");
        if (!btn) return;

        const ripple = document.createElement("span");
        ripple.className = "ripple";
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
        ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
        btn.appendChild(ripple);
        ripple.addEventListener("animationend", () => ripple.remove());
    });
}

/** Sticky header state with debounced scroll. */
function initScrollHandlers() {
    const updateScrollState = debounce(() => {
        document.body.classList.toggle("header-scrolled", scrollY > 28);
    }, CONFIG.animation.scrollDebounceMs);

    window.addEventListener("scroll", updateScrollState, { passive: true });
    updateScrollState();
}

/** Throttled resize handler for layout-sensitive elements. */
function initResizeHandler() {
    const onResize = throttle(() => {
        document.dispatchEvent(new CustomEvent("epi:resize"));
    }, CONFIG.animation.resizeThrottleMs);

    window.addEventListener("resize", onResize, { passive: true });
}

/** Dynamic copyright year. */
function initYearStamp() {
    document.querySelectorAll("[data-year]").forEach((el) => {
        el.textContent = new Date().getFullYear();
    });
}

/** CSS ticker animation for announcements (replaces deprecated marquee). */
function initAnnouncementsTicker() {
    const track = document.getElementById("announcements-track");
    if (!track) return;
    track.innerHTML = `${track.innerHTML} | ${track.innerHTML}`;
}

/** Smooth page transitions for internal links. */
function initPageTransitions() {
    document.querySelectorAll('a[href$=".html"], a[href*=".html#"]').forEach((link) => {
        link.addEventListener("click", (event) => {
            if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || link.target === "_blank") return;
            const destination = new URL(link.href, location.href);
            if (destination.origin !== location.origin || destination.pathname === location.pathname) return;
            event.preventDefault();
            document.body.classList.add("page-leaving");
            window.setTimeout(() => {
                location.href = destination.href;
            }, 180);
        });
    });
}

/** Initialize all home page UI behaviors (site chrome must be injected first). */
export function initHomeUI() {
    document.body.classList.add("home-page");
    initNavigation();
    initHeroSlider();
    initScrollReveal();
    initCounterAnimation();
    initLazyImages();
    initButtonRipple();
    initScrollHandlers();
    initResizeHandler();
    initYearStamp();
    void initFooterSettings();
    initAnnouncementsTicker();
    initPageTransitions();
}

/** Initialize shared UI for non-home pages (legacy support). */
export function initLegacyUI() {
    injectSiteChrome();
    initNavigation();
    initScrollReveal();
    initPremiumReveal();
    initLazyImages();
    initScrollHandlers();
    initYearStamp();
    void initFooterSettings();
    initPageTransitions();
    initTabGroups();
    initGalleryPage();
    initFaqAccordion();
    initButtonRipple();
}

export { siteHeader, siteFooter };

/** Tab panels for courses and similar pages. */
function initTabGroups() {
    document.querySelectorAll("[data-tab-group]").forEach((group) => {
        const buttons = [...group.querySelectorAll(".tab-btn[data-tab]")];
        const panels = [...group.querySelectorAll(".tab-panel")];
        if (!buttons.length || !panels.length) return;
        const activate = (id) => {
            buttons.forEach((btn) => {
                const active = btn.dataset.tab === id;
                btn.classList.toggle("active", active);
                btn.setAttribute("aria-selected", String(active));
            });
            panels.forEach((panel) => {
                const active = panel.id === id;
                panel.classList.toggle("active", active);
                panel.hidden = !active;
            });
        };
        buttons.forEach((btn) => btn.addEventListener("click", () => activate(btn.dataset.tab)));
        const initial = buttons.find((btn) => btn.classList.contains("active"))?.dataset.tab || buttons[0].dataset.tab;
        activate(initial);
    });
}

/** Premium reveal animation on all pages. */
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

/** Gallery page: filters + lightbox. */
function initGalleryPage() {
    const items = [...document.querySelectorAll(".gallery-grid .gallery-item[data-lightbox]")];
    if (!items.length) return;

    items.forEach((item) => {
        if (item.dataset.category) return;
        const caption = (item.dataset.caption || item.querySelector(".gallery-caption")?.textContent || "").toLowerCase();
        const category = inferGalleryCategory(caption);
        item.dataset.category = category;
    });

    const filterButtons = [...document.querySelectorAll("[data-gallery-filter]")];
    filterButtons.forEach((button) => button.addEventListener("click", () => {
        const category = button.dataset.galleryFilter;
        filterButtons.forEach((btn) => {
            const active = btn === button;
            btn.classList.toggle("active", active);
            btn.setAttribute("aria-pressed", String(active));
        });
        items.forEach((item) => {
            const show = category === "all" || item.dataset.category === category;
            item.hidden = !show;
            item.style.display = show ? "" : "none";
        });
    }));

    const lightbox = document.querySelector(".lightbox");
    if (!lightbox) return;
    const lightboxImg = lightbox.querySelector("img");
    const lightboxCaption = lightbox.querySelector("figure p");
    const visibleItems = () => items.filter((item) => !item.hidden && item.style.display !== "none");
    let currentIndex = 0;

    const openLightbox = (index) => {
        const list = visibleItems();
        if (!list.length) return;
        currentIndex = (index + list.length) % list.length;
        const item = list[currentIndex];
        const img = item.querySelector("img");
        lightboxImg.src = img?.currentSrc || img?.src || "";
        lightboxImg.alt = img?.alt || "Gallery image";
        if (lightboxCaption) lightboxCaption.textContent = item.dataset.caption || img?.alt || "Eaglewood Polytechnic Institute";
        lightbox.classList.add("open");
        lightbox.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    };

    const closeLightbox = () => {
        lightbox.classList.remove("open");
        lightbox.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    };

    items.forEach((item, index) => item.addEventListener("click", () => openLightbox(index)));
    lightbox.querySelector("[data-lightbox-close]")?.addEventListener("click", closeLightbox);
    lightbox.querySelector("[data-lightbox-prev]")?.addEventListener("click", () => openLightbox(currentIndex - 1));
    lightbox.querySelector("[data-lightbox-next]")?.addEventListener("click", () => openLightbox(currentIndex + 1));
    lightbox.addEventListener("click", (event) => { if (event.target === lightbox) closeLightbox(); });
    document.addEventListener("keydown", (event) => {
        if (!lightbox.classList.contains("open")) return;
        if (event.key === "Escape") closeLightbox();
        if (event.key === "ArrowLeft") openLightbox(currentIndex - 1);
        if (event.key === "ArrowRight") openLightbox(currentIndex + 1);
    });
}

function inferGalleryCategory(caption) {
    if (/lab|machine|computer|electrical|survey|chemistry|practical/.test(caption)) return "labs";
    if (/workshop|fabrication|fitting/.test(caption)) return "workshop";
    if (/hostel|dining|mess/.test(caption)) return "hostel";
    if (/gathering|festival|sports|volleyball|yoga|republic|teacher|ganesh|women|ncc|blood|health|poster|engineer|drone|traditional|placement/.test(caption)) return "events";
    return "campus";
}

/** FAQ accordion on about and similar pages. */
function initFaqAccordion() {
    document.querySelectorAll(".faq-item").forEach((item) => {
        const trigger = item.querySelector(".faq-question, summary, button");
        if (!trigger || trigger.dataset.faqBound) return;
        trigger.dataset.faqBound = "true";
        trigger.addEventListener("click", () => {
            const open = !item.classList.contains("open");
            item.classList.toggle("open", open);
            trigger.setAttribute("aria-expanded", String(open));
        });
    });
}


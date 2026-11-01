import { getSiteLogoUrl } from "./page-loader.js";

const NAV_COLLAPSE_WIDTH = 1280;

export const siteHeader = `
  <div id="top-bar" class="top-bar premium-topbar" aria-label="College information">
    <div class="epi-info-viewport"><div class="epi-info-track">
      <div class="epi-info-set">
        <span class="epi-info-item epi-info-approval">Approved by AICTE, DTE &amp; Govt. of Maharashtra</span>
        <span class="epi-info-item epi-info-affiliation">Affiliated to MSBTE &amp; DBATU</span>
        <span class="epi-info-item epi-info-codes">DTE 2634 | MSBTE 51307</span>
        <a class="epi-info-item epi-info-phone" href="tel:+919765543454">+91 97655 43454</a>
        <a class="epi-info-item epi-info-phone" href="tel:+919028185454">+91 90281 85454</a>
        <a class="epi-info-item epi-info-phone" href="tel:+919049344003">+91 90493 44003</a>
        <a class="epi-info-item epi-info-email" href="mailto:eaglewoodpoly@gmail.com">eaglewoodpoly@gmail.com</a>
        <a class="epi-info-item epi-info-email" href="mailto:eaglewoodcoe@gmail.com">eaglewoodcoe@gmail.com</a>
        <a class="epi-info-item epi-info-office" href="contact.html">Contact Office</a>
      </div>
      <div class="epi-info-set epi-info-set-copy" aria-hidden="true">
        <span class="epi-info-item epi-info-approval">Approved by AICTE, DTE &amp; Govt. of Maharashtra</span>
        <span class="epi-info-item epi-info-affiliation">Affiliated to MSBTE &amp; DBATU</span>
        <span class="epi-info-item epi-info-codes">DTE 2634 | MSBTE 51307</span>
        <a class="epi-info-item epi-info-phone" tabindex="-1" href="tel:+919765543454">+91 97655 43454</a>
        <a class="epi-info-item epi-info-phone" tabindex="-1" href="tel:+919028185454">+91 90281 85454</a>
        <a class="epi-info-item epi-info-phone" tabindex="-1" href="tel:+919049344003">+91 90493 44003</a>
        <a class="epi-info-item epi-info-email" tabindex="-1" href="mailto:eaglewoodpoly@gmail.com">eaglewoodpoly@gmail.com</a>
        <a class="epi-info-item epi-info-email" tabindex="-1" href="mailto:eaglewoodcoe@gmail.com">eaglewoodcoe@gmail.com</a>
        <a class="epi-info-item epi-info-office" tabindex="-1" href="contact.html">Contact Office</a>
      </div>
    </div></div>
  </div>
  <header class="site-header">
    <nav class="container navbar" aria-label="Main navigation">
      <a class="brand" href="index.html" aria-label="Eaglewood Polytechnic Institute home">
        <img src="${getSiteLogoUrl()}" alt="Eaglewood Polytechnic Institute official logo">
        <span><small>Venkateshwara Manav Vikas Mandal's</small><strong>Eaglewood Polytechnic Institute</strong><em>Affiliated to MSBTE &amp; DBATU · DTE 2634 | MSBTE 51307</em></span>
      </a>
      <ul class="nav-links" id="site-navigation">
        <li><a href="index.html">Home</a></li><li><a href="about.html">About</a></li><li><a href="courses.html">Courses</a></li><li><a href="departments.html">Departments</a></li><li><a href="faculty.html">Faculty</a></li><li><a href="committee.html">Committee</a></li><li><a href="alumni.html">Alumni</a></li><li><a href="placements.html">Placements</a></li><li><a href="infrastructure.html">Infrastructure</a></li><li><a href="gallery.html">Gallery</a></li><li class="nav-admission-link"><a href="admission.html">Admission</a></li><li><a href="contact.html">Contact</a></li>
      </ul>
      <div class="nav-actions">
        <a class="btn btn-sm nav-apply" href="admission.html">Admission <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 10h12m-5-5 5 5-5 5"/></svg></a>
        <div class="nav-ai-slot" data-nav-ai-slot></div>
        <button class="nav-toggle" type="button" aria-label="Open navigation menu" aria-controls="site-navigation" aria-expanded="false"><span></span><span></span><span></span></button>
      </div>
    </nav>
  </header>`;

let navigationBound = false;

export function injectSiteHeader() {
    const host = document.querySelector("[data-site-header]");
    if (!host || host.querySelector(".site-header")) return;
    host.insertAdjacentHTML("afterbegin", siteHeader);
}

/** Site navigation is initialized independently from CMS and Supabase startup. */
export function initSiteNavigation() {
    injectSiteHeader();
    if (navigationBound) return;
    const navToggle = document.querySelector(".nav-toggle");
    const navLinks = document.querySelector(".nav-links");
    if (!navToggle || !navLinks) return;
    navigationBound = true;

    const setOpen = (open) => {
        navLinks.classList.toggle("open", open);
        navToggle.classList.toggle("open", open);
        navToggle.setAttribute("aria-expanded", String(open));
        navToggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
        navLinks.setAttribute("aria-hidden", String(!open && window.innerWidth <= NAV_COLLAPSE_WIDTH));
        document.body.classList.toggle("no-scroll", open && window.innerWidth <= NAV_COLLAPSE_WIDTH);
    };

    navToggle.addEventListener("click", () => {
        setOpen(!navLinks.classList.contains("open"));
    });

    navLinks.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setOpen(false)));
    window.addEventListener("resize", () => {
        if (window.innerWidth > NAV_COLLAPSE_WIDTH) setOpen(false);
        else navLinks.setAttribute("aria-hidden", String(!navLinks.classList.contains("open")));
    }, { passive: true });
    document.addEventListener("click", (event) => {
        if (navLinks.classList.contains("open") && !event.target.closest(".navbar")) setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && navLinks.classList.contains("open")) {
            setOpen(false);
            navToggle.focus();
        }
    });

    const currentPage = location.pathname.split("/").pop() || "index.html";
    navLinks.querySelectorAll("a").forEach((link) => {
        if (link.getAttribute("href") === currentPage) {
            link.classList.add("active");
            link.setAttribute("aria-current", "page");
        }
    });
    navLinks.setAttribute("aria-hidden", String(window.innerWidth <= NAV_COLLAPSE_WIDTH));
}

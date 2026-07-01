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
        <img src="assets/images/logo.jpg" alt="Eaglewood Polytechnic Institute official logo">
        <span><small>Venkateshwara Manav Vikas Mandal's</small><strong>Eaglewood Polytechnic Institute</strong><em>DTE 2634 &nbsp;•&nbsp; MSBTE 51307</em></span>
      </a>
      <button class="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false"><span></span><span></span><span></span></button>
      <ul class="nav-links">
        <li><a href="index.html">Home</a></li><li><a href="about.html">About</a></li><li><a href="courses.html">Courses</a></li><li><a href="departments.html">Departments</a></li><li><a href="infrastructure.html">Infrastructure</a></li><li><a href="gallery.html">Gallery</a></li><li><a href="admission.html">Admission</a></li><li><a href="contact.html">Contact</a></li>
      </ul>
      <a class="btn btn-sm nav-apply" href="admission.html">Admission <span>→</span></a>
    </nav>
  </header>`;

const siteFooter = `
  <footer class="site-footer">
    <div class="container footer-grid footer-grid-minimal">
      <div class="footer-about">
        <a class="footer-logo" href="index.html"><img src="assets/images/logo.jpg" alt="Eaglewood official logo"><span>Eaglewood Polytechnic Institute</span></a>
        <div class="socials" aria-label="Eaglewood social media">
          <a href="https://www.facebook.com/people/Eaglewood-Polytechnic-Institute-Phule-Pimpalgaon-Majalgaon/100094206302049/?mibextid=ZbWKwL" target="_blank" rel="noopener noreferrer" aria-label="Eaglewood on Facebook"><span aria-hidden="true">f</span><em>Facebook</em></a>
          <a href="https://www.instagram.com/eaglewood_polytechnic/" target="_blank" rel="noopener noreferrer" aria-label="Eaglewood on Instagram"><span aria-hidden="true">◎</span><em>Instagram</em></a>
          <a href="https://x.com/eaglewoodpoly?t=IeFIDR-stfwL8BUZjZEZgQ&amp;s=08" target="_blank" rel="noopener noreferrer" aria-label="Eaglewood on X"><span aria-hidden="true">X</span><em>Twitter / X</em></a>
        </div>
      </div>
      <div class="footer-contact-compact"><h3>Contact</h3><address>Sunanda Nagar, Phule Pimpalgaon, Majalgaon, Dist. Beed 431131</address><a href="tel:+919423716230">+91 94237 16230</a><a href="mailto:eaglewoodpoly@gmail.com">eaglewoodpoly@gmail.com</a></div>
    </div>
    <div class="container footer-line"><span>© <span data-year></span> Eaglewood Polytechnic Institute. All rights reserved.</span></div>
    <div class="developer-credit"><span>Designed &amp; Developed by <strong>Shubham Ahire</strong> | Contact: <a href="https://wa.me/917249868133" target="_blank" rel="noopener noreferrer">7249868133</a></span></div>
  </footer>
  <a class="whatsapp" href="https://wa.me/919423716230" target="_blank" rel="noopener noreferrer" aria-label="Chat with Eaglewood admissions on WhatsApp"><span>WA</span><em>WhatsApp</em></a>
  <a class="mobile-apply" href="admission.html">Admission <span>→</span></a>
  <button class="back-top" type="button" aria-label="Back to top">↑</button>`;

document.querySelector("[data-site-header]")?.insertAdjacentHTML("afterbegin", siteHeader);
document.querySelector("[data-site-footer]")?.insertAdjacentHTML("afterbegin", siteFooter);

document.addEventListener("DOMContentLoaded", () => {
  const currentPage = location.pathname.split("/").pop() || "index.html";
  document.body.classList.toggle("home-page", currentPage === "index.html");
  const loader = document.querySelector(".page-loader");
  const finishLoading = () => window.setTimeout(() => loader?.classList.add("loaded"), 450);
  if (document.readyState === "complete") finishLoading();
  else window.addEventListener("load", finishLoading, { once: true });
  window.setTimeout(() => loader?.classList.add("loaded"), 1800);
  document.querySelectorAll("img").forEach((image) => { image.decoding = "async"; });

  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");
  navToggle?.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    navToggle.classList.toggle("open", open);
    navToggle.setAttribute("aria-expanded", String(open));
  });
  navLinks?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    navLinks.classList.remove("open"); navToggle?.classList.remove("open");
    navToggle?.setAttribute("aria-expanded", "false");
  }));
  document.addEventListener("click", (event) => {
    if (navLinks?.classList.contains("open") && !event.target.closest(".navbar")) {
      navLinks.classList.remove("open"); navToggle?.classList.remove("open");
      navToggle?.setAttribute("aria-expanded", "false");
    }
  });

  const slides = [...document.querySelectorAll(".hero-slide")];
  const sliderDots = [...document.querySelectorAll(".hero-dot")];
  const showSlide = (nextIndex) => {
    if (!slides.length) return;
    const index = (nextIndex + slides.length) % slides.length;
    slides.forEach((slide, itemIndex) => slide.classList.toggle("active", itemIndex === index));
    sliderDots.forEach((dot, itemIndex) => {
      dot.classList.toggle("active", itemIndex === index);
      dot.setAttribute("aria-current", itemIndex === index ? "true" : "false");
    });
  };
  if (slides.length) {
    let currentSlide = 0;
    let sliderTimer;
    const restartSlider = () => {
      window.clearInterval(sliderTimer);
      sliderTimer = window.setInterval(() => { currentSlide = (currentSlide + 1) % slides.length; showSlide(currentSlide); }, 5500);
    };
    sliderDots.forEach((dot, index) => dot.addEventListener("click", () => { currentSlide = index; showSlide(index); restartSlider(); }));
    document.querySelector("[data-slide-prev]")?.addEventListener("click", () => { currentSlide = (currentSlide - 1 + slides.length) % slides.length; showSlide(currentSlide); restartSlider(); });
    document.querySelector("[data-slide-next]")?.addEventListener("click", () => { currentSlide = (currentSlide + 1) % slides.length; showSlide(currentSlide); restartSlider(); });
    showSlide(0);
    restartSlider();
  }

  document.querySelectorAll(".nav-links a").forEach((link) => {
    if (link.getAttribute("href") === currentPage) { link.classList.add("active"); link.setAttribute("aria-current", "page"); }
  });

  document.querySelectorAll("[data-tab-group]").forEach((group) => {
    group.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => {
      group.querySelectorAll("[data-tab]").forEach((item) => { item.classList.remove("active"); item.setAttribute("aria-selected", "false"); });
      group.querySelectorAll(".tab-panel").forEach((item) => item.classList.remove("active"));
      button.classList.add("active"); button.setAttribute("aria-selected", "true");
      group.querySelector(`#${button.dataset.tab}`)?.classList.add("active");
    }));
  });

  const filterButtons = [...document.querySelectorAll("[data-gallery-filter]")];
  const filterItems = [...document.querySelectorAll(".gallery-item[data-lightbox]")];
  const inferCategory = (item) => {
    const text = `${item.dataset.caption || ""} ${item.querySelector("img")?.alt || ""}`.toLowerCase();
    if (text.includes("hostel") || text.includes("dining")) return "hostel";
    if (text.includes("workshop") || text.includes("machine")) return "workshop";
    if (text.includes("lab") || text.includes("surveying") || text.includes("computer") || text.includes("electrical") || text.includes("chemistry")) return "labs";
    if (text.includes("campus") || text.includes("institute")) return "campus";
    return "events";
  };
  filterItems.forEach((item) => { item.dataset.category ||= inferCategory(item); });
  filterButtons.forEach((button) => button.addEventListener("click", () => {
    const selected = button.dataset.galleryFilter;
    filterButtons.forEach((item) => {
      item.classList.toggle("active", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    });
    filterItems.forEach((item) => { item.hidden = selected !== "all" && item.dataset.category !== selected; });
  }));

  const lightbox = document.querySelector(".lightbox");
  const lightboxImage = lightbox?.querySelector("img");
  const lightboxCaption = lightbox?.querySelector("p");
  const lightboxItems = [...document.querySelectorAll("[data-lightbox]")];
  let lightboxIndex = 0;
  const visibleLightboxItems = () => lightboxItems.filter((item) => !item.hidden);
  const renderLightbox = () => {
    const items = visibleLightboxItems();
    const item = items[lightboxIndex];
    if (!item || !lightboxImage) return;
    lightboxImage.src = item.querySelector("img")?.src || item.dataset.image;
    lightboxImage.alt = item.dataset.caption || "Eaglewood campus gallery";
    lightboxCaption.textContent = `${item.dataset.caption || "Eaglewood Polytechnic Institute"} · ${lightboxIndex + 1} / ${items.length}`;
  };
  let lightboxTrigger;
  const closeLightbox = () => {
    lightbox?.classList.remove("open"); document.body.classList.remove("no-scroll");
    lightbox?.setAttribute("aria-hidden", "true"); lightboxTrigger?.focus();
  };
  lightboxItems.forEach((item) => item.addEventListener("click", () => {
    if (!lightbox || !lightboxImage) return;
    lightboxIndex = visibleLightboxItems().indexOf(item); lightboxTrigger = item;
    renderLightbox();
    lightbox.classList.add("open"); document.body.classList.add("no-scroll");
    lightbox.setAttribute("aria-hidden", "false");
    lightbox.querySelector("[data-lightbox-close]")?.focus();
  }));
  lightbox?.querySelector("[data-lightbox-close]")?.addEventListener("click", closeLightbox);
  lightbox?.querySelector("[data-lightbox-prev]")?.addEventListener("click", () => { const count = visibleLightboxItems().length; lightboxIndex = (lightboxIndex - 1 + count) % count; renderLightbox(); });
  lightbox?.querySelector("[data-lightbox-next]")?.addEventListener("click", () => { const count = visibleLightboxItems().length; lightboxIndex = (lightboxIndex + 1) % count; renderLightbox(); });
  lightbox?.addEventListener("click", (event) => { if (event.target === lightbox) closeLightbox(); });
  document.addEventListener("keydown", (event) => {
    if (!lightbox?.classList.contains("open")) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "Tab") {
      const controls = [...lightbox.querySelectorAll("button")];
      const current = controls.indexOf(document.activeElement);
      event.preventDefault();
      controls[(current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
    }
    if (event.key === "ArrowLeft") { const count = visibleLightboxItems().length; lightboxIndex = (lightboxIndex - 1 + count) % count; renderLightbox(); }
    if (event.key === "ArrowRight") { const count = visibleLightboxItems().length; lightboxIndex = (lightboxIndex + 1) % count; renderLightbox(); }
  });

  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add("revealed"); observer.unobserve(entry.target); }
  }), { threshold: .08 });
  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

  const backTop = document.querySelector(".back-top");
  const updateScrollState = () => {
    backTop?.classList.toggle("visible", scrollY > 650);
    document.body.classList.toggle("header-scrolled", scrollY > 28);
  };
  window.addEventListener("scroll", updateScrollState, { passive: true });
  updateScrollState();
  backTop?.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
  document.querySelectorAll("[data-year]").forEach((item) => { item.textContent = new Date().getFullYear(); });

  document.querySelectorAll('a[href$=".html"], a[href*=".html#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || link.target === "_blank") return;
      const destination = new URL(link.href, location.href);
      if (destination.origin !== location.origin || destination.pathname === location.pathname) return;
      event.preventDefault(); document.body.classList.add("page-leaving");
      window.setTimeout(() => { location.href = destination.href; }, 180);
    });
  });
});

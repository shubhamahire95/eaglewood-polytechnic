/**
 * UI polish utilities — lazy load, resize debounce, mobile gallery (no CRUD).
 */

let resizeTimer = null;

export function debounceResize(fn, wait = 120) {
  return (...args) => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => fn(...args), wait);
  };
}

export function initLazySections() {
    if (!("IntersectionObserver" in window)) {
        document.querySelectorAll("[data-lazy-section]").forEach((el) => el.classList.add("is-visible"));
        return;
    }
    const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
        });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.08 });
    document.querySelectorAll(".premium-section, [data-lazy-section]").forEach((el) => io.observe(el));
}

export function initLazyImages() {
    const images = document.querySelectorAll('img[loading="lazy"]:not([data-polish-lazy])');
    images.forEach((img) => {
        img.dataset.polishLazy = "1";
        if (img.complete && img.naturalWidth) return;
        img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
    });
}

export function initGalleryMobileSwiper() {
    const el = document.querySelector(".gallery-mobile-swiper");
    if (!el || el.dataset.bound === "1") return;
    el.dataset.bound = "1";
    const boot = () => {
        if (!window.Swiper) return false;
        new window.Swiper(el, {
            slidesPerView: 1.12,
            spaceBetween: 14,
            loop: true,
            speed: 650,
            grabCursor: true,
            autoplay: { delay: 4000, disableOnInteraction: false, pauseOnMouseEnter: true },
            pagination: { el: ".gallery-mobile-pagination", clickable: true },
            navigation: { nextEl: ".gallery-mobile-next", prevEl: ".gallery-mobile-prev" },
            breakpoints: {
                480: { slidesPerView: 1.25, spaceBetween: 16 },
            },
        });
        return true;
    };
    if (!boot()) {
        const wait = setInterval(() => { if (boot()) clearInterval(wait); }, 60);
        setTimeout(() => clearInterval(wait), 8000);
    }
}

function initPrincipalPhotoFit() {
    document.querySelectorAll(".gov-principal-photo, .principal-about-photo").forEach((img) => {
        const apply = () => {
            if (!img.naturalWidth || !img.naturalHeight) return;
            const ratio = img.naturalWidth / img.naturalHeight;
            if (ratio >= 0.72 && ratio <= 1.38) {
                img.classList.add("is-logo");
            }
        };
        if (img.complete) apply();
        else img.addEventListener("load", apply, { once: true });
    });
}

export function initPublicUiPolish() {
    initLazySections();
    initLazyImages();
    initPrincipalPhotoFit();
    initGalleryMobileSwiper();
    window.addEventListener("resize", debounceResize(() => {
        document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    }), { passive: true });
    document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
}

export function initAdminUiPolish() {
    const closeSidebarOnMobile = () => {
        if (window.matchMedia("(max-width: 780px)").matches) {
            document.body.classList.remove("sidebar-open");
        }
    };
    document.getElementById("adminNav")?.addEventListener("click", (e) => {
        if (e.target.closest(".nav-item")) closeSidebarOnMobile();
    });
    window.addEventListener("resize", debounceResize(closeSidebarOnMobile), { passive: true });
}

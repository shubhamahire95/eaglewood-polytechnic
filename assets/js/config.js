/**
 * Eaglewood Polytechnic — Home Page Configuration
 * Central config for animations, observers, and CMS field mapping.
 */

export const CONFIG = {
    site: {
        name: "Eaglewood Polytechnic Institute",
        phone: "+91 94237 16230",
        email: "eaglewoodpoly@gmail.com",
    },

    animation: {
        revealThreshold: 0.08,
        counterDuration: 1200,
        heroSlideInterval: 5500,
        scrollDebounceMs: 16,
        resizeThrottleMs: 150,
    },

    lazyLoad: {
        rootMargin: "120px",
        threshold: 0.01,
    },

    sections: {
        hero: "hero",
        about: "about",
        principal: "principal",
        statistics: "statistics",
        courses: "courses",
        departments: "departments",
        facilities: "facilities",
        placements: "placements",
        gallery: "gallery",
        testimonials: "testimonials",
        announcements: "announcements",
        news: "breaking-news",
        events: "events",
        faq: "faq",
        contact: "contact",
        footer: "footer",
        topBar: "top-bar",
    },

    cms: {
        enabled: true,
        storageBucket: "cms",
    },
};

export default CONFIG;

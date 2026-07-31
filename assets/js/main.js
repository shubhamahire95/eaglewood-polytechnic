/**
 * Eaglewood Polytechnic - Site Entry Point
 * Home renders from the production Supabase CMS; other pages keep shared chrome behavior.
 */

async function initAssistant() {
    try {
        const { initAiAssistant } = await import("./ai-assistant.js");
        await initAiAssistant();
    } catch {
        /* AI assistant is optional — fail silently */
    }
}

function hidePageLoader() {
    const loader = document.querySelector(".page-loader");
    if (loader) loader.classList.add("loaded");
}

function renderBootFallback() {
    const main = document.getElementById("main");
    if (!main || main.children.length) return;
    main.innerHTML = `<section class="section"><div class="container"><p class="eyebrow">Eaglewood Polytechnic Institute</p><h1>Welcome to Eaglewood Polytechnic Institute</h1><p>The website is loading local institute information. Please use the contact links for admission support.</p><a class="btn" href="tel:+919423716230">Call Office</a></div></section>`;
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const isHomePage = document.body.hasAttribute("data-home");
        const { initLegacyUI } = await import("./ui.js");

        if (isHomePage) {
            const { renderCmsHome } = await import("./home-cms.js");
            await renderCmsHome();
            await initAssistant();
        } else {
            initLegacyUI();
            const { initDynamicPages } = await import("./page-forms.js");
            await initDynamicPages();
            await initAssistant();
        }
    } catch (error) {
        try {
            const { injectSiteChrome, initFooterSettings } = await import("./ui.js");
            injectSiteChrome();
            void initFooterSettings();
        } catch { /* ignore */ }
        renderBootFallback();
    } finally {
        hidePageLoader();
    }
});

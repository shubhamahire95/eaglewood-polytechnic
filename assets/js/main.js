/**
 * Eaglewood Polytechnic - Site Entry Point
 * Home renders from the production Supabase CMS; other pages keep shared chrome behavior.
 */

import { dismissPageLoader, preloadSiteLogo } from "./page-loader.js";
import { applyStorageImageMapToDom } from "./media-url.js";
import { installGlobalErrorHandlers } from "./errors.js";

preloadSiteLogo();
void applyStorageImageMapToDom();
installGlobalErrorHandlers();

async function initAssistant() {
    try {
        const { initAiAssistant } = await import("./ai-assistant.js");
        await initAiAssistant();
    } catch {
        /* AI assistant is optional — fail silently */
    }
}

function renderBootFallback() {
    const main = document.getElementById("main");
    if (!main || main.children.length) return;
    main.innerHTML = `<section class="section"><div class="container"><p class="eyebrow">Eaglewood Polytechnic Institute</p><h1>Welcome to Eaglewood Polytechnic Institute</h1><p>The website is loading local institute information. Please use the contact links for admission support.</p><a class="btn" href="tel:+919423716230">Call Office</a></div></section>`;
}

function runWhenDocumentReady(fn) {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => { void fn(); });
        return;
    }
    void fn();
}

runWhenDocumentReady(async () => {
    const isHomePage = document.body.hasAttribute("data-home");
    try {
        const { initLegacyUI } = await import("./ui.js");

        if (isHomePage) {
            const { renderCmsHome } = await import("./home-cms.js");
            await renderCmsHome();
            const { initPublicUiPolish } = await import("./ui-polish.js");
            initPublicUiPolish();
            await initAssistant();
        } else {
            initLegacyUI();
            const { initDynamicPages } = await import("./page-forms.js");
            await initDynamicPages();
            const { initPublicUiPolish } = await import("./ui-polish.js");
            initPublicUiPolish();
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
        await dismissPageLoader({
            waitForHero: isHomePage,
            waitForCms: isHomePage,
        });
    }
});

/**
 * Shared page loader — college logo, preload, and smart dismiss timing.
 */

import { resolveMediaUrlSync } from "./media-url.js";

export const SITE_LOGO_URL = "assets/images/logo.jpg";

const PAGE_LOADER_FADE_MS = 480;
const PAGE_LOADER_MAX_MS = 3000;

let logoPreloadPromise = null;
let dismissPromise = null;
let dismissed = false;

export function getSiteLogoUrl() {
    return resolveMediaUrlSync(SITE_LOGO_URL);
}

export function preloadSiteLogo() {
    if (logoPreloadPromise) return logoPreloadPromise;
    logoPreloadPromise = new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = resolveMediaUrlSync(SITE_LOGO_URL);
    });
    return logoPreloadPromise;
}

preloadSiteLogo();

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function whenCriticalCssReady() {
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')];
    if (!links.length) return Promise.resolve();
    return Promise.all(
        links.map(
            (link) =>
                new Promise((resolve) => {
                    if (link.sheet) {
                        resolve();
                        return;
                    }
                    link.addEventListener("load", resolve, { once: true });
                    link.addEventListener("error", resolve, { once: true });
                })
        )
    );
}

function whenFontsReady() {
    if (!document.fonts?.ready) return Promise.resolve();
    return document.fonts.ready.catch(() => {});
}

function waitForCmsReady() {
    if (document.body?.dataset.cmsReady === "true") return Promise.resolve();
    return new Promise((resolve) => {
        const finish = () => {
            clearTimeout(timeout);
            observer?.disconnect();
            resolve();
        };
        const timeout = setTimeout(finish, PAGE_LOADER_MAX_MS);
        const observer = new MutationObserver(() => {
            if (document.body.dataset.cmsReady === "true") finish();
        });
        if (document.body) {
            observer.observe(document.body, { attributes: true, attributeFilter: ["data-cms-ready"] });
        } else {
            finish();
        }
    });
}

function loadImage(src) {
    if (!src) return Promise.resolve();
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = resolve;
        img.src = src;
    });
}

function whenHeroImagesReady() {
    const images = document.querySelectorAll("#hero img[src], .premium-slide img[src]");
    if (!images.length) return Promise.resolve();
    const tasks = [...images].map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return loadImage(img.currentSrc || img.src);
    });
    return Promise.allSettled(tasks);
}

export function markCmsReady() {
    if (document.body) document.body.dataset.cmsReady = "true";
}

export async function dismissPageLoader(options = {}) {
    const { waitForHero = false, waitForCms = false } = options;
    if (dismissPromise) return dismissPromise;

    dismissPromise = (async () => {
        const loader = document.getElementById("pageLoader") || document.querySelector(".page-loader");
        if (!loader || dismissed) {
            dismissed = true;
            return;
        }

        const tasks = [preloadSiteLogo(), whenCriticalCssReady(), whenFontsReady()];
        if (waitForCms) tasks.push(waitForCmsReady());
        if (waitForHero) tasks.push(whenHeroImagesReady());

        await Promise.race([Promise.allSettled(tasks), sleep(PAGE_LOADER_MAX_MS)]);

        dismissed = true;
        loader.classList.add("is-hiding");
        loader.setAttribute("aria-busy", "false");
        await sleep(PAGE_LOADER_FADE_MS);
        loader.classList.add("is-hidden");
        loader.setAttribute("hidden", "");
    })();

    return dismissPromise;
}

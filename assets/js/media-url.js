/**
 * Resolve local asset paths to Supabase Storage public URLs when mapped.
 */
import { getCmsStoragePublicUrl } from "./supabase.js";

export const CMS_STORAGE_PUBLIC_BASE = getCmsStoragePublicUrl("");

let mapPromise = null;
let cachedMap = {};

function mapUrl() {
    if (typeof document === "undefined") return "/assets/data/storage-image-map.json";
    if (typeof location !== "undefined" && location.origin) {
        return `${location.origin}/assets/data/storage-image-map.json`;
    }
    return "/assets/data/storage-image-map.json";
}

async function loadMap() {
    if (mapPromise) return mapPromise;
    mapPromise = fetch(mapUrl(), { cache: "no-store" })
        .then((res) => {
            if (!res.ok) return {};
            return res.json();
        })
        .then((map) => {
            cachedMap = map && typeof map === "object" ? map : {};
            return cachedMap;
        })
        .catch(() => {
            cachedMap = {};
            return cachedMap;
        });
    return mapPromise;
}

export async function ensureMediaMap() {
    return loadMap();
}

export function getMediaMap() {
    return cachedMap;
}

export async function resolveMediaUrl(path) {
    if (!path || typeof path !== "string") return path || "";
    if (/^https?:\/\//i.test(path)) return path;
    const normalized = path.replace(/^\.\//, "").replace(/^\//, "");
    const map = await loadMap();
    return map[normalized] || map[path] || path;
}

export function resolveMediaUrlSync(path, map = cachedMap) {
    if (!path || typeof path !== "string") return path || "";
    if (/^https?:\/\//i.test(path)) return path;
    const normalized = path.replace(/^\.\//, "").replace(/^\//, "");
    return map[normalized] || map[path] || path;
}

function adminAssetBase() {
    if (typeof location === "undefined") return "";
    return location.pathname.includes("/admin/") ? "../" : "";
}

/** Resolve any stored media path for admin previews (tables, editor, thumbnails). */
export function resolveAdminPreviewUrl(path, map = cachedMap) {
    if (!path || typeof path !== "string") return "";
    const trimmed = path.trim();
    if (!trimmed) return "";
    if (/^(https?:|blob:)/i.test(trimmed)) return trimmed;

    const mapped = resolveMediaUrlSync(trimmed, map);
    if (/^(https?:|blob:)/i.test(mapped)) return mapped;

    const base = adminAssetBase();
    if (mapped.startsWith("assets/")) return `${base}${mapped}`;
    if (mapped.startsWith("/")) return `${base}${mapped.replace(/^\//, "")}`;

    if (
        /\/storage\/v1\/object\/public\//i.test(mapped)
        || /\.(jpe?g|png|webp|gif|svg|avif)(\?|#|$)/i.test(mapped)
        || /^(principal|faculty|courses|departments|facilities|gallery|hero|notices|updates|placements|media)\//i.test(mapped)
    ) {
        return `${CMS_STORAGE_PUBLIC_BASE}${mapped.replace(/^\//, "")}`;
    }

    return `${base}${mapped}`;
}

/** Whether an upload field value should show an image preview. */
export function isRenderableImageUrl(value, fieldType = "image") {
    if (!value || typeof value !== "string") return false;
    const str = value.trim();
    if (!str) return false;
    if (fieldType === "image") return true;
    return (
        /\.(jpe?g|png|webp|gif|svg|avif)(\?|#|$)/i.test(str)
        || /^blob:/i.test(str)
        || /\/storage\/v1\/object\/public\//i.test(str)
    );
}

function resolveAttribute(value, map) {
    if (!value || typeof value !== "string") return value;
    let out = value;
    for (const [local, remote] of Object.entries(map)) {
        if (out.includes(local)) out = out.split(local).join(remote);
    }
    return out;
}

/** Patch img/src and data-full attributes after migration map loads. */
export async function applyStorageImageMapToDom(root = document) {
    const map = await loadMap();
    if (!Object.keys(map).length) return map;

    root.querySelectorAll("img[src]").forEach((img) => {
        const next = resolveMediaUrlSync(img.getAttribute("src") || "", map);
        if (next && next !== img.getAttribute("src")) img.src = next;
    });

    root.querySelectorAll("[data-full]").forEach((el) => {
        const next = resolveAttribute(el.getAttribute("data-full"), map);
        if (next && next !== el.getAttribute("data-full")) el.setAttribute("data-full", next);
    });

    root.querySelectorAll("link[rel='preload'][as='image']").forEach((link) => {
        const next = resolveMediaUrlSync(link.getAttribute("href") || "", map);
        if (next && next !== link.getAttribute("href")) link.href = next;
    });

    return map;
}

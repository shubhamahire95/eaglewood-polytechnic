/**
 * Shared utilities for image migration scripts.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
export const PUBLISHABLE_KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";
export const BUCKET = "cms";
export const STORAGE_PREFIX = "site-assets";
export const DEFAULT_ADMIN_EMAIL = "admin@eaglewoodpoly.in";
export const DEFAULT_ADMIN_PASSWORD = "admin123";

export const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"]);
export const SCAN_EXT = new Set([".html", ".js", ".css", ".json", ".md", ".xml"]);
export const SKIP_DIRS = new Set(["node_modules", ".git", "tmp", "agent-transcripts", ".cursor"]);

export const CMS_TABLES = [
    "home_slides", "principal_message", "updates", "notices", "courses",
    "departments", "faculty", "facilities", "placements", "gallery",
    "media_library", "footer_blocks", "settings",
];

export const IMAGE_FIELD_NAMES = new Set([
    "image_url", "photo_url", "department_image_url", "hod_photo_url",
    "company_logo_url", "file_url", "thumbnail_url", "pdf_url", "attachment_url",
    "syllabus_pdf_url", "logo_url",
]);

const REF_PATTERN = /(?:\.\.\/)?assets\/images\/[A-Za-z0-9_./%-]+/gi;

export function loadServiceRoleKey() {
    const candidates = [process.env.SUPABASE_SERVICE_ROLE_KEY].filter(Boolean);
    for (const envFile of [".env.local", ".env"]) {
        const path = join(ROOT, envFile);
        if (!existsSync(path)) continue;
        const text = readFileSync(path, "utf8");
        for (const line of text.split("\n")) {
            const match = line.match(/^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?([^"'\n#]+)/);
            if (match) candidates.push(match[1].trim());
        }
    }
    return candidates[0] || "";
}

export function loadAdminCredentials() {
    const email = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
    for (const envFile of [".env.local", ".env"]) {
        const path = join(ROOT, envFile);
        if (!existsSync(path)) continue;
        const text = readFileSync(path, "utf8");
        for (const line of text.split("\n")) {
            const emailMatch = line.match(/^\s*ADMIN_EMAIL\s*=\s*["']?([^"'\n#]+)/);
            const passMatch = line.match(/^\s*ADMIN_PASSWORD\s*=\s*["']?([^"'\n#]+)/);
            if (emailMatch) return { email: emailMatch[1].trim(), password: passMatch?.[1]?.trim() || password };
            if (passMatch) return { email, password: passMatch[1].trim() };
        }
    }
    return { email, password };
}

export function uploadHeaders(serviceKey, localPath, adminCreds = null) {
    const base = {
        "Content-Type": mimeFor(localPath),
        "x-upsert": "true",
    };
    if (serviceKey) return serviceHeaders(serviceKey, base);
    const creds = adminCreds || loadAdminCredentials();
    return {
        apikey: PUBLISHABLE_KEY,
        Authorization: `Bearer ${PUBLISHABLE_KEY}`,
        "x-admin-email": creds.email,
        "x-admin-password": creds.password,
        ...base,
    };
}

export function serviceHeaders(key, extra = {}) {
    return {
        apikey: key,
        Authorization: `Bearer ${key}`,
        ...extra,
    };
}

export function walk(dir, files = []) {
    if (!existsSync(dir)) return files;
    for (const entry of readdirSync(dir)) {
        if (SKIP_DIRS.has(entry)) continue;
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) walk(full, files);
        else files.push(full);
    }
    return files;
}

export function normalizeAssetPath(raw) {
    if (!raw) return "";
    let path = String(raw).replace(/\\/g, "/").trim();
    path = path.replace(/^\.\//, "");
    path = path.replace(/^\.\.\//, "");
    if (path.startsWith("/")) path = path.slice(1);
    if (path.startsWith("https://www.eaglewoodpoly.in/")) {
        path = path.replace("https://www.eaglewoodpoly.in/", "");
    }
    if (!path.startsWith("assets/images/")) return "";
    return path;
}

export function collectReferencedImages() {
    const refs = new Set();
    const files = walk(ROOT).filter((f) => SCAN_EXT.has(extname(f).toLowerCase()));

    for (const file of files) {
        const rel = relative(ROOT, file).replace(/\\/g, "/");
        if (rel.startsWith("tmp/") || rel.includes("node_modules")) continue;
        const text = readFileSync(file, "utf8");
        for (const match of text.matchAll(REF_PATTERN)) {
            const normalized = normalizeAssetPath(match[0]);
            if (normalized) refs.add(normalized);
        }
    }

    return [...refs]
        .filter((p) => existsSync(join(ROOT, p)))
        .filter((p) => IMAGE_EXT.has(extname(p).toLowerCase()))
        .sort();
}

export function storagePathFor(localPath) {
    const rel = localPath.replace(/\\/g, "/").replace(/^assets\/images\//, "");
    return `${STORAGE_PREFIX}/${rel}`;
}

export function publicUrl(storagePath) {
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

export function mimeFor(filePath) {
    const ext = extname(filePath).toLowerCase();
    const map = {
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
    };
    return map[ext] || "application/octet-stream";
}

export function replacePathsInText(text, map) {
    let out = text;
    const entries = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
    for (const [local, remote] of entries) {
        const variants = [
            local,
            `../${local}`,
            `/${local}`,
            `https://www.eaglewoodpoly.in/${local}`,
        ];
        for (const variant of variants) {
            out = out.split(variant).join(remote);
        }
    }
    return out;
}

export function collectProjectFiles() {
    return walk(ROOT).filter((f) => {
        const ext = extname(f).toLowerCase();
        if (!SCAN_EXT.has(ext)) return false;
        const rel = relative(ROOT, f).replace(/\\/g, "/");
        if (rel.startsWith("tmp/") || rel.includes("node_modules")) return false;
        return true;
    });
}

export function extractImagePathsFromValue(value) {
    const found = new Set();
    const visit = (v) => {
        if (typeof v === "string") {
            for (const match of v.matchAll(REF_PATTERN)) {
                const normalized = normalizeAssetPath(match[0]);
                if (normalized) found.add(normalized);
            }
            if (v.includes("assets/images/")) {
                const normalized = normalizeAssetPath(v);
                if (normalized) found.add(normalized);
            }
        } else if (Array.isArray(v)) {
            v.forEach(visit);
        } else if (v && typeof v === "object") {
            Object.values(v).forEach(visit);
        }
    };
    visit(value);
    return [...found];
}

export function replacePathsInValue(value, map) {
    if (typeof value === "string") {
        return replacePathsInText(value, map);
    }
    if (Array.isArray(value)) {
        return value.map((item) => replacePathsInValue(item, map));
    }
    if (value && typeof value === "object") {
        const out = {};
        for (const [key, val] of Object.entries(value)) {
            out[key] = replacePathsInValue(val, map);
        }
        return out;
    }
    return value;
}

export async function verifyUrl(url) {
    try {
        const res = await fetch(url, { method: "HEAD" });
        if (res.ok) return { ok: true, status: res.status };
        const getRes = await fetch(url, { method: "GET" });
        return { ok: getRes.ok, status: getRes.status };
    } catch (error) {
        return { ok: false, status: 0, error: error.message };
    }
}

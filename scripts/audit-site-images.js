#!/usr/bin/env node
/**
 * Audit all image references in the project and verify remote URLs load.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    ROOT,
    SUPABASE_URL,
    collectReferencedImages,
    verifyUrl,
    walk,
} from "./lib/image-migration.js";

const MAP_PATH = join(ROOT, "assets", "data", "storage-image-map.json");
const LOCALHOST_PATTERN = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0)/i;
const SUPABASE_STORAGE_PATTERN = /\/storage\/v1\/object\/public\/cms\//i;

function loadMap() {
    try {
        return JSON.parse(readFileSync(MAP_PATH, "utf8"));
    } catch {
        return {};
    }
}

function collectRemoteImageUrls() {
    const urls = new Set();
    const files = walk(ROOT).filter((f) => /\.(html|js|css|json)$/i.test(f));
    for (const file of files) {
        const rel = file.replace(ROOT, "").replace(/\\/g, "/").replace(/^\//, "");
        if (rel.startsWith("tmp/") || rel.includes("node_modules")) continue;
        const text = readFileSync(file, "utf8");
        const matches = text.matchAll(/https?:\/\/[^\s"'`)]+/gi);
        for (const m of matches) {
            const url = m[0];
            if (/\.(jpg|jpeg|png|webp|gif|svg)(\?|$)/i.test(url) || SUPABASE_STORAGE_PATTERN.test(url)) {
                urls.add(url.replace(/[),.;]+$/, ""));
            }
        }
    }
    return [...urls];
}

function findLocalhostImageRefs() {
    const hits = [];
    const files = walk(ROOT).filter((f) => /\.(html|js|css|json)$/i.test(f));
    for (const file of files) {
        const rel = file.replace(ROOT, "").replace(/\\/g, "/").replace(/^\//, "");
        if (rel.startsWith("tmp/") || rel.includes("node_modules")) continue;
        const text = readFileSync(file, "utf8");
        if (LOCALHOST_PATTERN.test(text) && /assets\/images|\.(jpg|jpeg|png|webp|gif|svg)/i.test(text)) {
            hits.push(rel);
        }
    }
    return hits;
}

async function main() {
    const localRefs = collectReferencedImages();
    const map = loadMap();
    const mapUrls = new Set(Object.values(map));
    const projectUrls = collectRemoteImageUrls();
    const localhostRefs = findLocalhostImageRefs();

    console.log("── Image Audit ──\n");

    console.log(`Local assets/images references: ${localRefs.length}`);
    localRefs.forEach((p) => console.log(`  LOCAL  ${p}`));

    console.log(`\nMapped URLs in storage-image-map.json: ${mapUrls.size}`);
    console.log(`Remote image URLs in project: ${projectUrls.length}`);
    console.log(`Localhost image references: ${localhostRefs.length}`);
    localhostRefs.forEach((f) => console.log(`  LOCALHOST  ${f}`));

    const failures = [];
    const checked = new Set([...mapUrls, ...projectUrls.filter((u) => u.includes(SUPABASE_URL))]);

    console.log(`\nVerifying ${checked.size} Supabase URL(s)...`);
    for (const url of checked) {
        const result = await verifyUrl(url);
        if (result.ok) console.log(`  OK     ${url}`);
        else {
            failures.push({ url, ...result });
            console.log(`  FAIL   ${url} (${result.status || result.error})`);
        }
    }

    const nonSupabaseRemote = projectUrls.filter((u) => !u.includes(SUPABASE_URL) && !u.includes("eaglewoodpoly"));
    if (nonSupabaseRemote.length) {
        console.log(`\nNon-Supabase remote URLs (review): ${nonSupabaseRemote.length}`);
        nonSupabaseRemote.slice(0, 10).forEach((u) => console.log(`  OTHER  ${u}`));
    }

    console.log("\n── Results ──");
    console.log(`Local refs:        ${localRefs.length}`);
    console.log(`Localhost refs:    ${localhostRefs.length}`);
    console.log(`URL failures:      ${failures.length}`);
    console.log(`Mapped URLs:       ${mapUrls.size}`);

    if (localRefs.length || failures.length || localhostRefs.length) {
        process.exit(1);
    }
    console.log("\nPASS: Image audit clean — all images load from Supabase Storage.");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});

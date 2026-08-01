#!/usr/bin/env node
/**
 * Safe post-migration cleanup — delete local images only after full verification.
 *
 * Usage:
 *   npm run cleanup:images          # delete verified migrated files
 *   npm run cleanup:images:dry      # preview only, no deletes
 *   npm run cleanup:images -- --force-audit  # run audit first, abort on failure
 */
import { readFileSync, unlinkSync, existsSync, readdirSync, statSync, rmdirSync } from "node:fs";
import { join, relative, extname, dirname } from "node:path";
import { createHash } from "node:crypto";
import {
    ROOT,
    IMAGE_EXT,
    collectReferencedImages,
    verifyUrl,
    walk,
} from "./lib/image-migration.js";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const FORCE_AUDIT = args.has("--force-audit");

const MAP_PATH = join(ROOT, "assets", "data", "storage-image-map.json");
const IMAGES_ROOT = join(ROOT, "assets", "images");
const LOCALHOST_PATTERN = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0)/i;
const SUPABASE_STORAGE_PATTERN = /\/storage\/v1\/object\/public\/cms\//i;

function loadMap() {
    try {
        const map = JSON.parse(readFileSync(MAP_PATH, "utf8"));
        return map && typeof map === "object" ? map : {};
    } catch {
        return {};
    }
}

function listAllLocalImages() {
    if (!existsSync(IMAGES_ROOT)) return [];
    return walk(IMAGES_ROOT)
        .filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()))
        .map((f) => relative(ROOT, f).replace(/\\/g, "/"))
        .sort();
}

function isSupabasePublicUrl(url) {
    return typeof url === "string" && SUPABASE_STORAGE_PATTERN.test(url);
}

function scanProjectForLocalRefs() {
    const refs = collectReferencedImages();
    return new Set(refs);
}

function scanProjectForLocalhostRefs() {
    const hits = [];
    const files = walk(ROOT).filter((f) => {
        const ext = extname(f).toLowerCase();
        return [".html", ".js", ".css", ".json"].includes(ext);
    });
    for (const file of files) {
        const rel = relative(ROOT, file).replace(/\\/g, "/");
        if (rel.startsWith("tmp/") || rel.includes("node_modules")) continue;
        const text = readFileSync(file, "utf8");
        if (LOCALHOST_PATTERN.test(text) && /assets\/images|\.(jpg|jpeg|png|webp|gif|svg)/i.test(text)) {
            hits.push(rel);
        }
    }
    return hits;
}

function fileHash(filePath) {
    const buf = readFileSync(filePath);
    return createHash("sha256").update(buf).digest("hex");
}

function findDuplicateImages(paths) {
    const byHash = new Map();
    for (const rel of paths) {
        const full = join(ROOT, rel);
        if (!existsSync(full)) continue;
        const hash = fileHash(full);
        if (!byHash.has(hash)) byHash.set(hash, []);
        byHash.get(hash).push(rel);
    }
    return [...byHash.values()].filter((group) => group.length > 1);
}

function removeEmptyDirs(dir) {
    if (!existsSync(dir)) return 0;
    let removed = 0;
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (!statSync(full).isDirectory()) continue;
        removed += removeEmptyDirs(full);
        const left = readdirSync(full);
        if (!left.length) {
            if (!DRY_RUN) rmdirSync(full);
            removed += 1;
        }
    }
    return removed;
}

async function runPreflightAudit(map, localRefs) {
    const failures = [];
    const urls = [...new Set(Object.values(map))];

    for (const url of urls) {
        const result = await verifyUrl(url);
        if (!result.ok) failures.push({ type: "url", url, status: result.status || result.error });
    }

    if (localRefs.length) {
        failures.push({ type: "local-refs", count: localRefs.length, samples: localRefs.slice(0, 10) });
    }

    const localhostRefs = scanProjectForLocalhostRefs();
    if (localhostRefs.length) {
        failures.push({ type: "localhost", files: localhostRefs });
    }

    return failures;
}

async function canDeleteLocalImage(localPath, map, localRefs) {
    const reasons = [];

    if (!existsSync(join(ROOT, localPath))) {
        return { ok: false, reason: "file missing" };
    }

    const remote = map[localPath];
    if (!remote) {
        return { ok: false, reason: "not in storage-image-map.json" };
    }

    if (!isSupabasePublicUrl(remote)) {
        return { ok: false, reason: "map URL is not a Supabase public URL" };
    }

    const verify = await verifyUrl(remote);
    if (!verify.ok) {
        return { ok: false, reason: `remote URL not accessible (${verify.status || verify.error})` };
    }

    if (localRefs.has(localPath)) {
        return { ok: false, reason: "still referenced in project files" };
    }

    return { ok: true, remote };
}

async function main() {
    const map = loadMap();
    const mapEntries = Object.entries(map);

    if (!mapEntries.length) {
        console.error("No entries in storage-image-map.json — run npm run migrate:images first.");
        process.exit(1);
    }

    const localRefs = scanProjectForLocalRefs();
    const localRefList = [...localRefs];

    console.log(`Loaded ${mapEntries.length} mapping(s) from storage-image-map.json\n`);

    if (FORCE_AUDIT || !DRY_RUN) {
        console.log("Running preflight audit...");
        const failures = await runPreflightAudit(map, localRefList);
        if (failures.length) {
            console.error("\nFAIL: Preflight audit did not pass. Local images will NOT be deleted.\n");
            for (const f of failures) {
                if (f.type === "url") console.error(`  URL ${f.url} → ${f.status}`);
                if (f.type === "local-refs") {
                    console.error(`  ${f.count} local assets/images reference(s) remain:`);
                    f.samples.forEach((p) => console.error(`    - ${p}`));
                }
                if (f.type === "localhost") {
                    console.error(`  Localhost image references in: ${f.files.join(", ")}`);
                }
            }
            process.exit(1);
        }
        console.log("  ✓ All mapped URLs accessible");
        console.log("  ✓ No local assets/images references in project");
        console.log("  ✓ No localhost image paths\n");
    }

    const allLocal = listAllLocalImages();
    const migratedCandidates = mapEntries.map(([local]) => local).filter((p) => allLocal.includes(p));
    const unmappedLocal = allLocal.filter((p) => !map[p]);

    let deleted = 0;
    let skipped = 0;
    let failed = 0;
    let verified = 0;

    console.log(DRY_RUN ? "DRY RUN — no files will be deleted:\n" : "Deleting verified local images...\n");

    for (const localPath of migratedCandidates) {
        const check = await canDeleteLocalImage(localPath, map, localRefs);
        if (!check.ok) {
            skipped += 1;
            console.log(`  SKIP  ${localPath} (${check.reason})`);
            continue;
        }
        verified += 1;
        try {
            if (!DRY_RUN) unlinkSync(join(ROOT, localPath));
            deleted += 1;
            console.log(`  ${DRY_RUN ? "→" : "✓"} ${DRY_RUN ? "would delete" : "deleted"} ${localPath}`);
        } catch (error) {
            failed += 1;
            console.warn(`  FAIL  ${localPath}: ${error.message}`);
        }
    }

    let emptyDirsRemoved = 0;
    if (!DRY_RUN && deleted > 0) {
        emptyDirsRemoved = removeEmptyDirs(IMAGES_ROOT);
    } else if (DRY_RUN && deleted > 0) {
        emptyDirsRemoved = countEmptyDirs(IMAGES_ROOT);
    }

    const duplicates = findDuplicateImages(unmappedLocal);
    const remainingLocal = listAllLocalImages();

    console.log("\n── Cleanup Summary ──");
    console.log(`Uploaded (in map):     ${mapEntries.length}`);
    console.log(`Verified:              ${verified}`);
    console.log(`Deleted local images:  ${deleted}`);
    console.log(`Skipped:               ${skipped}`);
    console.log(`Failed:                ${failed}`);
    console.log(`Empty dirs removed:    ${emptyDirsRemoved}`);
    console.log(`Unmapped local files:  ${unmappedLocal.length} (kept — not in map)`);
    console.log(`Remaining local files: ${remainingLocal.length}`);

    if (duplicates.length) {
        console.log(`\nDuplicate groups (unmapped, not auto-deleted): ${duplicates.length}`);
        duplicates.slice(0, 5).forEach((group) => console.log(`  - ${group.join(" | ")}`));
    }

    if (skipped || failed) {
        console.error("\nWARN: Some images were not deleted. Re-run audit and fix issues before retrying.");
        process.exit(1);
    }

    if (DRY_RUN) {
        console.log("\nDry run complete. Run without --dry-run to delete files.");
        return;
    }

    console.log("\nPASS: Cleanup complete. Run: npm run audit:images");
}

function countEmptyDirs(dir) {
    if (!existsSync(dir)) return 0;
    let count = 0;
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (!statSync(full).isDirectory()) continue;
        count += countEmptyDirs(full);
        if (!readdirSync(full).length) count += 1;
    }
    return count;
}

main().catch((error) => {
    console.error("Cleanup failed:", error.message || error);
    process.exit(1);
});

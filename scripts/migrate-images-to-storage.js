#!/usr/bin/env node
/**
 * Migrate all site-used local images to Supabase Storage and rewrite references.
 *
 * Requirements:
 *   SUPABASE_SERVICE_ROLE_KEY in .env.local or environment
 *
 * Usage:
 *   npm run migrate:images
 *   npm run migrate:images -- --dry-run
 *   npm run migrate:images -- --skip-db
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import {
    ROOT,
    SUPABASE_URL,
    BUCKET,
    CMS_TABLES,
    IMAGE_FIELD_NAMES,
    loadServiceRoleKey,
    loadAdminCredentials,
    uploadHeaders,
    serviceHeaders,
    PUBLISHABLE_KEY,
    collectReferencedImages,
    storagePathFor,
    publicUrl,
    mimeFor,
    replacePathsInText,
    collectProjectFiles,
    replacePathsInValue,
    verifyUrl,
} from "./lib/image-migration.js";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const SKIP_DB = args.has("--skip-db");
const FORCE_ADMIN = args.has("--admin-auth");

async function uploadFile(auth, localPath) {
    const storagePath = storagePathFor(localPath);
    const body = readFileSync(join(ROOT, localPath));
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
        method: "POST",
        headers: uploadHeaders(auth.serviceKey, localPath, auth.adminCreds),
        body,
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`${res.status} ${err}`);
    }
    return publicUrl(storagePath);
}

function restHeaders(auth, extra = {}) {
    if (auth.serviceKey) return serviceHeaders(auth.serviceKey, extra);
    return {
        apikey: PUBLISHABLE_KEY,
        Authorization: `Bearer ${PUBLISHABLE_KEY}`,
        "x-admin-email": auth.adminCreds.email,
        "x-admin-password": auth.adminCreds.password,
        ...extra,
    };
}

async function fetchTableRows(auth, table) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
        headers: restHeaders(auth, { "Content-Type": "application/json" }),
    });
    if (!res.ok) {
        const text = await res.text();
        if (res.status === 404 || text.includes("PGRST205")) return [];
        throw new Error(`Fetch ${table}: ${res.status} ${text}`);
    }
    return res.json();
}

async function updateTableRow(auth, table, id, payload) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: restHeaders(auth, {
            "Content-Type": "application/json",
            Prefer: "return=minimal",
        }),
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        throw new Error(`Update ${table}#${id}: ${res.status} ${await res.text()}`);
    }
}

function buildRowPatch(row, map) {
    const patch = {};
    for (const [key, value] of Object.entries(row)) {
        if (key === "id" || key === "created_at") continue;
        if (typeof value === "string" && (map[value] || value.includes("assets/images/"))) {
            const next = replacePathsInText(value, map);
            if (next !== value) patch[key] = next;
        } else if (IMAGE_FIELD_NAMES.has(key) || key === "value" || key === "content") {
            const next = replacePathsInValue(value, map);
            if (JSON.stringify(next) !== JSON.stringify(value)) patch[key] = next;
        }
    }
    return patch;
}

async function rewriteProjectFiles(map) {
    const files = collectProjectFiles();
    let changed = 0;
    for (const file of files) {
        const rel = relative(ROOT, file).replace(/\\/g, "/");
        const original = readFileSync(file, "utf8");
        const updated = replacePathsInText(original, map);
        if (updated !== original) {
            if (!DRY_RUN) writeFileSync(file, updated, "utf8");
            changed += 1;
            console.log(`  ${DRY_RUN ? "→" : "✓"} ${DRY_RUN ? "would update" : "updated"} ${rel}`);
        }
    }
    return changed;
}

async function updateDatabaseRecords(auth, map) {
    let updatedRows = 0;
    for (const table of CMS_TABLES) {
        const rows = await fetchTableRows(auth, table);
        if (!rows.length) continue;
        for (const row of rows) {
            const patch = buildRowPatch(row, map);
            if (!Object.keys(patch).length) continue;
            if (!DRY_RUN) await updateTableRow(auth, table, row.id, patch);
            updatedRows += 1;
            console.log(`  ✓ db ${table}#${row.id}`);
        }
    }
    return updatedRows;
}

async function auditUrls(map) {
    const failures = [];
    for (const [local, url] of Object.entries(map)) {
        const result = await verifyUrl(url);
        if (!result.ok) failures.push({ local, url, ...result });
        else console.log(`  ✓ verified ${local}`);
    }

    const leftover = collectReferencedImages();
    if (leftover.length) {
        console.warn(`\n⚠ ${leftover.length} local reference(s) still in project:`);
        leftover.slice(0, 20).forEach((p) => console.warn(`  - ${p}`));
    }

    return failures;
}

async function main() {
    const serviceKey = loadServiceRoleKey();
    const adminCreds = loadAdminCredentials();
    const auth = { serviceKey: FORCE_ADMIN ? "" : serviceKey, adminCreds };

    if (!auth.serviceKey && !DRY_RUN) {
        console.error(`
Missing SUPABASE_SERVICE_ROLE_KEY.

Option A (recommended): add service role key to .env.local:
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

  Dashboard → Project Settings → API → service_role (secret)

Option B: apply admin RLS fix first, then retry with admin headers:
  npm run cms:fix
  npm run migrate:images -- --admin-auth

Then run:
  npm run migrate:images
`);
        process.exit(1);
    }

    if (FORCE_ADMIN && !DRY_RUN) {
        console.log("Using admin header auth (requires 009_production_stabilize.sql on Supabase).\n");
    } else if (auth.serviceKey && !DRY_RUN) {
        console.log("Using service role key for storage upload.\n");
    }

    const images = collectReferencedImages();
    console.log(`Found ${images.length} used image(s) in project.\n`);

    if (!images.length) {
        console.log("Nothing to migrate.");
        return;
    }

    const map = {};
    let uploaded = 0;
    let failed = 0;

    console.log(DRY_RUN ? "DRY RUN — mapping only:\n" : "Uploading to Supabase Storage...\n");
    for (const localPath of images) {
        const storagePath = storagePathFor(localPath);
        const url = publicUrl(storagePath);
        if (DRY_RUN) {
            map[localPath] = url;
            console.log(`  → ${localPath}`);
            continue;
        }
        try {
            map[localPath] = await uploadFile(auth, localPath);
            uploaded += 1;
            console.log(`  ✓ ${localPath}`);
        } catch (error) {
            failed += 1;
            console.warn(`  ✗ ${localPath}: ${error.message}`);
        }
    }

    if (!Object.keys(map).length) {
        console.error("\nNo images uploaded. Aborting rewrite.");
        process.exit(1);
    }

    const mapPath = join(ROOT, "assets", "data", "storage-image-map.json");
    if (!DRY_RUN) writeFileSync(mapPath, JSON.stringify(map, null, 2));

    console.log(`\nRewriting project files...`);
    const fileChanges = await rewriteProjectFiles(map);
    console.log(`  ${fileChanges} file(s) updated`);

    if (!SKIP_DB && !DRY_RUN) {
        console.log(`\nUpdating database records...`);
        const dbChanges = await updateDatabaseRecords(auth, map);
        console.log(`  ${dbChanges} row(s) updated`);
    }

    if (!DRY_RUN) {
        console.log(`\nVerifying uploaded URLs...`);
        const failures = await auditUrls(map);

        console.log(`\n── Summary ──`);
        console.log(`Images found:    ${images.length}`);
        console.log(`Uploaded:        ${uploaded}`);
        console.log(`Failed upload:   ${failed}`);
        console.log(`Files rewritten: ${fileChanges}`);
        console.log(`Map file:        ${mapPath}`);

        if (failures.length) {
            console.error(`\nFAIL: ${failures.length} URL(s) did not load:`);
            failures.forEach((f) => console.error(`  ${f.local} → ${f.url} (${f.status || f.error})`));
            process.exit(1);
        }

        const leftover = collectReferencedImages();
        if (leftover.length) {
            console.error(`\nFAIL: ${leftover.length} local image reference(s) remain.`);
            process.exit(1);
        }

        console.log("\nPASS: All used images migrated to Supabase Storage.");
        console.log("\nNext step: npm run cleanup:images");
        return;
    }

    console.log(`\n── Dry Run Summary ──`);
    console.log(`Images found: ${images.length}`);
    console.log(`Would upload to bucket: cms/site-assets/*`);
    console.log(`Run without --dry-run after adding SUPABASE_SERVICE_ROLE_KEY to .env.local`);
}

main().catch((error) => {
    console.error("Migration failed:", error.message || error);
    process.exit(1);
});

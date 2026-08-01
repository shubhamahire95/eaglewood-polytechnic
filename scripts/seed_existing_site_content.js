#!/usr/bin/env node
/**
 * Seed all CMS tables from assets/data/cms-seed-data.json via admin REST.
 * Alias: seed_existing_site_content.js — copies production homepage content into Supabase.
 *
 * Prerequisites:
 *   1. supabase/migrations/009_production_stabilize.sql applied (npm run cms:fix)
 *   2. Admin credentials: admin@eaglewoodpoly.in / admin123
 *
 * Usage: node scripts/seed_existing_site_content.js
 */
import { seedViaAdminRest } from "./seed-via-admin-rest.js";

async function main() {
    console.log("Seeding existing site content into Supabase...\n");
    const result = await seedViaAdminRest();
    console.log(`\nDone: ${result.inserted} row(s) across ${result.tables.length} table(s)`);
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});

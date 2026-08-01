/**
 * Verify CMS tables have seed content via Supabase REST.
 * Usage: node scripts/verify-cms-content.js
 */
const SUPABASE_URL = "https://rhqmquaojetmzdznbevz.supabase.co";
const KEY = "sb_publishable_fUfSHGs4xC7ut470YywOuw_ire40q8v";
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "count=exact" };

const TABLES = [
    "home_slides", "updates", "notices", "principal_message", "courses",
    "departments", "faculty", "facilities", "placements", "gallery",
    "footer_blocks", "ai_knowledge_base", "ai_prompts", "settings",
];

async function countTable(table) {
    const filter = table === "settings" ? "" : "&published=eq.true";
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1${filter}`, {
        headers: { ...headers, Prefer: "count=exact" },
    });
    const range = res.headers.get("content-range") || "";
    const total = Number(range.split("/")[1] || 0);
    return { table, count: Number.isFinite(total) ? total : 0, ok: res.ok };
}

async function main() {
    console.log("CMS content verification\n");
    const results = [];
    for (const table of TABLES) {
        const r = await countTable(table);
        results.push(r);
        console.log(`${r.count > 0 ? "✓" : "✗"} ${table}: ${r.count} published record(s)`);
    }
    const empty = results.filter((r) => r.count === 0);
    if (empty.length) {
        console.log(`\n${empty.length} table(s) empty. Run supabase/APPLY_ALL_PRODUCTION.sql in SQL Editor or: npm run cms:deploy:all`);
        process.exit(1);
    }
    console.log("\nPASS: All core CMS tables have content.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

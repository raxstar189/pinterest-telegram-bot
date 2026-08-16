require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { fetchSitemapRecipes, parseSitemapXml } = require('../src/sitemap');
const { getStore } = require('../src/store');
const { syncSitemapWithState } = require('../src/selection');

(async () => {
  console.log('[sync-sitemap] Starting sitemap synchronization...');

  const args = process.argv.slice(2);
  let localFile = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      localFile = args[i + 1];
    }
  }

  let sitemapEntries = [];

  if (localFile) {
    console.log(`[sync-sitemap] Loading recipes from local XML file: ${localFile}`);
    if (!fs.existsSync(localFile)) {
      console.error(`[sync-sitemap] Error: File not found at ${localFile}`);
      process.exit(1);
    }
    const xmlContent = fs.readFileSync(localFile, 'utf-8');
    sitemapEntries = parseSitemapXml(xmlContent);
  } else {
    try {
      sitemapEntries = await fetchSitemapRecipes();
    } catch (err) {
      console.error('[sync-sitemap] Error fetching sitemap:', err.message);
      process.exit(1);
    }
  }

  console.log(`[sync-sitemap] Found ${sitemapEntries.length} recipe URLs.`);

  const store = getStore();
  const state = await store.loadState();

  const prevCount = Object.keys(state.recipes || {}).length;
  syncSitemapWithState(state, sitemapEntries);
  const newCount = Object.keys(state.recipes || {}).length;

  await store.saveState(state);

  console.log(`[sync-sitemap] Synchronization complete! Total recipes in state: ${newCount} (Added: ${newCount - prevCount}).`);
  process.exit(0);
})();

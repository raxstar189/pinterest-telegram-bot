const assert = require('assert');
const { cleanRecipeTitle } = require('../src/titleCleaner');
const { parseSitemapXml } = require('../src/sitemap');
const { selectDailyRecipes, syncSitemapWithState, getDaysDifference } = require('../src/selection');

console.log('--- Running Pinterest Telegram Bot Unit Tests ---');

// Test 1: Title Cleaner
console.log('\n[Test 1] Testing Title Cleaner...');
const sampleUrl = 'https://newdecr.com/easy-chicken-curry-your-new-favorite/';
const cleanedTitle = cleanRecipeTitle(sampleUrl);
console.log(`Original URL: ${sampleUrl} -> Cleaned Title: "${cleanedTitle}"`);
assert.strictEqual(cleanedTitle, 'Easy Chicken Curry', 'Title cleaner should strip "your-new-favorite"');

const sampleUrl2 = 'https://newdecr.com/the-perfect-baked-salmon-your-guide-to/';
const cleanedTitle2 = cleanRecipeTitle(sampleUrl2);
console.log(`Original URL: ${sampleUrl2} -> Cleaned Title: "${cleanedTitle2}"`);
assert.strictEqual(cleanedTitle2, 'Baked Salmon', 'Title cleaner should strip "the-perfect" and "your-guide-to"');

const sampleUrl3 = 'https://newdecr.com/seriously-good-beef-tacos-your-weeknight/';
const cleanedTitle3 = cleanRecipeTitle(sampleUrl3);
console.log(`Original URL: ${sampleUrl3} -> Cleaned Title: "${cleanedTitle3}"`);
assert.strictEqual(cleanedTitle3, 'Beef Tacos', 'Title cleaner should strip "seriously-good" and "your-weeknight"');

// Test 2: Sitemap XML Parser
console.log('\n[Test 2] Testing Sitemap XML Parser...');
const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://newdecr.com/</loc>
    <lastmod>2026-08-01T10:00:00+00:00</lastmod>
  </url>
  <url>
    <loc>https://newdecr.com/creamy-garlic-pasta-your-go-to/</loc>
    <lastmod>2026-08-10T10:00:00+00:00</lastmod>
  </url>
  <url>
    <loc>https://newdecr.com/spicy-ramen-bowl/</loc>
    <lastmod>2026-08-15T10:00:00+00:00</lastmod>
  </url>
</urlset>`;

const parsedRecipes = parseSitemapXml(mockXml);
console.log(`Parsed ${parsedRecipes.length} recipes from mock XML.`);
assert.strictEqual(parsedRecipes.length, 2, 'Homepage root should be filtered out');
assert.strictEqual(parsedRecipes[0].title, 'Creamy Garlic Pasta');
assert.strictEqual(parsedRecipes[1].title, 'Spicy Ramen Bowl');

// Test 3: Selection Algorithm with 6-day gap and relaxation
console.log('\n[Test 3] Testing Selection Engine...');
const mockState = {
  known_urls: [],
  recipes: {},
  pending_messages: {}
};

// Seed mock state with 15 recipes
const todayStr = new Date().toISOString().split('T')[0];
for (let i = 1; i <= 15; i++) {
  const slug = `recipe-${i}`;
  mockState.recipes[slug] = {
    slug,
    title: `Recipe ${i}`,
    url: `https://newdecr.com/recipe-${i}/`,
    // Give first 5 recipes recent pin dates (< 6 days), rest null or > 6 days
    last_pinned_date: i <= 5 ? todayStr : (i <= 10 ? '2026-01-01' : null),
    times_pinned: i <= 5 ? 1 : 0,
    first_seen_date: '2026-01-01',
    is_new: i > 12
  };
}

const selectionResult = selectDailyRecipes(mockState, {
  pinCountPerDay: 10,
  minPinIntervalDays: 6,
  thinPoolThreshold: 15
});

console.log(`Selected ${selectionResult.selectedRecipes.length} recipes.`);
console.log(`Thin Pool Warning: ${selectionResult.thinPoolWarning}`);
console.log(`Eligible Pool Size: ${selectionResult.eligiblePoolSize}`);

assert.strictEqual(selectionResult.selectedRecipes.length, 10, 'Selection engine should output exactly 10 recipes');
assert.strictEqual(selectionResult.eligiblePoolSize, 10, 'Eligible pool size should count >= 6 days or never pinned items');

console.log('\n✅ All Unit Tests Passed Successfully!');

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const { cleanRecipeTitle } = require('./titleCleaner');
const config = require('./config');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true
});

/**
 * Parses raw XML content of a sitemap into structured recipe items.
 */
function parseSitemapXml(xmlText) {
  if (!xmlText || typeof xmlText !== 'string') return [];

  // Check if response is an HTML page (e.g., firewall challenge) rather than XML
  if (xmlText.trim().toLowerCase().startsWith('<!doctype html') || xmlText.includes('<html')) {
    throw new Error('Sitemap response appears to be an HTML verification page (firewall challenge).');
  }

  const parsedObj = xmlParser.parse(xmlText);
  if (!parsedObj) return [];

  const recipes = [];

  // Handle standard sitemap urlset
  if (parsedObj.urlset && parsedObj.urlset.url) {
    let urls = parsedObj.urlset.url;
    if (!Array.isArray(urls)) urls = [urls];

    for (const item of urls) {
      const loc = typeof item.loc === 'string' ? item.loc.trim() : '';
      if (!loc) continue;

      try {
        const parsedUrl = new URL(loc);
        const pathname = parsedUrl.pathname.replace(/\/+$/, '');
        if (!pathname) continue;

        const pathSegments = pathname.split('/').filter(Boolean);
        if (pathSegments.length === 0) continue;

        const slug = pathSegments[pathSegments.length - 1];
        const title = cleanRecipeTitle(slug);
        const lastmod = item.lastmod || null;

        recipes.push({ url: loc, slug, title, lastmod });
      } catch (err) {
        console.warn(`[sitemap] Invalid URL encountered: ${loc}`);
      }
    }
  } 
  // Handle RSS Feed fallback (rss/channel/item)
  else if (parsedObj.rss && parsedObj.rss.channel && parsedObj.rss.channel.item) {
    let items = parsedObj.rss.channel.item;
    if (!Array.isArray(items)) items = [items];

    for (const item of items) {
      const loc = typeof item.link === 'string' ? item.link.trim() : '';
      if (!loc) continue;

      try {
        const parsedUrl = new URL(loc);
        const pathname = parsedUrl.pathname.replace(/\/+$/, '');
        if (!pathname) continue;

        const pathSegments = pathname.split('/').filter(Boolean);
        if (pathSegments.length === 0) continue;

        const slug = pathSegments[pathSegments.length - 1];
        const rawTitle = item.title || slug;
        const title = cleanRecipeTitle(rawTitle);
        const lastmod = item.pubDate || null;

        recipes.push({ url: loc, slug, title, lastmod });
      } catch (err) {
        console.warn(`[sitemap] Invalid RSS link: ${loc}`);
      }
    }
  }

  return recipes;
}

/**
 * Fetches and parses recipes from the Yoast SEO post sitemap.
 */
async function fetchSitemapRecipes(targetUrl = null) {
  const url = targetUrl || config.sitemapUrl;

  try {
    console.log(`[sitemap] Fetching sitemap from: ${url}`);
    const response = await axios.get(url, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const recipes = parseSitemapXml(response.data);
    console.log(`[sitemap] Successfully parsed ${recipes.length} recipes from HTTP sitemap.`);
    return recipes;

  } catch (httpError) {
    console.warn(`[sitemap] HTTP fetch failed or returned firewall challenge: ${httpError.message}`);

    // Fallback 1: Local sitemap XML file in project folder
    const localPath = config.localSitemapPath;
    if (fs.existsSync(localPath)) {
      console.log(`[sitemap] Falling back to local sitemap file: ${localPath}`);
      const xmlData = fs.readFileSync(localPath, 'utf-8');
      const recipes = parseSitemapXml(xmlData);
      console.log(`[sitemap] Parsed ${recipes.length} recipes from local sitemap fallback file.`);
      return recipes;
    }

    throw new Error(`Failed to fetch sitemap from ${url} and no local fallback file found at ${localPath}. Details: ${httpError.message}`);
  }
}

module.exports = {
  fetchSitemapRecipes,
  parseSitemapXml
};

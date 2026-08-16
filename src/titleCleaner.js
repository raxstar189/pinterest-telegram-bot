const config = require('./config');

/**
 * Converts a string to Title Case.
 */
function toTitleCase(str) {
  if (!str) return '';
  const minorWords = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'en', 'for', 'if', 'in', 'of', 'on', 'or', 'the', 'to', 'v', 'vs', 'via', 'with']);

  const words = str.toLowerCase().split(/\s+/);
  return words.map((word, index) => {
    if (!word) return '';
    if (index === 0 || index === words.length - 1 || !minorWords.has(word)) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
    return word;
  }).join(' ');
}

/**
 * Derives a clean, recognizable recipe title from a URL or slug.
 * 
 * @param {string} urlOrSlug - The post URL or slug
 * @param {Array<string|RegExp>} customFillerPhrases - Optional custom filler phrase list
 * @returns {string} Cleaned recipe title
 */
function cleanRecipeTitle(urlOrSlug, customFillerPhrases = null) {
  if (!urlOrSlug) return '';

  let slug = urlOrSlug.trim();

  // Extract last path segment if URL
  if (slug.includes('/') || slug.includes('http://') || slug.includes('https://')) {
    try {
      const urlObj = new URL(slug, 'https://newdecr.com');
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      if (pathSegments.length > 0) {
        slug = pathSegments[pathSegments.length - 1];
      }
    } catch (e) {
      const parts = slug.replace(/\/+$/, '').split('/');
      slug = parts[parts.length - 1];
    }
  }

  // Remove common extension
  slug = slug.replace(/\.(html|php|xml)$/i, '');

  let text = slug;

  const phrases = customFillerPhrases || config.fillerPhrases || [];

  // Strip filler phrases from slug (supports both hyphens and spaces in filler phrases)
  for (const item of phrases) {
    if (item instanceof RegExp) {
      text = text.replace(item, ' ');
    } else if (typeof item === 'string' && item.trim()) {
      // Create regex pattern matching space or hyphen separators
      const pattern = item
        .trim()
        .replace(/[\s\-_]+/g, '[\\s\\-_]+');

      const regex = new RegExp(`(?:^|[\\s\\-_]+)${pattern}(?:[\\s\\-_]+|$)`, 'gi');
      text = text.replace(regex, ' ');
    }
  }

  // Replace remaining hyphens and underscores with spaces
  text = text.replace(/[-_]+/g, ' ').trim();

  // Normalize multiple spaces
  text = text.replace(/\s+/g, ' ').trim();

  // Fix stray trailing punctuation or hanging dashes/truncated symbols
  text = text.replace(/[\s\-_:,;.|]+$/, '').replace(/^[\s\-_:,;.|]+/, '');

  let title = toTitleCase(text);

  // Fallback if cleaning stripped everything
  if (!title) {
    title = toTitleCase(slug.replace(/[-_]+/g, ' '));
  }

  return title;
}

module.exports = {
  cleanRecipeTitle,
  toTitleCase
};

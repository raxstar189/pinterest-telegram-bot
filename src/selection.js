const config = require('./config');

/**
 * Returns today's date formatted as YYYY-MM-DD in the target timezone.
 * 
 * @param {string} tz - IANA Timezone string (default: Asia/Dhaka)
 * @returns {string} Date string YYYY-MM-DD
 */
function getTodayDateString(tz = null) {
  const timeZone = tz || config.timezone;
  const now = new Date();
  const options = { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options); // en-CA outputs YYYY-MM-DD
  return formatter.format(now);
}

/**
 * Calculates the integer difference in days between two YYYY-MM-DD date strings.
 * Returns date2 - date1 in days.
 */
function getDaysDifference(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return null;
  const d1 = new Date(`${dateStr1}T00:00:00Z`);
  const d2 = new Date(`${dateStr2}T00:00:00Z`);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 3600 * 24));
}

/**
 * Synchronizes recipe pool with newly fetched sitemap entries.
 * 
 * @param {Object} state - Store state
 * @param {Array<Object>} sitemapEntries - Array of { url, slug, title, lastmod }
 * @returns {Object} Updated state with new recipes added
 */
function syncSitemapWithState(state, sitemapEntries) {
  const today = getTodayDateString();
  const knownUrls = new Set(state.known_urls || []);
  const recipes = state.recipes || {};
  let newCount = 0;

  for (const entry of sitemapEntries) {
    if (!knownUrls.has(entry.url)) {
      knownUrls.add(entry.url);
      
      // If recipe slug doesn't exist yet in state, add it
      if (!recipes[entry.slug]) {
        recipes[entry.slug] = {
          slug: entry.slug,
          title: entry.title,
          url: entry.url,
          last_pinned_date: null,
          times_pinned: 0,
          first_seen_date: today,
          is_new: true,
          lastmod: entry.lastmod || null
        };
        newCount++;
      } else {
        // Update title and URL if changed
        recipes[entry.slug].title = entry.title;
        recipes[entry.slug].url = entry.url;
      }
    }
  }

  state.known_urls = Array.from(knownUrls);
  state.recipes = recipes;

  if (newCount > 0) {
    console.log(`[selection] Auto-discovered ${newCount} new recipe(s) from sitemap.`);
  }

  return state;
}

/**
 * Weighted random selection without replacement.
 * 
 * @param {Array<Object>} candidates - Array of candidate objects, each having a `.weight` property
 * @param {number} count - Number of items to select
 * @returns {Array<Object>} Selected items
 */
function weightedRandomSelect(candidates, count) {
  const pool = [...candidates];
  const selected = [];
  const targetCount = Math.min(count, pool.length);

  while (selected.length < targetCount && pool.length > 0) {
    const totalWeight = pool.reduce((sum, item) => sum + (item.weight || 1), 0);
    if (totalWeight <= 0) {
      // Fallback: pick remaining uniformly
      const idx = Math.floor(Math.random() * pool.length);
      selected.push(pool.splice(idx, 1)[0]);
      continue;
    }

    let randomVal = Math.random() * totalWeight;
    let chosenIndex = -1;

    for (let i = 0; i < pool.length; i++) {
      randomVal -= pool[i].weight;
      if (randomVal <= 0) {
        chosenIndex = i;
        break;
      }
    }

    if (chosenIndex === -1) {
      chosenIndex = pool.length - 1;
    }

    selected.push(pool.splice(chosenIndex, 1)[0]);
  }

  return selected;
}

/**
 * Runs the daily selection engine to pick 10 recipes for today's pins.
 * 
 * @param {Object} state - Current state store
 * @param {Object} options - Custom tunables override (optional)
 * @returns {Object} { selectedRecipes: Array<Object>, thinPoolWarning: boolean, eligiblePoolSize: number }
 */
function selectDailyRecipes(state, options = {}) {
  const targetPinCount = options.pinCountPerDay || config.pinCountPerDay;
  const minInterval = options.minPinIntervalDays || config.minPinIntervalDays;
  const thinThreshold = options.thinPoolThreshold || config.thinPoolThreshold;
  const newBoost = options.newPostWeightBoost || config.newPostWeightBoost;
  const today = getTodayDateString();

  const allRecipes = Object.values(state.recipes || {});

  if (allRecipes.length === 0) {
    return {
      selectedRecipes: [],
      thinPoolWarning: false,
      eligiblePoolSize: 0
    };
  }

  // Calculate days_since_pinned for each recipe
  const evaluatedRecipes = allRecipes.map(r => {
    let daysSince = null;
    if (r.last_pinned_date) {
      daysSince = getDaysDifference(r.last_pinned_date, today);
    }
    return {
      ...r,
      days_since_pinned: daysSince
    };
  });

  // Step 3: Strictly eligible (days_since_pinned >= 6 OR never pinned)
  const strictlyEligible = evaluatedRecipes.filter(r => {
    return r.days_since_pinned === null || r.days_since_pinned >= minInterval;
  });

  const eligiblePoolSize = strictlyEligible.length;
  const thinPoolWarning = eligiblePoolSize < thinThreshold;

  let candidatePool = [...strictlyEligible];

  // Step 4: Fallback relaxation if fewer than targetPinCount are eligible
  if (candidatePool.length < targetPinCount) {
    console.warn(`[selection] Only ${candidatePool.length} strictly eligible recipes (>= ${minInterval} days). Relaxing filter to fill ${targetPinCount}...`);
    
    // Sort all non-eligible recipes by longest waiting first
    const remainingRecipes = evaluatedRecipes
      .filter(r => r.days_since_pinned !== null && r.days_since_pinned < minInterval)
      .sort((a, b) => (b.days_since_pinned || 0) - (a.days_since_pinned || 0));

    const needed = targetPinCount - candidatePool.length;
    const extraCandidates = remainingRecipes.slice(0, needed);
    candidatePool = candidatePool.concat(extraCandidates);
  }

  // Step 5: Assign weights to candidate pool
  // Max existing days for baseline
  const maxDaysInPool = candidatePool.reduce((max, r) => {
    return r.days_since_pinned !== null ? Math.max(max, r.days_since_pinned) : max;
  }, minInterval);

  const weightedCandidates = candidatePool.map(r => {
    // Never pinned recipes get high baseline weight (max days + 14)
    const effectiveDays = r.days_since_pinned === null ? (maxDaysInPool + 14) : Math.max(1, r.days_since_pinned);
    
    let weight = Math.pow(effectiveDays, 1.2); // Mild exponential scaling for longer waiting

    // Priority boost for newly discovered posts
    if (r.is_new) {
      weight *= newBoost;
    }

    return {
      ...r,
      weight
    };
  });

  // Step 6: Perform weighted random selection
  const selected = weightedRandomSelect(weightedCandidates, targetPinCount);

  // Remove temporary weight property
  const selectedRecipes = selected.map(({ weight, ...rest }) => rest);

  return {
    selectedRecipes,
    thinPoolWarning,
    eligiblePoolSize
  };
}

module.exports = {
  getTodayDateString,
  getDaysDifference,
  syncSitemapWithState,
  weightedRandomSelect,
  selectDailyRecipes
};

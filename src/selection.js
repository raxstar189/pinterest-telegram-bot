const config = require('./config');

/**
 * Returns today's date formatted as YYYY-MM-DD in the target timezone.
 */
function getTodayDateString(tz = null) {
  const timeZone = tz || config.timezone;
  const now = new Date();
  const options = { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  return formatter.format(now);
}

/**
 * Calculates the integer difference in days between two YYYY-MM-DD date strings.
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
 */
function syncSitemapWithState(state, sitemapEntries) {
  const today = getTodayDateString();
  const knownUrls = new Set(state.known_urls || []);
  const recipes = state.recipes || {};
  let newCount = 0;

  for (const entry of sitemapEntries) {
    if (!knownUrls.has(entry.url)) {
      knownUrls.add(entry.url);
      
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
 */
function weightedRandomSelect(candidates, count) {
  const pool = [...candidates];
  const selected = [];
  const targetCount = Math.min(count, pool.length);

  while (selected.length < targetCount && pool.length > 0) {
    const totalWeight = pool.reduce((sum, item) => sum + (item.weight || 1), 0);
    if (totalWeight <= 0) {
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
 * Guarantees same-day consistency: if 10 recipes were already selected for today, returns the exact same set.
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

  state.daily_selections = state.daily_selections || {};

  // Check if today's selection already exists (Same-Day Deterministic Selection)
  if (state.daily_selections[today] && Array.isArray(state.daily_selections[today]) && state.daily_selections[today].length > 0) {
    console.log(`[selection] Retrieving existing locked selection for today (${today}).`);
    const savedSlugs = state.daily_selections[today];
    const selectedRecipes = [];

    for (const slug of savedSlugs) {
      if (state.recipes[slug]) {
        selectedRecipes.push(state.recipes[slug]);
      }
    }

    if (selectedRecipes.length > 0) {
      const allRecipes = Object.values(state.recipes || {});
      const eligiblePoolSize = allRecipes.filter(r => {
        const d = r.last_pinned_date ? getDaysDifference(r.last_pinned_date, today) : null;
        return d === null || d >= minInterval;
      }).length;

      return {
        selectedRecipes,
        thinPoolWarning: eligiblePoolSize < thinThreshold,
        eligiblePoolSize
      };
    }
  }

  const allRecipes = Object.values(state.recipes || {});

  if (allRecipes.length === 0) {
    return {
      selectedRecipes: [],
      thinPoolWarning: false,
      eligiblePoolSize: 0
    };
  }

  // Calculate days_since_pinned
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

  // Strictly eligible (days_since_pinned >= 6 OR never pinned)
  const strictlyEligible = evaluatedRecipes.filter(r => {
    return r.days_since_pinned === null || r.days_since_pinned >= minInterval;
  });

  const eligiblePoolSize = strictlyEligible.length;
  const thinPoolWarning = eligiblePoolSize < thinThreshold;

  let candidatePool = [...strictlyEligible];

  // Fallback relaxation if fewer than targetPinCount are eligible
  if (candidatePool.length < targetPinCount) {
    console.warn(`[selection] Only ${candidatePool.length} strictly eligible recipes (>= ${minInterval} days). Relaxing filter to fill ${targetPinCount}...`);
    
    const remainingRecipes = evaluatedRecipes
      .filter(r => r.days_since_pinned !== null && r.days_since_pinned < minInterval)
      .sort((a, b) => (b.days_since_pinned || 0) - (a.days_since_pinned || 0));

    const needed = targetPinCount - candidatePool.length;
    const extraCandidates = remainingRecipes.slice(0, needed);
    candidatePool = candidatePool.concat(extraCandidates);
  }

  // Assign weights to candidate pool
  const maxDaysInPool = candidatePool.reduce((max, r) => {
    return r.days_since_pinned !== null ? Math.max(max, r.days_since_pinned) : max;
  }, minInterval);

  const weightedCandidates = candidatePool.map(r => {
    const effectiveDays = r.days_since_pinned === null ? (maxDaysInPool + 14) : Math.max(1, r.days_since_pinned);
    let weight = Math.pow(effectiveDays, 1.2);

    if (r.is_new) {
      weight *= newBoost;
    }

    return {
      ...r,
      weight
    };
  });

  // Perform weighted random selection
  const selected = weightedRandomSelect(weightedCandidates, targetPinCount);
  const selectedRecipes = selected.map(({ weight, ...rest }) => rest);

  // Lock today's selection so subsequent calls on the same day return the exact same 10 recipes
  state.daily_selections[today] = selectedRecipes.map(r => r.slug);

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

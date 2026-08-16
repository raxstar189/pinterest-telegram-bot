const { getStore } = require('./store');
const { fetchSitemapRecipes } = require('./sitemap');
const { syncSitemapWithState, selectDailyRecipes, getTodayDateString } = require('./selection');
const TelegramBotClient = require('./telegram');

/**
 * Main routine executed every morning.
 * Fetches sitemap, updates pool, selects 10 recipes, and sends Telegram message.
 */
async function runDailyMorningProcess() {
  console.log('[bot] Starting daily morning Pinterest content calendar process...');
  const store = getStore();
  const state = await store.loadState();
  const telegram = new TelegramBotClient();

  // Step 1: Fetch and parse sitemap
  let sitemapEntries = [];
  try {
    sitemapEntries = await fetchSitemapRecipes();
  } catch (err) {
    console.error('[bot] Error fetching sitemap recipes:', err.message);
    // Proceed with existing cached state recipes if fetch fails
  }

  // Step 2: Merge new recipes into pool
  if (sitemapEntries.length > 0) {
    syncSitemapWithState(state, sitemapEntries);
  }

  // Step 3: Run selection engine
  const { selectedRecipes, thinPoolWarning, eligiblePoolSize } = selectDailyRecipes(state);

  if (selectedRecipes.length === 0) {
    console.error('[bot] No recipes available in pool to select!');
    throw new Error('No recipes available in state pool.');
  }

  console.log(`[bot] Selected ${selectedRecipes.length} recipes for today (Thin pool warning: ${thinPoolWarning}).`);

  // Step 4: Send Telegram morning message
  const telegramResult = await telegram.sendMorningDigest(selectedRecipes, thinPoolWarning, eligiblePoolSize);
  const messageId = telegramResult.message_id;

  // Step 5: Save pending message state for interactive button tracking
  const itemStatuses = {};
  selectedRecipes.forEach(r => { itemStatuses[r.slug] = 'pending'; });

  state.pending_messages[messageId] = {
    date: getTodayDateString(),
    recipes: selectedRecipes,
    itemStatuses,
    thinPoolWarning,
    eligiblePoolSize
  };

  // Save updated state
  await store.saveState(state);
  console.log(`[bot] Morning process completed successfully. Message ID: ${messageId}`);

  return {
    messageId,
    selectedRecipes,
    thinPoolWarning,
    eligiblePoolSize
  };
}

/**
 * Process button callback queries from Telegram when user taps ✅ Posted or ⏭ Skip.
 */
async function handleTelegramCallback(callbackQuery) {
  const telegram = new TelegramBotClient();
  const callbackId = callbackQuery.id;
  const data = callbackQuery.data || '';
  const message = callbackQuery.message;

  if (!data.startsWith('pin:')) {
    return telegram.answerCallbackQuery(callbackId, 'Unknown callback command.');
  }

  const parts = data.split(':'); // ['pin', 'post'|'skip', 'slug']
  const action = parts[1];
  const slug = parts.slice(2).join(':');

  if (!message || !message.message_id) {
    return telegram.answerCallbackQuery(callbackId, 'Message context missing.');
  }

  const messageId = message.message_id;
  const store = getStore();
  const state = await store.loadState();

  const pendingRecord = state.pending_messages[messageId];
  if (!pendingRecord) {
    // If message isn't in pending map, load recipe from pool and respond
    return telegram.answerCallbackQuery(callbackId, 'Action recorded.');
  }

  const recipe = state.recipes[slug];
  const today = getTodayDateString();

  if (action === 'post') {
    if (recipe) {
      recipe.last_pinned_date = today;
      recipe.times_pinned = (recipe.times_pinned || 0) + 1;
      recipe.is_new = false;
    }
    pendingRecord.itemStatuses[slug] = 'posted';
    await telegram.answerCallbackQuery(callbackId, 'Marked as Posted! ✅');
  } else if (action === 'skip') {
    if (recipe) {
      recipe.is_new = false;
    }
    pendingRecord.itemStatuses[slug] = 'skipped';
    await telegram.answerCallbackQuery(callbackId, 'Marked as Skipped ⏭');
  }

  // Update Telegram message in-place to reflect updated badge
  await telegram.updateDigestMessage(
    messageId,
    pendingRecord.recipes,
    pendingRecord.itemStatuses,
    pendingRecord.thinPoolWarning,
    pendingRecord.eligiblePoolSize
  );

  // Save updated state
  await store.saveState(state);
  return { success: true, action, slug };
}

module.exports = {
  runDailyMorningProcess,
  handleTelegramCallback
};

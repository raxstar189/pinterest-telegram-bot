const { getStore } = require('./store');
const { fetchSitemapRecipes } = require('./sitemap');
const { syncSitemapWithState, selectDailyRecipes, getTodayDateString } = require('./selection');
const TelegramBotClient = require('./telegram');

/**
 * Main routine executed every morning or via command trigger.
 */
async function runDailyMorningProcess() {
  console.log('[bot] Starting daily morning Pinterest content calendar process...');
  const store = getStore();
  const state = await store.loadState();
  const telegram = new TelegramBotClient();

  // Try setting Telegram commands menu
  telegram.setMyCommands().catch(() => {});

  // Step 1: Fetch and parse sitemap
  let sitemapEntries = [];
  try {
    sitemapEntries = await fetchSitemapRecipes();
  } catch (err) {
    console.warn('[bot] Warning: Sitemap fetch encountered issue:', err.message);
  }

  // Step 2: Merge new recipes into pool
  if (sitemapEntries.length > 0) {
    syncSitemapWithState(state, sitemapEntries);
  }

  // Step 3: Run selection engine
  const { selectedRecipes, thinPoolWarning, eligiblePoolSize } = selectDailyRecipes(state);

  if (selectedRecipes.length === 0) {
    console.error('[bot] No recipes available in pool to select!');
    await telegram.sendMessageWithMenu('❌ *No recipes available in pool!* Please run 🔄 Sync Sitemap or upload post-sitemap.xml.');
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
 * Returns a pool status report message for the user.
 */
async function getPoolStatusReport() {
  const store = getStore();
  const state = await store.loadState();

  const allRecipes = Object.values(state.recipes || {});
  const today = getTodayDateString();
  const config = require('./config');
  const { getDaysDifference } = require('./selection');

  const minInterval = config.minPinIntervalDays;
  const thinThreshold = config.thinPoolThreshold;

  const eligiblePoolSize = allRecipes.filter(r => {
    const d = r.last_pinned_date ? getDaysDifference(r.last_pinned_date, today) : null;
    return d === null || d >= minInterval;
  }).length;

  const isThin = eligiblePoolSize < thinThreshold;

  let text = `📊 *Pinterest Recipe Pool Status*\n\n`;
  text += `• *Total Recipes in Store:* ${allRecipes.length}\n`;
  text += `• *Eligible Recipes (>= 6 days / Never Pinned):* ${eligiblePoolSize}\n`;
  
  if (allRecipes.length === 0) {
    text += `• *Status:* ⚠️ *Empty Pool* (Run 🔄 Sync Sitemap to load recipes)\n\n`;
  } else if (isThin) {
    text += `• *Status:* ⚠️ *Pool Running Thin* (< ${thinThreshold} eligible)\n\n`;
  } else {
    text += `• *Status:* ✅ *Healthy Pool*\n\n`;
  }

  const neverPinned = allRecipes.filter(r => r.last_pinned_date === null).length;
  text += `• *Never Pinned Recipes:* ${neverPinned}\n`;

  return text;
}

/**
 * Manually triggers a sitemap sync and returns status.
 */
async function syncSitemapManually() {
  const store = getStore();
  const state = await store.loadState();
  const prevCount = Object.keys(state.recipes || {}).length;

  let entries = [];
  let fetchNotice = '';
  try {
    entries = await fetchSitemapRecipes();
    syncSitemapWithState(state, entries);
    await store.saveState(state);
  } catch (err) {
    fetchNotice = ` (Using local backup pool)`;
  }

  const newCount = Object.keys(state.recipes || {}).length;
  const added = newCount - prevCount;

  return `🔄 *Sitemap Sync Complete!*${fetchNotice}\n\n• *Total Recipes in Pool:* ${newCount}\n• *New Recipes Discovered:* ${added}`;
}

/**
 * Returns help message text.
 */
function getHelpText() {
  return `❓ *Pinterest Content Calendar Bot Help*\n\n` +
    `This bot delivers **10 recommended recipes** from your blog to pin to Pinterest every morning at 8:00 AM.\n\n` +
    `*Rules & Rotation:*\n` +
    `1. Enforces a **minimum 6-day gap** between pins of the same recipe.\n` +
    `2. Uses weighted anti-monotony randomness so daily lists vary.\n` +
    `3. Newly published recipes get an automatic priority boost.\n\n` +
    `*Interactive Buttons:*\n` +
    `• Tap ✅ *Posted* when you pin a recipe to record history.\n` +
    `• Tap ⏭ *Skip* to leave date untouched.\n\n` +
    `*Available Commands:*\n` +
    `• /today or 📌 *Generate Today's Pins*\n` +
    `• /status or 📊 *Pool Status*\n` +
    `• /sync or 🔄 *Sync Sitemap*`;
}

/**
 * Process button callback queries from Telegram when user taps ✅ Posted or ⏭ Skip.
 */
async function handleTelegramCallback(callbackQuery) {
  const telegram = new TelegramBotClient();
  const callbackId = callbackQuery.id;
  const data = callbackQuery.data || '';
  const message = callbackQuery.message;

  if (!message || !message.message_id) {
    return telegram.answerCallbackQuery(callbackId, 'Message context missing.');
  }

  const messageId = message.message_id;
  const store = getStore();
  const state = await store.loadState();

  const pendingRecord = state.pending_messages[messageId];
  if (!pendingRecord || !pendingRecord.recipes) {
    return telegram.answerCallbackQuery(callbackId, 'Action recorded.');
  }

  let action = null;
  let index = -1;

  if (data.startsWith('p:')) {
    action = 'post';
    index = parseInt(data.substring(2), 10);
  } else if (data.startsWith('s:')) {
    action = 'skip';
    index = parseInt(data.substring(2), 10);
  }

  if (index < 0 || index >= pendingRecord.recipes.length) {
    return telegram.answerCallbackQuery(callbackId, 'Invalid item index.');
  }

  const selectedRecipe = pendingRecord.recipes[index];
  const slug = selectedRecipe.slug;
  const recipe = state.recipes[slug];
  const today = getTodayDateString();

  if (action === 'post') {
    if (recipe) {
      recipe.last_pinned_date = today;
      recipe.times_pinned = (recipe.times_pinned || 0) + 1;
      recipe.is_new = false;
    }
    pendingRecord.itemStatuses[slug] = 'posted';
    await telegram.answerCallbackQuery(callbackId, `Marked "${selectedRecipe.title}" as Posted! ✅`);
  } else if (action === 'skip') {
    if (recipe) {
      recipe.is_new = false;
    }
    pendingRecord.itemStatuses[slug] = 'skipped';
    await telegram.answerCallbackQuery(callbackId, `Skipped "${selectedRecipe.title}" ⏭`);
  }

  await telegram.updateDigestMessage(
    messageId,
    pendingRecord.recipes,
    pendingRecord.itemStatuses,
    pendingRecord.thinPoolWarning,
    pendingRecord.eligiblePoolSize
  );

  await store.saveState(state);
  return { success: true, action, slug };
}

module.exports = {
  runDailyMorningProcess,
  handleTelegramCallback,
  getPoolStatusReport,
  syncSitemapManually,
  getHelpText
};

const { runDailyMorningProcess } = require('../../src/bot');

/**
 * Netlify Scheduled Function entry point.
 * Triggers daily morning sitemap sync, selection, and Telegram message delivery.
 */
exports.handler = async function (event, context) {
  console.log('[netlify-scheduled] Daily digest trigger launched...');
  try {
    const result = await runDailyMorningProcess();
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Daily morning Pinterest digest delivered successfully.',
        result
      })
    };
  } catch (error) {
    console.error('[netlify-scheduled] Error running daily digest:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};

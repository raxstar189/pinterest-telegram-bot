const { 
  handleTelegramCallback, 
  runDailyMorningProcess, 
  getPoolStatusReport, 
  syncSitemapManually, 
  getHelpText 
} = require('../../src/bot');
const TelegramBotClient = require('../../src/telegram');

/**
 * Netlify Serverless Function endpoint for Telegram Webhook updates.
 */
exports.handler = async function (event, context) {
  // Allow GET requests for simple health check
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', service: 'Telegram Webhook Endpoint' })
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const telegram = new TelegramBotClient();

  try {
    const payload = JSON.parse(event.body || '{}');

    // Handle button tap callback queries
    if (payload.callback_query) {
      await handleTelegramCallback(payload.callback_query);
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'callback_processed' })
      };
    }

    // Handle incoming text commands & menu button taps
    if (payload.message && payload.message.text) {
      const text = payload.message.text.trim();
      const lower = text.toLowerCase();

      // Trigger daily pin digest
      if (lower === '/today' || lower === '/generate' || text.includes('Generate Today')) {
        await runDailyMorningProcess();
        return {
          statusCode: 200,
          body: JSON.stringify({ status: 'digest_generated' })
        };
      }

      // Pool status report
      if (lower === '/status' || text.includes('Pool Status')) {
        const reportText = await getPoolStatusReport();
        await telegram.sendMessageWithMenu(reportText);
        return {
          statusCode: 200,
          body: JSON.stringify({ status: 'status_sent' })
        };
      }

      // Sitemap sync
      if (lower === '/sync' || text.includes('Sync Sitemap')) {
        const syncText = await syncSitemapManually();
        await telegram.sendMessageWithMenu(syncText);
        return {
          statusCode: 200,
          body: JSON.stringify({ status: 'sync_sent' })
        };
      }

      // Start or Help
      if (lower === '/start' || lower === '/help' || text.includes('Help')) {
        const helpText = getHelpText();
        await telegram.sendMessageWithMenu(helpText);
        return {
          statusCode: 200,
          body: JSON.stringify({ status: 'help_sent' })
        };
      }

      // Fallback response with persistent menu
      await telegram.sendMessageWithMenu(`👋 Hi! Use the menu buttons below or send /today to get your daily 10 Pinterest pins!`);
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'menu_sent' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ignored' })
    };
  } catch (error) {
    console.error('[netlify-webhook] Error processing Telegram update:', error);
    // Send error message back to user chat so they see what happened
    try {
      await telegram.sendMessageWithMenu(`⚠️ *Notice:* ${error.message}`);
    } catch (e) {}

    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

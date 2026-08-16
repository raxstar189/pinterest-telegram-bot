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
 * Always returns HTTP 200 to Telegram so updates are acknowledged and not queued/retried in loops.
 */
exports.handler = async function (event, context) {
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok', service: 'Telegram Webhook Endpoint' })
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 200, body: JSON.stringify({ status: 'ignored' }) };
  }

  const telegram = new TelegramBotClient();

  try {
    const payload = JSON.parse(event.body || '{}');

    // Handle inline button tap callback queries
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
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok' })
    };
  } catch (error) {
    console.error('[netlify-webhook] Handled error in webhook:', error.message);
    // Return 200 to Telegram so Telegram does not retry old queued updates in loops
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'error_logged', error: error.message })
    };
  }
};

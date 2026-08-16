const { handleTelegramCallback, runDailyMorningProcess } = require('../../src/bot');

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

    // Optional manual trigger via Telegram text command "/generate" or "/today"
    if (payload.message && payload.message.text) {
      const text = payload.message.text.trim().toLowerCase();
      if (text === '/generate' || text === '/today' || text === '/start') {
        await runDailyMorningProcess();
        return {
          statusCode: 200,
          body: JSON.stringify({ status: 'digest_generated' })
        };
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ignored' })
    };
  } catch (error) {
    console.error('[netlify-webhook] Error processing Telegram update:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

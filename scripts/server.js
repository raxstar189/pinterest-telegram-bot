require('dotenv').config();
const express = require('express');
const config = require('../src/config');
const { handleTelegramCallback, runDailyMorningProcess } = require('../src/bot');

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    app: 'Pinterest Content Calendar Telegram Bot',
    time: new Date().toISOString()
  });
});

// Endpoint for external cron ping services (e.g. cron-job.org)
app.all('/trigger-daily', async (req, res) => {
  console.log('[express-server] Trigger daily request received...');
  try {
    const result = await runDailyMorningProcess();
    res.json({ success: true, result });
  } catch (error) {
    console.error('[express-server] Trigger daily error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Telegram Webhook endpoint
app.post(config.webhookPath, async (req, res) => {
  try {
    const payload = req.body || {};

    if (payload.callback_query) {
      await handleTelegramCallback(payload.callback_query);
      return res.json({ status: 'callback_processed' });
    }

    if (payload.message && payload.message.text) {
      const text = payload.message.text.trim().toLowerCase();
      if (text === '/generate' || text === '/today' || text === '/start') {
        await runDailyMorningProcess();
        return res.json({ status: 'digest_generated' });
      }
    }

    res.json({ status: 'ignored' });
  } catch (error) {
    console.error('[express-server] Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(config.port, () => {
  console.log(`[express-server] Bot webhook server running on port ${config.port}`);
  console.log(`[express-server] Webhook URL path: ${config.webhookPath}`);
  console.log(`[express-server] Cron trigger endpoint: http://localhost:${config.port}/trigger-daily`);
});

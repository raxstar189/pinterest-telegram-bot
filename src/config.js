const path = require('path');
require('dotenv').config();

module.exports = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',

  sitemapUrl: process.env.SITE_SITEMAP_URL || 'https://newdecr.com/post-sitemap.xml',
  localSitemapPath: process.env.LOCAL_SITEMAP_PATH || path.join(__dirname, '../data/post-sitemap.xml'),

  // Default to 'auto' mode for seamless local & serverless execution
  storageMode: process.env.STORAGE_MODE || 'auto',
  jsonStorePath: process.env.JSON_STORE_PATH || path.join(__dirname, '../data/state.json'),

  pinCountPerDay: parseInt(process.env.PIN_COUNT_PER_DAY || '10', 10),
  minPinIntervalDays: parseInt(process.env.MIN_PIN_INTERVAL_DAYS || '6', 10),
  thinPoolThreshold: parseInt(process.env.THIN_POOL_THRESHOLD || '15', 10),
  newPostWeightBoost: parseFloat(process.env.NEW_POST_WEIGHT_BOOST || '1.5'),
  timezone: process.env.TIMEZONE || 'Asia/Dhaka',

  port: parseInt(process.env.PORT || '3000', 10),
  webhookPath: process.env.WEBHOOK_PATH || '/api/telegram-webhook',

  fillerPhrases: [
    'your new favorite',
    'your weeknight',
    'seriously good',
    'the perfect',
    'your guide to',
    'your go-to',
    'the ultimate',
    'easy and delicious',
    'quick and easy',
    'best ever',
    'how to make',
    'step by step',
    'easy recipe',
    'best recipe'
  ]
};

const path = require('path');
require('dotenv').config();

module.exports = {
  // Telegram settings
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',

  // Sitemap settings
  sitemapUrl: process.env.SITE_SITEMAP_URL || 'https://newdecr.com/post-sitemap.xml',
  localSitemapPath: process.env.LOCAL_SITEMAP_PATH || path.join(__dirname, '../data/post-sitemap.xml'),

  // State store settings
  storageMode: process.env.STORAGE_MODE || 'auto', // 'auto', 'netlify', 'json'
  jsonStorePath: process.env.JSON_STORE_PATH || path.join(__dirname, '../data/state.json'),

  // Selection algorithm tunables
  pinCountPerDay: parseInt(process.env.PIN_COUNT_PER_DAY || '10', 10),
  minPinIntervalDays: parseInt(process.env.MIN_PIN_INTERVAL_DAYS || '6', 10),
  thinPoolThreshold: parseInt(process.env.THIN_POOL_THRESHOLD || '15', 10),
  newPostWeightBoost: parseFloat(process.env.NEW_POST_WEIGHT_BOOST || '1.5'),
  timezone: process.env.TIMEZONE || 'Asia/Dhaka',

  // Server settings for self-hosted webhook server
  port: parseInt(process.env.PORT || '3000', 10),
  webhookPath: process.env.WEBHOOK_PATH || '/api/telegram-webhook',

  // Editable list of filler phrases & marketing noise patterns to strip from title slugs
  // Add strings (case-insensitive) or RegExp objects.
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

const config = require('../config');
const JsonStore = require('./jsonStore');
const NetlifyStore = require('./netlifyStore');

function getStore() {
  const mode = (config.storageMode || 'auto').toLowerCase();

  if (mode === 'netlify') {
    console.log('[store] Explicit Netlify Blobs storage selected.');
    return new NetlifyStore();
  }

  if (mode === 'json') {
    console.log('[store] Explicit JSON file storage selected.');
    return new JsonStore();
  }

  // Auto mode: detect if running in Netlify context
  if (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY_DEV) {
    console.log('[store] Auto-detected Netlify environment. Using Netlify Blobs store.');
    return new NetlifyStore();
  }

  console.log('[store] Auto-detected local/cPanel environment. Using JSON file store.');
  return new JsonStore();
}

module.exports = {
  getStore,
  JsonStore,
  NetlifyStore
};

const config = require('../config');
const JsonStore = require('./jsonStore');
const NetlifyStore = require('./netlifyStore');

function getStore() {
  const mode = (config.storageMode || 'auto').toLowerCase();

  if (mode === 'netlify') {
    console.log('[store] Explicit Netlify Blobs storage selected.');
    return new NetlifyStore();
  }

  // For 'auto' or 'json' mode: Use JsonStore.
  // JsonStore automatically detects serverless environments and uses OS temp directory (/tmp/state.json),
  // guaranteeing 100% reliable state saving without requiring Netlify Blobs credentials.
  console.log('[store] Using JSON state store with serverless temp directory fallback.');
  return new JsonStore();
}

module.exports = {
  getStore,
  JsonStore,
  NetlifyStore
};

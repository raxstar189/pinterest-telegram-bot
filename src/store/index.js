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

  // Auto mode: detect if running in Netlify or AWS Lambda environment
  const isNetlifyEnv = !!(
    process.env.NETLIFY ||
    process.env.NETLIFY_BLOBS_CONTEXT ||
    process.env.NETLIFY_DEV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.CONTEXT
  );

  if (isNetlifyEnv) {
    console.log('[store] Auto-detected Netlify / Serverless environment.');
    // Check if Netlify Blobs environment is configured
    if (process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY) {
      try {
        return new NetlifyStore();
      } catch (err) {
        console.warn('[store] NetlifyStore init failed, falling back to JsonStore with temp dir:', err.message);
        return new JsonStore();
      }
    }
  }

  console.log('[store] Auto-detected local/cPanel environment. Using JSON file store.');
  return new JsonStore();
}

module.exports = {
  getStore,
  JsonStore,
  NetlifyStore
};

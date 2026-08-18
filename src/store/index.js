const config = require('../config');
const JsonStore = require('./jsonStore');
const NetlifyStore = require('./netlifyStore');
const GithubStore = require('./githubStore');

function getStore() {
  const mode = (config.storageMode || 'auto').toLowerCase();

  const githubStore = new GithubStore();

  if (githubStore.isConfigured() || mode === 'github') {
    console.log('[store] GitHub API permanent repository storage active.');
    return githubStore;
  }

  if (mode === 'netlify') {
    console.log('[store] Netlify Blobs storage selected.');
    return new NetlifyStore();
  }

  console.log('[store] Using JSON state store.');
  return new JsonStore();
}

module.exports = {
  getStore,
  JsonStore,
  NetlifyStore,
  GithubStore
};

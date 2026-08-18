const config = require('../config');
const JsonStore = require('./jsonStore');
const NetlifyStore = require('./netlifyStore');
const GithubStore = require('./githubStore');

/**
 * Smart Hybrid Store combining GitHub API persistence and local cache.
 */
class SmartHybridStore {
  constructor() {
    this.githubStore = new GithubStore();
    this.jsonStore = new JsonStore();
  }

  async loadState() {
    let state = null;

    // Try loading from GitHub first if configured
    if (this.githubStore.isConfigured()) {
      state = await this.githubStore.loadState();
    }

    // If GitHub state has recipes, use it and update local cache
    if (state && Object.keys(state.recipes || {}).length > 0) {
      await this.jsonStore.saveState(state);
      return state;
    }

    // Fallback to local JSON store
    const localState = await this.jsonStore.loadState();

    // If local state has recipes and GitHub is configured, sync local state up to GitHub
    if (localState && Object.keys(localState.recipes || {}).length > 0 && this.githubStore.isConfigured()) {
      await this.githubStore.saveState(localState);
    }

    return localState;
  }

  async saveState(state) {
    // Save to local cache first
    await this.jsonStore.saveState(state);

    // Save to GitHub API permanently
    if (this.githubStore.isConfigured()) {
      return this.githubStore.saveState(state);
    }

    return true;
  }
}

function getStore() {
  const mode = (config.storageMode || 'auto').toLowerCase();

  if (mode === 'netlify') {
    return new NetlifyStore();
  }

  return new SmartHybridStore();
}

module.exports = {
  getStore,
  JsonStore,
  NetlifyStore,
  GithubStore,
  SmartHybridStore
};

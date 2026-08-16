const { getStore: getNetlifyStore } = require('@netlify/blobs');
const { createInitialState } = require('./interface');
const JsonStore = require('./jsonStore');

class NetlifyStore {
  constructor(storeName = 'pinterest-bot-state') {
    this.storeName = storeName;
    this.blobKey = 'bot-state.json';
    this.fallbackStore = new JsonStore();
  }

  _getStoreInstance() {
    return getNetlifyStore({
      name: this.storeName,
      consistency: 'strong'
    });
  }

  async loadState() {
    try {
      const store = this._getStoreInstance();
      const rawData = await store.get(this.blobKey, { type: 'json' });

      if (!rawData) {
        console.log('[netlifyStore] No existing state found in Blobs store. Initializing state.');
        const initial = createInitialState();
        await this.saveState(initial);
        return initial;
      }

      return {
        known_urls: rawData.known_urls || [],
        recipes: rawData.recipes || {},
        pending_messages: rawData.pending_messages || {},
        daily_selections: rawData.daily_selections || {}
      };
    } catch (err) {
      console.warn('[netlifyStore] Blobs store load failed, using fallback JsonStore:', err.message);
      return this.fallbackStore.loadState();
    }
  }

  async saveState(state) {
    try {
      const store = this._getStoreInstance();
      await store.setJSON(this.blobKey, state);
      return true;
    } catch (err) {
      console.warn('[netlifyStore] Blobs store save failed, saving to fallback JsonStore:', err.message);
      return this.fallbackStore.saveState(state);
    }
  }
}

module.exports = NetlifyStore;

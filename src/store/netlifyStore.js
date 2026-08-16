const { getStore } = require('@netlify/blobs');
const { createInitialState } = require('./interface');

class NetlifyStore {
  constructor(storeName = 'pinterest-bot-state') {
    this.storeName = storeName;
    this.blobKey = 'bot-state.json';
  }

  _getStoreInstance() {
    return getStore({
      name: this.storeName,
      consistency: 'strong'
    });
  }

  async loadState() {
    try {
      const store = this._getStoreInstance();
      const rawData = await store.get(this.blobKey, { type: 'json' });

      if (!rawData) {
        console.log('[netlifyStore] No existing state found in Blobs store. Initializing new state.');
        const initial = createInitialState();
        await this.saveState(initial);
        return initial;
      }

      return {
        known_urls: rawData.known_urls || [],
        recipes: rawData.recipes || {},
        pending_messages: rawData.pending_messages || {}
      };
    } catch (err) {
      console.error('[netlifyStore] Error loading state from Netlify Blobs:', err);
      return createInitialState();
    }
  }

  async saveState(state) {
    try {
      const store = this._getStoreInstance();
      await store.setJSON(this.blobKey, state);
      return true;
    } catch (err) {
      console.error('[netlifyStore] Error saving state to Netlify Blobs:', err);
      throw err;
    }
  }
}

module.exports = NetlifyStore;

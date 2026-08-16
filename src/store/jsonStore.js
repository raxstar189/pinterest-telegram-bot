const fs = require('fs');
const path = require('path');
const config = require('../config');
const { createInitialState } = require('./interface');

class JsonStore {
  constructor(filePath = null) {
    this.filePath = filePath || config.jsonStorePath;
  }

  _ensureDirectory() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async loadState() {
    this._ensureDirectory();

    if (!fs.existsSync(this.filePath)) {
      const initial = createInitialState();
      await this.saveState(initial);
      return initial;
    }

    try {
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const data = JSON.parse(content);
      return {
        known_urls: data.known_urls || [],
        recipes: data.recipes || {},
        pending_messages: data.pending_messages || {}
      };
    } catch (err) {
      console.error(`[jsonStore] Error reading JSON state file from ${this.filePath}:`, err);
      return createInitialState();
    }
  }

  async saveState(state) {
    this._ensureDirectory();
    try {
      const serialized = JSON.stringify(state, null, 2);
      fs.writeFileSync(this.filePath, serialized, 'utf-8');
      return true;
    } catch (err) {
      console.error(`[jsonStore] Error writing JSON state file to ${this.filePath}:`, err);
      throw err;
    }
  }
}

module.exports = JsonStore;

const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('../config');
const { createInitialState } = require('./interface');

class JsonStore {
  constructor(filePath = null) {
    // If running in a Lambda/Netlify read-only environment, use OS tmpdir
    const isLambda = !!(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT || process.env.NETLIFY);
    if (isLambda) {
      this.filePath = path.join(os.tmpdir(), 'state.json');
    } else {
      this.filePath = filePath || config.jsonStorePath;
    }
  }

  _ensureDirectory() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (e) {
        console.warn(`[jsonStore] Cannot create dir ${dir}, falling back to OS temp dir.`);
        this.filePath = path.join(os.tmpdir(), 'state.json');
      }
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
        pending_messages: data.pending_messages || {},
        daily_selections: data.daily_selections || {}
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
      return false;
    }
  }
}

module.exports = JsonStore;

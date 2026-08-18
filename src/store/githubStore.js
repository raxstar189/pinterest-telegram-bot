const axios = require('axios');
const { createInitialState } = require('./interface');

class GithubStore {
  constructor() {
    this.token = (process.env.GITHUB_TOKEN || process.env.GH_PAT || '').trim();
    this.repo = (process.env.GITHUB_REPO || '').trim(); // e.g., "username/pinterest-telegram-bot"
    this.path = 'data/state.json';
    this.branch = (process.env.GITHUB_BRANCH || 'main').trim();
    this.sha = null;
  }

  isConfigured() {
    return !!(this.token && this.repo && this.repo.includes('/'));
  }

  async loadState() {
    if (!this.isConfigured()) {
      console.warn('[githubStore] GITHUB_TOKEN or GITHUB_REPO not properly configured.');
      return null;
    }

    const url = `https://api.github.com/repos/${this.repo}/contents/${this.path}?ref=${this.branch}`;
    try {
      console.log(`[githubStore] Loading state from GitHub repository: ${this.repo}/${this.path}`);
      const res = await axios.get(url, {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'PinterestBot'
        }
      });

      if (res.data && res.data.content) {
        this.sha = res.data.sha;
        const contentStr = Buffer.from(res.data.content, 'base64').toString('utf-8');
        const parsed = JSON.parse(contentStr);
        return {
          known_urls: parsed.known_urls || [],
          recipes: parsed.recipes || {},
          pending_messages: parsed.pending_messages || {},
          daily_selections: parsed.daily_selections || {}
        };
      }
    } catch (err) {
      if (err.response && err.response.status === 404) {
        console.log('[githubStore] state.json does not exist in GitHub repo yet. Initializing new state.');
        const initial = createInitialState();
        await this.saveState(initial);
        return initial;
      }
      console.error('[githubStore] Failed to load state from GitHub API:', err.message);
    }
    return null;
  }

  async saveState(state) {
    if (!this.isConfigured()) {
      console.warn('[githubStore] GITHUB_TOKEN or GITHUB_REPO not configured for saving.');
      return false;
    }

    const url = `https://api.github.com/repos/${this.repo}/contents/${this.path}`;
    
    // If SHA is missing, fetch current file SHA from GitHub API first
    if (!this.sha) {
      try {
        const getUrl = `${url}?ref=${this.branch}`;
        const getRes = await axios.get(getUrl, {
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'PinterestBot'
          }
        });
        if (getRes.data && getRes.data.sha) {
          this.sha = getRes.data.sha;
        }
      } catch (e) {
        // File may not exist yet, which is fine for first creation
      }
    }

    const contentStr = JSON.stringify(state, null, 2);
    const contentBase64 = Buffer.from(contentStr, 'utf-8').toString('base64');

    const payload = {
      message: `chore: update bot pinning state (${new Date().toISOString().split('T')[0]})`,
      content: contentBase64,
      branch: this.branch
    };

    if (this.sha) {
      payload.sha = this.sha;
    }

    try {
      const res = await axios.put(url, payload, {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'PinterestBot'
        }
      });
      if (res.data && res.data.content && res.data.content.sha) {
        this.sha = res.data.content.sha;
      }
      console.log('[githubStore] Successfully persisted state commit to GitHub repository!');
      return true;
    } catch (err) {
      const errDetail = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
      console.error('[githubStore] Failed to save state commit to GitHub:', errDetail);
      return false;
    }
  }
}

module.exports = GithubStore;

const axios = require('axios');
const { createInitialState } = require('./interface');

class GithubStore {
  constructor() {
    this.token = (
      process.env.GH_TOKEN ||
      process.env.BOT_GITHUB_TOKEN ||
      process.env.GITHUB_TOKEN ||
      process.env.GH_PAT ||
      ''
    ).trim();

    this.repo = (
      process.env.GH_REPO ||
      process.env.BOT_GITHUB_REPO ||
      process.env.GITHUB_REPO ||
      ''
    ).trim();

    this.path = 'data/state.json';
    this.branch = (process.env.GITHUB_BRANCH || '').trim();
    this.sha = null;
    this.resolvedRepo = null;
  }

  isConfigured() {
    return !!(this.token && this.repo);
  }

  async _getResolvedRepo() {
    if (this.resolvedRepo) return this.resolvedRepo;
    
    if (this.repo.includes('/')) {
      this.resolvedRepo = this.repo;
      return this.resolvedRepo;
    }

    try {
      const userRes = await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'PinterestBot'
        }
      });
      if (userRes.data && userRes.data.login) {
        this.resolvedRepo = `${userRes.data.login}/${this.repo}`;
        return this.resolvedRepo;
      }
    } catch (e) {
      console.warn('[githubStore] Could not auto-resolve GitHub username:', e.message);
    }

    this.resolvedRepo = this.repo;
    return this.resolvedRepo;
  }

  async _getBranchesToTry() {
    if (this.branch) return [this.branch];
    return ['main', 'master'];
  }

  async loadState() {
    if (!this.isConfigured()) {
      console.warn('[githubStore] GH_TOKEN or GH_REPO not configured.');
      return null;
    }

    const fullRepo = await this._getResolvedRepo();
    const branches = await this._getBranchesToTry();

    for (const b of branches) {
      const url = `https://api.github.com/repos/${fullRepo}/contents/${this.path}?ref=${b}`;
      try {
        console.log(`[githubStore] Loading state from GitHub repository: ${fullRepo}/${this.path} (branch: ${b})`);
        const res = await axios.get(url, {
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'PinterestBot'
          }
        });

        if (res.data && res.data.content) {
          this.sha = res.data.sha;
          this.branch = b;
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
          continue; // Try next branch name
        }
        console.error('[githubStore] Failed to load state from GitHub API:', err.response ? JSON.stringify(err.response.data) : err.message);
      }
    }

    // If file doesn't exist on any branch yet, initialize
    console.log('[githubStore] state.json does not exist in GitHub repo yet. Initializing new state file.');
    this.branch = branches[0];
    const initial = createInitialState();
    await this.saveState(initial);
    return initial;
  }

  async saveState(state) {
    if (!this.isConfigured()) {
      console.warn('[githubStore] GH_TOKEN or GH_REPO not configured for saving.');
      return false;
    }

    const fullRepo = await this._getResolvedRepo();
    const targetBranch = this.branch || 'main';
    const url = `https://api.github.com/repos/${fullRepo}/contents/${this.path}`;

    // Fetch latest SHA from GitHub API before saving to avoid 409 conflicts
    try {
      const getUrl = `${url}?ref=${targetBranch}`;
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
      // File may not exist yet
    }

    const contentStr = JSON.stringify(state, null, 2);
    const contentBase64 = Buffer.from(contentStr, 'utf-8').toString('base64');

    const payload = {
      message: `chore: update bot pinning state (${new Date().toISOString().split('T')[0]})`,
      content: contentBase64,
      branch: targetBranch
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

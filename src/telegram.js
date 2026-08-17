const axios = require('axios');
const config = require('./config');
const { getTodayDateString } = require('./selection');

class TelegramBotClient {
  constructor(token = null, chatId = null) {
    this.token = token || config.telegramBotToken;
    this.chatId = chatId || config.telegramChatId;
    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
  }

  async _request(method, data = {}) {
    if (!this.token || !this.chatId) {
      throw new Error('[telegram] TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in environment variables.');
    }
    const url = `${this.baseUrl}/${method}`;
    try {
      const res = await axios.post(url, data, { timeout: 10000 });
      return res.data;
    } catch (err) {
      const errorDetail = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
      console.error(`[telegram] Error in ${method}:`, errorDetail);
      throw new Error(`Telegram API Error (${method}): ${errorDetail}`);
    }
  }

  async setMyCommands() {
    const commands = [
      { command: 'today', description: '📌 Generate today\'s 10 Pinterest pins' },
      { command: 'status', description: '📊 Check recipe pool status' },
      { command: 'sync', description: '🔄 Sync latest recipes from sitemap' },
      { command: 'help', description: '❓ How to use this bot' }
    ];
    try {
      await this._request('setMyCommands', { commands });
    } catch (e) {
      console.warn('[telegram] Failed to set bot commands menu:', e.message);
    }
  }

  getPersistentMenuKeyboard() {
    return {
      keyboard: [
        [{ text: '📌 Generate Today\'s Pins' }, { text: '📊 Pool Status' }],
        [{ text: '🔄 Sync Sitemap' }, { text: '❓ Help' }]
      ],
      resize_keyboard: true,
      persistent: true
    };
  }

  /**
   * Truncates callback payload slug so callback_data never exceeds Telegram's 64-byte limit.
   */
  getShortCallbackData(prefix, slug) {
    const safeSlug = (slug || '').substring(0, 58);
    return `${prefix}:${safeSlug}`;
  }

  /**
   * Builds an individual recipe message card text and clean unnumbered buttons.
   */
  buildRecipeCard(recipe, index, status = 'pending') {
    const num = index + 1;
    let text = `*${num}.* [${recipe.title}](${recipe.url})\n`;

    const inline_keyboard = [];

    if (status === 'posted') {
      text += `   └ Status: ✅ *Posted*`;
    } else if (status === 'skipped') {
      text += `   └ Status: ⏭ *Skipped*`;
    } else {
      text += `   └ Status: ⏳ *Pending Action*`;
      // Buttons carry recipe slug directly so callback handler works statelessly across all serverless invocations
      inline_keyboard.push([
        {
          text: '✅ Posted',
          callback_data: this.getShortCallbackData('p', recipe.slug)
        },
        {
          text: '⏭ Skip',
          callback_data: this.getShortCallbackData('s', recipe.slug)
        }
      ]);
    }

    return { text, inline_keyboard };
  }

  /**
   * Sends individual recipe card message.
   */
  async sendRecipeCard(recipe, index, status = 'pending') {
    const { text, inline_keyboard } = this.buildRecipeCard(recipe, index, status);

    const payload = {
      chat_id: this.chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: inline_keyboard.length > 0 ? { inline_keyboard } : undefined
    };

    const res = await this._request('sendMessage', payload);
    return res.result;
  }

  /**
   * Updates an individual recipe card message in-place.
   */
  async updateRecipeCard(messageId, recipe, index, status = 'pending') {
    const { text, inline_keyboard } = this.buildRecipeCard(recipe, index, status);

    const payload = {
      chat_id: this.chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: inline_keyboard.length > 0 ? { inline_keyboard } : { inline_keyboard: [] }
    };

    try {
      await this._request('editMessageText', payload);
    } catch (err) {
      console.warn('[telegram] Failed to edit recipe card:', err.message);
    }
  }

  async sendMessageWithMenu(text) {
    const payload = {
      chat_id: this.chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: this.getPersistentMenuKeyboard()
    };
    return this._request('sendMessage', payload);
  }

  async answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
    return this._request('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert
    });
  }
}

module.exports = TelegramBotClient;

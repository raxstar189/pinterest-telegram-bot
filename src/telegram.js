const axios = require('axios');
const config = require('./config');
const { getTodayDateString } = require('./selection');

class TelegramBotClient {
  constructor(token = null, chatId = null) {
    this.token = token || config.telegramBotToken;
    this.chatId = chatId || config.telegramChatId;
    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
  }

  /**
   * Helper to execute Telegram Bot API requests.
   */
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

  /**
   * Formats the 10 recipes into a clean markdown message text and inline keyboard layout.
   * 
   * @param {Array<Object>} recipes - 10 selected recipe objects
   * @param {Object} itemStatuses - Map of slug -> status ('posted' | 'skipped' | 'pending')
   * @param {boolean} thinPoolWarning - Whether thin-pool warning line should be shown
   * @param {number} eligiblePoolSize - Number of eligible recipes
   * @returns {Object} { text, inline_keyboard }
   */
  buildMorningDigestMessage(recipes, itemStatuses = {}, thinPoolWarning = false, eligiblePoolSize = 0) {
    const today = getTodayDateString();

    let text = `📌 *Pinterest Daily Pin List* (${today})\n`;
    text += `_Here are today's 10 recommended recipes to pin:_\n\n`;

    if (thinPoolWarning) {
      text += `⚠️ *Warning:* Content pool is running thin (${eligiblePoolSize} eligible recipes remaining). Consider publishing fresh posts!\n\n`;
    }

    const inline_keyboard = [];

    recipes.forEach((recipe, index) => {
      const num = index + 1;
      const status = itemStatuses[recipe.slug] || 'pending';

      let statusBadge = '';
      if (status === 'posted') {
        statusBadge = ' ✅ *[POSTED]*';
      } else if (status === 'skipped') {
        statusBadge = ' ⏭ *[SKIPPED]*';
      }

      text += `${num}. [${recipe.title}](${recipe.url})${statusBadge}\n`;

      // Build inline buttons for pending items
      if (status === 'pending') {
        inline_keyboard.push([
          {
            text: `✅ ${num}. Posted`,
            callback_data: `pin:post:${recipe.slug}`
          },
          {
            text: `⏭ ${num}. Skip`,
            callback_data: `pin:skip:${recipe.slug}`
          }
        ]);
      }
    });

    text += `\n_Tap ✅ when you post a pin to record history, or ⏭ to skip._`;

    return { text, inline_keyboard };
  }

  /**
   * Sends the morning digest message to the configured Telegram chat ID.
   * 
   * @param {Array<Object>} recipes - 10 selected recipe objects
   * @param {boolean} thinPoolWarning - Thin-pool warning flag
   * @param {number} eligiblePoolSize - Eligible pool count
   * @returns {Promise<Object>} Telegram API response with message_id
   */
  async sendMorningDigest(recipes, thinPoolWarning = false, eligiblePoolSize = 0) {
    const itemStatuses = {};
    recipes.forEach(r => { itemStatuses[r.slug] = 'pending'; });

    const { text, inline_keyboard } = this.buildMorningDigestMessage(
      recipes,
      itemStatuses,
      thinPoolWarning,
      eligiblePoolSize
    );

    const payload = {
      chat_id: this.chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard
      }
    };

    const res = await this._request('sendMessage', payload);
    return res.result;
  }

  /**
   * Updates an existing morning digest Telegram message in-place to reflect a button tap.
   */
  async updateDigestMessage(messageId, recipes, itemStatuses, thinPoolWarning, eligiblePoolSize) {
    const { text, inline_keyboard } = this.buildMorningDigestMessage(
      recipes,
      itemStatuses,
      thinPoolWarning,
      eligiblePoolSize
    );

    const payload = {
      chat_id: this.chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard
      }
    };

    try {
      await this._request('editMessageText', payload);
    } catch (err) {
      console.warn('[telegram] Failed to edit message text in-place:', err.message);
    }
  }

  /**
   * Answers a Telegram callback query to dismiss the button loading spinner in the client.
   */
  async answerCallbackQuery(callbackQueryId, text = '') {
    return this._request('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text
    });
  }
}

module.exports = TelegramBotClient;

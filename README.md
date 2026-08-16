# 📌 Pinterest Content Calendar Telegram Bot

An automated, intelligent Telegram bot that delivers a daily morning list of **10 recipes** from your WordPress blog to pin to Pinterest. Tracks pinning history, enforces a **minimum 6-day gap** between pins of the same recipe, uses **weighted anti-monotony randomness**, auto-discovers newly published recipes from your Yoast SEO sitemap, and lets you confirm or skip each pin with interactive Telegram inline buttons.

---

## 🌟 Key Features

1. **Daily Morning Digest**: Delivered every morning at 8:00 AM (Asia/Dhaka / UTC+6 configurable).
2. **Flexible Rotation Engine**: Minimum 6-day interval between repeat pins of the same recipe (stretches dynamically when needed).
3. **Anti-Monotony Selection**: Weighted random sampling prevents predictable or mechanical lists.
4. **Auto-Discovery**: Automatically syncs newly published posts directly from Yoast SEO sitemap (`https://newdecr.com/post-sitemap.xml`) without manual entry.
5. **Clean Recipe Titles**: Strips filler marketing phrases (e.g. *"your new favorite"*, *"your weeknight"*, *"seriously good"*, *"the perfect"*, *"your guide to"*, *"your go-to"*) and title-cases post slugs into readable names.
6. **Interactive Telegram Buttons**:
   - `✅ Posted`: Updates recipe's `last_pinned_date` to today, increments pin count, and edits message in-place to show resolved status.
   - `⏭ Skip`: Leaves date untouched and returns recipe to normal eligible pool.
7. **Thin-Pool Alert**: Automatically includes a warning line if eligible pool drops below 15 recipes.
8. **Dual Deployment Support**: Out-of-the-box support for **Netlify** (Scheduled Function + Blobs) and **Self-Hosted / cPanel** (Cron script + Express server + JSON state store).

---

## 🏗️ Project Architecture

```
pinterest-telegram-bot/
├── package.json                   # Dependencies & script shortcuts
├── .env.example                   # Environment variable template
├── netlify.toml                   # Netlify functions & cron schedule configuration
├── src/
│   ├── config.js                  # Central configuration & editable filler phrases list
│   ├── sitemap.js                 # Yoast XML sitemap fetcher & parser (with local fallback)
│   ├── titleCleaner.js            # Slug-to-title converter & filler phrase stripper
│   ├── selection.js               # Weighted selection algorithm with 6-day filter & relaxation
│   ├── telegram.js                # Telegram Bot API client & message builder
│   ├── bot.js                     # Core bot workflow & callback query handler
│   └── store/
│       ├── interface.js           # Storage interface definitions
│       ├── jsonStore.js           # Local JSON file store (Self-Hosted / cPanel)
│       ├── netlifyStore.js        # Netlify Blobs KV store (Netlify)
│       └── index.js               # Environment auto-detection store factory
├── netlify/
│   └── functions/
│       ├── daily-digest.js        # Netlify Scheduled Function (runs daily cron)
│       └── telegram-webhook.js    # Netlify Serverless Function (handles button clicks)
├── scripts/
│   ├── run-daily.js               # Self-hosted CLI runner for Linux / cPanel cron
│   ├── server.js                  # Standalone Express webhook server for cPanel
│   └── sync-sitemap.js            # CLI utility to sync or seed sitemap from local file
└── test/
    └── run-tests.js               # Automated test suite
```

---

## 🚀 Step-by-Step Installation & Setup Guide

### Step 1: Create Your Telegram Bot & Get Credentials

1. Open Telegram and search for `@BotFather`.
2. Send `/newbot` to create a new bot.
3. Follow prompts to set a name and username (e.g. `MyPinterestPinBot`).
4. `@BotFather` will give you a **HTTP API Token** (e.g. `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`). Copy this as `TELEGRAM_BOT_TOKEN`.
5. Next, get your Telegram **User Chat ID**:
   - Search for `@userinfobot` or `@GetIDBot` on Telegram.
   - Send `/start`. It will return your numeric ID (e.g. `987654321`). Copy this as `TELEGRAM_CHAT_ID`.

---

### Step 2: Deployment Option A — Netlify (Preferred)

Netlify provides a serverless setup using **Scheduled Functions** (cron) and **Netlify Blobs** (zero-db key-value store).

#### 1. Push Code to GitHub / GitLab
Create a private repository and push this codebase to your account.

#### 2. Create Netlify Project
1. Log in to your [Netlify Dashboard](https://app.netlify.app).
2. Click **Add new site** -> **Import an existing project**.
3. Select your repository.
4. Leave build settings as default (Netlify automatically detects `netlify.toml`).

#### 3. Set Environment Variables in Netlify
Go to **Site Settings** -> **Environment variables** -> **Add variables**:
- `TELEGRAM_BOT_TOKEN`: `your-bot-token-here`
- `TELEGRAM_CHAT_ID`: `your-chat-id-here`
- `SITE_SITEMAP_URL`: `https://newdecr.com/post-sitemap.xml`
- `TIMEZONE`: `Asia/Dhaka`
- `STORAGE_MODE`: `netlify`

#### 4. Deploy Site
Click **Deploy Site**. Netlify will deploy your functions:
- Scheduled function `daily-digest`: Triggers daily at 8:00 AM Asia/Dhaka (02:00 UTC).
- Serverless function `telegram-webhook`: Serves callback queries at `https://<your-site>.netlify.app/.netlify/functions/telegram-webhook`.

#### 5. Register Telegram Webhook
To connect Telegram button clicks (`✅` / `⏭`) to your Netlify serverless function, open your browser and visit:
```text
https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<YOUR-NETLIFY-SITE>.netlify.app/.netlify/functions/telegram-webhook
```
You will receive a response: `{"ok":true,"result":true,"description":"Webhook was set"}`.

*Note on Netlify Scheduled Functions:* Scheduled functions are available on free and paid Netlify plans. If your plan limits cron triggers, you can use a free cron ping service like [cron-job.org](https://cron-job.org) pointing to `https://<YOUR-NETLIFY-SITE>.netlify.app/.netlify/functions/daily-digest`.

---

### Step 3: Deployment Option B — Self-Hosted / cPanel (Fallback)

If you prefer deploying to your own cPanel host (same server as `newdecr.com`), follow these steps:

#### 1. Upload Code to Server
Upload the project folder to a directory outside web root (e.g., `/home/username/pin-bot`).

#### 2. Install Node.js Dependencies
Via SSH or cPanel Terminal in your project directory, run:
```bash
npm install
```

#### 3. Create `.env` File
Copy `.env.example` to `.env` and enter your credentials:
```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
TELEGRAM_CHAT_ID=987654321
SITE_SITEMAP_URL=https://newdecr.com/post-sitemap.xml
STORAGE_MODE=json
JSON_STORE_PATH=./data/state.json
TIMEZONE=Asia/Dhaka
PORT=3000
WEBHOOK_PATH=/api/telegram-webhook
```

#### 4. Set Up Daily Cron Job in cPanel
In **cPanel** -> **Cron Jobs**, set the schedule to run daily at 8:00 AM (`0 8 * * *`):
```bash
/usr/local/bin/node /home/username/pin-bot/scripts/run-daily.js >> /home/username/pin-bot/cron.log 2>&1
```

#### 5. Set Up Webhook Listener for Buttons
To receive button clicks (`✅` / `⏭`), start the Express webhook server:
```bash
npm start
```
(Or run via cPanel "Setup Node.js App" / PM2 process manager).

Register the webhook with Telegram:
```text
https://api.telegram.org/bot<YOUR_TELEGRAM_BOT_TOKEN>/setWebhook?url=https://yourdomain.com/api/telegram-webhook
```

---

## 🛠️ How to Adjust Key Tunables

All algorithm tunables can be easily configured via environment variables or directly in `src/config.js`.

| Parameter | Environment Variable | Default | Description |
|---|---|---|---|
| **Pin Count Per Day** | `PIN_COUNT_PER_DAY` | `10` | Number of recipes delivered in the daily morning message. |
| **Minimum Interval** | `MIN_PIN_INTERVAL_DAYS` | `6` | Minimum days required between two pins of the same recipe. |
| **Thin Pool Alert** | `THIN_POOL_THRESHOLD` | `15` | Threshold of eligible recipes below which a warning line is added. |
| **New Post Boost** | `NEW_POST_WEIGHT_BOOST` | `1.5` | Priority multiplier for newly discovered recipes. |
| **Timezone** | `TIMEZONE` | `Asia/Dhaka` | Timezone used for date calculations. |

### Editing Title Cleanup Filler Phrases
To tune filler phrases stripped from recipe titles, open `src/config.js` and edit the `fillerPhrases` array:

```javascript
fillerPhrases: [
  'your new favorite',
  'your weeknight',
  'seriously good',
  'the perfect',
  'your guide to',
  'your go-to',
  'the ultimate',
  'easy and delicious',
  'quick and easy',
  'best ever',
  'how to make'
]
```
The cleaner handles word boundaries, hyphens, and uppercase/lowercase automatically!

---

## 🛡️ Sitemap Firewall & Offline Syncing

If Wordfence or BitNinja firewall blocks external HTTP requests to `https://newdecr.com/post-sitemap.xml`:

1. **Local File Fallback**: Save a copy of `post-sitemap.xml` inside `data/post-sitemap.xml`. The sitemap parser automatically falls back to reading this file if HTTP returns a firewall challenge page.
2. **CLI Sync Command**: You can manually trigger or seed sitemap updates anytime using:
   ```bash
   # Sync directly via HTTP/fallback
   npm run sync-sitemap

   # Or import from a downloaded XML file
   node scripts/sync-sitemap.js --file ./data/post-sitemap.xml
   ```

---

## 🧪 Testing

Run the built-in automated test suite anytime to verify title cleaner, sitemap parsing, and selection logic:
```bash
npm test
```

---

## 🔮 Future Enhancement Notes

* **Category-Based Content Balancing**: The Yoast SEO `post-sitemap.xml` lists URLs and modification dates, but does not include post category metadata. Category balancing would require querying WordPress endpoints. Once Wordfence REST API permissions (`/wp-json/wp/v2/posts`) or custom XML feed exports are enabled, a `category` property can be added to recipe state to enforce category distribution rules (e.g. max 2 desserts per day).

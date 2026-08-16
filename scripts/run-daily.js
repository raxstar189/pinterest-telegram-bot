require('dotenv').config();
const { runDailyMorningProcess } = require('../src/bot');

(async () => {
  console.log('[cron-cli] Executing daily morning Pinterest process...');
  try {
    const result = await runDailyMorningProcess();
    console.log('[cron-cli] Daily morning process completed successfully:', result);
    process.exit(0);
  } catch (error) {
    console.error('[cron-cli] Execution failed:', error);
    process.exit(1);
  }
})();

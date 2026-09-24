const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.error(`[BROWSER ERROR] ${err.message}`));
  
  console.log('Navigating to Vercel...');
  await page.goto('https://srm-students-portal.vercel.app/', { waitUntil: 'networkidle' });
  console.log('Page loaded.');
  
  await browser.close();
})();

const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('request', req => {
    if (req.url().includes('onrender.com')) {
      console.log(`[REQUEST] ${req.method()} ${req.url()}`);
    }
  });
  
  page.on('response', async res => {
    if (res.url().includes('onrender.com')) {
      console.log(`[RESPONSE] ${res.status()} ${res.url()}`);
    }
  });

  await page.goto('https://srm-students-portal.vercel.app/', { waitUntil: 'networkidle' });
  
  await page.click('text=Check My Attendance');
  
  // Wait for CredentialsForm to appear
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  
  console.log('Form appeared. Filling it out...');
  await page.fill('input[type="text"]', 'RA2111026010000'); // Dummy NetID
  await page.fill('input[type="password"]', 'dummy_password'); // Dummy Password
  // Captcha is the third input usually
  await page.fill('input[placeholder*="CAPTCHA"]', 'dummy'); 
  
  console.log('Submitting form...');
  await page.click('button:has-text("Connect")');
  
  // Wait for 10 seconds to observe state changes
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const statusText = await page.evaluate(() => document.body.innerText);
    if (statusText.includes('Invalid credentials detected') || statusText.includes('Login failed')) {
      console.log('Found error message!');
      break;
    }
  }
  
  await page.screenshot({ path: '/Users/britto/.gemini/antigravity-ide/brain/ddd2361a-5ef7-4a0d-ae4d-c42051280824/scratch/screenshot3.png' });
  console.log('Screenshot 3 taken.');
  
  await browser.close();
})();

import { chromium } from 'playwright';

export async function verifyPlaywrightInstallation(): Promise<boolean> {
  console.log('[SRM] Starting Playwright Health Check...');
  try {
    const isRemoteServer = !!(process.env.RENDER || process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL || process.env.FLY_ALLOC_ID || process.env.PLAYWRIGHT_HEADLESS === 'true');
    const useHeadless = isRemoteServer || process.env.NODE_ENV === 'production';

    const browser = await chromium.launch({
      headless: true, // ALWAYS headless for the health check
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    await browser.close();
    console.log('[SRM] Playwright Health Check Passed. Chromium is properly installed.');
    return true;
  } catch (error: any) {
    console.error('\n=============================================================');
    console.error('[CRITICAL ERROR] Playwright Chromium is not installed in the production runtime.');
    console.error('The backend cannot safely extract attendance data without it.');
    console.error('Diagnostic Info:', error.message);
    console.error('=============================================================\n');
    return false;
  }
}

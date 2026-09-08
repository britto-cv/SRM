import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { ConnectionState, NormalizedStudentData } from '@srm/shared';
import { AuthenticationDetector } from './AuthenticationDetector';
import { SRMISTPortalAdapter } from './SRMISTPortalAdapter';
import * as crypto from 'crypto';

/**
 * ============================================================================
 * ARCHITECTURAL NOTICE: LOCAL DEVELOPMENT vs. DEPLOYED PRODUCTION
 * ============================================================================
 * 
 * LOCAL DEVELOPMENT:
 * - Student browser (React @ localhost)
 *   ↓ HTTP/REST
 * - Local backend (Express @ localhost)
 *   ↓ Playwright (headless: false)
 * - Visible Chromium opens directly on student's personal computer screen.
 * - Student manually fills NetID, password, and solves CAPTCHA/MFA.
 * - Local backend monitors page DOM & URL signals, then extracts normalized
 *   attendance data strictly in-memory.
 *
 * DEPLOYED PRODUCTION LIMITATION:
 * - A remote Express server deployed on a cloud provider (e.g., Render, Railway,
 *   Fly.io, AWS, Vercel) runs inside an isolated container/virtual machine.
 * - A remote cloud backend CANNOT open a visible desktop Chromium window on the
 *   student's personal laptop screen.
 * - Attempting to launch `headless: false` on a headless Linux cloud container
 *   without an X11 display server will crash with:
 *   "Target closed / Missing X server $DISPLAY".
 * - Therefore, for public cloud deployments without requiring students to run
 *   a local Node.js backend, a client-side architecture (such as a browser
 *   extension or direct client-driven authentication flow) is required.
 * ============================================================================
 */

const LOGIN_URL = 'https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp';

export class PlaywrightSessionManager {
  private sessionId: string | null = null;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  
  private currentState: ConnectionState = 'DISCONNECTED';
  private stateDetail: string | null = null;
  private activeCaptchaBase64: string | null = null;
  private detector: AuthenticationDetector;
  private activeData: NormalizedStudentData | null = null;
  private isConnecting: boolean = false;
  
  constructor() {
    this.detector = new AuthenticationDetector();
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public getState(): ConnectionState {
    return this.currentState;
  }

  public getStateDetail(): string | null {
    return this.stateDetail;
  }

  public getData(): NormalizedStudentData | null {
    return this.activeData;
  }

  public getCaptchaBase64(): string | null {
    return this.activeCaptchaBase64;
  }

  private setState(state: ConnectionState, detail?: string) {
    this.currentState = state;
    this.stateDetail = detail || null;
    console.log(`[SRM] State: ${state}${detail ? ` - ${detail}` : ''}`);
  }

  /**
   * Initializes a session, launches visible Chromium, navigates to SRMIST login page,
   * and starts monitoring for manual authentication.
   */
  public async connect(): Promise<{ sessionId: string; status: ConnectionState }> {
    // 1. Concurrency Guard: If already connecting or active in login flow, return active session
    if (this.isConnecting) {
      console.log(`[SRM] Connection already in progress. Returning existing session ${this.sessionId}`);
      return { sessionId: this.sessionId || 'pending', status: this.currentState };
    }

    if (
      this.sessionId && 
      (this.currentState === 'WAITING_FOR_LOGIN' || 
       this.currentState === 'AUTHENTICATING' || 
       this.currentState === 'AUTHENTICATED' || 
       this.currentState === 'EXTRACTING' || 
       this.currentState === 'DATA_READY')
    ) {
      // Check if the page is still valid and open
      if (this.page && !this.page.isClosed()) {
        console.log(`[SRM] Active session already running (${this.sessionId}, state: ${this.currentState}). Reusing.`);
        return { sessionId: this.sessionId, status: this.currentState };
      }
    }

    // Set lock
    this.isConnecting = true;

    // 2. Clean up any stale sessions before launching a new one
    if (this.currentState !== 'DISCONNECTED') {
      console.log('[SRM] Cleaning up previous session before new connection...');
      await this.cleanup();
    }

    // Generate unique session identifier
    this.sessionId = `srm_sess_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    console.log(`[SRM] /connect request received. Created Session ID: ${this.sessionId}`);

    try {
      // Verify remote server environment
      const isRemoteServer = !!(process.env.RENDER || process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL || process.env.FLY_ALLOC_ID || process.env.PLAYWRIGHT_HEADLESS === 'true');
      const useHeadless = isRemoteServer;

      this.setState('LAUNCHING', `Launching ${useHeadless ? 'headless cloud' : 'visible local'} browser...`);

      console.log(`[SRM] Starting browser... (Headless: ${useHeadless})`);
      this.browser = await chromium.launch({
        headless: useHeadless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled'
        ]
      });
      console.log('[SRM] Browser launched');

      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 850 },
        deviceScaleFactor: 1
      });

      this.page = await this.context.newPage();
      console.log('[SRM] Page created');

      // Listen for unexpected page close or crash
      this.page.on('close', () => {
        console.log('[SRM] Page close event received');
        if (this.currentState !== 'DISCONNECTED' && this.currentState !== 'DISCONNECTING') {
          console.log('[SRM] Browser window closed by user. Cleaning up session...');
          this.setState('DISCONNECTED', 'Browser closed by user');
          this.cleanup();
        }
      });

      this.page.on('crash', () => {
        console.error('[SRM] Playwright page crashed');
        this.setState('ERROR', 'Browser page crashed');
        this.cleanup();
      });

      // 3. Navigate to SRMIST Student Portal
      console.log('[SRM] Opening SRMIST login page...');
      console.log(`[SRM] SRM URL navigation started: ${LOGIN_URL}`);

      const response = await this.page.goto(LOGIN_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      const finalUrl = this.page.url();
      const pageTitle = await this.page.title().catch(() => 'Unknown');
      console.log(`[SRM] SRM URL after navigation: ${finalUrl}, Title: "${pageTitle}"`);

      if (!response || !response.ok()) {
        const status = response ? response.status() : 'No response';
        console.warn(`[SRM] Non-200 navigation response: ${status}, continuing to verify DOM readiness...`);
      }

      // 4. Verify login page readiness & JavaScript execution
      console.log('[SRM] Verifying login page readiness and JavaScript execution...');
      await this.page.waitForSelector('#login_form, input[type="password"], #username', {
        timeout: 15000
      });
      console.log('[SRM] Login page detected');
      
      let returnedStatus: ConnectionState = 'WAITING_FOR_LOGIN';
      
      // If headless, we extract CAPTCHA and wait for credentials from frontend
      if (useHeadless) {
        console.log('[SRM] Extracting CAPTCHA image for frontend...');
        try {
          const captchaElement = await this.page.waitForSelector('img#secure_captcha, img[src*="captcha"]', { timeout: 5000 });
          const captchaBuffer = await captchaElement.screenshot();
          this.activeCaptchaBase64 = captchaBuffer.toString('base64');
          console.log('[SRM] CAPTCHA image extracted successfully');
          returnedStatus = 'WAITING_FOR_CREDENTIALS';
          this.setState('WAITING_FOR_CREDENTIALS', 'Waiting for student to provide credentials and CAPTCHA');
        } catch (e) {
          console.error('[SRM] Failed to extract CAPTCHA image', e);
          returnedStatus = 'ERROR';
          this.setState('ERROR', 'Failed to retrieve CAPTCHA image from SRM portal');
          await this.cleanup();
          return { sessionId: this.sessionId, status: 'ERROR' };
        }
      } else {
        this.setState('WAITING_FOR_LOGIN', 'SRMIST login window is open. Please enter credentials.');
        // 5. Start background monitoring asynchronously since student will interact directly with browser
        this.startBackgroundMonitoring(this.sessionId, useHeadless);
      }

      return {
        sessionId: this.sessionId,
        status: returnedStatus
      };

    } catch (error: any) {
      console.error('[SRM] Failed to initialize Playwright session:', error.stack || error.message || error);
      this.setState('ERROR', error.message || 'Failed to initialize secure browser');
      await this.cleanup();
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Submits credentials to the headless browser and starts authentication monitoring.
   */
  public async submitCredentials(netId: string, pass: string, captchaText: string): Promise<boolean> {
    if (!this.page || this.page.isClosed() || this.currentState !== 'WAITING_FOR_CREDENTIALS') {
      throw new Error('No active authentication session awaiting credentials');
    }

    try {
      this.setState('AUTHENTICATING', 'Submitting credentials to SRMIST...');
      
      // Fill the fields securely
      await this.page.fill('input#username', netId);
      await this.page.fill('input#password', pass);
      await this.page.fill('input#captcha', captchaText);
      
      // Click the login button
      await this.page.click('button#btnLogin, input[type="submit"]');
      
      // Start background monitoring for login success/failure
      // We know it is headless since submitCredentials is only called in WAITING_FOR_CREDENTIALS
      this.startBackgroundMonitoring(this.sessionId!, true);
      return true;
    } catch (error: any) {
      console.error('[SRM] Failed to submit credentials:', error);
      this.setState('LOGIN_FAILED', 'Failed to submit credentials to the portal');
      return false;
    }
  }

  /**
   * Continuously monitors the active page for manual login completion, failures, or closure.
   */
  private async startBackgroundMonitoring(activeSessionId: string, isHeadless: boolean = false) {
    if (!this.page || this.sessionId !== activeSessionId) return;

    try {
      const result = await this.detector.monitorAuthentication(this.page, {
        timeoutMs: 600000, // 10 minutes timeout for manual credential, CAPTCHA, and MFA entry
        checkIntervalMs: 1000,
        onStateChange: async (newState: ConnectionState, detail?: string) => {
          if (this.sessionId === activeSessionId) {
            this.setState(newState, detail);
            
            // If headless and login failed, refresh CAPTCHA so user can retry
            if (newState === 'LOGIN_FAILED' && isHeadless && this.page) {
              console.log('[SRM] Login failed in headless mode, refreshing CAPTCHA...');
              try {
                // The page has likely reloaded, wait for the new captcha image
                const captchaElement = await this.page.waitForSelector('img#secure_captcha, img[src*="captcha"]', { timeout: 8000 });
                const captchaBuffer = await captchaElement.screenshot();
                this.activeCaptchaBase64 = captchaBuffer.toString('base64');
                console.log('[SRM] New CAPTCHA image extracted successfully');
                this.setState('WAITING_FOR_CREDENTIALS', 'Login failed. Please verify your credentials and enter the new CAPTCHA.');
              } catch (e) {
                console.error('[SRM] Failed to refresh CAPTCHA image', e);
              }
            }
          }
        }
      });

      // Verify this monitoring loop still belongs to the active session
      if (this.sessionId !== activeSessionId) {
        console.log(`[SRM] Session changed during monitoring. Discarding result for ${activeSessionId}`);
        return;
      }

      if (result === 'AUTHENTICATED') {
        console.log('[SRM] Authentication detected');
        this.setState('EXTRACTING', 'Login successful! Extracting academic data...');
        console.log('[SRM] Starting academic data extraction...');

        if (!this.page || this.page.isClosed()) {
          throw new Error('Page was closed before extraction could begin');
        }

        const adapter = new SRMISTPortalAdapter();
        const extractedData = await adapter.extractData(this.page);

        if (extractedData) {
          // Store purely in-memory for the active session (Zero Persistence requirement)
          this.activeData = extractedData;
          this.setState('DATA_READY', 'Academic data extracted successfully');
          console.log('[SRM] Extraction completed');
          // Notice: We keep the visible browser open until the user clicks Disconnect.
        } else {
          throw new Error('Portal data adapter returned empty academic data');
        }

      } else if (result === 'DISCONNECTED') {
        console.log('[SRM] Session terminated because browser was closed');
        await this.cleanup();

      } else if (result === 'TIMEOUT') {
        console.warn('[SRM] Login monitoring timed out after 10 minutes');
        this.setState('TIMEOUT', 'Login session timed out');
        await this.cleanup();

      } else {
        console.error(`[SRM] Authentication ended with state: ${result}`);
        this.setState('ERROR', 'Authentication failed');
        await this.cleanup();
      }

    } catch (error: any) {
      console.error('[SRM] Background monitoring or extraction failed:', error.stack || error.message || error);
      if (this.sessionId === activeSessionId) {
        this.setState('ERROR', error.message || 'Extraction failed');
      }
      await this.cleanup();
    }
  }

  /**
   * Disconnects the session on user request.
   */
  public async disconnect(): Promise<void> {
    console.log(`[SRM] Disconnect requested for session: ${this.sessionId}`);
    this.setState('DISCONNECTING', 'Closing browser session...');
    await this.cleanup();
  }

  /**
   * Cleans up all Playwright resources and clears in-memory student data.
   * Enforces Zero-Persistence: no cookies, credentials, or student records stored.
   */
  public async cleanup(): Promise<void> {
    console.log('[SRM] Cleanup started');
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close().catch(() => {});
      }
    } catch (e) {
      // Ignore
    } finally {
      this.page = null;
    }

    try {
      if (this.context) {
        await this.context.close().catch(() => {});
      }
    } catch (e) {
      // Ignore
    } finally {
      this.context = null;
    }

    try {
      if (this.browser) {
        await this.browser.close().catch(() => {});
      }
    } catch (e) {
      // Ignore
    } finally {
      this.browser = null;
    }

    // Zero-persistence enforcement:
    this.activeData = null;
    this.sessionId = null;
    this.isConnecting = false;
    this.setState('DISCONNECTED', 'Session cleanly closed');
    console.log('[SRM] Cleanup completed');
  }
}

export const sessionManager = new PlaywrightSessionManager();

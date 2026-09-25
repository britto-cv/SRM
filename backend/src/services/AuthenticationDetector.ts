import { Page, Dialog } from 'playwright';
import { ConnectionState } from '@srm/shared';

export type AuthDetectionResult = 'AUTHENTICATED' | 'DISCONNECTED' | 'TIMEOUT' | 'ERROR' | 'LOGIN_FAILED';

export interface AuthenticationDetectorOptions {
  timeoutMs?: number;
  checkIntervalMs?: number;
  isHeadless?: boolean;
  onStateChange: (state: ConnectionState, detail?: string) => void;
}

export class AuthenticationDetector {
  private lastAlertMessage: string | null = null;
  private currentAuthState: ConnectionState = 'WAITING_FOR_LOGIN';
  private dialogListenerPage: Page | null = null;

  /**
   * Attaches dialog and event listeners to the Page to capture native alert popups
   * commonly used by the legacy SRMIST portal (e.g., "Invalid User Name or Password").
   */
  public attachPageListeners(page: Page, updateState: (state: ConnectionState, detail?: string) => void): void {
    // Each reconnect creates a new Page. A listener on a previous (closed)
    // page cannot observe alerts for the new login session.
    if (this.dialogListenerPage === page) return;
    this.dialogListenerPage = page;

    page.on('dialog', async (dialog: Dialog) => {
      const message = dialog.message() || '';
      this.lastAlertMessage = message;
      console.log(`[SRM] Login alert dialog detected: "${message}"`);
      
      // Do not set currentAuthState before updateState. Doing so caused
      // updateState to consider the failure unchanged and skip its callback,
      // leaving the deployed UI stuck on "Authenticating" without a new CAPTCHA.
      updateState('LOGIN_FAILED', message);
      
      // Dismiss dialog so it doesn't freeze the page or prevent the user from re-entering
      await dialog.dismiss().catch(() => {});
    });

    page.on('crash', () => {
      console.error('[SRM] Page crashed during authentication session');
      this.currentAuthState = 'ERROR';
      updateState('ERROR', 'Page crashed');
    });
  }

  /**
   * Continuously monitors the page state using multiple signals until:
   * - Login succeeds (AUTHENTICATED)
   * - Browser is closed (DISCONNECTED)
   * - Timeout occurs (TIMEOUT)
   * - Unrecoverable error occurs (ERROR)
   *
   * Supports both options object and legacy (page, timeoutMs, onStateChange) signatures.
   */
  public async monitorAuthentication(
    page: Page,
    optionsOrTimeout: AuthenticationDetectorOptions | number,
    legacyCallback?: (state: ConnectionState, detail?: string) => void
  ): Promise<AuthDetectionResult> {
    let timeoutMs = 600000; // 10 minutes default
    let checkIntervalMs = 1000;
    let onStateChange: (state: ConnectionState, detail?: string) => void;

    const isHeadless = typeof optionsOrTimeout === 'object' ? !!optionsOrTimeout.isHeadless : false;

    if (typeof optionsOrTimeout === 'number') {
      timeoutMs = optionsOrTimeout;
      onStateChange = legacyCallback || (() => {});
    } else {
      timeoutMs = optionsOrTimeout.timeoutMs || 600000;
      checkIntervalMs = optionsOrTimeout.checkIntervalMs || 1000;
      onStateChange = optionsOrTimeout.onStateChange;
    }

    const startTime = Date.now();
    this.currentAuthState = 'WAITING_FOR_LOGIN';
    this.lastAlertMessage = null;

    const updateState = (newState: ConnectionState, detail?: string) => {
      if (newState !== this.currentAuthState) {
        this.currentAuthState = newState;
        console.log(`[SRM] Authentication state changed: ${newState}${detail ? ` (${detail})` : ''}`);
        onStateChange(newState, detail);
      }
    };

    console.log('[SRM] Authentication monitor started');
    console.log('[SRM] Waiting for manual authentication...');

    // Attach native dialog listener
    this.attachPageListeners(page, updateState);

    while (Date.now() - startTime < timeoutMs) {
      if (page.isClosed()) {
        console.log('[SRM] Browser page was closed by user');
        updateState('DISCONNECTED', 'Browser window was closed');
        return 'DISCONNECTED';
      }

      try {
        const currentUrl = page.url();

        // 1. Check DOM for presence of authenticated student profile, navigation markers, or error messages
        const domSignals = await page.evaluate(() => {
          const bodyText = document.body ? document.body.innerText : '';
          const hasLoginForm = !!document.getElementById('login_form') || !!document.querySelector('form[action*="LoginServlet"]');
          const hasPasswordInput = !!document.querySelector('input[type="password"]');

          // Profile or dashboard elements
          const hasStudentName = bodyText.includes('Student Name') || bodyText.includes('STUDENT NAME');
          const hasRegisterNo = bodyText.includes('Register No') || bodyText.includes('Register Number') || bodyText.includes('Registration No');
          const hasStudentId = bodyText.includes('Student ID') || bodyText.includes('Program');
          const hasLogout = !!document.querySelector('a[href*="logout"], a[href*="Logout"], a[href*="youLogin.jsp?logout=true"], .logout, #logout');
          const hasNavLists = !!document.getElementById('listId7') || !!document.getElementById('listId9');

          // Failure signals in page text or alert boxes
          // Only treat an .alert element as a failure signal if it contains error-related keywords
          const errorKeywords = /invalid|wrong|incorrect|failed|mismatch|captcha|password|credentials|does not exist|not found/i;
          const alertEl = document.querySelector('.alert-danger, .alert-warning, .text-danger, font[color="red"], span.error');
          const alertText = alertEl ? (alertEl.textContent || '').trim().replace(/\s+/g, ' ') : '';
          const alertIsError = alertText.length > 0 && errorKeywords.test(alertText);

          const hasInvalidMsg = 
            alertIsError ||
            bodyText.includes('Invalid User Name or Password') ||
            bodyText.includes('Invalid credentials') ||
            bodyText.includes('Invalid Captcha') ||
            bodyText.includes('Captcha does not match') ||
            bodyText.includes('Verification Code did not match') ||
            bodyText.includes('Wrong Password') ||
            bodyText.includes('User does not exist');

          return {
            hasLoginForm,
            hasPasswordInput,
            hasStudentName,
            hasRegisterNo,
            hasStudentId,
            hasLogout,
            hasNavLists,
            hasInvalidMsg,
            invalidText: (alertIsError ? alertText : '') || (hasInvalidMsg ? 'Invalid credentials or CAPTCHA' : '')
          };
        }).catch(() => null);

        // 2. Check if user is actively submitting (LoginServlet in-flight before DOM renders)
        if (currentUrl.includes('LoginServlet') && (!domSignals || (!domSignals.hasInvalidMsg && !domSignals.hasLoginForm))) {
          updateState('AUTHENTICATING', 'Submitting credentials to SRMIST...');
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }

        // Check for Multi-Signal AUTHENTICATED states:
        // Signal A: URL moved away from login page to known student portal paths
        const isUrlAuthenticated = 
          currentUrl.includes('sp.srmist.edu.in') &&
          !currentUrl.includes('youLogin.jsp') &&
          !currentUrl.includes('LoginServlet') &&
          (
            currentUrl.includes('UserHomePage.jsp') ||
            currentUrl.includes('HRDSystem.jsp') ||
            currentUrl.includes('studentDetails.jsp') ||
            currentUrl.includes('template') ||
            currentUrl.includes('student_dashboard') ||
            currentUrl.includes('report') ||
            currentUrl.includes('welcome.jsp') ||
            currentUrl.includes('home.jsp') ||
            (currentUrl.includes('/students/') && !currentUrl.includes('youLogin.jsp'))
          );

        if (domSignals) {
          // Check for login failure in DOM (either explicit error message or remaining on LoginServlet with login form)
          if (domSignals.hasInvalidMsg || (currentUrl.includes('LoginServlet') && domSignals.hasLoginForm)) {
            const failReason = domSignals.invalidText || 'Invalid credentials or CAPTCHA entered';
            console.log(`[SRM] Login failure detected on page: ${failReason}`);
            updateState('LOGIN_FAILED', failReason);
            if (isHeadless) {
              return 'LOGIN_FAILED';
            }
            await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
            continue;
          }

          // Check if any strong authentication signal is satisfied
          let authDetectionReason: string | null = null;

          if (currentUrl.includes('UserHomePage.jsp')) {
            authDetectionReason = `Reached SRMIST UserHomePage.jsp: ${currentUrl}`;
          } else if (isUrlAuthenticated && (domSignals.hasStudentName || domSignals.hasRegisterNo || domSignals.hasNavLists || domSignals.hasLogout)) {
            authDetectionReason = `URL changed to ${currentUrl} and student dashboard markers verified`;
          } else if (domSignals.hasNavLists) {
            authDetectionReason = `Found authenticated portal navigation items (#listId7 / #listId9)`;
          } else if (domSignals.hasLogout && (domSignals.hasStudentName || domSignals.hasRegisterNo)) {
            authDetectionReason = `Found logout button and student identity details ("${domSignals.hasStudentName ? 'Student Name' : 'Register No'}")`;
          } else if (!domSignals.hasLoginForm && !domSignals.hasPasswordInput && (domSignals.hasStudentName || domSignals.hasStudentId)) {
            authDetectionReason = `Login form disappeared and student profile markers present`;
          } else if (isUrlAuthenticated && !domSignals.hasLoginForm) {
            authDetectionReason = `Redirected away from login to authenticated URL: ${currentUrl}`;
          }

          if (authDetectionReason) {
            console.log(`[SRM] Authentication detected! Reason: ${authDetectionReason}`);
            updateState('AUTHENTICATED', authDetectionReason);
            return 'AUTHENTICATED';
          }

          // Still on login form:
          if (domSignals.hasLoginForm || domSignals.hasPasswordInput) {
            const current = this.currentAuthState as ConnectionState;
            if (current === 'LOGIN_FAILED') {
              // Stay on LOGIN_FAILED until user interacts or triggers navigation
            } else if (current === 'AUTHENTICATING') {
              // Came back to login form without error message
              updateState('WAITING_FOR_LOGIN', 'Returned to login page');
            } else {
              updateState('WAITING_FOR_LOGIN', 'Waiting for student credentials and CAPTCHA');
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
      } catch (err: any) {
        if (page.isClosed()) {
          console.log('[SRM] Browser closed during check loop');
          updateState('DISCONNECTED', 'Browser closed');
          return 'DISCONNECTED';
        }
        // Transient error during navigation / DOM evaluation
        await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
      }
    }

    console.warn('[SRM] Authentication monitoring timed out after 10 minutes');
    updateState('TIMEOUT', 'Login window timed out after 10 minutes');
    return 'TIMEOUT';
  }
}

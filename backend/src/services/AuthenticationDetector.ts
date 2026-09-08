import { Page, Dialog } from 'playwright';
import { ConnectionState } from '@srm/shared';

export type AuthDetectionResult = 'AUTHENTICATED' | 'DISCONNECTED' | 'TIMEOUT' | 'ERROR';

export interface AuthenticationDetectorOptions {
  timeoutMs?: number;
  checkIntervalMs?: number;
  onStateChange: (state: ConnectionState, detail?: string) => void;
}

export class AuthenticationDetector {
  private lastAlertMessage: string | null = null;
  private currentAuthState: ConnectionState = 'WAITING_FOR_LOGIN';
  private dialogListenerAttached: boolean = false;

  /**
   * Attaches dialog and event listeners to the Page to capture native alert popups
   * commonly used by the legacy SRMIST portal (e.g., "Invalid User Name or Password").
   */
  public attachPageListeners(page: Page, updateState: (state: ConnectionState, detail?: string) => void): void {
    if (this.dialogListenerAttached) return;

    page.on('dialog', async (dialog: Dialog) => {
      const message = dialog.message() || '';
      this.lastAlertMessage = message;
      console.log(`[SRM] Login alert dialog detected: "${message}"`);
      
      this.currentAuthState = 'LOGIN_FAILED';
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

        // 1. Check if user is actively submitting (Navigating or LoginServlet)
        if (currentUrl.includes('LoginServlet')) {
          updateState('AUTHENTICATING', 'Submitting credentials to SRMIST...');
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }

        // 2. Check for Multi-Signal AUTHENTICATED states:
        // Signal A: URL moved away from login page to known student portal paths
        const isUrlAuthenticated = 
          currentUrl.includes('sp.srmist.edu.in') &&
          !currentUrl.includes('loginManager') &&
          !currentUrl.includes('youLogin.jsp') &&
          !currentUrl.includes('LoginServlet') &&
          (
            currentUrl.includes('studentDetails.jsp') ||
            currentUrl.includes('template') ||
            currentUrl.includes('student_dashboard') ||
            currentUrl.includes('report') ||
            currentUrl.includes('welcome.jsp') ||
            currentUrl.includes('home.jsp') ||
            currentUrl.includes('/students/')
          );

        // Signal B: Check DOM for presence of authenticated student profile or navigation markers
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

          // Failure signals in page text
          const hasInvalidMsg = 
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
          };
        }).catch(() => null);

        if (domSignals) {
          // Check for login failure in DOM
          if (domSignals.hasInvalidMsg) {
            updateState('LOGIN_FAILED', 'Invalid credentials or CAPTCHA entered');
            await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
            continue;
          }

          // Check if any strong authentication signal is satisfied
          let authDetectionReason: string | null = null;

          if (isUrlAuthenticated && (domSignals.hasStudentName || domSignals.hasRegisterNo || domSignals.hasNavLists || domSignals.hasLogout)) {
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

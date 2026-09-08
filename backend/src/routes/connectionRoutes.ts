import { Router, Request, Response } from 'express';
import { sessionManager } from '../services/PlaywrightSessionManager';

const router = Router();

/**
 * POST /api/connect
 * Initiates a new Playwright headed browser session on the local machine.
 * Navigates directly to the SRMIST login page and returns WAITING_FOR_LOGIN immediately.
 */
router.post('/connect', async (req: Request, res: Response) => {
  console.log('[SRM] Received POST /api/connect request');
  try {
    const result = await sessionManager.connect();
    console.log(`[SRM] Connect initiated successfully. Session ID: ${result.sessionId}, Status: ${result.status}`);
    res.json({ 
      status: result.status, 
      sessionId: result.sessionId 
    });
  } catch (error: any) {
    console.error('[SRM] Error in POST /api/connect:', error.stack || error.message || error);
    res.status(500).json({ 
      error: error.message || 'Failed to initiate secure browser connection',
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/connect/status
 * Returns the current session state and diagnostic detail.
 */
router.get('/connect/status', (req: Request, res: Response) => {
  const currentSessionId = sessionManager.getSessionId();
  const requestedSessionId = req.query.sessionId as string | undefined;

  // If a specific session ID was requested and it doesn't match active session
  if (requestedSessionId && currentSessionId && requestedSessionId !== currentSessionId) {
    res.json({
      state: 'DISCONNECTED',
      detail: 'Session superseded or expired',
      sessionId: requestedSessionId
    });
    return;
  }

  res.json({ 
    state: sessionManager.getState(),
    detail: sessionManager.getStateDetail(),
    sessionId: currentSessionId,
    captchaBase64: sessionManager.getCaptchaBase64()
  });
});

/**
 * POST /api/connect/submit
 * Submits the student credentials and captcha to the headless session.
 */
router.post('/connect/submit', async (req: Request, res: Response) => {
  console.log('[SRM] Received POST /api/connect/submit request');
  const { sessionId, netId, password, captcha } = req.body;

  if (!sessionId || !netId || !password || !captcha) {
    res.status(400).json({ error: 'Missing required credential fields' });
    return;
  }

  const currentSessionId = sessionManager.getSessionId();
  if (sessionId !== currentSessionId) {
    res.status(400).json({ error: 'Invalid or expired session ID' });
    return;
  }

  try {
    const success = await sessionManager.submitCredentials(netId, password, captcha);
    if (success) {
      res.json({ status: 'AUTHENTICATING' });
    } else {
      res.status(500).json({ error: 'Failed to submit credentials' });
    }
  } catch (error: any) {
    console.error('[SRM] Error in POST /api/connect/submit:', error);
    res.status(500).json({ error: error.message || 'Failed to submit credentials' });
  }
});

/**
 * GET /api/connect/data
 * Returns the normalized academic & attendance data extracted from SRMIST.
 */
router.get('/connect/data', (req: Request, res: Response) => {
  const data = sessionManager.getData();
  if (data) {
    console.log('[SRM] Returning extracted student data to client');
    res.json(data);
  } else {
    res.status(404).json({ 
      error: 'No active student data available. Please complete authentication first.' 
    });
  }
});

/**
 * POST /api/disconnect
 * Safely closes the browser and clears all in-memory data.
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  console.log('[SRM] Received POST /api/disconnect request');
  try {
    await sessionManager.disconnect();
    res.json({ status: 'disconnected' });
  } catch (error: any) {
    console.error('[SRM] Error in POST /api/disconnect:', error);
    res.status(500).json({ error: 'Failed to disconnect cleanly' });
  }
});

export default router;

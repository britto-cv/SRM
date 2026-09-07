import { sessionManager } from './backend/src/services/PlaywrightSessionManager';

async function test() {
  try {
    const res = await sessionManager.getCaptcha();
    console.log("Success! Session ID:", res.sessionId);
    console.log("Image starts with:", res.captchaImageBase64.substring(0, 30));
  } catch (e) {
    console.error("Failed:", e);
  } finally {
    process.exit(0);
  }
}

test();

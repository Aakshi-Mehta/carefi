import { Router, Response, Request } from 'express';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/authMiddleware';
import { getConfig } from '../lib/env';
import { MetaWhatsAppAdapter } from '../adapters/whatsapp/MetaWhatsAppAdapter';
import { MockWhatsAppAdapter } from '../adapters/whatsapp/MockWhatsAppAdapter';
import { SmtpEmailAdapter } from '../adapters/email/SmtpEmailAdapter';
import { MockEmailAdapter } from '../adapters/email/MockEmailAdapter';
import { GoogleDriveAdapter } from '../adapters/drive/GoogleDriveAdapter';
import { DemoDriveAdapter } from '../adapters/drive/DemoDriveAdapter';

const router = Router();

// Singleton adapters (tokens stored in memory for demo — use DB in production)
const driveAdapter = new GoogleDriveAdapter();

/** GET /api/integrations/status — returns honest config and connection status */
router.get('/status', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const cfg = getConfig();

    const whatsappAdapter = cfg.WHATSAPP_PROVIDER === 'meta'
      ? new MetaWhatsAppAdapter()
      : new MockWhatsAppAdapter();

    const emailAdapter = cfg.EMAIL_PROVIDER === 'smtp'
      ? new SmtpEmailAdapter()
      : new MockEmailAdapter();

    const activeDriveAdapter = cfg.DRIVE_PROVIDER === 'google'
      ? driveAdapter
      : new DemoDriveAdapter();

    // Test connections (don't fail the whole request if one fails)
    const [whatsappStatus, emailStatus, driveStatus] = await Promise.allSettled([
      whatsappAdapter.testConnection(),
      emailAdapter.testConnection(),
      activeDriveAdapter.testConnection(),
    ]);

    res.json({
      whatsapp: {
        provider: whatsappAdapter.name,
        configured: whatsappAdapter.isConfigured,
        mode: cfg.WHATSAPP_PROVIDER,
        ...(whatsappStatus.status === 'fulfilled' ? whatsappStatus.value : { connected: false, details: 'Test failed' }),
      },
      email: {
        provider: emailAdapter.name,
        configured: emailAdapter.isConfigured,
        mode: cfg.EMAIL_PROVIDER,
        ...(emailStatus.status === 'fulfilled' ? emailStatus.value : { connected: false, details: 'Test failed' }),
      },
      drive: {
        provider: activeDriveAdapter.name,
        configured: activeDriveAdapter.isConfigured,
        mode: cfg.DRIVE_PROVIDER,
        ...(driveStatus.status === 'fulfilled' ? driveStatus.value : { connected: false, details: 'Test failed' }),
      },
      demoMode: cfg.DEMO_MODE,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch integration status' });
  }
});

/** POST /api/integrations/drive/test */
router.post('/drive/test', requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const cfg = getConfig();
    const adapter = cfg.DRIVE_PROVIDER === 'google' ? driveAdapter : new DemoDriveAdapter();
    const result = await adapter.testConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/integrations/drive/auth — redirect to Google OAuth */
router.get('/drive/auth', requireAdmin, (req: AuthRequest, res: Response) => {
  const authUrl = driveAdapter.getAuthUrl();
  if (!authUrl) {
    res.status(400).json({ error: 'Google Drive is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.' });
    return;
  }
  res.redirect(authUrl);
});

/** GET /api/integrations/drive/callback — OAuth callback */
router.get('/drive/callback', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    if (!code) { res.status(400).json({ error: 'No authorization code received' }); return; }
    await driveAdapter.handleOAuthCallback(code);
    res.json({ message: 'Google Drive authorized successfully. Tokens stored in memory (use DB for production).' });
  } catch (err) {
    res.status(500).json({ error: `OAuth callback failed: ${(err as Error).message}` });
  }
});

/** POST /api/integrations/meta/test */
router.post('/meta/test', requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const adapter = new MetaWhatsAppAdapter();
    const result = await adapter.testConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/integrations/email/test */
router.post('/email/test', requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const cfg = getConfig();
    const adapter = cfg.EMAIL_PROVIDER === 'smtp' ? new SmtpEmailAdapter() : new MockEmailAdapter();
    const result = await adapter.testConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;

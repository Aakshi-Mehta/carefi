import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

import { getConfig } from './lib/env';
import { connectDB } from './lib/db';
import { ensureBootstrapAdmin } from './services/bootstrapAdmin';

// Routes
import authRouter from './routes/auth';
import patientsRouter from './routes/patients';
import claimsRouter from './routes/claims';
import documentsRouter from './routes/documents';
import queriesRouter from './routes/queries';
import notificationsRouter from './routes/notifications';
import integrationsRouter from './routes/integrations';
import webhooksRouter from './routes/webhooks';
import dashboardRouter from './routes/dashboard';
import activityRouter from './routes/activity';

const app = express();
const cfg = getConfig();

// Security headers
app.use(helmet());

// CORS — restrict to APP_URL in production
app.use(cors({
  origin: cfg.NODE_ENV === 'production'
    ? [cfg.APP_URL]
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// Compression
app.use(compression());

// Logging
app.use(morgan(cfg.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Stricter limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts' },
});
app.use('/api/auth/', authLimiter);

// Body parsing — raw body needed for webhook signature verification
app.use('/api/webhooks', express.json({ type: 'application/json' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Health check (no auth)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    demoMode: cfg.DEMO_MODE,
  });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/claims', claimsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/queries', queriesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/activity', activityRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler — never expose stack traces in production
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({
    error: cfg.NODE_ENV === 'production'
      ? 'An internal error occurred'
      : err.message,
  });
});

// Start server
async function start() {
  try {
    await connectDB(cfg.MONGODB_URI);

    // Seed demo data if in demo mode and DB is empty
    if (cfg.DEMO_MODE) {
      const { seedDemoData } = await import('./seedDemo');
      await seedDemoData();
    } else if (cfg.NODE_ENV === 'production') {
      await ensureBootstrapAdmin({
        email: cfg.BOOTSTRAP_ADMIN_EMAIL,
        password: cfg.BOOTSTRAP_ADMIN_PASSWORD,
        name: cfg.BOOTSTRAP_ADMIN_NAME,
      });
    }

    app.listen(cfg.PORT, () => {
      console.log(`[Server] RevNow API running on port ${cfg.PORT}`);
      console.log(`[Server] Demo mode: ${cfg.DEMO_MODE}`);
      console.log(`[Server] WhatsApp provider: ${cfg.WHATSAPP_PROVIDER}`);
      console.log(`[Server] Drive provider: ${cfg.DRIVE_PROVIDER}`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', (err as Error).message);
    process.exit(1);
  }
}

start();

export default app;

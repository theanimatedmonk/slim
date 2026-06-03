import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import routes from './routes/index.js';

const app = express();

const isProduction = process.env.NODE_ENV === 'production';

// Render (and most PaaS) terminate TLS at a proxy; trust the first hop so
// rate-limiting and logging see the real client IP via X-Forwarded-For.
app.set('trust proxy', 1);

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, '');
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  const normalized = normalizeOrigin(origin);

  // Localhost is only trusted in non-production environments.
  if (
    !isProduction &&
    (/^http:\/\/localhost:\d+$/.test(normalized) ||
      /^http:\/\/127\.0\.0\.1:\d+$/.test(normalized))
  ) {
    return true;
  }

  return config.allowedOrigins.some((allowed) => normalized === allowed);
}

app.disable('x-powered-by');
app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, origin ?? config.frontendUrl);
        return;
      }
      console.warn(
        'CORS blocked:',
        origin,
        '| allowed:',
        config.allowedOrigins.join(', ')
      );
      callback(null, false);
    },
    // Auth is via Bearer token (not cookies), so credentialed CORS isn't needed.
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
// SVG payloads are tiny JSON metadata; cap the body to blunt abuse.
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// General API rate limit. The cron route gets a tighter limiter below.
const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

const cronLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

app.use('/api/cron', cronLimiter);
app.use('/api', apiLimiter);
app.use('/api', routes);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
);

app.listen(config.port, () => {
  console.log(`API server listening on http://localhost:${config.port}`);
});

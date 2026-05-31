import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import routes from './routes/index.js';

const app = express();

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, '');
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  const normalized = normalizeOrigin(origin);

  if (
    /^http:\/\/localhost:\d+$/.test(normalized) ||
    /^http:\/\/127\.0\.0\.1:\d+$/.test(normalized)
  ) {
    return true;
  }

  return config.allowedOrigins.some((allowed) => normalized === allowed);
}

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
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

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

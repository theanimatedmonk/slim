import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import routes from './routes/index.js';

const app = express();

app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
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

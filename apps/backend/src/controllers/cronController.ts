import { timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { config } from '../config.js';
import { cleanupExpiredAssets } from '../services/cleanupService.js';
import { processQueue } from '../services/processQueueService.js';

/** Constant-time string comparison that doesn't leak length via early return. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still run a compare against a fixed-size buffer to avoid trivial timing leak.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function isAuthorized(req: Request): boolean {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return false;
  const token = header.slice(7);
  return token.length > 0 && safeEqual(token, config.cronSecret);
}

export async function processJobsCron(req: Request, res: Response) {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const cleanup = await cleanupExpiredAssets();
    const result = await processQueue();
    res.json({ ok: true, ...result, expiredAssetsDeleted: cleanup.deleted });
  } catch (err) {
    console.error('cron process-jobs error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Queue processing failed',
    });
  }
}

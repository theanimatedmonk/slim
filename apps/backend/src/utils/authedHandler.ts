import type { RequestHandler, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export function authed(
  handler: (req: AuthenticatedRequest, res: Response) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    handler(req as AuthenticatedRequest, res).catch(next);
  };
}

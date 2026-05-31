import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/supabase.js';

export interface AuthenticatedRequest extends Request {
  userId: string;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sign in required' });
    return;
  }

  const token = header.slice(7);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  (req as AuthenticatedRequest).userId = data.user.id;
  next();
}

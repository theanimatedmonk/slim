import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { deleteAssetForUser } from '../services/assetService.js';

function routeParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export async function deleteAsset(req: AuthenticatedRequest, res: Response) {
  try {
    const id = routeParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Asset id is required' });
      return;
    }

    await deleteAssetForUser(id, req.userId);
    res.status(204).send();
  } catch (err) {
    console.error('delete asset error:', err);
    const message = err instanceof Error ? err.message : 'Failed to delete asset';
    const status = message === 'Asset not found' ? 404 : 500;
    res.status(status).json({ error: message });
  }
}

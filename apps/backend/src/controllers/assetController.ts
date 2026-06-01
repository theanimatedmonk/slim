import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { deleteAssetForUser, getAssetForUser } from '../services/assetService.js';
import { getPreviewSetsForUser } from '../services/previewService.js';
import { createSignedDownloadUrl } from '../services/storageService.js';

function routeParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export async function getAssetPreviews(req: AuthenticatedRequest, res: Response) {
  try {
    const { assetIds } = req.body as { assetIds?: string[] };

    if (!assetIds?.length) {
      res.status(400).json({ error: 'assetIds array is required' });
      return;
    }

    if (assetIds.length > 100) {
      res.status(400).json({ error: 'Maximum 100 assets per preview request' });
      return;
    }

    const previews = await getPreviewSetsForUser(assetIds, req.userId);
    res.json({ previews });
  } catch (err) {
    console.error('asset previews error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to load previews',
    });
  }
}

export async function downloadAsset(req: AuthenticatedRequest, res: Response) {
  try {
    const id = routeParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Asset id is required' });
      return;
    }

    const asset = await getAssetForUser(id, req.userId);
    if (!asset) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    if (asset.status !== 'complete' || !asset.optimized_path) {
      res.status(400).json({ error: 'Optimized SVG is not available yet' });
      return;
    }

    const downloadUrl = await createSignedDownloadUrl(asset.optimized_path, {
      download: asset.filename,
    });

    res.json({ downloadUrl, filename: asset.filename });
  } catch (err) {
    console.error('asset download error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to generate download',
    });
  }
}

export async function downloadAssetWebp(req: AuthenticatedRequest, res: Response) {
  try {
    const id = routeParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Asset id is required' });
      return;
    }

    const asset = await getAssetForUser(id, req.userId);
    if (!asset) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    if (!asset.webp_path) {
      res.status(400).json({ error: 'WebP is not available yet' });
      return;
    }

    const filename = asset.filename.replace(/\.svg$/i, '.webp');
    const downloadUrl = await createSignedDownloadUrl(asset.webp_path, { download: filename });

    res.json({ downloadUrl, filename });
  } catch (err) {
    console.error('asset webp download error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to generate WebP download',
    });
  }
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

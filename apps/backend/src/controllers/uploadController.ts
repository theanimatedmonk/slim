import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { MAX_UPLOAD_FILE_SIZE_BYTES } from '@asset-optimiser/shared-utils';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { createAssetRecord, getAssetForUser } from '../services/assetService.js';
import { queueOptimizationForAsset } from '../services/optimizationService.js';
import { scheduleQueueProcessing } from '../services/processQueueService.js';
import { createSignedUploadUrl } from '../services/storageService.js';

export async function getUploadUrl(req: AuthenticatedRequest, res: Response) {
  try {
    const { filename, contentType } = req.body as {
      filename?: string;
      contentType?: string;
    };

    if (!filename || !filename.toLowerCase().endsWith('.svg')) {
      res.status(400).json({ error: 'Only SVG files are supported' });
      return;
    }

    const assetId = uuidv4();
    const { signedUrl, path } = await createSignedUploadUrl(assetId, filename);

    res.json({
      signedUrl,
      path,
      assetId,
      contentType: contentType ?? 'image/svg+xml',
    });
  } catch (err) {
    console.error('upload-url error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to generate upload URL',
    });
  }
}

export async function registerAsset(req: AuthenticatedRequest, res: Response) {
  try {
    const { assetId, filename, path, size } = req.body as {
      assetId?: string;
      filename?: string;
      path?: string;
      size?: number;
    };

    if (!assetId || !filename || !path || size === undefined) {
      res.status(400).json({ error: 'assetId, filename, path, and size are required' });
      return;
    }

    if (size > MAX_UPLOAD_FILE_SIZE_BYTES) {
      res.status(400).json({ error: 'File exceeds the 5 MB size limit' });
      return;
    }

    const asset = await createAssetRecord({
      id: assetId,
      userId: req.userId,
      filename,
      originalPath: path,
      originalSize: size,
    });

    await queueOptimizationForAsset(asset.id, req.userId);
    scheduleQueueProcessing();

    const queued = await getAssetForUser(asset.id, req.userId);
    res.status(201).json(queued ?? { ...asset, status: 'queued' });
  } catch (err) {
    console.error('register-asset error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to register asset',
    });
  }
}

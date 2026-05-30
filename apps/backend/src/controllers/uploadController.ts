import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createAssetRecord } from '../services/assetService.js';
import { createSignedUploadUrl } from '../services/storageService.js';

export async function getUploadUrl(req: Request, res: Response) {
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

export async function registerAsset(req: Request, res: Response) {
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

    const asset = await createAssetRecord({
      id: assetId,
      filename,
      originalPath: path,
      originalSize: size,
    });

    res.status(201).json(asset);
  } catch (err) {
    console.error('register-asset error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to register asset',
    });
  }
}

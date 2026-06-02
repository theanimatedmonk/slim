import type {
  Asset,
  AssetPreview,
  AssetPreviewKind,
  AssetPreviewSet,
} from '@asset-optimiser/shared-types';
import { getAssetForUser } from './assetService.js';
import { createSignedDownloadUrl } from './storageService.js';

const PREVIEW_URL_TTL_SEC = 3600;

async function signPreview(
  path: string | null,
  kind: AssetPreviewKind
): Promise<AssetPreview | null> {
  if (!path) return null;
  try {
    const url = await createSignedDownloadUrl(path, { expiresIn: PREVIEW_URL_TTL_SEC });
    return { url, kind };
  } catch (err) {
    console.warn(`Preview sign failed for ${path}:`, err);
    return null;
  }
}

export async function buildPreviewSetForAsset(asset: Asset): Promise<AssetPreviewSet> {
  const [original, optimized, webp] = await Promise.all([
    signPreview(asset.original_path, 'svg'),
    signPreview(asset.optimized_path, 'svg'),
    signPreview(asset.webp_path, 'webp'),
  ]);

  return {
    thumbnail: optimized ?? original ?? webp,
    original,
    optimized,
    webp,
  };
}

export async function getPreviewSetsForUser(
  assetIds: string[],
  userId: string
): Promise<Record<string, AssetPreviewSet>> {
  const previews: Record<string, AssetPreviewSet> = {};

  for (const id of assetIds) {
    try {
      const asset = await getAssetForUser(id, userId);
      if (!asset) continue;
      previews[id] = await buildPreviewSetForAsset(asset);
    } catch (err) {
      console.warn(`Preview build failed for asset ${id}:`, err);
    }
  }

  return previews;
}

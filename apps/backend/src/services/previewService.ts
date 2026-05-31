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
  const url = await createSignedDownloadUrl(path, PREVIEW_URL_TTL_SEC);
  return { url, kind };
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
    const asset = await getAssetForUser(id, userId);
    if (!asset) continue;
    previews[id] = await buildPreviewSetForAsset(asset);
  }

  return previews;
}

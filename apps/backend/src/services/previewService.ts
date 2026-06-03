import type {
  Asset,
  AssetPreview,
  AssetPreviewKind,
  AssetPreviewSet,
} from '@asset-optimiser/shared-types';
import { getAssetsForUser } from './assetService.js';
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
  const assets = await getAssetsForUser(assetIds, userId);

  // Sign all assets' previews concurrently instead of one round-trip per asset.
  const entries = await Promise.all(
    assets.map(async (asset) => {
      try {
        return [asset.id, await buildPreviewSetForAsset(asset)] as const;
      } catch (err) {
        console.warn(`Preview build failed for asset ${asset.id}:`, err);
        return null;
      }
    })
  );

  const previews: Record<string, AssetPreviewSet> = {};
  for (const entry of entries) {
    if (entry) previews[entry[0]] = entry[1];
  }
  return previews;
}

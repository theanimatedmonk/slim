import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AssetPreviewSet } from '@asset-optimiser/shared-types';
import { fetchAssetPreviews } from '../services/api';

const PREVIEW_STALE_MS = 45 * 60 * 1000;
const PREVIEW_POLL_MS = 3000;

interface Options {
  /** Refetch periodically while assets are still processing (thumbnails may update). */
  refetchWhileProcessing?: boolean;
}

export function useAssetPreviews(assetIds: string[], options?: Options) {
  const key = useMemo(
    () => [...new Set(assetIds)].sort().join(','),
    [assetIds]
  );

  const refetchWhileProcessing = options?.refetchWhileProcessing ?? false;

  return useQuery({
    queryKey: ['asset-previews', key],
    queryFn: () => fetchAssetPreviews(assetIds),
    enabled: assetIds.length > 0,
    staleTime: PREVIEW_STALE_MS,
    placeholderData: (previous) => previous,
    select: (data) => data.previews,
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: refetchWhileProcessing ? PREVIEW_POLL_MS : false,
  });
}

export function getPreviewForAsset(
  previews: Record<string, AssetPreviewSet> | undefined,
  assetId: string
): AssetPreviewSet | undefined {
  return previews?.[assetId];
}

/** Assets that may have at least one previewable file in storage. */
export function getPreviewableAssetIds(
  assets: { id: string; status: string; original_path?: string | null; optimized_path?: string | null; webp_path?: string | null }[]
): string[] {
  return assets
    .filter(
      (asset) =>
        asset.status !== 'failed' &&
        Boolean(asset.original_path || asset.optimized_path || asset.webp_path)
    )
    .map((asset) => asset.id);
}

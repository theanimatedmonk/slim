import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AssetPreviewSet } from '@asset-optimiser/shared-types';
import { fetchAssetPreviews } from '../services/api';

const PREVIEW_STALE_MS = 45 * 60 * 1000;

export function useAssetPreviews(assetIds: string[]) {
  const key = useMemo(
    () => [...new Set(assetIds)].sort().join(','),
    [assetIds]
  );

  return useQuery({
    queryKey: ['asset-previews', key],
    queryFn: () => fetchAssetPreviews(assetIds),
    enabled: assetIds.length > 0,
    staleTime: PREVIEW_STALE_MS,
    placeholderData: (previous) => previous,
    select: (data) => data.previews,
  });
}

export function getPreviewForAsset(
  previews: Record<string, AssetPreviewSet> | undefined,
  assetId: string
): AssetPreviewSet | undefined {
  return previews?.[assetId];
}

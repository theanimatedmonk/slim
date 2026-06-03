import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssetPreviewSet } from '@asset-optimiser/shared-types';
import { fetchAssetPreviews } from '../services/api';

const PREVIEWS_QUERY_KEY = ['asset-previews'] as const;
const PREVIEW_STALE_MS = 45 * 60 * 1000;
const PREVIEW_POLL_MS = 3000;

interface Options {
  /** Poll only assets still processing (not the whole library). */
  refetchWhileProcessing?: boolean;
  processingAssetIds?: string[];
}

export function useAssetPreviews(previewAssetIds: string[], options?: Options) {
  const queryClient = useQueryClient();
  const previewIdsRef = useRef(previewAssetIds);
  previewIdsRef.current = previewAssetIds;

  const processingIdsRef = useRef(options?.processingAssetIds ?? []);
  processingIdsRef.current = options?.processingAssetIds ?? [];

  const forceRefreshIdsRef = useRef<Set<string>>(new Set());
  const prevProcessingIdsRef = useRef<Set<string>>(new Set());

  const idsFingerprint = useMemo(
    () => [...new Set(previewAssetIds)].sort().join(','),
    [previewAssetIds]
  );

  useEffect(() => {
    const current = new Set(options?.processingAssetIds ?? []);
    const finished = [...prevProcessingIdsRef.current].filter((id) => !current.has(id));
    prevProcessingIdsRef.current = current;

    if (finished.length === 0) return;

    finished.forEach((id) => forceRefreshIdsRef.current.add(id));
    void queryClient.invalidateQueries({ queryKey: PREVIEWS_QUERY_KEY });
  }, [options?.processingAssetIds, queryClient]);

  const query = useQuery({
    queryKey: PREVIEWS_QUERY_KEY,
    queryFn: async () => {
      const ids = [...new Set(previewIdsRef.current)];
      const prev =
        queryClient.getQueryData<Record<string, AssetPreviewSet>>(PREVIEWS_QUERY_KEY) ?? {};

      const missing = ids.filter((id) => !prev[id]?.thumbnail?.url);
      const processing = processingIdsRef.current.filter((id) => ids.includes(id));
      const forceRefresh = [...forceRefreshIdsRef.current].filter((id) => ids.includes(id));
      forceRefreshIdsRef.current.clear();

      const toFetch = [...new Set([...missing, ...processing, ...forceRefresh])];

      if (toFetch.length === 0) return prev;

      const { previews: fetched } = await fetchAssetPreviews(toFetch);
      return { ...prev, ...fetched };
    },
    enabled: previewAssetIds.length > 0,
    staleTime: PREVIEW_STALE_MS,
    placeholderData: (previous) => previous ?? {},
    select: (data) => {
      const visible: Record<string, AssetPreviewSet> = {};
      for (const id of previewAssetIds) {
        if (data[id]) visible[id] = data[id];
      }
      return visible;
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: options?.refetchWhileProcessing ? PREVIEW_POLL_MS : false,
  });

  // Fetch previews for newly added assets without refetching the whole library.
  useEffect(() => {
    if (!previewAssetIds.length) return;
    void queryClient.invalidateQueries({ queryKey: PREVIEWS_QUERY_KEY });
  }, [idsFingerprint, previewAssetIds.length, queryClient]);

  return query;
}

export function getPreviewForAsset(
  previews: Record<string, AssetPreviewSet> | undefined,
  assetId: string
): AssetPreviewSet | undefined {
  return previews?.[assetId];
}

/** Assets that may have at least one previewable file in storage. */
export function getPreviewableAssetIds(
  assets: {
    id: string;
    status: string;
    original_path?: string | null;
    optimized_path?: string | null;
    webp_path?: string | null;
  }[]
): string[] {
  return assets
    .filter(
      (asset) =>
        asset.status !== 'failed' &&
        Boolean(asset.original_path || asset.optimized_path || asset.webp_path)
    )
    .map((asset) => asset.id);
}

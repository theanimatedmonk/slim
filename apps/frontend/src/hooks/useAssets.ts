import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssetListItem, AssetStatus, AssetWithJob } from '@asset-optimiser/shared-types';
import {
  convertToPng,
  convertToWebp,
  deleteAsset,
  getAssetDetail,
  getAssetDownloadUrl,
  getAssetPngDownloadUrl,
  getAssetWebpDownloadUrl,
  getBundleDownloadUrl,
  listAssets,
  requestBundle,
  retryAsset,
  startOptimization,
} from '../services/api';

const POLL_MS = 2000;

function hasProcessingAssets(assets: AssetListItem[] | undefined): boolean {
  return assets?.some((a) => isAssetProcessing(a)) ?? false;
}

interface UseAssetsOptions {
  /** Poll while uploads are in flight (before rows appear in the list). */
  pollWhileBusy?: boolean;
}

export function useAssets(options?: UseAssetsOptions) {
  const pollWhileBusy = options?.pollWhileBusy ?? false;

  return useQuery({
    queryKey: ['assets'],
    queryFn: listAssets,
    refetchInterval: (query) => {
      if (pollWhileBusy) return POLL_MS;
      const assets = query.state.data as AssetListItem[] | undefined;
      return hasProcessingAssets(assets) ? POLL_MS : false;
    },
  });
}

export function useAssetDetail(assetId: string | null, listStatus?: AssetStatus) {
  const isProcessing = listStatus ? isAssetProcessing({ status: listStatus }) : false;

  return useQuery({
    queryKey: ['asset', assetId],
    queryFn: () => getAssetDetail(assetId!),
    enabled: Boolean(assetId),
    staleTime: 30_000,
    refetchInterval: isProcessing ? POLL_MS : false,
  });
}

export function useOptimizeAssets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assetIds: string[]) => startOptimization(assetIds),
    onMutate: async (assetIds) => {
      await queryClient.cancelQueries({ queryKey: ['assets'] });
      const previous = queryClient.getQueryData<AssetListItem[]>(['assets']);
      queryClient.setQueryData<AssetListItem[]>(['assets'], (old) =>
        (old ?? []).map((a) =>
          assetIds.includes(a.id) ? { ...a, status: 'queued' as const } : a
        )
      );
      return { previous };
    },
    onError: (_err, _assetIds, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['assets'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-previews'] });
      queryClient.invalidateQueries({ queryKey: ['asset'] });
    },
  });
}

/** Queues any legacy assets still in `uploaded` status (pre auto-optimize). */
export function useAutoOptimizePending(assets: AssetListItem[]) {
  const optimize = useOptimizeAssets();
  const queuedRef = useRef(new Set<string>());
  const mutateRef = useRef(optimize.mutate);
  mutateRef.current = optimize.mutate;

  useEffect(() => {
    const pending = assets
      .filter((a) => a.status === 'uploaded' && !queuedRef.current.has(a.id))
      .map((a) => a.id);

    if (!pending.length) return;

    pending.forEach((id) => queuedRef.current.add(id));
    mutateRef.current(pending);
  }, [assets]);
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assetId: string) => deleteAsset(assetId),
    onMutate: async (assetId) => {
      await queryClient.cancelQueries({ queryKey: ['assets'] });
      const previous = queryClient.getQueryData<AssetListItem[]>(['assets']);
      queryClient.setQueryData<AssetListItem[]>(['assets'], (old) =>
        (old ?? []).filter((a) => a.id !== assetId)
      );
      return { previous };
    },
    onError: (_err, _assetId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['assets'], context.previous);
      }
    },
    onSettled: (_data, _err, assetId) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-previews'] });
      queryClient.removeQueries({ queryKey: ['asset', assetId] });
    },
  });
}

export function useDeleteAssets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assetIds: string[]) => {
      await Promise.all(assetIds.map((id) => deleteAsset(id)));
    },
    onMutate: async (assetIds) => {
      await queryClient.cancelQueries({ queryKey: ['assets'] });
      const previous = queryClient.getQueryData<AssetListItem[]>(['assets']);
      const idSet = new Set(assetIds);
      queryClient.setQueryData<AssetListItem[]>(['assets'], (old) =>
        (old ?? []).filter((a) => !idSet.has(a.id))
      );
      return { previous, assetIds };
    },
    onError: (_err, _assetIds, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['assets'], context.previous);
      }
    },
    onSettled: (_data, _err, assetIds) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-previews'] });
      assetIds.forEach((id) => {
        queryClient.removeQueries({ queryKey: ['asset', id] });
      });
    },
  });
}

export function useRetryAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assetId: string) => retryAsset(assetId),
    onMutate: async (assetId) => {
      await queryClient.cancelQueries({ queryKey: ['assets'] });
      const previous = queryClient.getQueryData<AssetListItem[]>(['assets']);
      const asset = previous?.find((a) => a.id === assetId);
      const nextStatus = asset?.original_path
        ? ('queued' as const)
        : asset?.optimized_path
          ? ('converting' as const)
          : ('queued' as const);

      queryClient.setQueryData<AssetListItem[]>(['assets'], (old) =>
        (old ?? []).map((a) => (a.id === assetId ? { ...a, status: nextStatus } : a))
      );
      return { previous };
    },
    onError: (_err, _assetId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['assets'], context.previous);
      }
    },
    onSettled: (_data, _err, assetId) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-previews'] });
      queryClient.invalidateQueries({ queryKey: ['asset', assetId] });
    },
  });
}

export function useConvertPng() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assetId: string) => convertToPng(assetId),
    onMutate: async (assetId) => {
      await queryClient.cancelQueries({ queryKey: ['assets'] });
      const previous = queryClient.getQueryData<AssetListItem[]>(['assets']);
      queryClient.setQueryData<AssetListItem[]>(['assets'], (old) =>
        (old ?? []).map((a) =>
          a.id === assetId ? { ...a, status: 'converting' as const } : a
        )
      );
      return { previous };
    },
    onError: (_err, _assetId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['assets'], context.previous);
      }
    },
    onSettled: (_data, _err, assetId) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-previews'] });
      queryClient.invalidateQueries({ queryKey: ['asset', assetId] });
    },
  });
}

export function useConvertWebp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assetId: string) => convertToWebp(assetId),
    onMutate: async (assetId) => {
      await queryClient.cancelQueries({ queryKey: ['assets'] });
      const previous = queryClient.getQueryData<AssetListItem[]>(['assets']);
      queryClient.setQueryData<AssetListItem[]>(['assets'], (old) =>
        (old ?? []).map((a) =>
          a.id === assetId ? { ...a, status: 'converting' as const } : a
        )
      );
      return { previous };
    },
    onError: (_err, _assetId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['assets'], context.previous);
      }
    },
    onSettled: (_data, _err, assetId) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-previews'] });
      queryClient.invalidateQueries({ queryKey: ['asset', assetId] });
    },
  });
}

export function useDownloadAsset() {
  return useMutation({
    mutationFn: async (assetId: string) => {
      const { downloadUrl, filename } = await getAssetDownloadUrl(assetId);
      triggerFileDownload(downloadUrl, filename);
    },
  });
}

export function useDownloadWebp() {
  return useMutation({
    mutationFn: async (assetId: string) => {
      const { downloadUrl, filename } = await getAssetWebpDownloadUrl(assetId);
      triggerFileDownload(downloadUrl, filename);
    },
  });
}

export function useDownloadPng() {
  return useMutation({
    mutationFn: async (assetId: string) => {
      const { downloadUrl, filename } = await getAssetPngDownloadUrl(assetId);
      triggerFileDownload(downloadUrl, filename);
    },
  });
}

function triggerFileDownload(downloadUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function useDownloadBundle() {
  return useMutation({
    mutationFn: async (assetIds: string[]) => {
      const { jobId } = await requestBundle(assetIds);

      let attempts = 0;
      while (attempts < 30) {
        try {
          const { downloadUrl } = await getBundleDownloadUrl(jobId);
          window.open(downloadUrl, '_blank');
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 2000));
          attempts += 1;
        }
      }

      throw new Error('Bundle generation timed out');
    },
  });
}

export function isAssetProcessing(asset: Pick<AssetListItem, 'status'>): boolean {
  return ['queued', 'optimizing', 'converting'].includes(asset.status);
}

export function shouldRecommendWebp(
  asset: Pick<AssetListItem, 'status' | 'complexity' | 'base64_detected'> & {
    report?: AssetWithJob['report'];
  }
): boolean {
  return (
    asset.status === 'complete' &&
    (asset.complexity === 'complex' ||
      asset.base64_detected === true ||
      asset.report?.base64_detected === true)
  );
}

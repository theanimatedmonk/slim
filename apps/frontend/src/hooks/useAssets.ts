import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssetListItem, AssetStatus, AssetWithJob } from '@asset-optimiser/shared-types';
import {
  convertToWebp,
  deleteAsset,
  getAssetDetail,
  getAssetDownloadUrl,
  getAssetWebpDownloadUrl,
  getBundleDownloadUrl,
  listAssets,
  requestBundle,
  startOptimization,
} from '../services/api';

const POLL_MS = 1000;

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

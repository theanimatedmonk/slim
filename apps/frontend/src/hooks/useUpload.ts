import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AssetListItem } from '@asset-optimiser/shared-types';
import { MAX_UPLOAD_FILE_SIZE_BYTES } from '@asset-optimiser/shared-utils';
import { getUploadUrl, registerAsset, uploadToStorage } from '../services/api';

export type UploadZonePhase = 'idle' | 'uploading' | 'success';

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'error';
  error?: string;
}

interface BatchTracker {
  total: number;
  totalBytes: number;
  loadedBytes: number;
  expectedAssetIds: string[];
  errorCount: number;
  uploadsDone: boolean;
}

function inFlightLoadedBytes(items: UploadItem[]): number {
  return items
    .filter((u) => u.status === 'pending' || u.status === 'uploading')
    .reduce((sum, u) => sum + u.file.size * (u.progress / 100), 0);
}

function batchPercent(batch: BatchTracker, inFlight: UploadItem[]): number {
  if (batch.totalBytes === 0) return 0;
  const loaded = batch.loadedBytes + inFlightLoadedBytes(inFlight);
  return Math.min(100, (loaded / batch.totalBytes) * 100);
}

function oversizedUploadMessages(files: File[]): string[] {
  return files
    .filter((file) => file.size > MAX_UPLOAD_FILE_SIZE_BYTES)
    .map((file) => `${file.name} exceeds the 5MB limit`);
}

export function useUpload(assets: AssetListItem[] = []) {
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [zonePhase, setZonePhase] = useState<UploadZonePhase>('idle');
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotalBytes, setBatchTotalBytes] = useState(0);
  const [batchLoadedBytes, setBatchLoadedBytes] = useState(0);
  const [rejectionMessages, setRejectionMessages] = useState<string[]>([]);
  const batchRef = useRef<BatchTracker | null>(null);
  const batchRemainingRef = useRef(0);
  const successTimerRef = useRef<number | null>(null);
  const finishingRef = useRef(false);
  const [batchCheckTick, setBatchCheckTick] = useState(0);

  const refreshAssets = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['assets'] });
  }, [queryClient]);

  const refreshPreviews = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['asset-previews'] });
  }, [queryClient]);

  const syncBatchProgress = useCallback((inFlight: UploadItem[]) => {
    const batch = batchRef.current;
    if (!batch) return;
    const loaded = batch.loadedBytes + inFlightLoadedBytes(inFlight);
    setBatchTotalBytes(batch.totalBytes);
    setBatchLoadedBytes(loaded);
    setBatchProgress(batchPercent(batch, inFlight));
  }, []);

  const finishSuccess = useCallback(() => {
    setZonePhase('success');
    setBatchProgress(100);
    refreshPreviews();
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
    }
    successTimerRef.current = window.setTimeout(() => {
      setZonePhase('idle');
      setBatchTotal(0);
      setBatchProgress(0);
      setBatchTotalBytes(0);
      setBatchLoadedBytes(0);
      batchRef.current = null;
      finishingRef.current = false;
      successTimerRef.current = null;
    }, 3000);
  }, [refreshPreviews]);

  const finishWithErrors = useCallback(() => {
    setZonePhase('idle');
    setBatchTotal(0);
    setBatchProgress(0);
    setBatchTotalBytes(0);
    setBatchLoadedBytes(0);
    batchRef.current = null;
    refreshPreviews();
  }, [refreshPreviews]);

  useEffect(() => {
    const batch = batchRef.current;
    if (!batch || zonePhase !== 'uploading' || !batch.uploadsDone) return;

    const successIds = batch.expectedAssetIds;
    const allSuccessfulInTable =
      successIds.length > 0 &&
      successIds.every((id) => assets.some((a) => a.id === id));

    if (batch.errorCount === 0 && successIds.length === batch.total && allSuccessfulInTable) {
      if (finishingRef.current) return;
      finishingRef.current = true;
      finishSuccess();
      return;
    }

    if (batch.errorCount > 0) {
      const allDone = successIds.length + batch.errorCount >= batch.total;
      const successesSettled =
        successIds.length === 0 || successIds.every((id) => assets.some((a) => a.id === id));
      if (allDone && successesSettled) {
        finishWithErrors();
      }
    }
  }, [assets, zonePhase, batchCheckTick, finishSuccess, finishWithErrors]);

  const uploadOne = useCallback(
    async (item: UploadItem) => {
      setUploads((prev) => {
        const next = prev.map((u) =>
          u.id === item.id ? { ...u, status: 'uploading' as const, progress: 0 } : u
        );
        syncBatchProgress(next);
        return next;
      });

      const { signedUrl, path, assetId } = await getUploadUrl(item.file.name);

      await uploadToStorage(signedUrl, item.file, (progress) => {
        setUploads((prev) => {
          const next = prev.map((u) => (u.id === item.id ? { ...u, progress } : u));
          syncBatchProgress(next);
          return next;
        });
      });

      await registerAsset({
        assetId,
        filename: item.file.name,
        path,
        size: item.file.size,
      });

      queryClient.setQueryData<AssetListItem[]>(['assets'], (old) => {
        const existing = old ?? [];
        const nextItem: AssetListItem = {
          id: assetId,
          user_id: null,
          filename: item.file.name,
          original_path: path,
          optimized_path: null,
          webp_path: null,
          original_size: item.file.size,
          optimized_size: null,
          complexity: 'unknown',
          status: 'queued',
          created_at: new Date().toISOString(),
          base64_detected: null,
        };
        if (existing.some((a) => a.id === assetId)) {
          return existing.map((a) =>
            a.id === assetId ? { ...a, status: 'queued' as const } : a
          );
        }
        return [nextItem, ...existing];
      });

      const batch = batchRef.current;
      if (batch) {
        batch.expectedAssetIds.push(assetId);
        batch.loadedBytes += item.file.size;
      }

      setUploads((prev) => {
        const next = prev.filter((u) => u.id !== item.id);
        syncBatchProgress(next);
        return next;
      });

      return assetId;
    },
    [queryClient, syncBatchProgress]
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const svgFiles = files.filter((f) => f.name.toLowerCase().endsWith('.svg'));
      if (!svgFiles.length) return;

      const oversizedMessages = oversizedUploadMessages(svgFiles);
      setRejectionMessages(oversizedMessages);

      const validFiles = svgFiles.filter((file) => file.size <= MAX_UPLOAD_FILE_SIZE_BYTES);
      if (!validFiles.length) return;

      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }

      const items: UploadItem[] = validFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        progress: 0,
        status: 'pending',
      }));

      const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);

      batchRef.current = {
        total: items.length,
        totalBytes,
        loadedBytes: 0,
        expectedAssetIds: [],
        errorCount: 0,
        uploadsDone: false,
      };
      finishingRef.current = false;

      setUploads((prev) => [...prev, ...items]);
      setBatchTotal(items.length);
      setBatchProgress(0);
      setBatchTotalBytes(totalBytes);
      setBatchLoadedBytes(0);
      setZonePhase('uploading');
      batchRemainingRef.current = items.length;

      await Promise.all(
        items.map(async (item) => {
          try {
            await uploadOne(item);
          } catch (err) {
            if (batchRef.current) {
              batchRef.current.errorCount += 1;
            }
            setUploads((prev) => {
              const next = prev.map((u) =>
                u.id === item.id
                  ? {
                      ...u,
                      status: 'error' as const,
                      error: err instanceof Error ? err.message : 'Upload failed',
                    }
                  : u
              );
              syncBatchProgress(next);
              return next;
            });
          } finally {
            batchRemainingRef.current -= 1;
            if (batchRemainingRef.current === 0 && batchRef.current) {
              batchRef.current.uploadsDone = true;
              refreshAssets();
              setBatchCheckTick((t) => t + 1);
            }
          }
        })
      );
    },
    [uploadOne, syncBatchProgress, refreshAssets]
  );

  const clearUploads = useCallback(() => {
    setUploads([]);
    setZonePhase('idle');
    setBatchTotal(0);
    setBatchProgress(0);
    setBatchTotalBytes(0);
    setBatchLoadedBytes(0);
    setRejectionMessages([]);
    batchRef.current = null;
  }, []);

  return {
    uploads,
    uploadFiles,
    clearUploads,
    rejectionMessages,
    zonePhase,
    batchTotal,
    batchProgress,
    batchLoadedBytes,
    batchTotalBytes,
  };
}

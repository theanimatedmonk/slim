import { useCallback, useEffect, useMemo, useState } from 'react';
import UploadDropzone from '../components/UploadDropzone';
import AssetRow from '../components/AssetRow';
import AssetDrawer from '../components/AssetDrawer';
import AssetTableHeader from '../components/AssetTableHeader';
import BulkActionBar from '../components/BulkActionBar';
import ConfirmModal from '../components/ConfirmModal';
import GuestLanding from '../components/GuestLanding';
import AppPageSkeleton from '../components/AppPageSkeleton';
import AssetRowSkeleton from '../components/AssetRowSkeleton';
import { useAuth } from '../context/AuthContext.js';
import { useUpload } from '../hooks/useUpload';
import { useUploadSounds } from '../hooks/useUploadSounds';
import { getPreviewForAsset, getPreviewableAssetIds, useAssetPreviews } from '../hooks/useAssetPreviews';
import {
  useAssets,
  useAssetDetail,
  useAutoOptimizePending,
  isAssetProcessing,
  useConvertWebp,
  useDownloadBundle,
  useDownloadAsset,
  useDownloadWebp,
  useDeleteAsset,
  useDeleteAssets,
  useRetryAsset,
} from '../hooks/useAssets';
import { playDeleteSound } from '../utils/sounds';
import './AppPage.css';

function AppPageContent() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{
    assetIds: string[];
    message: string;
  } | null>(null);
  const [pollAssetsWhileUploading, setPollAssetsWhileUploading] = useState(false);

  const { data: assets = [], isLoading, error } = useAssets({
    pollWhileBusy: pollAssetsWhileUploading,
  });
  useAutoOptimizePending(assets);
  const { uploads, uploadFiles, zonePhase, batchTotal, batchProgress, batchLoadedBytes, rejectionMessages } =
    useUpload(assets);

  useEffect(() => {
    setPollAssetsWhileUploading(zonePhase === 'uploading');
  }, [zonePhase]);

  useUploadSounds(zonePhase);

  const convertWebp = useConvertWebp();
  const downloadBundle = useDownloadBundle();
  const downloadAsset = useDownloadAsset();
  const downloadWebp = useDownloadWebp();
  const deleteAssetMutation = useDeleteAsset();
  const deleteAssetsMutation = useDeleteAssets();
  const retryAssetMutation = useRetryAsset();

  const completeIdsList = useMemo(
    () => assets.filter((a) => a.status === 'complete').map((a) => a.id),
    [assets]
  );

  const completeAssetIds = useMemo(() => new Set(completeIdsList), [completeIdsList]);

  const allCompleteSelected =
    completeIdsList.length > 0 && completeIdsList.every((id) => checkedIds.has(id));
  const someCompleteSelected =
    completeIdsList.some((id) => checkedIds.has(id)) && !allCompleteSelected;

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setCheckedIds(checked ? new Set(completeIdsList) : new Set());
    },
    [completeIdsList]
  );

  const selectedAsset = useMemo(
    () => (selectedId ? assets.find((a) => a.id === selectedId) ?? null : null),
    [assets, selectedId]
  );

  const { data: assetDetail, isLoading: isDetailLoading } = useAssetDetail(
    selectedId,
    selectedAsset?.status
  );

  const drawerAsset = useMemo(() => {
    if (!selectedAsset) return null;
    if (!assetDetail) return selectedAsset;
    return {
      ...assetDetail,
      status: selectedAsset.status,
      webp_path: selectedAsset.webp_path ?? assetDetail.webp_path,
      optimized_size: selectedAsset.optimized_size ?? assetDetail.optimized_size,
      complexity:
        selectedAsset.complexity !== 'unknown' ? selectedAsset.complexity : assetDetail.complexity,
      base64_detected: selectedAsset.base64_detected ?? assetDetail.report?.base64_detected ?? null,
    };
  }, [selectedAsset, assetDetail]);

  const previewAssetIds = useMemo(() => getPreviewableAssetIds(assets), [assets]);
  const processingAssetIds = useMemo(
    () => assets.filter((asset) => isAssetProcessing(asset)).map((asset) => asset.id),
    [assets]
  );
  const hasProcessingAssets = processingAssetIds.length > 0;
  const { data: previews } = useAssetPreviews(previewAssetIds, {
    refetchWhileProcessing: hasProcessingAssets,
    processingAssetIds,
    selectedAssetId: selectedId,
  });

  const selectedCompleteIds = useMemo(
    () => [...checkedIds].filter((id) => completeAssetIds.has(id)),
    [checkedIds, completeAssetIds]
  );

  useEffect(() => {
    setCheckedIds((prev) => {
      const next = new Set([...prev].filter((id) => completeAssetIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [completeAssetIds]);

  const toggleChecked = useCallback((assetId: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(assetId);
      else next.delete(assetId);
      return next;
    });
  }, []);

  const handleBulkDownload = () => {
    if (selectedCompleteIds.length) {
      downloadBundle.mutate(selectedCompleteIds);
    }
  };

  const handleBulkDelete = () => {
    const count = selectedCompleteIds.length;
    if (!count) return;

    const message =
      count === 1
        ? 'Are you sure you want to delete 1 selected file?'
        : `Are you sure you want to delete ${count} selected files?`;

    setDeleteConfirm({ assetIds: selectedCompleteIds, message });
  };

  const handleRequestDelete = (assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    setDeleteConfirm({
      assetIds: [assetId],
      message: 'Are you sure you want to delete this file?',
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;

    const { assetIds } = deleteConfirm;
    const idSet = new Set(assetIds);
    setDeleteConfirm(null);
    playDeleteSound();

    if (assetIds.length === 1) {
      const id = assetIds[0];
      deleteAssetMutation.mutate(id, {
        onSuccess: () => {
          setCheckedIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          if (selectedId === id) setSelectedId(null);
        },
      });
      return;
    }

    deleteAssetsMutation.mutate(assetIds, {
      onSuccess: () => {
        setCheckedIds(new Set());
        if (selectedId && idSet.has(selectedId)) {
          setSelectedId(null);
        }
      },
    });
  };

  return (
    <div className="app-page">
      <div className="app-page__upload">
        <UploadDropzone
          onFiles={uploadFiles}
          uploads={uploads}
          zonePhase={zonePhase}
          batchTotal={batchTotal}
          batchProgress={batchProgress}
          batchLoadedBytes={batchLoadedBytes}
          rejectionMessages={rejectionMessages}
        />
      </div>

      {error && <div className="app-page__alert">{(error as Error).message}</div>}

      {(deleteAssetMutation.isError || deleteAssetsMutation.isError) && (
        <div className="app-page__alert">
          Delete failed:{' '}
          {((deleteAssetsMutation.error ?? deleteAssetMutation.error) as Error).message}
        </div>
      )}

      {retryAssetMutation.isError && (
        <div className="app-page__alert">
          Retry failed: {(retryAssetMutation.error as Error).message}
        </div>
      )}

      <section className="app-page__assets">
        <div
          className={`app-page__list-wrap${!isLoading && assets.length === 0 ? ' app-page__list-wrap--empty' : ''}`}
        >
          <ul className="app-page__asset-list">
            {!isLoading && assets.length > 0 && (
              <AssetTableHeader
                checked={allCompleteSelected}
                indeterminate={someCompleteSelected}
                disabled={completeIdsList.length === 0}
                onSelectAll={handleSelectAll}
              />
            )}
            {isLoading && <AssetRowSkeleton count={4} />}
            {!isLoading && assets.length === 0 && (
              <li className="app-page__list-empty">
                No assets yet. Upload SVGs above to get started.
              </li>
            )}
            {assets.map((asset) => {
              const isComplete = asset.status === 'complete';
              const isChecked = checkedIds.has(asset.id);

              return (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  thumbnail={getPreviewForAsset(previews, asset.id)?.thumbnail}
                  selectable={isComplete}
                  checked={isChecked}
                  onCheckedChange={(checked) => toggleChecked(asset.id, checked)}
                  onSelect={() => setSelectedId(asset.id)}
                  onDownload={(asset) => downloadAsset.mutate(asset.id)}
                  onDelete={handleRequestDelete}
                  onDeleteImmediate={(id) => {
                    playDeleteSound();
                    deleteAssetMutation.mutate(id, {
                      onSuccess: () => {
                        setCheckedIds((prev) => {
                          const next = new Set(prev);
                          next.delete(id);
                          return next;
                        });
                        if (selectedId === id) setSelectedId(null);
                      },
                    });
                  }}
                  onRetry={(id) => retryAssetMutation.mutate(id)}
                  isDeleting={deleteAssetMutation.isPending || deleteAssetsMutation.isPending}
                  isRetrying={
                    retryAssetMutation.isPending && retryAssetMutation.variables === asset.id
                  }
                />
              );
            })}
          </ul>
        </div>
      </section>

      <BulkActionBar
        count={selectedCompleteIds.length}
        onDownload={handleBulkDownload}
        onDelete={handleBulkDelete}
        onClear={() => setCheckedIds(new Set())}
        isDownloading={downloadBundle.isPending}
        isDeleting={deleteAssetsMutation.isPending}
      />

      <ConfirmModal
        open={deleteConfirm !== null}
        message={deleteConfirm?.message ?? ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      <AssetDrawer
        asset={drawerAsset}
        previewSet={
          drawerAsset ? getPreviewForAsset(previews, drawerAsset.id) : undefined
        }
        isDetailLoading={Boolean(selectedId && isDetailLoading)}
        onClose={() => setSelectedId(null)}
        onDownload={(id) => downloadAsset.mutate(id)}
        onConvertWebp={(id) => convertWebp.mutate(id)}
        onDownloadWebp={(id) => downloadWebp.mutate(id)}
        isConverting={
          convertWebp.isPending && convertWebp.variables === selectedId
        }
      />
    </div>
  );
}

export default function AppPage() {
  const { user, loading, signInWithGoogle } = useAuth();

  if (loading) {
    return <AppPageSkeleton />;
  }

  if (!user) {
    return <GuestLanding onSignIn={() => signInWithGoogle()} />;
  }

  return <AppPageContent />;
}

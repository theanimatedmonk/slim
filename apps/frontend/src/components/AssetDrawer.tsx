import { useEffect, useState } from 'react';
import type { AssetListItem, AssetPreviewSet, AssetWithJob } from '@asset-optimiser/shared-types';
import AssetPreviewImage from './AssetPreviewImage';
import Icon from './Icon';
import Skeleton from './Skeleton';
import Tooltip from './Tooltip';
import { shouldRecommendWebp } from '../hooks/useAssets';
import { formatBytes, calculateReductionPercent } from '../utils/format';
import './AssetDrawer.css';

type DrawerAsset = AssetWithJob & Pick<AssetListItem, 'base64_detected'>;

interface Props {
  asset: DrawerAsset | null;
  previewSet?: AssetPreviewSet;
  onClose: () => void;
  onDownload: (assetId: string) => void;
  onConvertWebp: (assetId: string) => void;
  onConvertPng: (assetId: string) => void;
  onDownloadWebp: (assetId: string) => void;
  onDownloadPng: (assetId: string) => void;
  isConvertingWebp?: boolean;
  isConvertingPng?: boolean;
  isDetailLoading?: boolean;
}

export default function AssetDrawer({
  asset,
  previewSet,
  onClose,
  onDownload,
  onConvertWebp,
  onConvertPng,
  onDownloadWebp,
  onDownloadPng,
  isConvertingWebp,
  isConvertingPng,
  isDetailLoading = false,
}: Props) {
  const [displayAsset, setDisplayAsset] = useState<DrawerAsset | null>(null);
  const [displayPreview, setDisplayPreview] = useState<AssetPreviewSet | undefined>();
  const [isEntering, setIsEntering] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (asset) {
      setDisplayAsset((prev) => {
        if (prev === null) setIsEntering(true);
        return asset;
      });
      setDisplayPreview(previewSet);
      setIsClosing(false);
    } else {
      setDisplayAsset((prev) => {
        if (prev !== null) setIsClosing(true);
        return prev;
      });
      setIsEntering(false);
    }
  }, [asset, previewSet]);

  const finishClose = () => {
    setDisplayAsset(null);
    setDisplayPreview(undefined);
    setIsClosing(false);
  };

  const handlePanelAnimationEnd = (e: React.AnimationEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;

    const closeAnimation =
      e.animationName === 'asset-drawer-slide-out' ||
      e.animationName === 'asset-drawer-sheet-out';
    const openAnimation =
      e.animationName === 'asset-drawer-slide-in' ||
      e.animationName === 'asset-drawer-sheet-in';

    if (isClosing && closeAnimation) {
      finishClose();
      return;
    }

    if (isEntering && openAnimation) {
      setIsEntering(false);
    }
  };

  const handleOverlayAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (isClosing && e.animationName === 'asset-drawer-overlay-out') {
      finishClose();
    }
  };

  if (!displayAsset) return null;

  const shownPreview = isClosing ? displayPreview : (previewSet ?? displayPreview);

  const finalReduction =
    displayAsset.optimized_size != null
      ? calculateReductionPercent(displayAsset.original_size, displayAsset.optimized_size)
      : 0;

  const isComplexAsset =
    shouldRecommendWebp(displayAsset) ||
    displayAsset.complexity === 'complex' ||
    displayAsset.base64_detected === true;
  const showWebpCallout =
    isComplexAsset &&
    !['uploaded', 'queued', 'optimizing'].includes(displayAsset.status);
  const isWebpReady = Boolean(displayAsset.webp_path);
  const isPngReady = Boolean(displayAsset.png_path);
  const isWebpConverting = !isWebpReady && Boolean(isConvertingWebp);
  const isPngConverting = !isPngReady && Boolean(isConvertingPng);
  const isComplete = displayAsset.status === 'complete';
  const showDetailSkeleton = isDetailLoading && isComplete;

  const overlayClass = [
    'asset-drawer__overlay',
    isEntering && 'asset-drawer__overlay--open',
    isClosing && 'asset-drawer__overlay--closing',
  ]
    .filter(Boolean)
    .join(' ');

  const panelClass = [
    'asset-drawer',
    isEntering && 'asset-drawer--open',
    isClosing && 'asset-drawer--closing',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div
        className={overlayClass}
        onClick={onClose}
        onAnimationEnd={handleOverlayAnimationEnd}
        aria-hidden
      />
      <aside
        className={panelClass}
        onAnimationEnd={handlePanelAnimationEnd}
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-drawer-title"
      >
        <div className="asset-drawer__inner">
          <div className="asset-drawer__header">
            <div>
              <h2 id="asset-drawer-title" className="asset-drawer__title">
                {displayAsset.filename}
              </h2>
              <p className="asset-drawer__meta">
                {displayAsset.complexity} · {displayAsset.status}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="asset-drawer__close"
              aria-label="Close"
            >
              <Icon size="md" viewBox="0 0 20 20" fill="currentColor" stroke="none">
                <path d="M10 11.7971L6.20972 15.5874C5.97011 15.827 5.66514 15.9468 5.29483 15.9468C4.92451 15.9468 4.61955 15.827 4.37993 15.5874C4.14031 15.3478 4.02051 15.0428 4.02051 14.6725C4.02051 14.3022 4.14031 13.9972 4.37993 13.7576L8.17021 9.96733L4.37993 6.20972C4.14031 5.97011 4.02051 5.66514 4.02051 5.29483C4.02051 4.92451 4.14031 4.61955 4.37993 4.37993C4.61955 4.14032 4.92451 4.02051 5.29483 4.02051C5.66514 4.02051 5.97011 4.14032 6.20972 4.37993L10 8.17021L13.7576 4.37993C13.9972 4.14032 14.3022 4.02051 14.6725 4.02051C15.0428 4.02051 15.3478 4.14032 15.5874 4.37993C15.8488 4.64133 15.9795 4.95196 15.9795 5.31182C15.9795 5.67168 15.8488 5.97098 15.5874 6.20972L11.7971 9.96733L15.5874 13.7576C15.827 13.9972 15.9468 14.3022 15.9468 14.6725C15.9468 15.0428 15.827 15.3478 15.5874 15.5874C15.326 15.8488 15.0158 15.9795 14.6568 15.9795C14.2978 15.9795 13.9981 15.8488 13.7576 15.5874L10 11.7971Z" />
              </Icon>
            </button>
          </div>

          {(shownPreview?.thumbnail ?? shownPreview?.optimized ?? shownPreview?.original) && (
            <div className="asset-drawer__hero-preview">
              <AssetPreviewImage
                preview={
                  shownPreview.thumbnail ?? shownPreview.optimized ?? shownPreview.original
                }
                alt={displayAsset.filename}
                size="lg"
                priority
                className="asset-preview--constrained"
              />
            </div>
          )}

          <section className="asset-drawer__section">
            <h3 className="asset-drawer__section-title">Before / After</h3>
            <div className="asset-drawer__compare-grid">
              <div className="asset-drawer__compare-card">
                <AssetPreviewImage
                  preview={shownPreview?.original ?? shownPreview?.thumbnail}
                  alt={`${displayAsset.filename} original`}
                  size="md"
                  priority
                />
                <div>
                  <p className="asset-drawer__compare-label">Original</p>
                  <p className="asset-drawer__compare-value">
                    {formatBytes(displayAsset.original_size)}
                  </p>
                </div>
              </div>
              <div className="asset-drawer__compare-card">
                <AssetPreviewImage
                  preview={shownPreview?.optimized ?? shownPreview?.webp}
                  alt={`${displayAsset.filename} optimized`}
                  size="md"
                  priority
                />
                <div className="asset-drawer__compare-meta">
                  <div>
                    <p className="asset-drawer__compare-label">Optimized</p>
                    <p className="asset-drawer__compare-value asset-drawer__compare-value--success">
                      {displayAsset.optimized_size != null
                        ? formatBytes(displayAsset.optimized_size)
                        : '—'}
                    </p>
                  </div>
                  {isComplete && (
                    <Tooltip label="Download">
                      <button
                        type="button"
                        onClick={() => onDownload(displayAsset.id)}
                        className="icon-btn icon-btn--download"
                        aria-label={`Download ${displayAsset.filename}`}
                      >
                        <Icon size="sm" viewBox="0 0 16 16" stroke="var(--color-text-inverse)">
                          <path
                            d="M8 2.5v7M5 8.5l3 3 3-3"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path d="M3 13.5h10" strokeWidth="1.5" strokeLinecap="round" />
                        </Icon>
                      </button>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
            {displayAsset.job?.stabilized && (
              <p className="asset-drawer__stabilized">
                Optimization stabilized · Final reduction: {finalReduction}%
              </p>
            )}
          </section>

          {displayAsset.iterations && displayAsset.iterations.length > 0 && (
            <section className="asset-drawer__section">
              <h3 className="asset-drawer__section-title">Optimization Iterations</h3>
              <div className="asset-drawer__iteration-list">
                {displayAsset.iterations.map((iteration) => (
                  <div key={iteration.id} className="asset-drawer__iteration-item">
                    <div>
                      <p className="asset-drawer__iteration-size">
                        Iteration {iteration.iteration_number}
                      </p>
                      <p className="asset-drawer__iteration-size">
                        {formatBytes(iteration.size_bytes)}
                      </p>
                    </div>
                    <span className="asset-drawer__iteration-reduction">
                      ↓ {iteration.reduction_percent}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {showDetailSkeleton && !displayAsset.iterations?.length && (
            <section className="asset-drawer__section" aria-hidden>
              <Skeleton className="asset-drawer-skeleton__section-title" />
              <div className="asset-drawer-skeleton__iteration-list">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="asset-drawer-skeleton__iteration-row" />
                ))}
              </div>
            </section>
          )}

          {showWebpCallout && (
            <section className="asset-drawer__section asset-drawer__webp-callout">
              <h3 className="asset-drawer__webp-title">Complex SVG</h3>
              <p className="asset-drawer__webp-desc">
                This asset still contains characteristics that may impact rendering
                performance. WebP or PNG conversion is recommended.
              </p>
              {displayAsset.report?.operations && displayAsset.report.operations.length > 0 && (
                <ul className="asset-drawer__webp-ops">
                  {displayAsset.report.operations.map((op) => (
                    <li key={op}>{op}</li>
                  ))}
                </ul>
              )}
              <div className="asset-drawer__raster-actions">
                {isWebpReady ? (
                  <button
                    type="button"
                    onClick={() => onDownloadWebp(displayAsset.id)}
                    className="asset-drawer__webp-btn"
                  >
                    Download WebP
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isWebpConverting}
                    onClick={() => onConvertWebp(displayAsset.id)}
                    className="asset-drawer__webp-btn"
                  >
                    {isWebpConverting ? 'Converting…' : 'Convert to WebP'}
                  </button>
                )}
                {isPngReady ? (
                  <button
                    type="button"
                    onClick={() => onDownloadPng(displayAsset.id)}
                    className="asset-drawer__webp-btn asset-drawer__webp-btn--outline"
                  >
                    Download PNG
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isPngConverting}
                    onClick={() => onConvertPng(displayAsset.id)}
                    className="asset-drawer__webp-btn asset-drawer__webp-btn--outline"
                  >
                    {isPngConverting ? 'Converting…' : 'Convert to PNG'}
                  </button>
                )}
              </div>
            </section>
          )}

          {displayAsset.report && (
            <section className="asset-drawer__section">
              <h3 className="asset-drawer__section-title">Complexity Report</h3>
              <dl className="asset-drawer__report-grid">
                <dt className="asset-drawer__report-term">Paths</dt>
                <dd className="asset-drawer__report-value">{displayAsset.report.path_count}</dd>
                <dt className="asset-drawer__report-term">Gradients</dt>
                <dd className="asset-drawer__report-value">{displayAsset.report.gradients}</dd>
                <dt className="asset-drawer__report-term">Score</dt>
                <dd className="asset-drawer__report-value">
                  {displayAsset.report.final_complexity_score}
                </dd>
                <dt className="asset-drawer__report-term">Base64 images</dt>
                <dd className="asset-drawer__report-value">
                  {displayAsset.report.base64_detected ? 'Yes' : 'No'}
                </dd>
              </dl>
            </section>
          )}

          {showDetailSkeleton && !displayAsset.report && (
            <section className="asset-drawer__section" aria-hidden>
              <Skeleton className="asset-drawer-skeleton__section-title" />
              <div className="asset-drawer-skeleton__report-grid">
                {Array.from({ length: 4 }, (_, index) => (
                  <Skeleton key={index} className="asset-drawer-skeleton__report-row" />
                ))}
              </div>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}

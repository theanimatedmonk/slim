import type { AssetListItem, AssetPreview } from '@asset-optimiser/shared-types';
import AssetPreviewImage from './AssetPreviewImage';
import Icon from './Icon';
import { formatBytes, calculateReductionPercent } from '../utils/format';
import { shouldRecommendWebp } from '../hooks/useAssets';
import './AssetRow.css';

interface Props {
  asset: AssetListItem;
  thumbnail?: AssetPreview | null;
  selectable?: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onSelect: (asset: AssetListItem) => void;
  onDownload: (asset: AssetListItem) => void;
  onDelete: (assetId: string) => void;
  onDeleteImmediate?: (assetId: string) => void;
  onRetry?: (assetId: string) => void;
  isDeleting?: boolean;
  isRetrying?: boolean;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'uploaded':
      return (
        <Icon size="sm" viewBox="0 0 16 16" stroke="var(--color-text-muted)">
          <circle cx="8" cy="8" r="7" strokeWidth="1.5" />
          <path d="M5 8l2 2 4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </Icon>
      );
    case 'queued':
      return (
        <Icon size="sm" viewBox="0 0 16 16" stroke="var(--color-text-muted)">
          <circle cx="8" cy="8" r="6.5" strokeWidth="1.5" />
          <path d="M8 4.5V8l2.5 1.5" strokeWidth="1.5" strokeLinecap="round" />
        </Icon>
      );
    case 'optimizing':
    case 'converting':
      return (
        <Icon
          size="sm"
          viewBox="0 0 16 16"
          stroke="var(--color-text-muted)"
          className="asset-row__feedback-icon--spin"
        >
          <circle cx="8" cy="8" r="2" strokeWidth="1.5" />
          <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2" strokeWidth="1.5" strokeLinecap="round" />
        </Icon>
      );
    case 'failed':
      return (
        <Icon size="sm" viewBox="0 0 16 16" stroke="var(--color-error-text)">
          <circle cx="8" cy="8" r="7" strokeWidth="1.5" />
          <path d="M8 5v3.5M8 10.5v.5" strokeWidth="1.5" strokeLinecap="round" />
        </Icon>
      );
    default:
      return null;
  }
}

function statusDisplayLabel(status: string): string {
  const labels: Record<string, string> = {
    uploaded: 'Uploaded',
    queued: 'Queued',
    optimizing: 'Optimising...',
    converting: 'Optimising...',
    failed: 'Failed',
  };
  return labels[status] ?? status;
}

function statusFeedbackClass(status: string): string {
  switch (status) {
    case 'uploaded':
      return 'asset-row__feedback--uploaded';
    case 'queued':
      return 'asset-row__feedback--queued';
    case 'optimizing':
    case 'converting':
      return 'asset-row__feedback--optimizing';
    case 'failed':
      return 'asset-row__feedback--failed';
    default:
      return 'asset-row__feedback--default';
  }
}

function ComplexSvgPill() {
  return (
    <span className="asset-row__complex-pill">
      <Icon size="sm" viewBox="0 0 16 16" fill="currentColor" stroke="none">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
  <path fill-rule="evenodd" clip-rule="evenodd" d="M1.45967 11.888L6.90109 2.80384C7.01567 2.61508 7.17696 2.45903 7.36938 2.35074C7.56181 2.24244 7.7789 2.18555 7.99971 2.18555C8.22052 2.18555 8.43761 2.24244 8.63003 2.35074C8.82246 2.45903 8.98374 2.61508 9.09832 2.80384L14.5397 11.888C14.6519 12.0823 14.7112 12.3026 14.7117 12.5269C14.7123 12.7513 14.6542 12.9719 14.5431 13.1668C14.432 13.3616 14.2718 13.5241 14.0785 13.6379C13.8852 13.7517 13.6654 13.8129 13.4411 13.8154H2.55829C2.33388 13.8131 2.11399 13.752 1.92053 13.6383C1.72707 13.5246 1.56679 13.3621 1.45565 13.1671C1.34452 12.9722 1.28641 12.7515 1.28712 12.527C1.28782 12.3026 1.34732 12.0823 1.45967 11.888ZM7.99971 5.72037C8.20418 5.72037 8.40028 5.8016 8.54486 5.94618C8.68944 6.09076 8.77067 6.28686 8.77067 6.49133V8.8042C8.77067 9.00867 8.68944 9.20477 8.54486 9.34935C8.40028 9.49393 8.20418 9.57516 7.99971 9.57516C7.79524 9.57516 7.59914 9.49393 7.45456 9.34935C7.30998 9.20477 7.22875 9.00867 7.22875 8.8042V6.49133C7.22875 6.28686 7.30998 6.09076 7.45456 5.94618C7.59914 5.8016 7.79524 5.72037 7.99971 5.72037ZM7.22875 11.1171C7.22875 10.9126 7.30998 10.7165 7.45456 10.5719C7.59914 10.4273 7.79524 10.3461 7.99971 10.3461H8.00588C8.21035 10.3461 8.40644 10.4273 8.55103 10.5719C8.69561 10.7165 8.77684 10.9126 8.77684 11.1171C8.77684 11.3215 8.69561 11.5176 8.55103 11.6622C8.40644 11.8068 8.21035 11.888 8.00588 11.888H7.99971C7.79524 11.888 7.59914 11.8068 7.45456 11.6622C7.30998 11.5176 7.22875 11.3215 7.22875 11.1171Z" fill="black"/>
</svg>
      </Icon>
      Complex SVG
    </span>
  );
}

export default function AssetRow({
  asset,
  thumbnail,
  selectable,
  checked,
  onCheckedChange,
  onSelect,
  onDownload,
  onDelete,
  onDeleteImmediate,
  onRetry,
  isDeleting,
  isRetrying,
}: Props) {
  const isComplete = asset.status === 'complete';
  const canRetry =
    asset.status === 'failed' && Boolean(asset.original_path ?? asset.optimized_path);
  const reduction =
    asset.optimized_size != null
      ? calculateReductionPercent(asset.original_size, asset.optimized_size)
      : null;
  const isComplexSvg = isComplete && shouldRecommendWebp(asset);

  return (
    <li
      className={`asset-row${selectable ? ' asset-row--selectable' : ''}${checked ? ' asset-row--selected' : ''}`}
      onClick={() => onSelect(asset)}
    >
      <div
        className="asset-row__col asset-row__col--select"
        onClick={(e) => e.stopPropagation()}
      >
        {selectable && (
          <input
            type="checkbox"
            className="app-checkbox"
            checked={checked}
            onChange={(e) => onCheckedChange?.(e.target.checked)}
            aria-label={`Select ${asset.filename}`}
          />
        )}
      </div>

      {/* C1 — asset name */}
      <div className="asset-row__col asset-row__col--name">
        <AssetPreviewImage preview={thumbnail} alt={asset.filename} size="sm" />
        <span className="asset-row__name" title={asset.filename}>
          {asset.filename}
        </span>
      </div>

      {/* C2 — size / optimised meta */}
      <div className="asset-row__col asset-row__col--meta">
        {isComplete && asset.optimized_size != null ? (
          <>
            <span className="asset-row__size-compare">
              {formatBytes(asset.original_size)}
              <span className="asset-row__arrow" aria-hidden>
                →
              </span>
              <strong>{formatBytes(asset.optimized_size)}</strong>
            </span>
            {reduction != null && (
              <span className="asset-row__savings">
                <Icon size="sm" viewBox="0 0 16 16" stroke="currentColor">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3.5 8.375L8 12.875L12.5 8.375M8 12.25V3.125" stroke="#086E0A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                </Icon>
                {reduction}%
              </span>
            )}
            {isComplexSvg && <ComplexSvgPill />}
          </>
        ) : (
          <span className="asset-row__size">{formatBytes(asset.original_size)}</span>
        )}
      </div>

      {/* C3 — actions or feedback */}
      <div
        className="asset-row__col asset-row__col--trail"
        onClick={(e) => e.stopPropagation()}
      >
        {isComplete ? (
          <div className="asset-row__actions">
            <button
              type="button"
              onClick={() => onDownload(asset)}
              className="asset-row__icon-btn asset-row__icon-btn--download"
              aria-label={`Download ${asset.filename}`}
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
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => onDelete(asset.id)}
              className="asset-row__icon-btn asset-row__icon-btn--delete"
              aria-label={`Delete ${asset.filename}`}
            >
              <Icon
                size="md"
                viewBox="0 0 20 20"
                fill="var(--color-text-primary)"
                stroke="none"
              >
                <path d="M8.33366 5.00033H11.667C11.667 4.5583 11.4914 4.13437 11.1788 3.82181C10.8663 3.50925 10.4424 3.33366 10.0003 3.33366C9.5583 3.33366 9.13437 3.50925 8.82181 3.82181C8.50925 4.13437 8.33366 4.5583 8.33366 5.00033ZM6.66699 5.00033C6.66699 4.11627 7.01818 3.26842 7.6433 2.6433C8.26842 2.01818 9.11627 1.66699 10.0003 1.66699C10.8844 1.66699 11.7322 2.01818 12.3573 2.6433C12.9825 3.26842 13.3337 4.11627 13.3337 5.00033H17.5003C17.7213 5.00033 17.9333 5.08812 18.0896 5.2444C18.2459 5.40068 18.3337 5.61265 18.3337 5.83366C18.3337 6.05467 18.2459 6.26663 18.0896 6.42291C17.9333 6.57919 17.7213 6.66699 17.5003 6.66699H16.7653L16.027 15.2837C15.956 16.1157 15.5753 16.8908 14.9602 17.4556C14.3451 18.0204 13.5404 18.3338 12.7053 18.3337H7.29533C6.46025 18.3338 5.65555 18.0204 5.04045 17.4556C4.42534 16.8908 4.04464 16.1157 3.97366 15.2837L3.23533 6.66699H2.50033C2.27931 6.66699 2.06735 6.57919 1.91107 6.42291C1.75479 6.26663 1.66699 6.05467 1.66699 5.83366C1.66699 5.61265 1.75479 5.40068 1.91107 5.2444C2.06735 5.08812 2.27931 5.00033 2.50033 5.00033H6.66699ZM12.5003 10.0003C12.5003 9.77931 12.4125 9.56735 12.2562 9.41107C12.1 9.25479 11.888 9.16699 11.667 9.16699C11.446 9.16699 11.234 9.25479 11.0777 9.41107C10.9215 9.56735 10.8337 9.77931 10.8337 10.0003V13.3337C10.8337 13.5547 10.9215 13.7666 11.0777 13.9229C11.234 14.0792 11.446 14.167 11.667 14.167C11.888 14.167 12.1 14.0792 12.2562 13.9229C12.4125 13.7666 12.5003 13.5547 12.5003 13.3337V10.0003ZM8.33366 9.16699C8.55467 9.16699 8.76663 9.25479 8.92291 9.41107C9.07919 9.56735 9.16699 9.77931 9.16699 10.0003V13.3337C9.16699 13.5547 9.07919 13.7666 8.92291 13.9229C8.76663 14.0792 8.55467 14.167 8.33366 14.167C8.11264 14.167 7.90068 14.0792 7.7444 13.9229C7.58812 13.7666 7.50033 13.5547 7.50033 13.3337V10.0003C7.50033 9.77931 7.58812 9.56735 7.7444 9.41107C7.90068 9.25479 8.11264 9.16699 8.33366 9.16699ZM5.63366 15.142C5.66916 15.5582 5.85963 15.9458 6.16736 16.2283C6.47509 16.5107 6.87764 16.6673 7.29533 16.667H12.7053C13.1227 16.6668 13.5249 16.5101 13.8322 16.2277C14.1396 15.9453 14.3298 15.5579 14.3653 15.142L15.092 6.66699H4.90866L5.63366 15.142Z" />
              </Icon>
            </button>
          </div>
        ) : asset.status === 'failed' ? (
          <div className="asset-row__trail-failed">
            <span className="asset-row__feedback asset-row__feedback--failed">
              <StatusIcon status={asset.status} />
              {statusDisplayLabel(asset.status)}
            </span>
            <div className="asset-row__actions">
              {canRetry && onRetry && (
                <button
                  type="button"
                  disabled={isRetrying}
                  onClick={() => onRetry(asset.id)}
                  className="asset-row__icon-btn asset-row__icon-btn--retry"
                  aria-label={`Retry ${asset.filename}`}
                >
                  <Icon
                    size="sm"
                    viewBox="0 0 16 16"
                    stroke="currentColor"
                    className={isRetrying ? 'asset-row__feedback-icon--spin' : undefined}
                  >
                    <path
                      d="M13.5 8A5.5 5.5 0 0 0 8 2.5V1M2.5 8A5.5 5.5 0 0 0 8 13.5V15M8 1l1.5 1.5M8 15l-1.5-1.5"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Icon>
                </button>
              )}
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => (onDeleteImmediate ?? onDelete)(asset.id)}
                className="asset-row__icon-btn asset-row__icon-btn--dismiss"
                aria-label={`Remove ${asset.filename}`}
              >
                <Icon size="sm" viewBox="0 0 16 16" stroke="currentColor">
                  <path d="M4 4l8 8M12 4l-8 8" strokeWidth="1.5" strokeLinecap="round" />
                </Icon>
              </button>
            </div>
          </div>
        ) : (
          <span className={`asset-row__feedback ${statusFeedbackClass(asset.status)}`}>
            <StatusIcon status={asset.status} />
            {statusDisplayLabel(asset.status)}
          </span>
        )}
      </div>
    </li>
  );
}

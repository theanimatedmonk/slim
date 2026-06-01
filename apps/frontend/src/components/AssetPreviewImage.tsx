import type { AssetPreview } from '@asset-optimiser/shared-types';
import './AssetPreviewImage.css';

interface Props {
  preview: AssetPreview | null | undefined;
  alt: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function AssetPreviewImage({
  preview,
  alt,
  className = '',
  size = 'sm',
}: Props) {
  const sizeClass =
    size === 'md' ? 'asset-preview--md' : size === 'lg' ? 'asset-preview--lg' : '';

  if (!preview?.url) {
    return (
      <div className={`asset-preview ${sizeClass} ${className}`.trim()} aria-hidden>
        <span className="asset-preview__placeholder">svg</span>
      </div>
    );
  }

  return (
    <div className={`asset-preview ${sizeClass} ${className}`.trim()}>
      <img src={preview.url} alt={alt} className="asset-preview__image" loading="lazy" draggable={false} />
    </div>
  );
}

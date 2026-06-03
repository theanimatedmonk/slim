import { useEffect, useState } from 'react';
import type { AssetPreview } from '@asset-optimiser/shared-types';
import './AssetPreviewImage.css';

interface Props {
  preview: AssetPreview | null | undefined;
  alt: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/** Signed URLs rotate tokens; pathname is stable for the same stored file. */
function previewSourceKey(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0] ?? url;
  }
}

function Placeholder({ sizeClass, className }: { sizeClass: string; className: string }) {
  return (
    <div className={`asset-preview ${sizeClass} ${className}`.trim()} aria-hidden>
      <span className="asset-preview__placeholder">svg</span>
    </div>
  );
}

export default function AssetPreviewImage({
  preview,
  alt,
  className = '',
  size = 'sm',
}: Props) {
  const url = preview?.url;
  const sourceKey = url ? previewSourceKey(url) : null;
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const sizeClass =
    size === 'md' ? 'asset-preview--md' : size === 'lg' ? 'asset-preview--lg' : '';

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [sourceKey]);

  if (!url || failed) {
    return <Placeholder sizeClass={sizeClass} className={className} />;
  }

  return (
    <div className={`asset-preview ${sizeClass} ${className}`.trim()}>
      {!loaded && <span className="asset-preview__placeholder">svg</span>}
      <img
        src={url}
        alt={alt}
        className={`asset-preview__image${loaded ? '' : ' asset-preview__image--pending'}`}
        loading="lazy"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

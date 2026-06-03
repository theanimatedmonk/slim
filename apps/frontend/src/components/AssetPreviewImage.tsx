import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AssetPreview } from '@asset-optimiser/shared-types';
import {
  isPreviewSourceLoaded,
  markPreviewSourceLoaded,
  previewSourceKey,
} from '../utils/previewLoadCache';
import Skeleton from './Skeleton';
import './AssetPreviewImage.css';

interface Props {
  preview: AssetPreview | null | undefined;
  alt: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Eager load for above-the-fold previews (e.g. drawer). */
  priority?: boolean;
}

function PreviewSkeleton({ sizeClass, className }: { sizeClass: string; className: string }) {
  return (
    <div className={`asset-preview ${sizeClass} ${className}`.trim()} aria-hidden>
      <Skeleton className="asset-preview__skeleton" />
    </div>
  );
}

export default function AssetPreviewImage({
  preview,
  alt,
  className = '',
  size = 'sm',
  priority = false,
}: Props) {
  const url = preview?.url;
  const sourceKey = url ? previewSourceKey(url) : null;
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(
    () => (sourceKey ? isPreviewSourceLoaded(sourceKey) : false)
  );
  const [failed, setFailed] = useState(false);

  const sizeClass =
    size === 'md' ? 'asset-preview--md' : size === 'lg' ? 'asset-preview--lg' : '';

  useEffect(() => {
    setFailed(false);
    setLoaded(sourceKey ? isPreviewSourceLoaded(sourceKey) : false);
  }, [sourceKey]);

  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img || !sourceKey || failed) return;

    if (img.complete && img.naturalWidth > 0) {
      markPreviewSourceLoaded(sourceKey);
      setLoaded(true);
    }
  }, [url, sourceKey, failed]);

  const handleLoad = () => {
    if (sourceKey) markPreviewSourceLoaded(sourceKey);
    setLoaded(true);
  };

  if (!url || failed) {
    return <PreviewSkeleton sizeClass={sizeClass} className={className} />;
  }

  return (
    <div className={`asset-preview ${sizeClass} ${className}`.trim()}>
      {!loaded && <Skeleton className="asset-preview__skeleton" />}
      <img
        ref={imgRef}
        src={url}
        alt={alt}
        className={`asset-preview__image${loaded ? '' : ' asset-preview__image--pending'}`}
        loading={priority ? 'eager' : 'lazy'}
        draggable={false}
        decoding="async"
        onLoad={handleLoad}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

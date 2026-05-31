import type { AssetPreview } from '@asset-optimiser/shared-types';

interface Props {
  preview: AssetPreview | null | undefined;
  alt: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-10 h-10',
  md: 'w-full aspect-square max-h-40',
  lg: 'w-full aspect-square max-h-56',
};

export default function AssetPreviewImage({
  preview,
  alt,
  className = '',
  size = 'sm',
}: Props) {
  const frame = `${sizeClasses[size]} rounded-lg border border-border bg-[#1a1a1e] overflow-hidden flex items-center justify-center shrink-0`;

  if (!preview?.url) {
    return (
      <div className={`${frame} ${className}`} aria-hidden>
        <span className="text-[10px] font-mono text-gray-600 uppercase">svg</span>
      </div>
    );
  }

  return (
    <div className={`${frame} ${className}`}>
      <img
        src={preview.url}
        alt={alt}
        className="w-full h-full object-contain p-1"
        loading="lazy"
        draggable={false}
      />
    </div>
  );
}

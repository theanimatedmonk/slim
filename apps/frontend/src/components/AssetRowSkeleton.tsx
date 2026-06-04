import Skeleton from './Skeleton';
import './AssetRowSkeleton.css';

function AssetRowSkeletonItem() {
  return (
    <li className="asset-row asset-row--skeleton">
      <div className="asset-row__header">
        <div className="asset-row__col asset-row__col--name">
          <Skeleton className="asset-row-skeleton__thumb" />
          <Skeleton className="asset-row-skeleton__name" />
        </div>
        <div className="asset-row__col asset-row__col--select">
          <Skeleton className="asset-row-skeleton__checkbox" />
        </div>
      </div>
      <div className="asset-row__col asset-row__col--meta">
        <Skeleton className="asset-row-skeleton__meta" />
      </div>
      <div className="asset-row__col asset-row__col--trail">
        <div className="asset-row-skeleton__actions">
          <Skeleton className="asset-row-skeleton__action" />
          <Skeleton className="asset-row-skeleton__action" />
        </div>
      </div>
    </li>
  );
}

export function AssetTableHeaderSkeleton() {
  return (
    <li className="asset-table-header asset-table-header--skeleton" aria-hidden>
      <span className="asset-table-header__col asset-table-header__col--select">
        <Skeleton className="asset-table-header-skeleton__checkbox" />
      </span>
      <span className="asset-table-header__col asset-table-header__col--file">
        <Skeleton className="asset-table-header-skeleton__label asset-table-header-skeleton__label--file" />
      </span>
      <span className="asset-table-header__col asset-table-header__col--size">
        <Skeleton className="asset-table-header-skeleton__label asset-table-header-skeleton__label--size" />
      </span>
      <span className="asset-table-header__col asset-table-header__col--actions">
        <Skeleton className="asset-table-header-skeleton__label asset-table-header-skeleton__label--actions" />
      </span>
    </li>
  );
}

interface Props {
  count?: number;
  showHeader?: boolean;
}

export default function AssetRowSkeleton({ count = 4, showHeader = true }: Props) {
  return (
    <>
      {showHeader && <AssetTableHeaderSkeleton />}
      {Array.from({ length: count }, (_, index) => (
        <AssetRowSkeletonItem key={index} />
      ))}
    </>
  );
}

import AssetRowSkeleton from './AssetRowSkeleton';
import Skeleton from './Skeleton';
import './AppPageSkeleton.css';

interface Props {
  showUpload?: boolean;
  rowCount?: number;
}

export default function AppPageSkeleton({ showUpload = true, rowCount = 4 }: Props) {
  return (
    <div className="app-page" aria-busy="true" aria-label="Loading">
      {showUpload && (
        <div className="app-page-skeleton__upload">
          <div className="upload-dropzone-skeleton__zone">
            <Skeleton className="upload-dropzone-skeleton__icon" />
            <Skeleton className="upload-dropzone-skeleton__title" />
            <Skeleton className="upload-dropzone-skeleton__browse" />
          </div>
        </div>
      )}

      <section className="app-page-skeleton__assets">
        <div className="app-page__list-wrap">
          <ul className="app-page__asset-list">
            <AssetRowSkeleton count={rowCount} />
          </ul>
        </div>
      </section>
    </div>
  );
}

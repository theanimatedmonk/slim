export type AssetStatus =
  | 'uploaded'
  | 'queued'
  | 'optimizing'
  | 'complete'
  | 'failed'
  | 'converting';

export type JobStatus =
  | 'queued'
  | 'active'
  | 'optimizing'
  | 'complete'
  | 'failed'
  | 'converting';

export type ComplexityLevel = 'simple' | 'moderate' | 'complex' | 'unknown';

export interface Asset {
  id: string;
  user_id: string | null;
  filename: string;
  original_path: string | null;
  optimized_path: string | null;
  webp_path: string | null;
  png_path: string | null;
  original_size: number;
  optimized_size: number | null;
  complexity: ComplexityLevel;
  status: AssetStatus;
  created_at: string;
}

export interface Job {
  id: string;
  asset_id: string;
  status: JobStatus;
  iterations: number;
  reduction_percent: number;
  stabilized: boolean;
  created_at: string;
}

export interface JobIteration {
  id: string;
  job_id: string;
  iteration_number: number;
  size_bytes: number;
  reduction_percent: number;
  created_at: string;
}

export interface OptimizationReport {
  id: string;
  asset_id: string;
  operations: string[];
  gradients: number;
  path_count: number;
  base64_detected: boolean;
  final_complexity_score: number;
  created_at: string;
}

export interface AssetWithJob extends Asset {
  job?: Job | null;
  iterations?: JobIteration[];
  report?: OptimizationReport | null;
}

/** Slim row payload for GET /assets (table list). */
export interface AssetListItem extends Asset {
  base64_detected?: boolean | null;
}

export interface UploadUrlRequest {
  filename: string;
  contentType?: string;
}

export interface UploadUrlResponse {
  signedUrl: string;
  path: string;
  assetId: string;
}

export interface OptimizeRequest {
  assetIds: string[];
}

export interface OptimizeResponse {
  jobIds: string[];
}

export interface ConvertWebpRequest {
  assetId: string;
}

export interface ConvertWebpResponse {
  jobId: string;
}

export interface ConvertPngRequest {
  assetId: string;
}

export interface ConvertPngResponse {
  jobId: string;
}

export interface RetryAssetResponse {
  jobId: string;
  jobType: 'optimize' | 'convert-webp' | 'convert-png';
  status: 'queued' | 'converting';
}

export interface JobStatusResponse {
  job: Job;
  asset: Asset;
  iterations: JobIteration[];
  report: OptimizationReport | null;
}

export interface RegisterAssetRequest {
  assetId: string;
  filename: string;
  path: string;
  size: number;
}

export type AssetPreviewKind = 'svg' | 'webp' | 'png';

export interface AssetPreview {
  url: string;
  kind: AssetPreviewKind;
}

/** Signed preview URLs for an asset (thumbnail + optional variants). */
export interface AssetPreviewSet {
  thumbnail: AssetPreview | null;
  original: AssetPreview | null;
  optimized: AssetPreview | null;
  webp: AssetPreview | null;
  png: AssetPreview | null;
}

export interface AssetPreviewsRequest {
  assetIds: string[];
}

export interface AssetPreviewsResponse {
  previews: Record<string, AssetPreviewSet>;
}

export interface QueueJobPayload {
  type: 'optimize' | 'convert-webp' | 'convert-png' | 'generate-zip';
  assetId: string;
  jobId: string;
  bundleJobId?: string;
  assetIds?: string[];
}

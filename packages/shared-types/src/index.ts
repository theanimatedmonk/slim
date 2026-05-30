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
  filename: string;
  original_path: string;
  optimized_path: string | null;
  webp_path: string | null;
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
  passes: number;
  reduction_percent: number;
  stabilized: boolean;
  created_at: string;
}

export interface JobPass {
  id: string;
  job_id: string;
  pass_number: number;
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
  passes?: JobPass[];
  report?: OptimizationReport | null;
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

export interface JobStatusResponse {
  job: Job;
  asset: Asset;
  passes: JobPass[];
  report: OptimizationReport | null;
}

export interface RegisterAssetRequest {
  assetId: string;
  filename: string;
  path: string;
  size: number;
}

export interface QueueJobPayload {
  type: 'optimize' | 'convert-webp' | 'generate-zip';
  assetId: string;
  jobId: string;
  bundleJobId?: string;
  assetIds?: string[];
}

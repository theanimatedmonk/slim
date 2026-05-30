import { Queue } from 'bullmq';
import type { QueueJobPayload } from '@asset-optimiser/shared-types';
import { redisConnection } from './connection.js';

export const OPTIMIZATION_QUEUE_NAME = 'asset-optimization';

export type OptimizationJobName = 'optimize' | 'convert-webp' | 'generate-zip';

export const optimizationQueue = new Queue<
  QueueJobPayload,
  void,
  OptimizationJobName
>(OPTIMIZATION_QUEUE_NAME, { connection: redisConnection });

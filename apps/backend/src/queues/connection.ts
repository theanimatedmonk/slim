import { config } from '../config.js';

/** Plain options for BullMQ (avoids duplicate ioredis type versions in tsc). */
export const redisConnection = {
  url: config.redisUrl,
  maxRetriesPerRequest: null,
};

import { startOptimizationWorker } from './workers/optimizationWorker.js';

console.log('Starting asset optimization worker...');
startOptimizationWorker();
console.log('Worker listening for jobs on asset-optimization queue');

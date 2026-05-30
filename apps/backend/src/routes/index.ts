import { Router } from 'express';
import { getUploadUrl, registerAsset } from '../controllers/uploadController.js';
import { listAllAssets, startOptimization } from '../controllers/optimizeController.js';
import { getJob, downloadBundle, requestBundleDownload } from '../controllers/jobController.js';
import { convertToWebp } from '../controllers/webpController.js';

const router = Router();

router.post('/upload-url', getUploadUrl);
router.post('/assets/register', registerAsset);
router.get('/assets', listAllAssets);
router.post('/optimize', startOptimization);
router.get('/job/:id', getJob);
router.post('/convert-webp', convertToWebp);
router.post('/download', requestBundleDownload);
router.get('/download/:jobId', downloadBundle);

export default router;

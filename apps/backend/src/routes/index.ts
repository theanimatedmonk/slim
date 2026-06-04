import { Router, type RequestHandler } from 'express';
import { getUploadUrl, registerAsset } from '../controllers/uploadController.js';
import { listAllAssets, startOptimization } from '../controllers/optimizeController.js';
import {
  getJob,
  downloadBundle,
  requestBundleDownload,
} from '../controllers/jobController.js';
import { convertToPng } from '../controllers/pngController.js';
import { convertToWebp } from '../controllers/webpController.js';
import { processJobsCron } from '../controllers/cronController.js';
import { deleteAsset, downloadAsset, downloadAssetPng, downloadAssetWebp, getAssetDetail, getAssetPreviews, retryAsset } from '../controllers/assetController.js';
import { requireAuth } from '../middleware/auth.js';
import { authed } from '../utils/authedHandler.js';

const router = Router();

router.post('/cron/process-jobs', processJobsCron);

router.use(requireAuth as RequestHandler);

router.post('/upload-url', authed(getUploadUrl));
router.post('/assets/register', authed(registerAsset));
router.get('/assets', authed(listAllAssets));
router.post('/assets/previews', authed(getAssetPreviews));
router.get('/assets/:id', authed(getAssetDetail));
router.get('/assets/:id/download', authed(downloadAsset));
router.get('/assets/:id/download-webp', authed(downloadAssetWebp));
router.get('/assets/:id/download-png', authed(downloadAssetPng));
router.post('/assets/:id/retry', authed(retryAsset));
router.delete('/assets/:id', authed(deleteAsset));
router.post('/optimize', authed(startOptimization));
router.get('/job/:id', authed(getJob));
router.post('/convert-webp', authed(convertToWebp));
router.post('/convert-png', authed(convertToPng));
router.post('/download', authed(requestBundleDownload));
router.get('/download/:jobId', authed(downloadBundle));

export default router;

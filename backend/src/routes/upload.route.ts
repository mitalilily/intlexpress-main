import { Router } from "express";
import {
  createPresignedUrl,
  downloadStoredFile,
  getPresignedDownloadUrl,
  uploadFileToStorage,
} from "../controllers/upload.controller";
import { upload } from "../middlewares/upload";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.post("/presign", requireAuth, createPresignedUrl);
router.post("/direct", requireAuth, upload.single("file"), uploadFileToStorage);
router.post("/presign-download-url", requireAuth, getPresignedDownloadUrl);
router.get("/download", requireAuth, downloadStoredFile);

export default router;

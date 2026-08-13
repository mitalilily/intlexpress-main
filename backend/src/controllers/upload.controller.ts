import { Request, Response } from "express";
import {
  presignDownload,
  presignUpload,
  uploadBufferToR2,
} from "../models/services/upload.service";
import { getBucketName } from "../utils/functions";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2 } from "../config/r2Client";
import path from "path";

export const createPresignedUrl = async (
  req: any,
  res: Response
): Promise<any> => {
  const { filename, contentType, folder } = req.body;
  const { sub } = req?.user;

  if (!filename || !contentType) {
    return res.status(400).json({ message: "filename & contentType required" });
  }

  try {
    const data = await presignUpload({
      filename,
      contentType,
      userId: sub,
      folderKey: folder,
    });
    return res.status(200).json(data);
  } catch (err) {
    console.error("Presign error:", err);
    return res.status(500).json({ message: "Failed to presign URL" });
  }
};

export const uploadFileToStorage = async (
  req: any,
  res: Response
): Promise<any> => {
  const { sub } = req?.user || {};
  const file = req.file;
  const folder = String(req.body?.folder || "userPp").trim() || "userPp";

  if (!sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!file?.buffer || !file?.originalname) {
    return res.status(400).json({ message: "File is required" });
  }

  try {
    const uploaded = await uploadBufferToR2({
      filename: file.originalname,
      contentType: file.mimetype || "application/octet-stream",
      userId: sub,
      folderKey: folder,
      fileBuffer: file.buffer,
    });

    return res.status(200).json({
      ...uploaded,
      originalName: file.originalname,
      size: file.size,
      mime: file.mimetype || "application/octet-stream",
    });
  } catch (err) {
    console.error("Direct upload error:", err);
    return res.status(500).json({ message: "Failed to upload file" });
  }
};

export const getPresignedDownloadUrl = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { keys } = req.body;

    // Validate payload
    if (!keys || (typeof keys !== "string" && !Array.isArray(keys))) {
      return res
        .status(400)
        .json({ message: "'keys' must be a string or string[]" });
    }

    // Generate signed URL(s)
    const result = await presignDownload(keys, { checkExists: true });

    if (Array.isArray(keys)) {
      const urls = Array.isArray(result) ? result : [];
      const missingFiles = keys.filter((_, index) => !urls[index]);
      const foundCount = urls.filter(Boolean).length;
      const missingCount = missingFiles.length;

      if (missingFiles.length > 0) {
        console.warn(`⚠️ Some files not found in storage:`, missingFiles);
      }

      const message =
        missingCount === 0
          ? 'Download links are ready.'
          : foundCount > 0
            ? `${foundCount} file(s) are ready. ${missingCount} file(s) could not be found or have not been generated yet.`
            : 'None of the requested files are available yet. They may still be generating or may need to be regenerated.';

      return res.status(200).json({
        urls,
        foundCount,
        missingCount,
        missingFiles,
        message,
      });
    } else {
      if (!result || result === null) {
        return res.status(404).json({ 
          message: "This file is not available yet. It may still be generating or may need to be regenerated.",
          key: keys 
        });
      }
      return res.status(200).json({ url: result as string });
    }
  } catch (error) {
    console.error("Presign download failed:", error);
    return res
      .status(500)
      .json({ message: "Failed to generate download URL(s)" });
  }
};

const sanitizeDownloadName = (value: unknown, fallback: string) => {
  const candidate = String(value || "").trim();
  const basename = path.basename(candidate || fallback);
  const safe = basename
    .replace(/[^\w.\- ()]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-. ]+|[-. ]+$/g, "");

  return safe || fallback;
};

const streamToBuffer = async (body: any): Promise<Buffer> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export const downloadStoredFile = async (
  req: Request,
  res: Response
): Promise<any> => {
  const key = String(req.query.key || "").trim().replace(/^\/+/, "");

  if (!key || /^https?:\/\//i.test(key) || key.includes("..")) {
    return res.status(400).json({ message: "Valid storage key is required" });
  }

  const downloadName = sanitizeDownloadName(
    req.query.filename,
    path.basename(key) || "document.pdf"
  );

  try {
    const result = await r2.send(
      new GetObjectCommand({
        Bucket: getBucketName(),
        Key: key,
      })
    );

    const contentType =
      result.ContentType || "application/pdf";
    const bodyBuffer = await streamToBuffer(result.Body);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(bodyBuffer.length));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${downloadName.replace(/"/g, "")}"`
    );
    res.setHeader("Cache-Control", "private, no-store");

    return res.status(200).send(bodyBuffer);
  } catch (error: any) {
    const statusCode =
      error?.name === "NoSuchKey" ||
      error?.$metadata?.httpStatusCode === 404
        ? 404
        : 500;

    console.error("Stored file download failed:", {
      key,
      statusCode,
      message: error?.message || error,
    });

    return res.status(statusCode).json({
      message:
        statusCode === 404
          ? "This file is not available yet. It may still be generating or may need to be regenerated."
          : "Failed to download file",
    });
  }
};

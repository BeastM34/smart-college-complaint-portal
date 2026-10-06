import { Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../services/storageService';

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

// Configure in-memory storage (zero local persistent disk writes)
const storage = multer.memoryStorage();

// File filter to validate MIME types and file extensions
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback
): void => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isValidMime = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const isValidExt = ALLOWED_EXTENSIONS.includes(ext);

  if (!isValidMime || !isValidExt) {
    const error = new Error(
      `Invalid file type "${file.mimetype}". Allowed types: JPEG, PNG, WebP, and PDF.`
    );
    (error as any).code = 'INVALID_FILE_TYPE';
    return callback(error);
  }

  callback(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1, // Single file per request
  },
  fileFilter,
});

/**
 * Middleware wrapper for single attachment uploads.
 * Form field must be named "file".
 * Intercepts Multer-specific errors and returns structured JSON responses.
 */
export const handleAttachmentUpload = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const uploadSingle = upload.single('file');

  uploadSingle(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            success: false,
            message: 'File size exceeds maximum allowed limit of 5MB.',
            error: err.message,
          });
          return;
        }

        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          res.status(400).json({
            success: false,
            message: 'Unexpected file field. Please upload file with form field key "file".',
            error: err.message,
          });
          return;
        }

        res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`,
          error: err.code,
        });
        return;
      }

      if (err.code === 'INVALID_FILE_TYPE') {
        res.status(400).json({
          success: false,
          message: err.message,
          error: 'INVALID_FILE_TYPE',
        });
        return;
      }

      res.status(400).json({
        success: false,
        message: err.message || 'File upload failed.',
        error: err.name || 'UPLOAD_ERROR',
      });
      return;
    }

    next();
  });
};

import path from "node:path";
import multer from "multer";
import { AppError } from "../errors/AppError";
import { logger } from "../lib/logger";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/x-png",
  "image/webp",
  "application/octet-stream",
]);

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export const uploadEmployeeImages = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 2,
  },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (
      ALLOWED_MIME_TYPES.has(file.mimetype) ||
      ALLOWED_EXTENSIONS.has(extension)
    ) {
      callback(null, true);

      return;
    }

    logger.warn(
      {
        field: file.fieldname,
        originalName: file.originalname,
        mimetype: file.mimetype,
      },
      "upload rejected by file filter",
    );

    callback(
      new AppError(
        400,
        `Only jpeg, png and webp images are allowed. Received "${file.mimetype}" for field "${file.fieldname}"`,
      ),
    );
  },
}).fields([
  { name: "employeeImage", maxCount: 1 },
  { name: "companyImage", maxCount: 1 },
]);

/** Dedicated bounded memory upload; the face engine verifies the actual bytes. */
export const uploadAttendanceSelfie = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
    fields: 3,
    // Busboy fires the limit at the boundary; files/fields cap the actual four.
    parts: 5,
    fieldSize: 128,
  },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIME_TYPES.has(file.mimetype) || ALLOWED_EXTENSIONS.has(extension)) {
      callback(null, true);
    } else {
      callback(new AppError(400, "The selfie must be a JPEG, PNG or WebP image", "FACE_IMAGE_INVALID"));
    }
  },
}).single("selfie");

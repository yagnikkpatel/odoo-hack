import multer from "multer";
import { AppError } from "../errors/AppError";

const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  // fileSize, not fieldSize — fieldSize caps a text field and lets a large file straight
  // through, which is how the previous project's banner upload was mis-wired.
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED.includes(file.mimetype)) {
      callback(new AppError(400, "Only JPEG, PNG, WebP or GIF images are accepted.", "validation_error"));

      return;
    }

    callback(null, true);
  },
}).single("file");

/** Turns multer's own errors into the documented envelope. */
export function handleUploadErrors(error: unknown): never {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      throw new AppError(413, "That image is larger than 5 MB.", "file_too_large");
    }

    throw new AppError(400, error.message, "validation_error");
  }

  throw error;
}

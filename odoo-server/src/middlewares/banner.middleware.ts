import multer from "multer";
import { AppError } from "../errors/AppError";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const uploadBannerImg = multer({
  storage: multer.memoryStorage(),
  limits: {
    fieldSize: MAX_FILE_SIZE,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new AppError(400, "Only image upload is allowed"));
      return;
    }
    callback(null, true);
  },
});

export const uploadSingleBannerImage = uploadBannerImg.single("image");

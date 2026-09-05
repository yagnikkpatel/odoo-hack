import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { AppError } from "../errors/AppError";
import { StoredImage } from "../types/employee";

let isConfigured = false;

function configureCloudinary(): void {
  if (isConfigured) {
    return;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError(500, "Cloudinary is not configured");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  isConfigured = true;
}

export async function uploadImageToCloudinary(
  buffer: Buffer,
  folder: string,
  options: { timeoutMs?: number } = {},
): Promise<StoredImage> {
  configureCloudinary();

  const uploaded = await new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: "image", folder, ...(options.timeoutMs ? { timeout: options.timeoutMs } : {}) },
      (error, result) => {
        if (error) {
          const httpCode = (error as { http_code?: number }).http_code;
          const message = (error as { message?: string }).message;

          reject(
            httpCode && httpCode < 500
              ? new AppError(httpCode, `Image upload rejected: ${message}`)
              : error,
          );

          return;
        }

        if (!result) {
          reject(new Error("Cloudinary upload returned no result"));

          return;
        }

        resolve(result);
      },
    );

    uploadStream.end(buffer);
  });

  return {
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
  };
}

export async function deleteImageFromCloudinary(
  publicId: string,
): Promise<string> {
  configureCloudinary();

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });

  return result.result;
}

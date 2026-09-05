import { v2 as cloudinary } from "cloudinary";
import { AppError } from "../errors/AppError";

export type UploadResult = {
  secureUrl: string;
  publicId: string;
};

function configure(): void {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError(
      500,
      "Image uploads are not configured on this server.",
      "cloudinary_unconfigured",
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

export async function uploadImageToCloudinary(
  buffer: Buffer,
  options?: { folder?: string },
): Promise<UploadResult> {
  configure();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: "image", folder: options?.folder },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("cloudinary returned no result"));

          return;
        }

        resolve({ secureUrl: result.secure_url, publicId: result.public_id });
      },
    );

    stream.end(buffer);
  });
}

export async function deleteImageFromCloudinary(publicId: string): Promise<void> {
  configure();

  await cloudinary.uploader.destroy(publicId);
}

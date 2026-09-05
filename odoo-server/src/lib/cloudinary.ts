import { v2 as cloudinary } from "cloudinary";
import { AppError } from "../errors/AppError";

type UploadResult = {
  secureUrl: string;
  publicId: string;
};

export async function uploadBannerImageToCloudinary(
  buffer: Buffer,
  options?: { folder?: string },
): Promise<UploadResult> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError(500, "cloudinary is not confgured properly");
  }

  // configure
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: options?.folder,
      },

      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          secureUrl: result?.secure_url ?? "",
          publicId: result?.public_id ?? "",
        });
      },
    );

    // sending raw image bytes to cloudinary
    uploadStream.end(buffer);
  });
}

export async function deleteBannerImageFromCloudinary(
  publicId: string,
): Promise<void> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError(500, "cloudinary is not confgured properly");
  }

  // configure
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  return cloudinary.uploader.destroy(publicId);
}

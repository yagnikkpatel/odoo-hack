import { AppError } from "../errors/AppError";
import {
  clearBannersCache,
  getBannersFromCache,
  setBannerCache,
} from "../lib/bannerCache";
import { uploadBannerImageToCloudinary } from "../lib/cloudinary";
import { addDeleteCloudinaryImageJob } from "../queues/deleteCloudinaryImage.queue";
import {
  createAdminBanner,
  deleteAdminBannerById,
  findAllAdminBannersFromDB,
} from "../repositories/admin.banner.repository";
import { Banner } from "../types/banner";

export async function createAdminBannerService(
  file: Express.Multer.File | undefined,
): Promise<Banner> {
  if (!file) {
    throw new AppError(400, "Image is required");
  }

  if (!file.buffer) {
    throw new AppError(400, "Image type is invalid");
  }

  const { secureUrl, publicId } = await uploadBannerImageToCloudinary(
    file.buffer,
    {
      folder: "nodejs-capstone-project",
    },
  );

  if (!secureUrl || !publicId) {
    throw new AppError(500, "cloudinary error occured");
  }

  const banner = await createAdminBanner(secureUrl, publicId);

  // invalidate the cache

  await clearBannersCache();

  return banner;
}

export async function fetchAdminBanners(): Promise<Banner[]> {
  const getCachedBanners = await getBannersFromCache();

  if (getCachedBanners) {
    return getCachedBanners;
  }

  const banners = await findAllAdminBannersFromDB();

  // set the data to cache
  await setBannerCache(banners);

  return banners;
}

export async function deleteAdminBannerService(
  bannerId: string,
): Promise<void> {
  // delete from our db and get the public id
  const publicId = await deleteAdminBannerById(bannerId);

  if (!publicId) {
    throw new AppError(404, "Banner not found");
  }

  await clearBannersCache();

  // add BULLMQ job
  await addDeleteCloudinaryImageJob(publicId);
}

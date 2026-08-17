import { Banner, type IBanner } from "./banner.model.js"
import { uploadImageToR2 } from "../../utils/upload.js"
import { logger } from "../../utils/logger.js"
import type {
  CreateBannerBody,
  UpdateBannerBody,
} from "./banner.validation.js"

async function getBannerOrThrow(id: string): Promise<IBanner> {
  const banner = await Banner.findById(id)
  if (!banner) {
    throw Object.assign(new Error("Banner not found"), {
      status: 404,
      code: "BANNER_NOT_FOUND",
    })
  }
  return banner
}

/** Pre-upload existence check so an unknown banner can't orphan an R2 object. */
async function assertBannerExists(id: string): Promise<void> {
  await getBannerOrThrow(id)
}

/** Public callers see active banners only; staff may request all via includeInactive. */
async function listBanners(includeInactive = false): Promise<IBanner[]> {
  const query = includeInactive ? {} : { active: true }
  return Banner.find(query).sort({ order: 1, createdAt: 1 })
}

async function createBanner(input: CreateBannerBody): Promise<IBanner> {
  const banner = await Banner.create({
    ...input,
    active: input.active ?? true,
    order: input.order ?? 0,
  })
  logger.info({ id: banner._id.toString() }, "banner_created")
  return banner
}

async function updateBanner(id: string, input: UpdateBannerBody): Promise<IBanner> {
  const banner = await getBannerOrThrow(id)
  Object.assign(banner, input)
  await banner.save()
  logger.info({ id }, "banner_updated")
  return banner
}

async function deleteBanner(id: string): Promise<void> {
  await getBannerOrThrow(id)
  await Banner.deleteOne({ _id: id })
  logger.info({ id }, "banner_deleted")
}

/** Compress (Sharp → WebP) and upload a banner image, then persist its URL. */
async function uploadBannerImage(
  id: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<IBanner> {
  const imageUrl = await uploadImageToR2(fileBuffer, mimeType, {
    folder: "site",
    identifier: `banner-${id}`,
    maxWidth: 1920,
    maxHeight: 720,
    quality: 85,
  })
  const banner = await getBannerOrThrow(id)
  banner.imageUrl = imageUrl
  await banner.save()
  logger.info({ id, imageUrl }, "banner_image_uploaded")
  return banner
}

export const bannerService = {
  listBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  assertBannerExists,
  uploadBannerImage,
}

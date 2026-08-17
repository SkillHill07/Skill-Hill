import { SiteLogo, type ISiteLogo } from "./logo.model.js"
import { uploadImageToR2 } from "../../utils/upload.js"
import { logger } from "../../utils/logger.js"
import type { UpdateLogoBody } from "./logo.validation.js"

const LOGO_KEY = "primary"

/**
 * The site logo is a singleton. `getLogo` auto-creates the document on first
 * call so the public endpoint always returns 200 (frontend falls back to a
 * text logo when logoUrl is null). The upsert is atomic — a find-then-create
 * would race E11000 on the unique key under concurrent first requests.
 */
async function getLogo(): Promise<ISiteLogo> {
  return SiteLogo.findOneAndUpdate(
    { key: LOGO_KEY },
    { $setOnInsert: { key: LOGO_KEY } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ) as Promise<ISiteLogo>
}

/** Update the site logo fields (upserts the singleton document). */
async function updateLogo(input: UpdateLogoBody): Promise<ISiteLogo> {
  const logo = await SiteLogo.findOneAndUpdate(
    { key: LOGO_KEY },
    { $set: input },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  logger.info({}, "site_logo_updated")
  return logo as ISiteLogo
}

/** Compress (Sharp → WebP) and upload a new logo image, then persist its URL. */
async function uploadLogo(fileBuffer: Buffer, mimeType: string): Promise<ISiteLogo> {
  const logoUrl = await uploadImageToR2(fileBuffer, mimeType, {
    folder: "site",
    identifier: "logo",
    maxWidth: 512,
    maxHeight: 512,
    quality: 90,
  })
  return updateLogo({ logoUrl })
}

export const logoService = {
  getLogo,
  updateLogo,
  uploadLogo,
}

import { WhyChooseUsItem, type IWhyChooseUsItem } from "./whyChooseUs.model.js"
import { logger } from "../../utils/logger.js"
import type {
  CreateWhyChooseUsBody,
  UpdateWhyChooseUsBody,
} from "./whyChooseUs.validation.js"

async function getWhyChooseUsOrThrow(id: string): Promise<IWhyChooseUsItem> {
  const item = await WhyChooseUsItem.findById(id)
  if (!item) {
    throw Object.assign(new Error("Why choose us item not found"), {
      status: 404,
      code: "WHY_CHOOSE_US_NOT_FOUND",
    })
  }
  return item
}

/** Public callers see active items only; staff may request all via includeInactive. */
async function listWhyChooseUs(includeInactive = false): Promise<IWhyChooseUsItem[]> {
  const query = includeInactive ? {} : { active: true }
  return WhyChooseUsItem.find(query).sort({ order: 1, createdAt: 1 })
}

async function createWhyChooseUs(input: CreateWhyChooseUsBody): Promise<IWhyChooseUsItem> {
  const item = await WhyChooseUsItem.create({
    ...input,
    active: input.active ?? true,
    order: input.order ?? 0,
  })
  logger.info({ id: item._id.toString() }, "why_choose_us_created")
  return item
}

async function updateWhyChooseUs(
  id: string,
  input: UpdateWhyChooseUsBody,
): Promise<IWhyChooseUsItem> {
  const item = await getWhyChooseUsOrThrow(id)
  Object.assign(item, input)
  await item.save()
  logger.info({ id }, "why_choose_us_updated")
  return item
}

async function deleteWhyChooseUs(id: string): Promise<void> {
  await getWhyChooseUsOrThrow(id)
  await WhyChooseUsItem.deleteOne({ _id: id })
  logger.info({ id }, "why_choose_us_deleted")
}

export const whyChooseUsService = {
  listWhyChooseUs,
  createWhyChooseUs,
  updateWhyChooseUs,
  deleteWhyChooseUs,
}

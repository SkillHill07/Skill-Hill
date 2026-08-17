import { Faq, type IFaq } from "./faq.model.js"
import { logger } from "../../utils/logger.js"
import type { CreateFaqBody, UpdateFaqBody } from "./faq.validation.js"

async function getFaqOrThrow(id: string): Promise<IFaq> {
  const faq = await Faq.findById(id)
  if (!faq) {
    throw Object.assign(new Error("FAQ not found"), {
      status: 404,
      code: "FAQ_NOT_FOUND",
    })
  }
  return faq
}

/**
 * Public callers see active FAQs only; staff may request all via includeInactive.
 * An optional category filter narrows the list (active items only for public).
 */
async function listFaqs(includeInactive = false, category?: string): Promise<IFaq[]> {
  const query: Record<string, unknown> = includeInactive ? {} : { active: true }
  if (category) query.category = category
  return Faq.find(query).sort({ order: 1, createdAt: 1 })
}

async function createFaq(input: CreateFaqBody): Promise<IFaq> {
  const faq = await Faq.create({
    ...input,
    active: input.active ?? true,
    order: input.order ?? 0,
  })
  logger.info({ id: faq._id.toString() }, "faq_created")
  return faq
}

async function updateFaq(id: string, input: UpdateFaqBody): Promise<IFaq> {
  const faq = await getFaqOrThrow(id)
  Object.assign(faq, input)
  await faq.save()
  logger.info({ id }, "faq_updated")
  return faq
}

async function deleteFaq(id: string): Promise<void> {
  await getFaqOrThrow(id)
  await Faq.deleteOne({ _id: id })
  logger.info({ id }, "faq_deleted")
}

export const faqService = {
  listFaqs,
  createFaq,
  updateFaq,
  deleteFaq,
}

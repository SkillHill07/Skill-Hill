import "dotenv/config"
import mongoose from "mongoose"
import { config } from "../config/index.js"
import { Contest } from "../modules/contest/contest.model.js"
import { Problem } from "../modules/problem/problem.model.js"

async function verify() {
  await mongoose.connect(config.MONGODB_URI)
  console.log("connected\n")

  const mcqContests = await Contest.find({ problemType: "mcq" }).lean()
  console.log("=== MCQ Contests ===")
  for (const c of mcqContests) {
    const problems = await Problem.find({ contestId: c._id, type: "mcq" }).lean()
    const status = problems.length >= 5 ? "✅" : "❌ NEEDS MORE"
    console.log(`\n${status} ${c.title} — ${problems.length} MCQs (type: ${c.problemType})`)
    for (const p of problems) {
      console.log(`   • ${p.title} (${p.options.length} options, correct: index ${p.correctAnswer})`)
    }
  }

  const codingContests = await Contest.find({ problemType: { $in: ["coding", "mixed"] } }).lean()
  console.log("\n=== Coding/Mixed Contests ===")
  for (const c of codingContests) {
    const problems = await Problem.find({ contestId: c._id }).lean()
    console.log(`📝 ${c.title} — ${problems.length} problems (type: ${c.problemType})`)
  }

  const total = await Problem.countDocuments()
  const mcqTotal = await Problem.countDocuments({ type: "mcq" })
  const codingTotal = await Problem.countDocuments({ type: "coding" })
  console.log(`\n=== Totals ===`)
  console.log(`Problems: ${total} total (${codingTotal} coding, ${mcqTotal} mcq)`)
  console.log(`Contests: ${await Contest.countDocuments()} total`)

  await mongoose.disconnect()
}

verify().catch(console.error)

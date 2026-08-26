/**
 * Dev seed — inserts realistic dummy data into the local MongoDB so the web
 * UI can be exercised end-to-end (home, contests, workspace, leaderboard,
 * prizes, site content).
 *
 * Usage (from apps/api):  pnpm exec tsx src/scripts/seed-dev.ts
 * Idempotent-ish: demo users are upserted by email; contest/content data is
 * wiped and reinserted each run.
 */
import "dotenv/config"
import mongoose from "mongoose"
import { config } from "../config/index.js"
import { User } from "../modules/auth/auth.schema.js"
import { Contest } from "../modules/contest/contest.model.js"
import { Participation } from "../modules/contest/participation.model.js"
import { Problem } from "../modules/problem/problem.model.js"
import { Wallet } from "../modules/wallet/wallet.model.js"
import { Prize } from "../modules/prize/prize.model.js"
import { SiteLogo } from "../modules/logo/logo.model.js"
import { WhyChooseUsItem } from "../modules/whyChooseUs/whyChooseUs.model.js"
import { Banner } from "../modules/banner/banner.model.js"
import { Faq } from "../modules/faq/faq.model.js"

const DEMO_PASSWORD = "password123"

async function main(): Promise<void> {
  await mongoose.connect(config.MONGODB_URI)
  console.log("connected:", config.MONGODB_URI)

  // ---------------------------------------------------------------- users
  const userSeeds = [
    { email: "admin@skillhill.dev", firstName: "Asha", lastName: "Admin", role: "admin" as const },
    { email: "creator@skillhill.dev", firstName: "Cyril", lastName: "Creator", role: "creator" as const },
    { email: "riya@skillhill.dev", firstName: "Riya", lastName: "Sharma", role: "user" as const },
    { email: "arjun@skillhill.dev", firstName: "Arjun", lastName: "Patel", role: "user" as const },
    { email: "meera@skillhill.dev", firstName: "Meera", lastName: "Iyer", role: "user" as const },
    { email: "dev@skillhill.dev", firstName: "Devika", lastName: "Nair", role: "user" as const },
    { email: "kabir@skillhill.dev", firstName: "Kabir", lastName: "Singh", role: "user" as const },
    { email: "test@skillhill.dev", firstName: "Test", lastName: "User", role: "user" as const },
  ]

  const users: Record<string, InstanceType<typeof User>> = {}
  for (const s of userSeeds) {
    let u = await User.findOne({ email: s.email })
    if (!u) {
      u = await User.create({ ...s, password: DEMO_PASSWORD })
      console.log("created user:", s.email)
    }
    users[s.email] = u
  }

  // ------------------------------------------------------------- clean slate
  await Promise.all([
    Contest.deleteMany({}),
    Problem.deleteMany({}),
    Participation.deleteMany({}),
    Prize.deleteMany({}),
    WhyChooseUsItem.deleteMany({}),
    Banner.deleteMany({}),
    Faq.deleteMany({}),
    SiteLogo.deleteMany({}),
  ])

  // ---------------------------------------------------------------- contests
  const now = Date.now()
  const admin = users["admin@skillhill.dev"]

  const liveContest = await Contest.create({
    title: "Winter Sprint Challenge",
    slug: "winter-sprint-challenge",
    description:
      "A fast-paced 90-minute sprint through three classic algorithm problems and one quick-fire MCQ. Warm up on arrays, then climb into graph territory before the clock runs out.",
    problemIds: [],
    startTime: new Date(now - 30 * 60 * 1000),
    endTime: new Date(now + 90 * 60 * 1000),
    type: "paid",
    entryFee: 2000,
    prizePool: 80000,
    maxParticipants: 200,
    status: "active",
    rules:
      "1. All submissions are judged automatically against public + hidden test cases.\n2. Best score per problem counts; ties broken by earliest submission.\n3. No external help — this is a skill contest, keep it fair.\n4. Prizes are credited to wallets within minutes of settlement.",
    createdBy: admin._id,
  })

  const upcomingContest = await Contest.create({
    title: "Algorithms Open — February",
    slug: "algorithms-open-february",
    description:
      "Our flagship monthly open. Five problems across dynamic programming, greedy and number theory. ₹20 to enter, real cash for the top five.",
    problemIds: [],
    startTime: new Date(now + 3 * 24 * 60 * 60 * 1000),
    endTime: new Date(now + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
    type: "paid",
    entryFee: 2000,
    prizePool: 150000,
    maxParticipants: null,
    status: "active",
    rules: "Standard contest rules apply. Solutions are judged automatically.",
    createdBy: admin._id,
  })

  const freePractice = await Contest.create({
    title: "Weekend Warmup (Free)",
    slug: "weekend-warmup-free",
    description: "A free-entry warmup contest for newcomers. No fee, small prize pool, all fun.",
    problemIds: [],
    startTime: new Date(now - 7 * 24 * 60 * 60 * 1000),
    endTime: new Date(now + 2 * 24 * 60 * 60 * 1000),
    type: "free",
    entryFee: 0,
    prizePool: 5000,
    maxParticipants: null,
    status: "active",
    rules: "Free contest — just join and solve.",
    createdBy: admin._id,
  })

  const settledContest = await Contest.create({
    title: "January Weekly #4",
    slug: "january-weekly-4",
    description: "Settled weekly contest — congratulations to the winners!",
    problemIds: [],
    startTime: new Date(now - 8 * 24 * 60 * 60 * 1000),
    endTime: new Date(now - 8 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
    type: "paid",
    entryFee: 2000,
    prizePool: 60000,
    maxParticipants: 100,
    status: "settled",
    rules: "",
    createdBy: admin._id,
  })

  // ---------------------------------------------------------------- problems
  const sumProblem = await Problem.create({
    title: "Two Sum Return",
    slug: "two-sum-return",
    contestId: liveContest._id,
    type: "coding",
    difficulty: "easy",
    points: 50,
    timeLimit: 2000,
    memoryLimit: 256,
    languageSupport: ["javascript", "typescript", "python", "cpp"],
    solutionTemplate: {
      javascript:
        "function main() {\n  const input = require('fs').readFileSync(0, 'utf8').trim().split('\\n');\n  // TODO: solve\n  console.log(input[0]);\n}\nmain();\n",
      python: "def main():\n    # TODO: solve\n    print(input())\n\nmain()\n",
    },
    description:
      "Given an array of integers and a target, return the indices of the two numbers that add up to the target.\n\nInput format:\n- First line: n and target\n- Second line: n space-separated integers\n\nOutput:\n- Two indices (0-based), ascending, space-separated.",
    options: [],
    correctAnswer: null,
    testCases: [
      { input: "4 9\n2 7 11 15", expectedOutput: "0 1", isPublic: true },
      { input: "3 6\n3 2 4", expectedOutput: "1 2", isPublic: true },
      { input: "5 10\n1 3 5 7 9", expectedOutput: "1 3", isPublic: false },
    ],
    imageUrls: [],
  })

  const graphProblem = await Problem.create({
    title: "Island Hopping",
    slug: "island-hopping",
    contestId: liveContest._id,
    type: "coding",
    difficulty: "medium",
    points: 100,
    timeLimit: 3000,
    memoryLimit: 256,
    languageSupport: ["javascript", "python", "cpp"],
    solutionTemplate: {},
    description:
      "Count the number of islands in a binary grid. An island is a group of connected 1s (horizontally or vertically).\n\nInput:\n- First line: rows r and columns c\n- Next r lines: c characters of 0/1\n\nOutput:\n- Number of islands.",
    options: [],
    correctAnswer: null,
    testCases: [
      {
        input: "4 5\n11000\n11000\n00100\n00011",
        expectedOutput: "3",
        isPublic: true,
      },
      { input: "2 2\n01\n10", expectedOutput: "2", isPublic: false },
    ],
    imageUrls: [],
  })

  const mcqProblem = await Problem.create({
    title: "Big-O Quickfire",
    slug: "big-o-quickfire",
    contestId: liveContest._id,
    type: "mcq",
    difficulty: "easy",
    points: 25,
    timeLimit: 1000,
    memoryLimit: 64,
    languageSupport: [],
    solutionTemplate: {},
    description: "What is the average-case time complexity of binary search on a sorted array of n elements?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    correctAnswer: 1,
    testCases: [],
    imageUrls: [],
  })

  const dpProblem = await Problem.create({
    title: "Staircase Paths",
    slug: "staircase-paths",
    contestId: upcomingContest._id,
    type: "coding",
    difficulty: "medium",
    points: 75,
    timeLimit: 2000,
    memoryLimit: 256,
    languageSupport: ["javascript", "python"],
    solutionTemplate: {},
    description:
      "A staircase has n steps. You can climb 1 or 2 steps at a time. Count distinct ways to reach the top.\n\nInput: one integer n.\nOutput: number of ways modulo 1e9+7.",
    options: [],
    correctAnswer: null,
    testCases: [
      { input: "3", expectedOutput: "3", isPublic: true },
      { input: "5", expectedOutput: "8", isPublic: false },
    ],
    imageUrls: [],
  })

  liveContest.problemIds = [sumProblem._id, graphProblem._id, mcqProblem._id]
  await liveContest.save()
  upcomingContest.problemIds = [dpProblem._id]
  await upcomingContest.save()

  const settledProblems = await Problem.create([
    {
      title: "Reverse Words",
      slug: "jan4-reverse-words",
      contestId: settledContest._id,
      type: "coding",
      difficulty: "easy",
      points: 50,
      timeLimit: 2000,
      memoryLimit: 256,
      languageSupport: ["javascript", "python"],
      solutionTemplate: {},
      description: "Reverse the words in a sentence.",
      options: [],
      correctAnswer: null,
      testCases: [{ input: "hello world", expectedOutput: "world hello", isPublic: true }],
      imageUrls: [],
    },
  ])
  settledContest.problemIds = [settledProblems[0]._id]
  await settledContest.save()

  // ----------------------------------------------------------- participation
  const players = [
    users["riya@skillhill.dev"],
    users["arjun@skillhill.dev"],
    users["meera@skillhill.dev"],
    users["dev@skillhill.dev"],
    users["kabir@skillhill.dev"],
  ]
  const scores = [125, 125, 75, 50, 25]
  await Participation.insertMany(
    players.map((p, i) => ({
      userId: p._id,
      contestId: settledContest._id,
      joinedAt: new Date(now - 8 * 24 * 60 * 60 * 1000 - 3600_000),
      startedAt: new Date(now - 8 * 24 * 60 * 60 * 1000),
      submittedAt: new Date(now - 8 * 24 * 60 * 60 * 1000 + (i + 1) * 120_000),
      totalScore: scores[i],
      rank: i < 2 ? 1 : i + 1,
      status: "completed",
    })),
  )
  // Live participants in the running contest
  await Participation.insertMany(
    players.slice(0, 3).map((p, i) => ({
      userId: p._id,
      contestId: liveContest._id,
      joinedAt: new Date(now - 25 * 60 * 1000),
      startedAt: new Date(now - 24 * 60 * 1000),
      submittedAt: new Date(now - 10 * 60 * 1000),
      totalScore: [175, 150, 50][i],
      rank: null,
      status: "started",
    })),
  )

  // ------------------------------------------------------------------ prizes
  const prizeRows = [
    { rank: 1, share: 0.4, users: [players[0], players[1]] }, // tie split
    { rank: 3, share: 0.15, users: [players[2]] },
    { rank: 4, share: 0.05, users: [players[3]] },
    { rank: 5, share: 0.05, users: [players[4]] },
  ]
  const netPool = Math.round(60000 * (1 - 0.1))
  for (const row of prizeRows) {
    for (const u of row.users) {
      await Prize.create({
        contestId: settledContest._id,
        userId: u._id,
        rank: row.rank,
        prizeAmount: Math.round((netPool * row.share) / row.users.length),
        status: "credited",
        failureReason: null,
        creditedAt: new Date(now - 7 * 24 * 60 * 60 * 1000),
      })
    }
  }

  // ----------------------------------------------------------------- wallets
  for (const [i, u] of players.entries()) {
    const existing = await Wallet.findOne({ userId: u._id })
    if (!existing) {
      await Wallet.create({
        userId: u._id,
        balance: [52000, 26000, 9000, 5000, 2500][i],
        locked: 0,
        totalDeposited: 2000,
        totalWithdrawn: 0,
        totalWon: [20800, 20800, 7200, 2400, 2400][i],
        totalSpentOnFees: 2000,
        status: "active",
      })
    }
  }

  // ------------------------------------------------------------ site content
  await SiteLogo.create({
    key: "primary",
    logoUrl: null,
    altText: "SkillHill",
    tagline: "₹20 coding contests · real cash prizes",
  })

  await WhyChooseUsItem.create([
    { title: "Real prizes, real stakes", description: "Every paid contest pools entries into a transparent prize table — winners are paid automatically within minutes of settlement.", icon: "trophy", order: 1, isActive: true },
    { title: "Live leaderboards", description: "Watch your rank move in real time as submissions are judged. Scores update the moment your code passes hidden tests.", icon: "users", order: 2, isActive: true },
    { title: "Wallet-first payouts", description: "Winnings land in your SkillHill wallet instantly. Withdraw to any verified UPI id once KYC is approved.", icon: "wallet", order: 3, isActive: true },
    { title: "Sandboxed judging", description: "Your code runs in isolated containers with strict time and memory limits — exactly like the big platforms.", icon: "sparkles", order: 4, isActive: true },
  ])

  await Banner.create([
    {
      title: "Winter Sprint Challenge is LIVE",
      subtitle: "90 minutes, 4 problems, ₹80,000 pool — join before the timer starts.",
      imageUrl: null,
      ctaText: "Join now",
      ctaLink: `/contests/${liveContest._id}`,
      order: 1,
      isActive: true,
    },
  ])

  await Faq.create([
    { question: "How much does it cost to join a contest?", answer: "Most contests cost ₹20 to enter. Some warmup contests are completely free. The entry fee goes into the prize pool minus a small platform fee.", category: "Payments", order: 1, isActive: true },
    { question: "When do I get my prize money?", answer: "Prizes are calculated and credited straight to your SkillHill wallet the moment a contest settles — usually within a few minutes of the timer ending.", category: "Prizes", order: 2, isActive: true },
    { question: "How do I withdraw my winnings?", answer: "Complete KYC (PAN verification) from your profile, then request a withdrawal from the wallet page. Payouts go to your verified UPI id.", category: "Withdrawals", order: 3, isActive: true },
    { question: "What happens if two people have the same score?", answer: "Ties share the prize money equally, and the earlier submission wins the higher rank for tie-breaking purposes.", category: "Rules", order: 4, isActive: true },
    { question: "Is my payment information safe?", answer: "All payments run through Razorpay — we never see or store your card details. Wallet balances use an append-only ledger with atomic transactions.", category: "Payments", order: 5, isActive: true },
    { question: "Can I practice without paying?", answer: "Yes! The practice library contains every problem from past contests, free to solve with the full editor and judge.", category: "Practice", order: 6, isActive: true },
  ])

  console.log("\nSeed complete:")
  console.log(`  users: ${userSeeds.length} (login: test@skillhill.dev / ${DEMO_PASSWORD})`)
  console.log(`  contests: live=${liveContest.title}, upcoming=${upcomingContest.title}, settled=${settledContest.title}`)
  console.log(`  problems: ${await Problem.countDocuments()}`)
  console.log(`  participations: ${await Participation.countDocuments()}`)
  console.log(`  prizes: ${await Prize.countDocuments()}`)
  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error("Seed failed:", err)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})

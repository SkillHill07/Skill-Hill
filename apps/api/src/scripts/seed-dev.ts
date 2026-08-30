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

  // ── 1. Live paid coding contest ──
  const liveContest = await Contest.create({
    title: "Winter Sprint Challenge",
    slug: "winter-sprint-challenge",
    description:
      "A fast-paced 90-minute sprint through classic algorithm problems. Warm up on arrays, then climb into graph territory before the clock runs out.",
    problemIds: [],
    startTime: new Date(now - 30 * 60 * 1000),
    endTime: new Date(now + 90 * 60 * 1000),
    type: "paid",
    problemType: "mixed",
    entryFee: 2000,
    prizePool: 80000,
    maxParticipants: 200,
    status: "active",
    rules:
      "1. All submissions are judged automatically against public + hidden test cases.\n2. Best score per problem counts; ties broken by earliest submission.\n3. No external help — this is a skill contest, keep it fair.\n4. Prizes are credited to wallets within minutes of settlement.",
    createdBy: admin._id,
  })

  // ── 2. Upcoming paid coding contest ──
  const upcomingContest = await Contest.create({
    title: "Algorithms Open — February",
    slug: "algorithms-open-february",
    description:
      "Our flagship monthly open. Five problems across dynamic programming, greedy and number theory. ₹20 to enter, real cash for the top five.",
    problemIds: [],
    startTime: new Date(now + 3 * 24 * 60 * 60 * 1000),
    problemType: "coding",
    endTime: new Date(now + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
    type: "paid",
    entryFee: 2000,
    prizePool: 150000,
    maxParticipants: null,
    status: "active",
    rules: "Standard contest rules apply. Solutions are judged automatically.",
    createdBy: admin._id,
  })

  // ── 3. Free coding practice contest ──
  const freePractice = await Contest.create({
    title: "Weekend Warmup (Free)",
    slug: "weekend-warmup-free",
    description: "A free-entry warmup contest for newcomers. No fee, small prize pool, all fun.",
    problemIds: [],
    startTime: new Date(now - 7 * 24 * 60 * 60 * 1000),
    endTime: new Date(now + 2 * 24 * 60 * 60 * 1000),
    type: "free",
    problemType: "coding",
    entryFee: 0,
    prizePool: 5000,
    maxParticipants: null,
    status: "active",
    rules: "Free contest — just join and solve.",
    createdBy: admin._id,
  })

  // ── 4. Settled coding contest ──
  const settledContest = await Contest.create({
    title: "January Weekly #4",
    slug: "january-weekly-4",
    description: "Settled weekly contest — congratulations to the winners!",
    problemIds: [],
    startTime: new Date(now - 8 * 24 * 60 * 60 * 1000),
    endTime: new Date(now - 8 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
    type: "paid",
    problemType: "coding",
    entryFee: 2000,
    prizePool: 60000,
    maxParticipants: 100,
    status: "settled",
    rules: "",
    createdBy: admin._id,
  })

  // ── 5. FREE MCQ timed contest — Data Structures Quickfire ──
  const mcqFreeContest = await Contest.create({
    title: "Data Structures Quickfire",
    slug: "data-structures-quickfire",
    description:
      "Test your knowledge of arrays, linked lists, trees, and hash maps. 10 MCQs, 10 minutes — fast fingers and fast thinking!",
    problemIds: [],
    startTime: new Date(now - 2 * 60 * 60 * 1000),
    endTime: new Date(now + 4 * 60 * 60 * 1000),
    type: "free",
    problemType: "mcq",
    entryFee: 0,
    prizePool: 3000,
    maxParticipants: null,
    status: "active",
    rules: "10 multiple-choice questions. 1 point each. 10-minute timer. No negative marking.",
    createdBy: admin._id,
  })

  // ── 6. FREE MCQ timed contest — Big-O & Complexity ──
  const mcqComplexityContest = await Contest.create({
    title: "Big-O & Complexity Quiz",
    slug: "big-o-complexity-quiz",
    description:
      "How well do you know your time and space complexities? 8 questions covering sorting, searching, and graph algorithms.",
    problemIds: [],
    startTime: new Date(now - 1 * 60 * 60 * 1000),
    endTime: new Date(now + 5 * 60 * 60 * 1000),
    type: "free",
    problemType: "mcq",
    entryFee: 0,
    prizePool: 2000,
    maxParticipants: null,
    status: "active",
    rules: "8 MCQs, 8 minutes. 1 point each. Choose the best answer.",
    createdBy: admin._id,
  })

  // ── 7. FREE MCQ timed contest — JavaScript Fundamentals ──
  const mcqJsContest = await Contest.create({
    title: "JavaScript Fundamentals Quiz",
    slug: "javascript-fundamentals-quiz",
    description:
      "Closures, event loop, prototypal inheritance, and more. 6 quick-fire MCQs to test your JS chops.",
    problemIds: [],
    startTime: new Date(now + 1 * 24 * 60 * 60 * 1000),
    endTime: new Date(now + 1 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
    type: "free",
    problemType: "mcq",
    entryFee: 0,
    prizePool: 1500,
    maxParticipants: null,
    status: "active",
    rules: "6 MCQs, 90 seconds each. 1 point per correct answer.",
    createdBy: admin._id,
  })

  // ── 8. PAID MCQ timed contest — System Design Concepts ──
  const mcqPaidContest = await Contest.create({
    title: "System Design Concepts",
    slug: "system-design-concepts",
    description:
      "CAP theorem, sharding, caching strategies, and load balancing. 10 premium MCQs for serious engineers. ₹20 entry, ₹5,000 prize pool.",
    problemIds: [],
    startTime: new Date(now + 2 * 24 * 60 * 60 * 1000),
    endTime: new Date(now + 2 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000),
    type: "paid",
    problemType: "mcq",
    entryFee: 2000,
    prizePool: 50000,
    maxParticipants: 100,
    status: "active",
    rules: "10 MCQs, 15-minute timer. ₹20 entry. Top 3 win prize money.",
    createdBy: admin._id,
  })

  // ── 9. Live coding contest — Strings & Patterns ──
  const stringsContest = await Contest.create({
    title: "Strings & Patterns Sprint",
    slug: "strings-patterns-sprint",
    description:
      "String manipulation, pattern matching, and substring problems. 3 coding problems in 60 minutes.",
    problemIds: [],
    startTime: new Date(now - 15 * 60 * 1000),
    problemType: "coding",
    endTime: new Date(now + 45 * 60 * 1000),
    type: "free",
    entryFee: 0,
    prizePool: 3000,
    maxParticipants: null,
    status: "active",
    rules: "Free coding contest. Best score wins.",
    createdBy: admin._id,
  })

  // ================================================================ PROBLEMS

  // ── Live contest coding problems ──
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
    mcqLayout: "list",
    testCases: [],
    imageUrls: [],
  })

  // ── Upcoming contest problems ──
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

  const greedyProblem = await Problem.create({
    title: "Activity Selection",
    slug: "activity-selection",
    contestId: upcomingContest._id,
    type: "coding",
    difficulty: "hard",
    points: 150,
    timeLimit: 4000,
    memoryLimit: 256,
    languageSupport: ["javascript", "python", "cpp"],
    solutionTemplate: {},
    description:
      "Given n activities with start and end times, select the maximum number of non-overlapping activities.\n\nInput:\n- First line: n\n- Next n lines: start end\n\nOutput:\n- Maximum number of activities.",
    options: [],
    correctAnswer: null,
    testCases: [
      { input: "4\n1 2\n3 4\n0 6\n5 7", expectedOutput: "3", isPublic: true },
      { input: "3\n1 4\n2 3\n3 5", expectedOutput: "2", isPublic: false },
    ],
    imageUrls: [],
  })

  liveContest.problemIds = [sumProblem._id, graphProblem._id, mcqProblem._id]
  await liveContest.save()
  upcomingContest.problemIds = [dpProblem._id, greedyProblem._id]
  await upcomingContest.save()

  // ── Settled contest problems ──
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

  // ── Free practice coding problems ──
  const freeProblems = await Problem.create([
    {
      title: "FizzBuzz",
      slug: "fizzbuzz",
      contestId: freePractice._id,
      type: "coding",
      difficulty: "easy",
      points: 25,
      timeLimit: 1000,
      memoryLimit: 128,
      languageSupport: ["javascript", "python", "cpp"],
      solutionTemplate: {
        javascript:
          "function main() {\n  const n = parseInt(require('fs').readFileSync(0, 'utf8').trim());\n  for (let i = 1; i <= n; i++) {\n    if (i % 15 === 0) console.log('FizzBuzz');\n    else if (i % 3 === 0) console.log('Fizz');\n    else if (i % 5 === 0) console.log('Buzz');\n    else console.log(i);\n  }\n}\nmain();\n",
        python:
          "def main():\n    n = int(input())\n    for i in range(1, n + 1):\n        if i % 15 == 0: print('FizzBuzz')\n        elif i % 3 == 0: print('Fizz')\n        elif i % 5 == 0: print('Buzz')\n        else: print(i)\n\nmain()\n",
      },
      description:
        "Print numbers from 1 to n. For multiples of 3 print 'Fizz', for multiples of 5 print 'Buzz', for multiples of both print 'FizzBuzz'. Otherwise print the number.\n\nInput: One integer n.\nOutput: n lines, one per number.",
      options: [],
      correctAnswer: null,
      testCases: [
        { input: "5", expectedOutput: "1\n2\nFizz\n4\nBuzz", isPublic: true },
        { input: "15", expectedOutput: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz", isPublic: false },
      ],
      imageUrls: [],
    },
    {
      title: "Palindrome Check",
      slug: "palindrome-check",
      contestId: freePractice._id,
      type: "coding",
      difficulty: "easy",
      points: 25,
      timeLimit: 1000,
      memoryLimit: 128,
      languageSupport: ["javascript", "python", "cpp"],
      solutionTemplate: {},
      description:
        "Check if a given string is a palindrome (reads the same forwards and backwards). Ignore case.\n\nInput: A single string.\nOutput: 'true' if palindrome, 'false' otherwise.",
      options: [],
      correctAnswer: null,
      testCases: [
        { input: "racecar", expectedOutput: "true", isPublic: true },
        { input: "hello", expectedOutput: "false", isPublic: true },
        { input: "Madam", expectedOutput: "true", isPublic: false },
      ],
      imageUrls: [],
    },
    {
      title: "Max Subarray Sum",
      slug: "max-subarray-sum",
      contestId: freePractice._id,
      type: "coding",
      difficulty: "medium",
      points: 50,
      timeLimit: 2000,
      memoryLimit: 256,
      languageSupport: ["javascript", "python", "cpp"],
      solutionTemplate: {},
      description:
        "Given an array of integers, find the contiguous subarray with the largest sum and return that sum.\n\nInput: First line n, second line n integers.\nOutput: The maximum subarray sum.",
      options: [],
      correctAnswer: null,
      testCases: [
        { input: "5\n-2 1 -3 4 -1", expectedOutput: "6", isPublic: true },
        { input: "3\n1 2 3", expectedOutput: "6", isPublic: false },
      ],
      imageUrls: [],
    },
    {
      title: "Binary Search",
      slug: "binary-search",
      contestId: freePractice._id,
      type: "coding",
      difficulty: "medium",
      points: 50,
      timeLimit: 1500,
      memoryLimit: 128,
      languageSupport: ["javascript", "python", "cpp"],
      solutionTemplate: {},
      description:
        "Implement binary search. Given a sorted array and a target value, return the index of the target. Return -1 if not found.\n\nInput: First line n and target, second line n sorted integers.\nOutput: Index of target or -1.",
      options: [],
      correctAnswer: null,
      testCases: [
        { input: "5 3\n1 2 3 4 5", expectedOutput: "2", isPublic: true },
        { input: "5 6\n1 2 3 4 5", expectedOutput: "-1", isPublic: false },
      ],
      imageUrls: [],
    },
  ])
  freePractice.problemIds = freeProblems.map((p) => p._id)
  await freePractice.save()

  // ── Strings contest problems ──
  const stringsProblems = await Problem.create([
    {
      title: "Anagram Checker",
      slug: "anagram-checker",
      contestId: stringsContest._id,
      type: "coding",
      difficulty: "easy",
      points: 25,
      timeLimit: 1000,
      memoryLimit: 128,
      languageSupport: ["javascript", "python"],
      solutionTemplate: {},
      description: "Check if two strings are anagrams of each other.\n\nInput: Two lines, each a string.\nOutput: 'true' or 'false'.",
      options: [],
      correctAnswer: null,
      testCases: [
        { input: "listen\nsilent", expectedOutput: "true", isPublic: true },
        { input: "hello\nworld", expectedOutput: "false", isPublic: true },
      ],
      imageUrls: [],
    },
    {
      title: "Longest Substring",
      slug: "longest-substring",
      contestId: stringsContest._id,
      type: "coding",
      difficulty: "medium",
      points: 75,
      timeLimit: 2000,
      memoryLimit: 256,
      languageSupport: ["javascript", "python"],
      solutionTemplate: {},
      description: "Find the length of the longest substring without repeating characters.\n\nInput: A string.\nOutput: Integer length.",
      options: [],
      correctAnswer: null,
      testCases: [
        { input: "abcabcbb", expectedOutput: "3", isPublic: true },
        { input: "bbbbb", expectedOutput: "1", isPublic: false },
      ],
      imageUrls: [],
    },
    {
      title: "String Compression",
      slug: "string-compression",
      contestId: stringsContest._id,
      type: "coding",
      difficulty: "hard",
      points: 100,
      timeLimit: 3000,
      memoryLimit: 256,
      languageSupport: ["javascript", "python"],
      solutionTemplate: {},
      description: "Implement basic string compression using counts of repeated characters.\n\nInput: A string.\nOutput: Compressed string (e.g., 'aabcccccaaa' → 'a2b1c5a3').",
      options: [],
      correctAnswer: null,
      testCases: [
        { input: "aabcccccaaa", expectedOutput: "a2b1c5a3", isPublic: true },
        { input: "abcdef", expectedOutput: "abcdef", isPublic: false },
      ],
      imageUrls: [],
    },
  ])
  stringsContest.problemIds = stringsProblems.map((p) => p._id)
  await stringsContest.save()

  // ── MCQ Free Contest: Data Structures Quickfire (10 questions) ──
  const dsMcqs = await Problem.create([
    {
      title: "Array Access Time",
      slug: "ds-array-access",
      contestId: mcqFreeContest._id,
      type: "mcq",
      difficulty: "easy",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "What is the time complexity of accessing an element by index in an array?",
      options: ["O(1)", "O(n)", "O(log n)", "O(n²)"],
      correctAnswer: 0,
    mcqLayout: "grid",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Linked List Insertion",
      slug: "ds-linked-list-insert",
      contestId: mcqFreeContest._id,
      type: "mcq",
      difficulty: "easy",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "What is the time complexity of inserting at the head of a singly linked list?",
      options: ["O(1)", "O(n)", "O(log n)", "O(n²)"],
      correctAnswer: 0,
    mcqLayout: "grid",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Binary Tree Height",
      slug: "ds-binary-tree-height",
      contestId: mcqFreeContest._id,
      type: "mcq",
      difficulty: "medium",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "What is the maximum number of nodes in a binary tree of height h?",
      options: ["2^h", "2^(h+1) - 1", "h²", "2h"],
      correctAnswer: 1,
    mcqLayout: "grid",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Hash Table Collision",
      slug: "ds-hash-collision",
      contestId: mcqFreeContest._id,
      type: "mcq",
      difficulty: "medium",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "Which technique stores colliding elements in a separate linked list?",
      options: ["Open addressing", "Chaining", "Rehashing", "Clustering"],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Stack Operations",
      slug: "ds-stack-operations",
      contestId: mcqFreeContest._id,
      type: "mcq",
      difficulty: "easy",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "Which data structure follows LIFO (Last In, First Out) order?",
      options: ["Queue", "Stack", "Array", "Linked List"],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "BST Search",
      slug: "ds-bst-search",
      contestId: mcqFreeContest._id,
      type: "mcq",
      difficulty: "medium",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "What is the average time complexity of search in a balanced BST?",
      options: ["O(1)", "O(n)", "O(log n)", "O(n log n)"],
      correctAnswer: 2,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Heap Property",
      slug: "ds-heap-property",
      contestId: mcqFreeContest._id,
      type: "mcq",
      difficulty: "medium",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "In a min-heap, which property holds for every node?",
      options: [
        "Parent is greater than children",
        "Parent is less than or equal to children",
        "All leaves are at the same level",
        "Nodes are sorted left to right",
      ],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Graph BFS",
      slug: "ds-graph-bfs",
      contestId: mcqFreeContest._id,
      type: "mcq",
      difficulty: "medium",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "Which data structure is used in BFS traversal of a graph?",
      options: ["Stack", "Queue", "Priority Queue", "Deque"],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Trie Usage",
      slug: "ds-trie-usage",
      contestId: mcqFreeContest._id,
      type: "mcq",
      difficulty: "hard",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "A Trie is most efficiently used for which operation?",
      options: [
        "Finding the maximum element",
        "Prefix-based string search",
        "Sorting integers",
        "Finding the median",
      ],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Disjoint Set",
      slug: "ds-disjoint-set",
      contestId: mcqFreeContest._id,
      type: "mcq",
      difficulty: "hard",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "Which operation makes Union-Find nearly O(1) amortized?",
      options: [
        "Path compression + union by rank",
        "Balancing the tree",
        "Hashing the elements",
        "Using a Fibonacci heap",
      ],
      correctAnswer: 0,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
  ])
  mcqFreeContest.problemIds = dsMcqs.map((p) => p._id)
  await mcqFreeContest.save()

  // ── MCQ Free Contest: Big-O & Complexity (8 questions) ──
  const bigOMcqs = await Problem.create([
    {
      title: "Merge Sort Complexity",
      slug: "bigo-merge-sort",
      contestId: mcqComplexityContest._id,
      type: "mcq",
      difficulty: "easy",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "What is the average time complexity of merge sort?",
      options: ["O(n)", "O(n log n)", "O(n²)", "O(log n)"],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Quick Sort Worst Case",
      slug: "bigo-quicksort-worst",
      contestId: mcqComplexityContest._id,
      type: "mcq",
      difficulty: "medium",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "What is the worst-case time complexity of quicksort?",
      options: ["O(n log n)", "O(n)", "O(n²)", "O(2^n)"],
      correctAnswer: 2,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Space Complexity of DFS",
      slug: "bigo-dfs-space",
      contestId: mcqComplexityContest._id,
      type: "mcq",
      difficulty: "medium",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "What is the space complexity of DFS on a graph with V vertices?",
      options: ["O(1)", "O(V)", "O(V²)", "O(E)"],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Amortized Push",
      slug: "bigo-amortized-push",
      contestId: mcqComplexityContest._id,
      type: "mcq",
      difficulty: "medium",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "What is the amortized time complexity of push operations in a dynamic array?",
      options: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
      correctAnswer: 0,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Dijkstra Complexity",
      slug: "bigo-dijkstra",
      contestId: mcqComplexityContest._id,
      type: "mcq",
      difficulty: "hard",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "What is the time complexity of Dijkstra's algorithm with a binary heap?",
      options: ["O(V²)", "O((V + E) log V)", "O(V log V)", "O(E log E)"],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Recurrence Relation",
      slug: "bigo-recurrence",
      contestId: mcqComplexityContest._id,
      type: "mcq",
      difficulty: "hard",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "Solve: T(n) = 2T(n/2) + n. What is T(n)?",
      options: ["O(n)", "O(n log n)", "O(n²)", "O(log n)"],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "NP-Complete Problem",
      slug: "bigo-np-complete",
      contestId: mcqComplexityContest._id,
      type: "mcq",
      difficulty: "hard",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "Which of these is NP-Complete?",
      options: [
        "Shortest path in a graph",
        "Traveling Salesman Problem (decision version)",
        "Binary search",
        "Merge sort",
      ],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Master Theorem",
      slug: "bigo-master-theorem",
      contestId: mcqComplexityContest._id,
      type: "mcq",
      difficulty: "hard",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "Using the Master Theorem, solve T(n) = 4T(n/2) + n².",
      options: ["O(n²)", "O(n² log n)", "O(n³)", "O(log n)"],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
  ])
  mcqComplexityContest.problemIds = bigOMcqs.map((p) => p._id)
  await mcqComplexityContest.save()

  // ── MCQ Free Contest: JavaScript Fundamentals (6 questions) ──
  const jsMcqs = await Problem.create([
    {
      title: "Closure Scope",
      slug: "js-closure-scope",
      contestId: mcqJsContest._id,
      type: "mcq",
      difficulty: "easy",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "What does a closure in JavaScript give you access to?",
      options: [
        "The global scope only",
        "The outer function's scope after the outer function has returned",
        "Only the current block scope",
        "No extra scope",
      ],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Event Loop",
      slug: "js-event-loop",
      contestId: mcqJsContest._id,
      type: "mcq",
      difficulty: "medium",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "In which order does JavaScript execute: microtasks, macrotasks, rendering?",
      options: [
        "Macrotasks → Microtasks → Rendering",
        "Microtasks → Rendering → Macrotasks",
        "Rendering → Macrotasks → Microtasks",
        "Microtasks → Macrotasks → Rendering",
      ],
      correctAnswer: 3,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "typeof null",
      slug: "js-typeof-null",
      contestId: mcqJsContest._id,
      type: "mcq",
      difficulty: "easy",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "What does `typeof null` return in JavaScript?",
      options: ['"null"', '"undefined"', '"object"', '"boolean"'],
      correctAnswer: 2,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Promise Resolution",
      slug: "js-promise-resolution",
      contestId: mcqJsContest._id,
      type: "mcq",
      difficulty: "medium",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "What is the output of: `Promise.resolve(1).then(console.log)`?",
      options: ["1", "Promise { <fulfilled>: 1 }", "undefined", "TypeError"],
      correctAnswer: 0,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Prototypal Inheritance",
      slug: "js-prototype",
      contestId: mcqJsContest._id,
      type: "mcq",
      difficulty: "medium",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "How does JavaScript implement inheritance?",
      options: ["Class-based", "Prototypal", "Multiple inheritance", "Trait-based"],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Strict Equality",
      slug: "js-strict-equality",
      contestId: mcqJsContest._id,
      type: "mcq",
      difficulty: "easy",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: 'What is the result of `0 === false` in JavaScript?',
      options: ["true", "false", "TypeError", "undefined"],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
  ])
  mcqJsContest.problemIds = jsMcqs.map((p) => p._id)
  await mcqJsContest.save()

  // ── MCQ Paid Contest: System Design Concepts (10 questions) ──
  const sysDesignMcqs = await Problem.create([
    {
      title: "CAP Theorem",
      slug: "sd-cap-theorem",
      contestId: mcqPaidContest._id,
      type: "mcq",
      difficulty: "medium",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "The CAP theorem states that a distributed system can guarantee at most two of three properties. Which are they?",
      options: [
        "Consistency, Availability, Partition tolerance",
        "Consistency, Availability, Performance",
        "Concurrency, Accessibility, Partition tolerance",
        "Consistency, Authenticity, Performance",
      ],
      correctAnswer: 0,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Database Sharding",
      slug: "sd-sharding",
      contestId: mcqPaidContest._id,
      type: "mcq",
      difficulty: "medium",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "What is database sharding?",
      options: [
        "Replicating the same data across multiple servers",
        "Splitting data horizontally across multiple databases",
        "Encrypting data at rest",
        "Compressing data before storage",
      ],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Load Balancer",
      slug: "sd-load-balancer",
      contestId: mcqPaidContest._id,
      type: "mcq",
      difficulty: "easy",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "Which algorithm distributes requests to the server with the fewest active connections?",
      options: ["Round Robin", "Least Connections", "Random", "IP Hash"],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Cache Eviction",
      slug: "sd-cache-eviction",
      contestId: mcqPaidContest._id,
      type: "mcq",
      difficulty: "medium",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "Which cache eviction policy removes the item that was accessed least recently?",
      options: ["FIFO", "LFU", "LRU", "Random"],
      correctAnswer: 2,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Message Queue",
      slug: "sd-message-queue",
      contestId: mcqPaidContest._id,
      type: "mcq",
      difficulty: "medium",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "What is the primary benefit of using a message queue between services?",
      options: [
        "Reduced latency",
        "Decoupling and asynchronous processing",
        "Stronger consistency",
        "Lower memory usage",
      ],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Consistent Hashing",
      slug: "sd-consistent-hashing",
      contestId: mcqPaidContest._id,
      type: "mcq",
      difficulty: "hard",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "What problem does consistent hashing solve?",
      options: [
        "Data encryption across nodes",
        "Minimizing key redistribution when nodes are added/removed",
        "Load balancing across regions",
        "Database replication lag",
      ],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "CDN Purpose",
      slug: "sd-cdn",
      contestId: mcqPaidContest._id,
      type: "mcq",
      difficulty: "easy",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "What does a CDN primarily improve?",
      options: [
        "Database query performance",
        "Static asset delivery latency by caching near users",
        "Application code execution speed",
        "Server-side rendering",
      ],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Rate Limiting",
      slug: "sd-rate-limiting",
      contestId: mcqPaidContest._id,
      type: "mcq",
      difficulty: "medium",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "Which rate limiting algorithm allows bursts while enforcing an average rate?",
      options: ["Fixed Window", "Sliding Window Log", "Token Bucket", "Leaky Bucket"],
      correctAnswer: 2,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Microservices Trade-off",
      slug: "sd-microservices",
      contestId: mcqPaidContest._id,
      type: "mcq",
      difficulty: "hard",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "What is a major disadvantage of microservices over a monolith?",
      options: [
        "Harder to scale individual services",
        "Increased operational complexity and network overhead",
        "Less code reusability",
        "Tighter coupling between components",
      ],
      correctAnswer: 1,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
    {
      title: "Database Index",
      slug: "sd-database-index",
      contestId: mcqPaidContest._id,
      type: "mcq",
      difficulty: "medium",
      points: 10,
      timeLimit: 1000,
      memoryLimit: 64,
      languageSupport: [],
      solutionTemplate: {},
      description: "What is the trade-off of adding a B-tree index to a database column?",
      options: [
        "Faster reads but slower writes and more storage",
        "Faster writes but slower reads",
        "No trade-off, only benefits",
        "Reduced storage but slower queries",
      ],
      correctAnswer: 0,
    mcqLayout: "list",
      testCases: [],
      imageUrls: [],
    },
  ])
  mcqPaidContest.problemIds = sysDesignMcqs.map((p) => p._id)
  await mcqPaidContest.save()

  // ============================================================ PARTICIPATION
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
  // Live participants
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
  // MCQ contest participants
  await Participation.insertMany(
    players.slice(0, 4).map((p, i) => ({
      userId: p._id,
      contestId: mcqFreeContest._id,
      joinedAt: new Date(now - 90 * 60 * 1000),
      startedAt: new Date(now - 89 * 60 * 1000),
      submittedAt: new Date(now - 80 * 60 * 1000),
      totalScore: [8, 7, 6, 5][i],
      rank: i + 1,
      status: "completed",
    })),
  )

  // ------------------------------------------------------------------ prizes
  const prizeRows = [
    { rank: 1, share: 0.4, users: [players[0], players[1]] },
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

  // ------------------------------------------------------------------ wallets
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
      subtitle: "90 minutes, 3 problems, ₹80,000 pool — join before the timer starts.",
      imageUrl: null,
      ctaText: "Join now",
      ctaLink: `/contests/${liveContest._id}`,
      order: 1,
      isActive: true,
    },
    {
      title: "New: Free MCQ Quizzes!",
      subtitle: "Test your knowledge with timed MCQ contests — no entry fee, instant results.",
      imageUrl: null,
      ctaText: "Try a quiz",
      ctaLink: `/contests`,
      order: 2,
      isActive: true,
    },
  ])

  await Faq.create([
    { question: "How much does it cost to join a contest?", answer: "Most contests cost ₹20 to enter. Some warmup contests and MCQ quizzes are completely free. The entry fee goes into the prize pool minus a small platform fee.", category: "Payments", order: 1, isActive: true },
    { question: "When do I get my prize money?", answer: "Prizes are calculated and credited straight to your SkillHill wallet the moment a contest settles — usually within a few minutes of the timer ending.", category: "Prizes", order: 2, isActive: true },
    { question: "How do I withdraw my winnings?", answer: "Complete KYC (PAN verification) from your profile, then request a withdrawal from the wallet page. Payouts go to your verified UPI id.", category: "Withdrawals", order: 3, isActive: true },
    { question: "What happens if two people have the same score?", answer: "Ties share the prize money equally, and the earlier submission wins the higher rank for tie-breaking purposes.", category: "Rules", order: 4, isActive: true },
    { question: "Is my payment information safe?", answer: "All payments run through Razorpay — we never see or store your card details. Wallet balances use an append-only ledger with atomic transactions.", category: "Payments", order: 5, isActive: true },
    { question: "Can I practice without paying?", answer: "Yes! The practice library contains every problem from past contests, free to solve with the full editor and judge.", category: "Practice", order: 6, isActive: true },
    { question: "What are MCQ contests?", answer: "Multiple-choice question contests test your knowledge with timed quizzes. No coding required — just pick the right answer. They're a great way to learn and win small prizes.", category: "Practice", order: 7, isActive: true },
  ])

  console.log("\nSeed complete:")
  console.log(`  users: ${userSeeds.length} (login: test@skillhill.dev / ${DEMO_PASSWORD})`)
  console.log(`  contests: ${await Contest.countDocuments()} total`)
  console.log(`  problems: ${await Problem.countDocuments()} total`)
  console.log(`  participations: ${await Participation.countDocuments()}`)
  console.log(`  prizes: ${await Prize.countDocuments()}`)
  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error("Seed failed:", err)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})

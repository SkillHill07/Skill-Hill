"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { motion } from "motion/react"
import { useState } from "react"
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  Crown,
  FileCode2,
  Trophy,
  Users,
} from "lucide-react"
import { api } from "@/lib/api"
import { type ContestCardData } from "@/components/contest-card"
import {
  Avatar,
  Countup,
  Reveal,
  SectionHeading,
} from "@/components/marketing"
import { Badge, Button } from "@/components/ui"
import { cn } from "@skillcontest/ui"
import { inr } from "@/lib/format"

interface ContestsResponse {
  contests: Array<{ contest: ContestCardData; participantCount: number }>
  total: number
}

interface WhyChooseUsItem {
  _id: string
  title: string
  description: string
  icon: string
}

interface Faq {
  _id: string
  question: string
  answer: string
  category: string | null
}

interface SiteLogo {
  logoUrl: string | null
  altText: string
  tagline: string | null
}

interface RecentWinner {
  rank: number
  prizeAmount: number
  creditedAt: string | null
  user: { firstName: string; lastName: string; avatarUrl: string | null } | null
  contest: { title: string; slug: string } | null
}

function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string
  children: React.ReactNode
  variant?: "primary" | "outline"
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variant === "primary" && "bg-orange-600 text-white shadow-sm hover:bg-orange-500",
        variant === "outline" && "border border-border bg-transparent hover:bg-accent",
        className,
      )}
    >
      {children}
    </Link>
  )
}

const steps = [
  {
    icon: <BadgeCheck className="h-4 w-4" aria-hidden />,
    title: "Create your account",
    text: "Sign up for free and access the practice library immediately.",
  },
  {
    icon: <FileCode2 className="h-4 w-4" aria-hidden />,
    title: "Solve your first problem",
    text: "Pick from hundreds of problems across easy, medium, and hard.",
  },
  {
    icon: <Clock3 className="h-4 w-4" aria-hidden />,
    title: "Enter a contest",
    text: "Join a timed contest and race against other developers.",
  },
  {
    icon: <Crown className="h-4 w-4" aria-hidden />,
    title: "Climb the leaderboard",
    text: "Top performers win real prize money, paid automatically.",
  },
]

const languages = [
  { key: "cpp", name: "C++", code: `#include <iostream>\n#include <vector>\nusing namespace std;\n\nint main() {\n    vector<int> nums = {2, 7, 11, 15};\n    int target = 9;\n    \n    for (int i = 0; i < nums.size(); i++) {\n        for (int j = i + 1; j < nums.size(); j++) {\n            if (nums[i] + nums[j] == target) {\n                cout << i << " " << j << endl;\n                return 0;\n            }\n        }\n    }\n    return -1;\n}` },
  { key: "python", name: "Python", code: `def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i\n    return []` },
  { key: "java", name: "Java", code: `class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        Map<Integer, Integer> map = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int complement = target - nums[i];\n            if (map.containsKey(complement)) {\n                return new int[] { map.get(complement), i };\n            }\n            map.put(nums[i], i);\n        }\n        return new int[] {};\n    }\n}` },
  { key: "javascript", name: "JavaScript", code: `function twoSum(nums, target) {\n  const map = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const complement = target - nums[i];\n    if (map.has(complement)) {\n      return [map.get(complement), i];\n    }\n    map.set(nums[i], i);\n  }\n  return [];\n}` },
  { key: "go", name: "Go", code: `func twoSum(nums []int, target int) []int {\n    seen := make(map[int]int)\n    for i, num := range nums {\n        complement := target - num\n        if j, ok := seen[complement]; ok {\n            return []int{j, i}\n        }\n        seen[num] = i\n    }\n    return nil\n}` },
  { key: "rust", name: "Rust", code: `fn two_sum(nums: Vec<i32>, target: i32) -> Vec<i32> {\n    use std::collections::HashMap;\n    let mut seen: HashMap<i32, usize> = HashMap::new();\n    for (i, &num) in nums.iter().enumerate() {\n        let complement = target - num;\n        if let Some(&j) = seen.get(&complement) {\n            return vec![j as i32, i as i32];\n        }\n        seen.insert(num, i);\n    }\n    vec![]\n}` },
]

export default function HomePage() {
  const { data: contests, isLoading } = useQuery({
    queryKey: ["contests", "home"],
    queryFn: () => api.get<ContestsResponse>("/contests?status=active&limit=6"),
  })

  const { data: logo } = useQuery({
    queryKey: ["site-logo"],
    queryFn: () => api.get<SiteLogo>("/site/logo"),
    retry: false,
  })

  const { data: whyItems } = useQuery({
    queryKey: ["why-choose-us"],
    queryFn: () => api.get<WhyChooseUsItem[]>("/site/why-choose-us"),
    retry: false,
  })

  const { data: faqs } = useQuery({
    queryKey: ["faqs"],
    queryFn: () => api.get<Faq[]>("/site/faqs"),
    retry: false,
  })

  const { data: winners } = useQuery({
    queryKey: ["winners", "recent"],
    queryFn: () => api.get<RecentWinner[]>("/prizes/recent?limit=10"),
    retry: false,
  })

  return (
    <div className="overflow-x-clip">
      {/* ============================== HERO ============================== */}
      <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:pt-24">
        <div className="grid gap-12 lg:grid-cols-[1fr_480px] lg:items-center">
          {/* Left — copy */}
          <div className="flex flex-col gap-6">
            {/* Live badge */}
            {contests && contests.contests.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                {contests.contests.length} contest{contests.contests.length > 1 ? "s" : ""} live
              </motion.div>
            )}

            {!contests && (
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
                {logo?.tagline ?? "Skill-based coding contests"}
              </div>
            )}

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]"
            >
              Compete. Solve.{" "}
              <span className="text-orange-500">Win real prizes.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Timed coding contests with live leaderboards, instant judging, and
              automatic prize payouts. Join thousands of developers sharpening
              their skills.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-wrap items-center gap-3"
            >
              <ButtonLink href="/register">
                Start solving <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/contests" variant="outline">
                Browse contests
              </ButtonLink>
            </motion.div>
          </div>

          {/* Right — product preview */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-600/40" />
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-600/40" />
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-600/40" />
                </div>
                <span className="ml-2 text-xs text-muted-foreground">workspace — Two Sum</span>
              </div>
              {/* Editor body */}
              <div className="p-4 font-mono text-[13px] leading-[1.7]">
                <p>
                  <span className="text-orange-400">function</span>{" "}
                  <span className="text-amber-300">twoSum</span>
                  <span className="text-muted-foreground">(</span>
                  <span className="text-zinc-400">nums</span>
                  <span className="text-muted-foreground">,</span>{" "}
                  <span className="text-zinc-400">target</span>
                  <span className="text-muted-foreground">)</span>{" "}
                  <span className="text-muted-foreground">{"{"}</span>
                </p>
                <p className="pl-4">
                  <span className="text-orange-400">const</span>{" "}
                  <span className="text-zinc-300">map</span>{" "}
                  <span className="text-muted-foreground">=</span>{" "}
                  <span className="text-orange-400">new</span>{" "}
                  <span className="text-amber-300">Map</span>
                  <span className="text-muted-foreground">();</span>
                </p>
                <p className="pl-4">
                  <span className="text-orange-400">for</span>{" "}
                  <span className="text-muted-foreground">(</span>
                  <span className="text-orange-400">let</span>{" "}
                  <span className="text-zinc-300">i</span>{" "}
                  <span className="text-muted-foreground">=</span>{" "}
                  <span className="text-emerald-400">0</span>
                  <span className="text-muted-foreground">;</span>{" "}
                  <span className="text-zinc-300">i</span>{" "}
                  <span className="text-muted-foreground">&lt;</span>{" "}
                  <span className="text-zinc-300">nums.length</span>
                  <span className="text-muted-foreground">;</span>{" "}
                  <span className="text-zinc-300">i++</span>
                  <span className="text-muted-foreground">)</span>{" "}
                  <span className="text-muted-foreground">{"{"}</span>
                </p>
                <p className="pl-8">
                  <span className="text-orange-400">const</span>{" "}
                  <span className="text-zinc-300">j</span>{" "}
                  <span className="text-muted-foreground">=</span>{" "}
                  <span className="text-zinc-300">map.get</span>
                  <span className="text-muted-foreground">(</span>
                  <span className="text-zinc-300">target</span>
                  <span className="text-muted-foreground"> -</span>{" "}
                  <span className="text-zinc-300">nums[i]</span>
                  <span className="text-muted-foreground">);</span>
                </p>
                <p className="pl-8">
                  <span className="text-orange-400">if</span>{" "}
                  <span className="text-muted-foreground">(</span>
                  <span className="text-zinc-300">j !== undefined</span>
                  <span className="text-muted-foreground">)</span>{" "}
                  <span className="text-orange-400">return</span>{" "}
                  <span className="text-muted-foreground">[</span>
                  <span className="text-zinc-300">j, i</span>
                  <span className="text-muted-foreground">];</span>
                </p>
                <p className="pl-8">
                  <span className="text-zinc-300">map.set</span>
                  <span className="text-muted-foreground">(</span>
                  <span className="text-zinc-300">nums[i]</span>
                  <span className="text-muted-foreground">,</span>{" "}
                  <span className="text-zinc-300">i</span>
                  <span className="text-muted-foreground">);</span>
                </p>
                <p className="pl-4">
                  <span className="text-muted-foreground">{"}"}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">{"}"}</span>
                </p>
                {/* Result line */}
                <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                  <span className="text-emerald-400 font-medium text-xs">Accepted</span>
                  <span className="text-muted-foreground text-xs">—</span>
                  <span className="text-xs text-muted-foreground">42ms</span>
                  <span className="text-muted-foreground text-xs">·</span>
                  <span className="text-xs text-muted-foreground">14.2 MB</span>
                </div>
              </div>
            </div>
            {/* Subtle glow behind the card */}
            <div className="pointer-events-none absolute -inset-4 -z-10 rounded-2xl bg-orange-500/5 blur-2xl" />
          </motion.div>
        </div>
      </section>

      {/* ========================== LIVE CONTESTS ========================== */}
      {contests && contests.contests.length > 0 && (
        <section className="border-y border-border bg-muted/20">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <div className="mb-6 flex items-end justify-between">
              <SectionHeading
                align="left"
                eyebrow="Live now"
                title="Active contests"
                description="Join before the timer runs out"
              />
              <Link
                href="/contests"
                className="mb-1 hidden shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
              >
                View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>

            <div className="space-y-2">
              {contests.contests.map(({ contest, participantCount }) => (
                <Link
                  key={contest._id}
                  href={`/contests/${contest._id}`}
                  className="group flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-orange-500/30 hover:bg-accent/50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-600/10 text-orange-500">
                    <Trophy className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold group-hover:text-orange-500">
                        {contest.title}
                      </h3>
                      {contest.problemType === "mcq" && (
                        <Badge tone="amber" className="shrink-0">MCQ</Badge>
                      )}
                      {contest.problemType === "coding" && (
                        <Badge tone="blue" className="shrink-0">Coding</Badge>
                      )}
                      {contest.problemType === "mixed" && (
                        <Badge tone="teal" className="shrink-0">Mixed</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" aria-hidden />
                        {participantCount}
                      </span>
                      <span>{inr(contest.prizePool)} pool</span>
                      {contest.type === "paid" && (
                        <span>{inr(contest.entryFee)} entry</span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-orange-500" aria-hidden />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========================= HOW IT WORKS ========================= */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionHeading
          eyebrow="How it works"
          title="From sign-up to payout"
        />
        <div className="relative mt-12">
          {/* Connector line (desktop) */}
          <div className="absolute left-0 right-0 top-5 hidden h-px bg-border lg:block" />
          <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <Reveal as="li" key={step.title} delay={i * 0.08}>
                <div className="relative flex flex-col items-center text-center">
                  <span className="relative z-10 mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground">
                    {step.icon}
                  </span>
                  <h3 className="text-sm font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* =================== WHY SKILLHILL (editorial) =================== */}
      {whyItems && whyItems.length > 0 && (
        <section className="border-y border-border bg-muted/20">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <SectionHeading
              eyebrow="Why SkillHill"
              title="Built for serious solvers"
              description="Fair judging, real problems, and instant feedback."
            />
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {whyItems.slice(0, 3).map((item, i) => (
                <Reveal key={item._id} delay={i * 0.1}>
                  <div className="flex flex-col gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-600/10 text-orange-500">
                      {item.icon === "trophy" ? <Trophy className="h-5 w-5" aria-hidden /> :
                       item.icon === "users" ? <Users className="h-5 w-5" aria-hidden /> :
                       <Trophy className="h-5 w-5" aria-hidden />}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========================== LANGUAGES ========================== */}
      <LanguageShowcase />

      {/* ========================= PRACTICE ========================== */}
      <section className="border-y border-border bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <SectionHeading
            eyebrow="Practice"
            title="Free problems, no strings"
            description="Problems from past contests and open practice sets. No entry fee, no timer."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              { label: "Easy", count: "Build fundamentals", tone: "text-emerald-500 border-emerald-500/30", examples: "Two Sum, Valid Parentheses" },
              { label: "Medium", count: "Sharpen problem solving", tone: "text-amber-500 border-amber-500/30", examples: "LRU Cache, Word Search" },
              { label: "Hard", count: "Push your limits", tone: "text-rose-500 border-rose-500/30", examples: "Merge Intervals, Median" },
            ].map((d, i) => (
              <Reveal key={d.label} delay={i * 0.1}>
                <Link href={`/problems?difficulty=${d.label.toLowerCase()}`} className="group block">
                  <div className={cn(
                    "rounded-xl border bg-card p-6 transition-all duration-200 hover:shadow-md",
                    d.tone,
                  )}>
                    <div className="flex items-center justify-between">
                      <span className={cn("text-lg font-bold", d.tone.split(" ")[0])}>{d.label}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{d.count}</p>
                    <p className="mt-3 font-mono text-xs text-muted-foreground/60">{d.examples}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ======================== WINNERS ======================== */}
      {winners && winners.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <SectionHeading
            eyebrow="Payouts"
            title="Winners get paid instantly"
            description="Prizes are credited automatically the moment a contest settles."
          />
          <div className="mt-10 flex flex-col items-center gap-4">
            <div className="flex -space-x-2">
              {winners.slice(0, 8).map((w, i) => (
                <Avatar
                  key={`${w.user?.firstName}-${i}`}
                  name={w.user ? `${w.user.firstName} ${w.user.lastName ?? ""}`.trim() : "Anonymous"}
                  src={w.user?.avatarUrl}
                  size="lg"
                  className="ring-2 ring-background"
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{winners.length}+ winners</span> paid out
              </span>
              <span className="hidden sm:inline">·</span>
              <span>
                <span className="font-semibold text-emerald-500">
                  {winners.reduce((sum, w) => sum + w.prizeAmount, 0).toLocaleString("en-IN")}
                </span>{" "}
                total prizes
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ========================== FAQ ========================== */}
      {faqs && faqs.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <SectionHeading
            eyebrow="FAQ"
            title="Common questions"
          />
          <div className="mx-auto mt-10 max-w-3xl">
            <div className="flex flex-col gap-2">
              {faqs.map((faq, i) => (
                <Reveal key={faq._id} delay={i * 0.04}>
                  <FaqItem
                    question={faq.question}
                    answer={faq.answer}
                    defaultOpen={i === 0}
                  />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============================= CTA ============================= */}
      <section className="border-y border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Ready to compete?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-muted-foreground">
            Your next problem is waiting. Join a contest, solve it faster than
            everyone else, and win.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/register">
              Start solving <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/contests" variant="outline">
              Explore contests
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Language Showcase — interactive code preview                        */
/* ------------------------------------------------------------------ */

function LanguageShowcase() {
  const [active, setActive] = useState(0)
  const lang = languages[active]

  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <SectionHeading
        eyebrow="Languages"
        title="Code in your language"
        description="Six popular languages with full editor support."
      />

      {/* Language tabs */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        {languages.map((l, i) => (
          <button
            key={l.key}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors cursor-pointer",
              i === active
                ? "bg-orange-600 text-white"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {l.name}
          </button>
        ))}
      </div>

      {/* Code preview */}
      <Reveal>
        <div className="mx-auto mt-6 max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-600/40" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-600/40" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-600/40" />
            </div>
            <span className="ml-2 text-xs text-muted-foreground">solution.{lang.key === "cpp" ? "cpp" : lang.key === "java" ? "java" : lang.key === "rust" ? "rs" : lang.key === "go" ? "go" : lang.key}</span>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-[1.7]">
            <code>{lang.code}</code>
          </pre>
        </div>
      </Reveal>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* FAQ Item — simple expandable                                       */
/* ------------------------------------------------------------------ */

function FaqItem({ question, answer, defaultOpen = false }: { question: string; answer: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-sm font-medium">{question}</span>
        <span className={cn(
          "shrink-0 text-muted-foreground transition-transform duration-200",
          open ? "rotate-180" : "",
        )}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
          {answer}
        </div>
      )}
    </div>
  )
}

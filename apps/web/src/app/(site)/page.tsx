"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { motion } from "motion/react"
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Clock3,
  Code2,
  Crown,
  Rocket,
  Sparkles,
  Trophy,
  Users,
  Wallet,
} from "lucide-react"
import { api } from "@/lib/api"
import { ContestCard, type ContestCardData } from "@/components/contest-card"
import {
  Accordion,
  Avatar,
  Countup,
  Marquee,
  Reveal,
  SectionHeading,
} from "@/components/marketing"
import { Badge, Card, CardContent, EmptyState, Skeleton } from "@/components/ui"
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

interface Banner {
  _id: string
  title: string
  subtitle: string | null
  ctaText: string | null
  ctaLink: string | null
  imageUrl: string | null
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

const whyIcons: Record<string, React.ReactNode> = {
  trophy: <Trophy className="h-5 w-5" aria-hidden />,
  users: <Users className="h-5 w-5" aria-hidden />,
  wallet: <Wallet className="h-5 w-5" aria-hidden />,
  sparkles: <Sparkles className="h-5 w-5" aria-hidden />,
}

/** Anchor styled as a primary/outline button — avoids invalid <button><a> nesting. */
function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string
  children: React.ReactNode
  variant?: "primary" | "outline" | "ghost-white"
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-6 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variant === "primary" && "bg-orange-600 text-white shadow-sm hover:bg-orange-500",
        variant === "outline" && "border border-border bg-transparent hover:bg-accent",
        variant === "ghost-white" && "text-white hover:bg-white/10",
        className,
      )}
    >
      {children}
    </Link>
  )
}

const steps = [
  {
    icon: <BadgeCheck className="h-5 w-5" aria-hidden />,
    title: "Create a free account",
    text: "Sign up in seconds. No credit card needed until you join a paid contest.",
  },
  {
    icon: <Wallet className="h-5 w-5" aria-hidden />,
    title: "Join a contest for ₹20",
    text: "Pick a timed contest, pay the entry fee through Razorpay, and lock in your seat.",
  },
  {
    icon: <Clock3 className="h-5 w-5" aria-hidden />,
    title: "Solve under the clock",
    text: "Race through coding problems while the timer runs. Every submission counts.",
  },
  {
    icon: <Crown className="h-5 w-5" aria-hidden />,
    title: "Win real prize money",
    text: "Top the leaderboard when time runs out and prizes are distributed automatically.",
  },
]

const difficultyCards = [
  {
    tone: "text-emerald-600 dark:text-emerald-400 border-emerald-300/50 dark:border-emerald-500/30",
    label: "Easy",
    text: "Warm-up problems to build momentum and learn the arena format.",
  },
  {
    tone: "text-amber-600 dark:text-amber-400 border-amber-300/50 dark:border-amber-500/30",
    label: "Medium",
    text: "Real interview-style questions that separate the pack.",
  },
  {
    tone: "text-rose-600 dark:text-rose-400 border-rose-300/50 dark:border-rose-500/30",
    label: "Hard",
    text: "Brutal edge-case riddles. Winners are made here.",
  },
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

  const { data: banners } = useQuery({
    queryKey: ["banners"],
    queryFn: () => api.get<Banner[]>("/site/banners"),
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

  const heroBanner = banners?.[0]
  const prizePool = (contests?.contests ?? []).reduce((sum, c) => sum + c.contest.prizePool, 0)

  return (
    <div className="overflow-x-clip">
      {/* ============================== Hero ============================== */}
      <section className="relative mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 pb-16 pt-16 text-center sm:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-1.5 text-sm text-muted-foreground"
        >
          <Sparkles className="h-4 w-4 text-orange-500" aria-hidden />
          {logo?.tagline ?? "Skill-based coding contests"}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl"
        >
          Compete. Solve.{" "}
          <span className="bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
            Win real prizes.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-xl text-lg text-muted-foreground"
        >
          Pay ₹20 to enter a timed coding contest, race the clock against other
          developers, and climb the leaderboard for prize money.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <ButtonLink href="/contests">
            Browse contests <ArrowRight className="h-4 w-4" aria-hidden />
          </ButtonLink>
          <ButtonLink href="/problems" variant="outline">
            Practice library
          </ButtonLink>
        </motion.div>

        {contests && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-4 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Contests hosted
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight">
                <Countup value={contests.total} />
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Live prize pool
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight">
                <Countup value={prizePool} format={(n) => inr(Math.round(n))} />
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Entry fee
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{inr(2000)}</p>
            </Card>
          </motion.div>
        )}

        {heroBanner?.title && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="w-full max-w-2xl"
          >
            <Card>
              <CardContent className="p-5 text-left">
                <Badge tone="teal">Announcement</Badge>
                <h2 className="mt-2 text-lg font-semibold">{heroBanner.title}</h2>
                {heroBanner.subtitle && (
                  <p className="mt-1 text-sm text-muted-foreground">{heroBanner.subtitle}</p>
                )}
                {heroBanner.ctaText && heroBanner.ctaLink && (
                  <Link
                    href={heroBanner.ctaLink}
                    className="mt-3 inline-block text-sm font-medium text-orange-600 hover:underline dark:text-orange-400"
                  >
                    {heroBanner.ctaText} →
                  </Link>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </section>

      {/* ========================== Winners wall ========================== */}
      {winners && winners.length > 0 && (
        <section className="py-8">
          <div className="mx-auto max-w-6xl px-4">
            <SectionHeading
              eyebrow="Wall of fame"
              title="Recent winners"
              description="Prizes are credited automatically the moment a contest settles."
            />
          </div>
          <Marquee speed={35} className="mt-8">
            {winners.map((w) => (
              <div
                key={`${w.contest?.title}-${w.user?.firstName}-${w.rank}-${w.creditedAt}`}
                className="flex w-72 shrink-0 items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                  #{w.rank}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {w.user ? `${w.user.firstName} ${w.user.lastName ?? ""}`.trim() : "Anonymous"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{w.contest?.title}</p>
                </div>
                <p className="ml-auto shrink-0 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  +{inr(w.prizeAmount)}
                </p>
              </div>
            ))}
          </Marquee>
        </section>
      )}

      {/* ============================ Why us ============================== */}
      {whyItems && whyItems.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-14">
          <SectionHeading
            eyebrow="Why SkillHill"
            title="Built for serious solvers"
            description="Everything you need to compete at your best — no distractions."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {whyItems.map((item, i) => (
              <Reveal key={item._id} delay={i * 0.08}>
                <Card className="h-full">
                  <CardContent className="flex h-full flex-col gap-2 p-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-600/10 text-orange-600 dark:text-orange-400">
                      {whyIcons[item.icon] ?? <Sparkles className="h-5 w-5" />}
                    </span>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ========================== How it works ========================== */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <SectionHeading
            eyebrow="How it works"
            title="From sign-up to payout in four steps"
          />
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <Reveal as="li" key={step.title} delay={i * 0.08}>
                <Card className="relative h-full">
                  <CardContent className="flex h-full flex-col gap-3 p-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-600 text-white">
                      {step.icon}
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-400">
                        Step {i + 1}
                      </p>
                      <h3 className="mt-1 font-semibold">{step.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
                    </div>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ========================= Live contests ========================== */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-8 flex items-end justify-between gap-4">
          <SectionHeading
            align="left"
            eyebrow="The arena"
            title="Live contests"
            description="Join now before the timer starts"
          />
          <Link
            href="/contests"
            className="mb-1 hidden shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
          >
            View all <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        ) : contests && contests.contests.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {contests.contests.map(({ contest, participantCount }, i) => (
              <Reveal key={contest._id} delay={(i % 3) * 0.08}>
                <ContestCard contest={contest} participants={participantCount} />
              </Reveal>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No live contests right now"
            hint="New contests are announced regularly — check the contest list or warm up in the practice library."
          />
        )}
      </section>

      {/* ======================== Practice teaser ========================= */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <SectionHeading
            eyebrow="Practice library"
            title="Sharpen your edge, free"
            description="Hundreds of problems from past contests and open practice sets — no entry fee, no timer pressure."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {difficultyCards.map((d, i) => (
              <Reveal key={d.label} delay={i * 0.08}>
                <Link href={`/problems?difficulty=${d.label.toLowerCase()}`} className="group block h-full">
                  <Card className={`h-full border bg-card transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md ${d.tone}`}>
                    <CardContent className="flex h-full flex-col gap-2 p-5">
                      <div className="flex items-center justify-between">
                        <Code2 className="h-5 w-5" aria-hidden />
                        <Badge tone={d.label === "Easy" ? "green" : d.label === "Medium" ? "amber" : "red"}>
                          {d.label}
                        </Badge>
                      </div>
                      <h3 className="mt-1 font-semibold">{d.label} problems</h3>
                      <p className="text-sm text-muted-foreground">{d.text}</p>
                      <span className="mt-auto flex items-center gap-1 pt-2 text-sm font-medium text-orange-600 group-hover:underline dark:text-orange-400">
                        Start practicing <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== FAQs ============================== */}
      {faqs && faqs.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 py-14">
          <SectionHeading
            eyebrow="FAQ"
            title="Frequently asked questions"
            description="Everything about entry fees, prizes, and how contests work."
          />
          <Accordion
            className="mt-8"
            items={faqs.map((f) => ({
              id: f._id,
              question: f.question,
              answer: f.answer,
            }))}
          />
        </section>
      )}

      {/* =============================== CTA ============================== */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-700 via-orange-600 to-amber-600 px-6 py-14 text-center text-white sm:px-12">
            <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <Rocket className="mx-auto h-10 w-10" aria-hidden />
            <h2 className="mx-auto mt-4 max-w-xl text-3xl font-extrabold tracking-tight">
              Your first win is one contest away
            </h2>
            <p className="mx-auto mt-3 max-w-md text-orange-100">
              Join a live contest in the next five minutes. Prizes are paid out
              straight to your wallet.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink href="/register" className="bg-white text-orange-700 hover:bg-orange-50">
                Get started free <ArrowRight className="h-4 w-4" aria-hidden />
              </ButtonLink>
              <ButtonLink
                href="/contests"
                variant="ghost-white"
                className="border border-white/40"
              >
                <BrainCircuit className="h-4 w-4" aria-hidden /> View contests
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ========================= Winner avatars ======================== */}
      {winners && winners.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex -space-x-2">
              {winners.slice(0, 6).map((w, i) => (
                <Avatar
                  key={`${w.user?.firstName}-${i}`}
                  name={w.user ? `${w.user.firstName} ${w.user.lastName ?? ""}`.trim() : "Anonymous"}
                  src={w.user?.avatarUrl}
                  size="lg"
                  className="ring-2 ring-background"
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{winners.length}+ recent winners</span>{" "}
              already paid out. Could be you next.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}

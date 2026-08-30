"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Code2, Trophy, Zap, Shield } from "lucide-react";

export default function Features3() {
  return (
    <section className="w-full py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="text-muted-foreground bg-muted/50 inline-flex w-fit items-center gap-2 rounded-lg px-3 py-1 text-sm">
            <span className="bg-primary h-2 w-2 rounded-full" />
            Why SkillHill
          </div>

          <h2 className="text-5xl leading-tight font-semibold tracking-tight">
            Built for competitive coders
          </h2>

          <p className="text-muted-foreground max-w-lg">
            Real-time leaderboards, instant code judging, and automatic prize
            distribution — everything you need for a fair and exciting contest.
          </p>

          <div className="">
            <div className="space-y-2">
              {[
                "Real-time leaderboard updates as problems are solved",
                "Instant judging against hidden test cases in Docker",
                "Automatic prize distribution to your wallet on settlement",
                "Support for 6+ languages with syntax highlighting",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="bg-primary/10 mt-1 flex h-6 w-6 items-center justify-center rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]">
                    <div className="bg-primary h-2.5 w-2.5 rounded-full" />
                  </div>

                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <Link href="/contests">
            <Button className="rounded-sm px-6 shadow-[inset_0_0px_2px_0px_rgba(0,0,0,0.1),inset_0_0px_4px_0px_rgba(0,0,0,0.1)]">
              Browse contests
            </Button>
          </Link>
        </div>

        <div className="bg-muted dark:bg-card/50 relative flex justify-center rounded-xl p-8 shadow-[inset_0_0px_4px_0px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0px_4px_0px_rgba(0,0,0,1)]">
          <div className="relative h-[380px] w-full max-w-md">
            {/* Leaderboard card */}
            <Card className="bg-background/80 dark:bg-card/80 ring-border/50 absolute top-0 left-0 w-[260px] rounded-lg p-0 shadow-md backdrop-blur-md">
              <CardContent className="space-y-2 p-4">
                <div className="text-muted-foreground text-xs flex items-center gap-1.5">
                  <Trophy className="h-3 w-3 text-amber-500" />
                  Live Leaderboard
                </div>

                <div className="text-2xl font-semibold">
                  #1<span className="text-muted-foreground text-sm"> / 42</span>
                </div>

                <div className="flex gap-2 text-[10px]">
                  <span className="rounded-md bg-emerald-200 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                    +3 solved
                  </span>
                  <span className="rounded-md bg-blue-200 px-2 py-0.5 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                    12 min ago
                  </span>
                </div>

                <div className="text-muted-foreground space-y-1 text-xs">
                  <div>Score: 750 pts</div>
                  <div>Penalty: 12m 34s</div>
                  <div>Problems: 3/5 solved</div>
                </div>
              </CardContent>
            </Card>

            {/* Judging status card */}
            <Card className="bg-background/90 dark:bg-card/80 ring-border/50 absolute top-28 right-0 z-50 w-[240px] rounded-lg p-0 shadow-lg backdrop-blur-md">
              <CardContent className="space-y-3 p-4">
                <div className="text-muted-foreground text-xs flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-amber-500" />
                  Judging Status
                </div>

                <div className="text-muted-foreground text-sm">
                  <span className="text-foreground font-medium">
                    Running test cases
                  </span>{" "}
                  ...
                </div>

                <div className="flex h-2 w-full gap-1">
                  <div className="w-[60%] rounded-full bg-emerald-400" />
                  <div className="w-[20%] rounded-full bg-amber-400 animate-pulse" />
                  <div className="w-[20%] rounded-full bg-muted" />
                </div>

                <div className="text-muted-foreground flex gap-3 text-[10px]">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Passed
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    Running
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-muted" />
                    Pending
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Prize payout card */}
            <Card className="bg-background/90 dark:bg-card/80 ring-border/50 absolute bottom-8 left-10 w-[260px] rounded-lg p-0 shadow-lg backdrop-blur-md">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-emerald-500" />
                    Prize Payout
                  </span>
                  <span className="text-muted-foreground text-xs">Auto</span>
                </div>

                <div className="text-muted-foreground text-sm">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    +₹500 credited
                  </span>{" "}
                  to wallet
                </div>

                <div className="flex gap-2 text-[10px]">
                  <span className="rounded-md bg-emerald-200 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                    #1 Finish
                  </span>
                  <span className="rounded-md bg-amber-200 px-2 py-0.5 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                    Instant
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

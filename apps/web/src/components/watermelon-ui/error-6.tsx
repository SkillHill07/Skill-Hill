"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowRight } from "lucide-react"

interface ErrorHeroProps {
  code?: string
  title?: string
  description?: string
  buttonLabel?: string
  buttonHref?: string
}

function BackgroundGrid() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden rounded-lg mask-size-2xl mask-radial-from-muted mask-radial-to-transparent mask-radial-at-center">
      <div className="grid h-full w-full grid-cols-12 grid-rows-6">
        {Array.from({ length: 72 }).map((_, index) => (
          <div
            key={index}
            className="border-border/50 hover:bg-primary/20 border transition-colors duration-300"
          />
        ))}
      </div>
    </div>
  )
}

function ErrorContent({
  title,
  description,
  buttonLabel,
  buttonHref,
}: Omit<ErrorHeroProps, "code">) {
  return (
    <div className="pointer-events-none relative z-0 flex max-w-md flex-col items-center justify-center gap-5 text-center sm:items-start sm:text-start">
      <div className="space-y-1">
        <h1 className="text-foreground text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="text-muted-foreground max-w-sm text-sm leading-normal sm:text-base">
          {description}
        </p>
      </div>
      <Button
        asChild
        className="group pointer-events-auto rounded px-5"
        size="lg"
      >
        <Link href={buttonHref ?? "/"}>
          <span>{buttonLabel}</span>
          <span className="flex items-center justify-center transition-transform duration-200 group-hover:translate-x-1">
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </Button>
    </div>
  )
}

function ErrorCode({ code }: Pick<ErrorHeroProps, "code">) {
  return (
    <div className="pointer-events-none relative z-10 flex items-center justify-center">
      <span className="text-foreground/70 translate-y-10 text-[7rem] leading-none font-light tracking-tight select-none sm:translate-y-0 sm:text-[9rem] md:text-[11rem] lg:text-[13rem]">
        {code}
      </span>
    </div>
  )
}

export default function ErrorPanel({
  code = "404",
  title = "Page not found",
  description = "The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.",
  buttonLabel = "Back to home",
  buttonHref = "/",
}: ErrorHeroProps) {
  return (
    <div className="h-full p-4">
      <Card className="bg-muted mx-auto relative overflow-hidden rounded-2xl px-4 sm:px-8 lg:px-14 w-full">
        <BackgroundGrid />
        <div className="pointer-events-none relative z-10 grid min-h-[420px] grid-cols-1 gap-10 sm:grid-cols-2 sm:items-center">
          <div className="order-2 sm:order-1">
            <ErrorContent
              title={title}
              description={description}
              buttonLabel={buttonLabel}
              buttonHref={buttonHref}
            />
          </div>
          <div className="order-1 sm:order-2">
            <ErrorCode code={code} />
          </div>
        </div>
      </Card>
    </div>
  )
}

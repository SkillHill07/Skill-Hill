"use client"

import { useState } from "react"
import { X, Rocket } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface Announcement1Props {
  badge?: string
  message?: string
  linkText?: string
  linkHref?: string
}

export default function Announcement1({
  badge = "NEW",
  message = "Winter Sprint Challenge is LIVE — 90 minutes, 4 problems, ₹80,000 pool.",
  linkText = "Join now",
  linkHref = "/contests",
}: Announcement1Props) {
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="border-primary flex w-full items-center justify-between border-b px-4 py-1.5">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Badge variant="default" className="text-xs">
            {badge}
          </Badge>
          <p className="text-muted-foreground flex items-center gap-2 truncate">
            {message}
          </p>
          <Link href={linkHref} className="group flex items-center gap-1">
            <span className="text-primary before:bg-primary relative flex cursor-pointer items-center gap-1 truncate font-medium before:absolute before:-bottom-1 before:left-0 before:h-[1px] before:w-full before:origin-right before:scale-x-0 before:transition-transform before:duration-300 before:ease-out group-hover:before:scale-x-100">
              {linkText}
            </span>
            <Rocket className="text-primary h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-primary hover:text-primary/50 cursor-pointer rounded-lg hover:bg-transparent"
          onClick={() => setVisible(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

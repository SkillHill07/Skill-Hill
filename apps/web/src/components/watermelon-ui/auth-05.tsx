"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import { Lock, Mail, ArrowRight, Sparkles, Github } from "lucide-react"
import Link from "next/link"

export interface AuthFeature {
  icon: React.ReactNode
  title: string
  description: string
}

export interface Auth5Props {
  brandName?: string
  panelHeading?: string
  panelSubtext?: string
  features?: AuthFeature[]
  submitLabel?: string
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void
  signUpHref?: string
  forgotPasswordHref?: string
}

export function Auth5({
  brandName = "SkillHill",
  submitLabel = "Sign in",
  onSubmit,
  signUpHref = "/register",
  forgotPasswordHref = "/forgot-password",
}: Auth5Props) {
  return (
    <div className="flex min-h-screen w-full flex-col p-1 lg:flex-row">
      <section className="bg-background flex flex-1 flex-col items-center justify-center px-6 py-16 sm:px-10 lg:max-w-xl lg:px-16">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
                <Sparkles className="text-primary-foreground h-4 w-4" />
              </span>
              <span className="text-foreground text-xl font-bold tracking-tight">
                {brandName}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-foreground text-2xl font-extrabold tracking-tight">
              Welcome back
            </h1>
            <p className="text-muted-foreground text-sm">
              Sign in to continue to your workspace.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" type="button" className="bg-muted h-10 gap-2 text-sm font-medium">
              <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google
            </Button>
            <Button variant="outline" type="button" className="bg-muted h-10 gap-2 text-sm font-medium">
              <Github className="h-4 w-4" />
              GitHub
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-muted-foreground shrink-0 text-xs">or continue with email</span>
            <Separator className="flex-1" />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              onSubmit?.(e)
            }}
            className="space-y-5"
          >
            <div className="space-y-1.5">
              <Label htmlFor="auth5-email" className="text-sm font-medium">Email address</Label>
              <div className="relative">
                <Mail className="text-muted-foreground absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="auth5-email"
                  type="email"
                  placeholder="you@company.com"
                  className="bg-muted h-11 border-0 pl-10 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_1px_4px_0px_rgba(0,0,0,0.08)]"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="auth5-password" className="text-sm font-medium">Password</Label>
                <Link href={forgotPasswordHref} className="text-primary text-xs font-medium hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="text-muted-foreground absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
                <Input
                  id="auth5-password"
                  type="password"
                  placeholder="••••••••••"
                  className="bg-muted h-11 border-0 pl-10 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_1px_4px_0px_rgba(0,0,0,0.08)]"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="auth5-remember" />
              <Label htmlFor="auth5-remember" className="text-muted-foreground cursor-pointer text-sm">
                Keep me signed in
              </Label>
            </div>

            <Button type="submit" className="h-11 w-full gap-2 font-semibold text-white shadow-sm">
              {submitLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="text-muted-foreground text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href={signUpHref} className="text-primary font-medium hover:underline">
              Create one for free
            </Link>
          </p>
        </div>
      </section>

      <section className="relative hidden flex-1 flex-col items-center justify-center overflow-hidden rounded-4xl bg-gradient-to-br from-orange-600 to-amber-500 p-10 lg:flex lg:p-16">
        <div className="relative z-10 text-center text-white">
          <h2 className="text-3xl font-extrabold tracking-tight lg:text-4xl">
            Start competing today
          </h2>
          <p className="mt-4 text-lg text-white/80">
            Join coding contests, solve problems, and win real prizes.
          </p>
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik0yMCAydjM2TTIgMjBoMzYiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+')] opacity-50" />
      </section>
    </div>
  )
}

import { Button } from "@skillcontest/ui"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg">
        SkillsArena
      </h1>
      <p className="mb-4 text-lg text-slate-300">Skill-based coding contests</p>
      <div className="flex flex-wrap items-center gap-4">
        <Button>Get Started</Button>
        <Button variant="secondary">Learn More</Button>
        <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
          GitHub
        </Button>
        <Button variant="ghost" className="text-slate-300 hover:text-white">
          Sign In
        </Button>
        <Button variant="destructive" size="lg">
          Delete Account
        </Button>
        <Button variant="link" size="sm">
          Terms
        </Button>
      </div>
    </main>
  )
}

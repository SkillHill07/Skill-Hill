import type { Metadata } from "next"
import Contact6 from "@/components/watermelon-ui/contact-6"

export const metadata: Metadata = {
  title: "Contact us",
  description: "Get in touch with the SkillHill team. We're here to help with contests, payments, and account issues.",
}

export default function ContactPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Get in touch</h1>
        <p className="mt-2 text-muted-foreground">
          Have a question about contests, payments, or your account? We&apos;re here to help.
        </p>
      </div>
      <Contact6 />
    </main>
  )
}

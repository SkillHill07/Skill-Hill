import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "SkillHill terms and conditions — rules for using the platform, contests, and payments.",
}

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Terms & Conditions</h1>
      <p className="mb-8 text-sm text-muted-foreground">Last updated: August 2026</p>

      <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p>
            By accessing or using SkillHill, you agree to be bound by these Terms &amp; Conditions.
            If you do not agree, please do not use the platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">2. Eligibility</h2>
          <p>
            You must be at least 13 years old to use SkillHill. By creating an account, you
            represent that you meet this age requirement and have the legal capacity to enter
            into a binding agreement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">3. Account Registration</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials.
            You must provide accurate information during registration. One account per person —
            duplicate accounts may be suspended.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Contest Rules</h2>
          <ul className="list-disc pl-5">
            <li>Entry fees are non-refundable once a contest has started</li>
            <li>All solutions must be your own work — plagiarism or sharing solutions during a live contest results in disqualification</li>
            <li>Contest timing and scoring are server-authoritative</li>
            <li>Prizes are distributed automatically after contest settlement</li>
            <li>SkillHill reserves the right to cancel contests in case of technical issues</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Payments &amp; Wallet</h2>
          <p>
            All monetary values are in Indian Rupees (₹). Deposits are processed via Razorpay.
            Wallet balance is non-transferable between accounts. Withdrawals require KYC
            verification and are processed to your registered UPI or bank account. Minimum
            withdrawal is ₹100.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">6. Intellectual Property</h2>
          <p>
            Problem statements, platform code, and design are the intellectual property of
            SkillHill. Your submitted solutions remain yours, but you grant SkillHill a
            non-exclusive license to display them for educational purposes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">7. Prohibited Conduct</h2>
          <ul className="list-disc pl-5">
            <li>Using bots, scripts, or automated tools to participate in contests</li>
            <li>Exploiting bugs or vulnerabilities for unfair advantage</li>
            <li>Harassing other users or staff</li>
            <li>Attempting to access other users&apos; accounts</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">8. Termination</h2>
          <p>
            SkillHill may suspend or terminate your account for violating these terms. Upon
            termination, your wallet balance (minus any pending refunds) will be returned
            within 30 business days.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">9. Limitation of Liability</h2>
          <p>
            SkillHill is provided &quot;as is&quot; without warranties. We are not liable for
            indirect, incidental, or consequential damages. Our total liability shall not
            exceed the amount you paid in entry fees during the 12 months preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">10. Changes to Terms</h2>
          <p>
            We may modify these terms at any time. Continued use of the platform after changes
            constitutes acceptance. Material changes will be communicated via email.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">11. Governing Law</h2>
          <p>
            These terms are governed by the laws of India. Disputes shall be subject to the
            exclusive jurisdiction of courts in Bangalore, Karnataka.
          </p>
        </section>
      </div>
    </main>
  )
}

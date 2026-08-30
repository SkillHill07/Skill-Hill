import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "SkillHill privacy policy — how we collect, use, and protect your data.",
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mb-8 text-sm text-muted-foreground">Last updated: August 2026</p>

      <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
          <p>
            When you create a SkillHill account, we collect your name, email address, and password
            (stored as a bcrypt hash). If you choose to verify your identity, we collect your PAN
            number, bank account details, and UPI ID — all encrypted at rest. We also collect
            device information and IP addresses for security purposes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">2. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul className="list-disc pl-5">
            <li>Authenticate you and secure your account</li>
            <li>Process contest entry fees and prize payouts via Razorpay</li>
            <li>Verify your identity for KYC compliance (withdrawals)</li>
            <li>Send contest notifications and account updates</li>
            <li>Improve our platform and user experience</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">3. Data Security</h2>
          <p>
            We use industry-standard encryption for data in transit (TLS) and at rest (AES-256 for
            KYC fields). Passwords are hashed with bcrypt. Payment processing is handled by Razorpay
            — we never store your card or UPI credentials on our servers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Data Sharing</h2>
          <p>
            We do not sell your personal information to third parties. We share data only with:
          </p>
          <ul className="list-disc pl-5">
            <li>Razorpay (payment processing)</li>
            <li>Cloudflare (security, CDN)</li>
            <li>Law enforcement when legally required</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Your Rights</h2>
          <p>
            You can access, update, or delete your account data at any time from your profile
            settings. For KYC data deletion, contact support. You can also request a copy of all
            data we hold about you.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">6. Cookies</h2>
          <p>
            We use HttpOnly cookies for authentication (access and refresh tokens). These are
            essential for the platform to function and are not used for tracking. We do not use
            third-party advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">7. Children&apos;s Privacy</h2>
          <p>
            SkillHill is not intended for users under 13 years of age. We do not knowingly collect
            information from children.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">8. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. Significant changes will be notified via
            email or in-app notice.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">9. Contact</h2>
          <p>
            For privacy-related questions, reach out at{" "}
            <a href="mailto:privacy@skillhill.dev" className="text-orange-600 hover:underline dark:text-orange-400">
              privacy@skillhill.dev
            </a>.
          </p>
        </section>
      </div>
    </main>
  )
}

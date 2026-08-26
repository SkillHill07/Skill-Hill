/**
 * Minimal layout for authentication pages (login, register, forgot-password).
 * No Navbar or Footer — keeps auth flows distraction-free.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4">
      {children}
    </main>
  )
}

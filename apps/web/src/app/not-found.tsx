import ErrorPanel from "@/components/watermelon-ui/error-6"

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center">
      <ErrorPanel
        code="404"
        title="Page not found"
        description="The page you are looking for doesn't exist or may have moved. Try browsing live contests instead."
        buttonLabel="Browse contests"
        buttonHref="/contests"
      />
    </main>
  )
}

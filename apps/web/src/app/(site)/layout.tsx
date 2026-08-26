import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"

/** Chrome for all public/authenticated site pages. The contest workspace
 * renders outside this group for a distraction-free coding experience. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  )
}

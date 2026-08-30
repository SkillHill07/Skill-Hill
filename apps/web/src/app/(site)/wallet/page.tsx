import { redirect } from "next/navigation"

/** The wallet is now integrated into the profile page. Redirect here. */
export default function WalletPage() {
  redirect("/profile?tab=wallet")
}

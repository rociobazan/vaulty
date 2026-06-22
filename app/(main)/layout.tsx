import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { Navbar } from "@/components/navbar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSession()
  if (!user) redirect("/login")

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      {children}
    </div>
  )
}

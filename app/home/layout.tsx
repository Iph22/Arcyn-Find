// Force dynamic rendering for real-time trends
export const dynamic = 'force-dynamic'

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}


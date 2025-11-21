// Force dynamic rendering for user-specific followers
export const dynamic = 'force-dynamic'

export default function FollowersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}


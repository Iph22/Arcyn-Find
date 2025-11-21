// Force dynamic rendering for user-specific reviews
export const dynamic = 'force-dynamic'

export default function ReviewsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}


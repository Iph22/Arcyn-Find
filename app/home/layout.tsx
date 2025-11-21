// Hybrid approach: Static generation with ISR (revalidate every 30 minutes)
// This allows the page to be pre-rendered at build time and updated periodically
export const revalidate = 1800; // 30 minutes

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}


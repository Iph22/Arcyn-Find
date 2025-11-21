// Hybrid approach: Static generation with ISR (revalidate every hour)
// Tools list is pre-rendered at build time and refreshed periodically
export const revalidate = 3600; // 1 hour

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}


/**
 * Revalidation is set per page rather than here: the directory and category
 * pages refresh hourly, individual tool pages every two hours. A value on this
 * layout would become the default for all of them and hide that distinction.
 */
export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

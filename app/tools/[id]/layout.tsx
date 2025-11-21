// Hybrid approach: Static generation with ISR for tool detail pages
// Revalidate every 2 hours to keep tool data fresh
export const revalidate = 7200; // 2 hours
import React from 'react';

export default function ToolDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}


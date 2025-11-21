// Hybrid approach: Collection detail pages with ISR
// Revalidate every hour to keep collection data fresh
export const revalidate = 3600; // 1 hour
import React from 'react';

export default function CollectionDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}


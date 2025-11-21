// Static page - no revalidation needed (content rarely changes)
export const dynamic = 'force-static';
import React from 'react';

export default function InstructionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}


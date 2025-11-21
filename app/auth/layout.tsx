// Static page - auth UI is static, authentication happens client-side
export const dynamic = 'force-static';
import React from 'react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}


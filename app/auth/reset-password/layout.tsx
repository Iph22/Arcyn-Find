// Static page - reset password UI is static
export const dynamic = 'force-static';
import React from 'react';

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}


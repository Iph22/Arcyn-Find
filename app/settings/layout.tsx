// Static page - settings UI is static, data is fetched client-side
export const dynamic = 'force-static';
import React from 'react';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}


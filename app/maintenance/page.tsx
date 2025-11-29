"use client"

import dynamic from 'next/dynamic'

const MaintenanceScene = dynamic(() => import('@/components/maintenance-scene'), { ssr: false })

export default function MaintenancePage() {
  return (
    <html lang="en">
      <head>
        <title>Maintenance Mode - Arcyn Find</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body className="m-0 p-0 font-sans min-h-screen flex items-center justify-center text-white bg-gradient-to-br from-[#667eea] to-[#764ba2] relative overflow-hidden">
        <MaintenanceScene />
        <div className="text-center p-8 max-w-2xl relative z-10">
          <h1 className="text-5xl mb-4">🔧</h1>
          <h2 className="text-3xl mb-4 font-bold">We'll be back soon!</h2>
          <p className="text-xl opacity-90 leading-relaxed">
            Arcyn Find is currently undergoing maintenance. We're working hard to improve your experience.
          </p>
          <p className="mt-8 opacity-70 text-base">
            Please check back shortly.
          </p>
        </div>
      </body>
    </html>
  )
}


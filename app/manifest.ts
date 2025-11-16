import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Arcyn Find - Discover AI Tools Worldwide',
    short_name: 'Arcyn Find',
    description: 'Search, filter, and explore AI tools, models, platforms, and research worldwide. Find the perfect AI for your needs.',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    categories: ['productivity', 'utilities', 'education'],
    shortcuts: [
      {
        name: 'Search AI Tools',
        short_name: 'Search',
        description: 'Search for AI tools',
        url: '/?action=search',
        icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'All AI Tools',
        short_name: 'All Tools',
        description: 'Browse all AI tools',
        url: '/ai-tools',
        icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192' }],
      },
    ],
  }
}


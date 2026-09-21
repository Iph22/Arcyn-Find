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
    // Both of these used to 404. They are only reachable by long-pressing the
    // installed app icon, which is a surface nobody exercises in a browser, so
    // nothing caught it: '/?action=search' set a query parameter no route ever
    // read, and '/ai-tools' was never a route at all. '/browse' is the
    // interactive search-and-filter surface; '/tools' is the directory.
    shortcuts: [
      {
        name: 'Search AI Tools',
        short_name: 'Search',
        description: 'Search for AI tools',
        url: '/browse',
        icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'All AI Tools',
        short_name: 'All Tools',
        description: 'Browse all AI tools',
        url: '/tools',
        icons: [{ src: '/android-chrome-192x192.png', sizes: '192x192' }],
      },
    ],
  }
}


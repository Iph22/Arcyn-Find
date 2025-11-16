import { Metadata } from 'next'
import { aiEntries } from '@/lib/ai-data'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const ai = aiEntries.find((entry) => entry.id === params.id)

  if (!ai) {
    return {
      title: 'AI Tool Not Found',
      description: 'The requested AI tool could not be found.',
    }
  }

  return {
    title: `${ai.name} - AI Tool Details | Arcyn Find`,
    description: ai.description,
    keywords: [...ai.tags, ai.category, ai.name, 'AI tool', 'artificial intelligence'],
    openGraph: {
      title: `${ai.name} - AI Tool Details`,
      description: ai.description,
      type: 'website',
      url: `https://arcyn-find.vercel.app/ai/${ai.id}`,
      siteName: 'Arcyn Find',
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: `${ai.name} - AI Tool`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${ai.name} - AI Tool Details`,
      description: ai.description,
      images: ['/og-image.png'],
    },
    alternates: {
      canonical: `/ai/${ai.id}`,
    },
  }
}

export default function AIDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}


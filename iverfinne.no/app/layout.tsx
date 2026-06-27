import type { Metadata, Viewport } from 'next'
import './globals.css'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Newsreader } from 'next/font/google'
import { PostsProvider } from '@/lib/posts-context'

const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
})

const APP_NAME = 'iverfinne.no'
const APP_DEFAULT_TITLE = 'iverfinne.no'
const APP_TITLE_TEMPLATE = '%s - iverfinne.no'
const APP_DESCRIPTION = 'Personleg nettside og blogg'

// Global default social sharing image (1200x630, the size expected by
// Facebook, Messenger, Discord, Slack, LinkedIn, Twitter/X, etc.)
const OG_IMAGE = {
  url: '/og-image.png',
  width: 1200,
  height: 630,
  alt: APP_DEFAULT_TITLE,
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://iverfinne.no'),
  applicationName: APP_NAME,
  title: {
    default: APP_DEFAULT_TITLE,
    template: APP_TITLE_TEMPLATE,
  },
  description: APP_DESCRIPTION,
  authors: [{ name: 'Iver Finne', url: 'https://iverfinne.no' }],
  creator: 'Iver Finne',
  publisher: 'Iver Finne',
  keywords: ['Iver Finne', 'iverfinne', 'design', 'kunstig intelligens', 'generativ kunst', 'portefølje', 'blogg'],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_DEFAULT_TITLE,
  },
  formatDetection: {
    telephone: false,
  },
  alternates: {
    canonical: '/',
    types: { 'application/rss+xml': '/feed.xml' },
  },
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    url: '/',
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
    locale: 'nn_NO',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nn" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${newsreader.variable}`}>
      <body><PostsProvider>{children}</PostsProvider></body>
    </html>
  )
}

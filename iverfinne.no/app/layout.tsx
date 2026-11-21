import type { Metadata, Viewport } from 'next'
import './globals.css'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Newsreader } from 'next/font/google'
import { PostsProvider } from '@/lib/posts-context'
import { NoPageZoom } from '@/components/no-page-zoom'
import { ServiceWorker } from '@/components/service-worker'

const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
})

const APP_NAME = 'iverfinne.no'
const APP_DEFAULT_TITLE = 'iverfinne.no'
const APP_TITLE_TEMPLATE = '%s - iverfinne.no'
const APP_DESCRIPTION = 'Arkivet til Iver Finne — små prosjekt, skisser og tekstar, samla på ein stad.'

// Global default social sharing image (1200x630, the size expected by
// Facebook, Messenger, Discord, Slack, LinkedIn, Twitter/X, etc.)
const OG_IMAGE = {
  url: '/og-image.png',
  width: 1200,
  height: 630,
  alt: APP_DEFAULT_TITLE,
}

// The page never zooms: it is laid out at exactly the screen width and
// should feel like an app. maximumScale also stops iOS Safari's automatic
// zoom-in when focusing the search field. Safari ignores maximum-scale and
// user-scalable for pinch gestures, so <NoPageZoom> blocks those itself.
// Photos can still be zoomed in the full-screen viewer.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      <body>
        <NoPageZoom />
        <ServiceWorker />
        <PostsProvider>{children}</PostsProvider>
      </body>
    </html>
  )
}

import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'iverfinne.no',
    short_name: 'iverfinne',
    description: 'Personleg nettside og blogg',
    start_url: '/',
    display: 'standalone',
    lang: 'nn',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}

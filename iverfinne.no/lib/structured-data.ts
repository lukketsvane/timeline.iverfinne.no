import { Post } from '@/types/post'

const SITE_URL = 'https://iverfinne.no'

const author = {
  '@type': 'Person',
  name: 'Iver Finne',
  url: SITE_URL,
}

export function generatePostJsonLd(post: Post) {
  const url = `${SITE_URL}/${post.type.toLowerCase()}/${post.slug}`
  const image = post.image || post.ogImage

  switch (post.type) {
    case 'Skriving':
      return {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.description,
        author,
        datePublished: post.date,
        url,
        ...(image && { image }),
      }

    case 'Bok':
      return {
        '@context': 'https://schema.org',
        '@type': 'Review',
        itemReviewed: {
          '@type': 'Book',
          name: post.title,
          ...(image && { image }),
        },
        author,
        datePublished: post.date,
        description: post.description,
        url,
      }

    case 'Prosjekt':
      return {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: post.title,
        description: post.description,
        author,
        datePublished: post.date,
        url,
        ...(image && { image }),
      }

    case 'Bilete':
      return {
        '@context': 'https://schema.org',
        '@type': 'ImageGallery',
        name: post.title,
        description: post.description,
        author,
        datePublished: post.date,
        url,
        ...(image && { image }),
      }

    case 'Presentasjon':
      return {
        '@context': 'https://schema.org',
        '@type': 'PresentationDigitalDocument',
        name: post.title,
        description: post.description,
        author,
        datePublished: post.date,
        url,
        ...(image && { image }),
      }

    default:
      return {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: post.title,
        description: post.description,
        author,
        datePublished: post.date,
        url,
        ...(image && { image }),
      }
  }
}

export function generateWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'iverfinne.no',
    url: SITE_URL,
    author,
    description: 'Personleg nettside og blogg',
    inLanguage: 'nn',
  }
}

export function generatePersonJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'Iver Finne',
    url: SITE_URL,
  }
}

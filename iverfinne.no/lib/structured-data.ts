import { Post } from '@/types/post'
import { notionImgSrc } from '@/lib/utils'

const SITE_URL = 'https://iverfinne.no'

const author = {
  '@type': 'Person',
  name: 'Iver Finne',
  url: SITE_URL,
}

const SCHEMA_TYPE: Partial<Record<Post['type'], string>> = {
  Skriving: 'BlogPosting',
  Bilete: 'ImageGallery',
  Presentasjon: 'PresentationDigitalDocument',
}

export function postImage(post: Post): string | undefined {
  const src =
    post.sosialbilete ||
    post.image ||
    post.thumbnails?.[0]?.src ||
    post.ogImage ||
    post.content?.match(/!\[[^\]]*\]\((\/api\/notion-image\?[^)\s]+)\)/)?.[1]
  if (!src) return undefined
  const sized = notionImgSrc(src, 1280)
  return sized.startsWith('http') ? sized : `${SITE_URL}${sized}`
}

export function generatePostJsonLd(post: Post) {
  const url = `${SITE_URL}/${post.type.toLowerCase()}/${post.slug}`
  const image = postImage(post)
  const common = {
    '@context': 'https://schema.org',
    description: post.description,
    author,
    datePublished: post.date,
    url,
  }

  if (post.type === 'Bok') {
    return {
      ...common,
      '@type': 'Review',
      itemReviewed: {
        '@type': 'Book',
        name: post.title,
        ...(image && { image }),
      },
    }
  }

  const type = SCHEMA_TYPE[post.type] || 'CreativeWork'
  return {
    ...common,
    '@type': type,
    [type === 'BlogPosting' ? 'headline' : 'name']: post.title,
    mainEntityOfPage: url,
    ...(image && { image }),
    ...(Array.isArray(post.tags) && post.tags.length > 0 && { keywords: post.tags.join(', ') }),
  }
}

export function generateWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'iverfinne.no',
    url: SITE_URL,
    author,
    description: 'Arkivet til Iver Finne — små prosjekt, skisser og tekstar, samla på ein stad.',
    inLanguage: 'nn',
  }
}

export function generatePersonJsonLd() {
  return {
    '@context': 'https://schema.org',
    ...author,
    sameAs: ['https://github.com/lukketsvane'],
  }
}

export function generateBreadcrumbJsonLd(post: Post) {
  const typeUrl = `${SITE_URL}/${post.type.toLowerCase()}`
  const postUrl = `${typeUrl}/${post.slug}`

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Heim', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: post.type, item: typeUrl },
      { '@type': 'ListItem', position: 3, name: post.title, item: postUrl },
    ],
  }
}

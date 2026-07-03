export interface Post {
  uid: string
  id?: string // Notion Page ID
  title: string
  description: string
  date: string
  tags: string[] | string | undefined
  slug: string
  type: "Skriving" | "Bok" | "Prosjekt" | "Lenkje" | "Interaktiv" | "Bilete" | "Presentasjon"
  image?: string
  content: string
  url?: string
  lyd?: string
  icon?: string
  sosialbilete?: string
  thumbnails?: { src: string; alt: string }[]
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  // Set when the page body is nothing but an attached 3D model (.glb/.gltf):
  // the timeline then renders a bare square viewer instead of a card.
  modelSrc?: string
}


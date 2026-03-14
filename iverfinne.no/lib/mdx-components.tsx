import NextImage from "next/image"
import { ImageGallery } from "@/components/image-gallery"
import { ResponsiveIframe } from "@/components/responsive-iframe"
import { ModelViewer } from "@/components/model-viewer"
import { Callout } from "@/components/callout"

// Shared MDX component overrides
// Standard elements (ul, ol, li, blockquote, hr, table, a, strong, em, del)
// are handled by Tailwind Typography (.prose) — only override what needs custom styling.

export const baseMdxComponents: Record<string, any> = {
  // Headings
  h1: (props: any) => <h1 {...props} className="text-2xl font-bold mt-6 mb-3 break-words" />,
  h2: (props: any) => <h2 {...props} className="text-xl font-semibold mt-5 mb-2 break-words" />,
  h3: (props: any) => <h3 {...props} className="text-lg font-medium mt-4 mb-2 break-words" />,
  h4: (props: any) => <h4 {...props} className="text-base font-medium mt-3 mb-1 break-words" />,
  h5: (props: any) => <h5 {...props} className="text-sm font-medium mt-3 mb-1 break-words" />,
  h6: (props: any) => <h6 {...props} className="text-xs font-medium mt-2 mb-1 break-words" />,

  // Text
  p: (props: any) => <p {...props} className="break-words font-serif text-base leading-relaxed" />,

  // Code
  pre: (props: any) => (
    <pre {...props} className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-words text-sm my-4" />
  ),
  code: (props: any) => {
    // Inline code only — block code is inside <pre>
    const isBlock = typeof props.className === 'string' && props.className.includes('language-')
    if (isBlock) return <code {...props} />
    return <code {...props} className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-1.5 py-0.5 text-[0.9em] break-words" />
  },

  // Images
  img: (props: any) => <img {...props} className="max-w-full h-auto rounded-lg my-4" />,
  Image: (props: any) => {
    if (!props.width && !props.height && !props.fill) {
      return <img {...props} className="max-w-full h-auto rounded-lg my-4" />
    }
    return <NextImage {...props} />
  },

  // Blockquote — styled with left border
  blockquote: (props: any) => (
    <blockquote {...props} className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-4 text-muted-foreground italic [&>p]:m-0" />
  ),

  // Divider
  hr: () => <hr className="my-8 border-gray-200 dark:border-gray-700" />,

  // Tables — responsive wrapper
  table: (props: any) => (
    <div className="overflow-x-auto my-4 -mx-4 px-4">
      <table {...props} className="min-w-full text-sm border-collapse" />
    </div>
  ),
  thead: (props: any) => <thead {...props} className="border-b-2 border-gray-200 dark:border-gray-700" />,
  th: (props: any) => <th {...props} className="text-left px-3 py-2 font-semibold text-sm" />,
  td: (props: any) => <td {...props} className="px-3 py-2 border-b border-gray-100 dark:border-gray-800" />,

  // Toggle / collapsible (from Notion toggle blocks → <details>)
  details: (props: any) => (
    <details {...props} className="my-3 group border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden" />
  ),
  summary: (props: any) => (
    <summary {...props} className="px-4 py-3 cursor-pointer font-medium select-none hover:bg-gray-50 dark:hover:bg-gray-800/50 list-none flex items-center gap-2 [&::-webkit-details-marker]:hidden before:content-['▶'] before:text-xs before:text-gray-400 before:transition-transform group-open:before:rotate-90" />
  ),

  // Iframe
  iframe: (props: any) => (
    <div className="relative w-full aspect-video rounded-lg overflow-hidden my-4">
      <iframe {...props} className="absolute inset-0 w-full h-full border-0" />
    </div>
  ),

  // Custom components
  ImageGallery,
  ResponsiveIframe,
  ModelViewer,
  Callout,
  material: (props: any) => <div {...props} />,
}

// Larger prose variant for full post pages
export const fullPageMdxComponents: Record<string, any> = {
  ...baseMdxComponents,
  h1: (props: any) => <h1 {...props} className="text-3xl font-bold mt-8 mb-4 break-words" />,
  h2: (props: any) => <h2 {...props} className="text-2xl font-semibold mt-6 mb-3 break-words" />,
  h3: (props: any) => <h3 {...props} className="text-xl font-medium mt-4 mb-2 break-words" />,
  p: (props: any) => <p {...props} className="mb-4 leading-relaxed break-words font-serif text-lg" />,
  img: (props: any) => <img {...props} className="max-w-full h-auto rounded-lg my-6" />,
}

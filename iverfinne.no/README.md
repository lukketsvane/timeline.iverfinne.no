# iverfinne.no

Personal website and blog built with Next.js 16, powered by Notion as CMS.

## Architecture

- **Framework:** Next.js 16 (App Router)
- **CMS:** Notion API via `@notionhq/client` + `notion-to-md`
- **Content rendering:** `next-mdx-remote` with custom component map
- **Styling:** Tailwind CSS + `@tailwindcss/typography`
- **Animations:** Framer Motion
- **Deployment:** Vercel

## Post Types (Notion `Type` property)

The site supports 7 post types. Each maps to a URL path `/{type}/{slug}` and has specific behavior.

### Skriving (Writing)

Blog posts / essays.

| Property | Notion Field | Required |
|---|---|---|
| Namn | Title | Yes |
| Slug | Rich text | Auto-generated from title if empty |
| Dato | Date | Falls back to `created_time` |
| Samandrag | Rich text | No |
| Type | Select = `Skriving` or `Writing` | Yes |
| Merkelappar | Multi-select | No |
| Status | Status = `Ferdig` or `Done` | Yes (to publish) |

**Display:** Title, description, read time estimate, expandable MDX content.
**Schema.org:** `BlogPosting`

### Bok (Book)

Book reviews with cover image.

| Property | Notion Field | Required |
|---|---|---|
| Namn | Title (book title) | Yes |
| Slug | Rich text | Auto-generated |
| Dato | Date | Falls back to `created_time` |
| Samandrag | Rich text | No |
| Type | Select = `Bok` or `Book` | Yes |
| Omslag | URL (book cover image) | No |
| Merkelappar | Multi-select | No |
| Status | Status = `Ferdig` or `Done` | Yes |

**Display:** Book cover thumbnail on left, title + description on right. Cover image is filtered from body content to avoid duplication.
**Schema.org:** `Review` with `itemReviewed: Book`

### Prosjekt (Project)

Portfolio projects with optional thumbnail and social links.

| Property | Notion Field | Required |
|---|---|---|
| Namn | Title | Yes |
| Slug | Rich text | Auto-generated |
| Dato | Date | Falls back to `created_time` |
| Samandrag | Rich text | No |
| Type | Select = `Prosjekt` or `Project` | Yes |
| URL | URL | No |
| Omslag | URL (project thumbnail) | No |
| Merkelappar | Multi-select | No |
| Status | Status = `Ferdig` or `Done` | Yes |

**Display:** Title with social link icons (GitHub, Instagram, LinkedIn, Twitter) extracted from content/URL. Thumbnail on right. Expandable MDX content.
**Schema.org:** `CreativeWork`

### Lenkje (Link)

External link bookmarks with OG metadata preview.

| Property | Notion Field | Required |
|---|---|---|
| Namn | Title (or domain name) | Yes |
| Slug | Rich text | Auto-generated |
| Dato | Date | Falls back to `created_time` |
| Samandrag | Rich text | No |
| Type | Select = `Lenkje` or `Link` | Yes |
| URL | URL | Yes |
| Merkelappar | Multi-select | No |
| Status | Status = `Ferdig` or `Done` | Yes |

**Display:** Bookmark card with OG title, description, image, and favicon. Clicking opens URL in new tab. If title looks like a domain and no URL is set, URL is derived from title.
**Schema.org:** `CreativeWork`

### Interaktiv (Interactive)

Full HTML/JS interactive content rendered in an iframe.

| Property | Notion Field | Required |
|---|---|---|
| Namn | Title | Yes |
| Slug | Rich text | Auto-generated |
| Dato | Date | Falls back to `created_time` |
| Samandrag | Rich text | No |
| Type | Select = `Interaktiv` or `Interactive` | Yes |
| Merkelappar | Multi-select | No |
| Status | Status = `Ferdig` or `Done` | Yes |

**Display:** Content rendered in a sandboxed iframe. Full-screen on detail page.
**Schema.org:** `CreativeWork`

### Bilete (Images)

Photo galleries. Images are pulled from image blocks in the Notion page.

| Property | Notion Field | Required |
|---|---|---|
| Namn | Title | Yes |
| Slug | Rich text | Auto-generated |
| Dato | Date | Falls back to `created_time` |
| Samandrag | Rich text | No |
| Type | Select = `Bilete`, `Images`, or `Bilder` | Yes |
| Merkelappar | Multi-select | No |
| Status | Status = `Ferdig` or `Done` | Yes |

**Display:** 4-column thumbnail grid (up to 8 images) on timeline card. All images shown inline on detail page. Images are sourced from image blocks in the Notion page body (not properties).
**Schema.org:** `ImageGallery`

### Presentasjon (Presentation)

Figma slide deck embeds.

| Property | Notion Field | Required |
|---|---|---|
| Namn | Title | Yes |
| Slug | Rich text | Auto-generated |
| Dato | Date | Falls back to `created_time` |
| Samandrag | Rich text | No |
| Type | Select = `Presentasjon`, `Presentation`, `Slides`, or `Slide` | Yes |
| URL | URL (Figma embed/slides/proto URL) | Yes |
| Merkelappar | Multi-select | No |
| Status | Status = `Ferdig` or `Done` | Yes |

**Display:** Figma embed in an aspect-video iframe. Supports `embed.figma.com`, `figma.com/slides`, `figma.com/proto`, and `figma.com/design` URLs (auto-converted to embed URLs).
**Schema.org:** `PresentationDigitalDocument`

## Shared Notion Properties

These properties work across all types:

| Property | Aliases | Type | Notes |
|---|---|---|---|
| Namn | (any title property) | Title | Post title |
| Slug | | Rich text | URL slug. Auto-generated from title if empty |
| Dato | Date | Date | Publication date. Falls back to page `created_time` |
| Samandrag | Summary, Description | Rich text | Short description |
| Type | | Select | One of the 7 types above |
| Merkelappar | Tags | Multi-select | Tags for filtering |
| URL | Link, Lenkje | URL | External URL |
| Omslag | Cover, Bilete, Thumbnail | URL | Cover/thumbnail image |
| Status | | Status | Must be `Ferdig` or `Done` to publish |

The page icon (emoji, external URL, or Notion file) is also extracted and available as `icon`.

The page cover image is used as fallback if no `Omslag`/`Cover` property is set.

## Supported Notion Block Formatting

Content from Notion is converted to MDX via `notion-to-md` with custom transformers. The following block types are supported and styled:

### Text & Headings

| Notion Block | Rendered As | Notes |
|---|---|---|
| Text (paragraph) | `<p>` | Serif font, relaxed leading |
| Heading 1 | `<h1>` | Bold, larger on full page |
| Heading 2 | `<h2>` | Semibold |
| Heading 3 | `<h3>` | Medium weight |
| Heading 4/5/6 | `<h4>`/`<h5>`/`<h6>` | Smaller headings |

### Rich Text Formatting

| Notion Format | Rendered As |
|---|---|
| **Bold** | `<strong>` |
| *Italic* | `<em>` |
| ~~Strikethrough~~ | `<del>` |
| `Inline code` | `<code>` with gray background |
| [Link](url) | `<a>` with blue underline |

### Lists

| Notion Block | Rendered As | Notes |
|---|---|---|
| Bulleted list | `<ul>` | Disc, circle, square for nesting |
| Numbered list | `<ol>` | Decimal, nested support |
| To-do list | `<ul>` + `<input type="checkbox">` | Checked/unchecked checkboxes |

### Code

| Notion Block | Rendered As | Notes |
|---|---|---|
| Code block | `<pre><code>` | Syntax highlighting via `rehype-prism-plus`. Dark theme. Language classes preserved from Notion. |
| Inline code | `<code>` | Gray background pill |

### Media

| Notion Block | Rendered As | Notes |
|---|---|---|
| Image | `<img>` | Rounded corners, responsive |
| Video / Embed | `<iframe>` | Aspect-video responsive wrapper |
| Bookmark | `[caption](url)` | Rendered as a styled link |
| Equation | `<MathBlock>` | Displays expression in monospace code block |

### Structure

| Notion Block | Rendered As | Notes |
|---|---|---|
| Divider | `<hr>` | Subtle gray line |
| Quote | `<blockquote>` | Left border, italic, muted color |
| Table | `<table>` | Responsive with horizontal scroll |
| Callout | `<Callout>` | Left colored border + icon. Colors: blue, red, green, yellow, orange, purple, pink, gray, brown |
| Toggle | `<details><summary>` | Collapsible with arrow indicator |
| Toggle heading | `<details><summary><h1-3>` | Collapsible heading (custom transformer) |

### Callout Colors

Notion callout colors map to styled borders and backgrounds:

| Notion Color | Border Color |
|---|---|
| `blue` / `blue_background` | Blue |
| `red` / `red_background` | Red |
| `green` / `green_background` | Green |
| `yellow` / `yellow_background` | Yellow |
| `orange` / `orange_background` | Orange |
| `purple` / `purple_background` | Purple |
| `pink` / `pink_background` | Pink |
| `gray` / `gray_background` | Gray |
| `brown` / `brown_background` | Amber |
| `default` | Gray |

### Custom MDX Components Available in Content

These components can be used directly in Notion content (via MDX):

| Component | Usage |
|---|---|
| `<ImageGallery>` | Image gallery with thumbnails |
| `<ResponsiveIframe>` | Responsive iframe wrapper |
| `<ModelViewer>` | 3D model viewer (`.glb` files) |
| `<Callout>` | Styled callout box |
| `<MathBlock>` | Math expression display |
| `<WebDesignKeys>` | Interactive key visualization |

## URL Structure

```
/                          → Homepage (timeline of all posts)
/{type}                    → Filtered view (e.g., /skriving, /bok)
/{type}/{slug}             → Individual post (e.g., /skriving/my-post)
/api/posts                 → JSON API for all published posts
/api/posts?content=1       → JSON API with serialized MDX content
/api/posts/{id}            → JSON API for single post by Notion page ID
/sitemap.xml               → Dynamic sitemap
/robots.txt                → Robots file
/manifest.webmanifest      → PWA manifest
```

## Environment Variables

| Variable | Description |
|---|---|
| `NOTION_API_KEY` | Notion integration API key |
| `NOTION_DATABASE_ID` | Notion database ID (with or without hyphens) |

## Development

```bash
cd iverfinne.no
pnpm install
pnpm dev
```

// Notion API client library
import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { serialize } from "next-mdx-remote/serialize";
import type { MDXRemoteSerializeResult } from "next-mdx-remote";
import remarkGfm from "remark-gfm";
import rehypePrismPlus from "rehype-prism-plus";
import { Post } from "@/types/post";
import { cache } from "react";
import { unstable_cache } from "next/cache";
// React cache() dedupes Notion calls within a single render pass; the
// route-level revalidate=60 still caches the rendered output across requests.

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// Retry wrapper for Notion API calls that handles 429 rate limits
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error?.status === 429 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        console.warn(`Notion rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Unreachable");
}

// Caps how many of a given async call run at once — getPublishedPosts fans out
// one block-listing per post, and an uncapped Promise.all would burst-fire the
// Notion API into 429s.
function createLimiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => queue.push(resolve));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

// Proxy Notion images through our API using stable identifiers
// Block images: /api/notion-image?block=<block-id>
// Page covers:  /api/notion-image?page=<page-id>&type=cover
// Page icons:   /api/notion-image?page=<page-id>&type=icon
// Fallback:     /api/notion-image?url=<encoded-url> (for non-Notion URLs)
function proxyBlockImage(blockId: string): string {
  return `/api/notion-image?block=${blockId}`;
}

function proxyPageImage(pageId: string, type: 'cover' | 'icon'): string {
  return `/api/notion-image?page=${pageId}&type=${type}`;
}

// Stable proxy for file properties (e.g. sosialbilete). The raw Notion S3 URL
// expires after ~1h, so embedding it (even URL-encoded) breaks images and
// busts the edge cache on every regeneration; this URL never changes.
function proxyPageProp(pageId: string, prop: string): string {
  return `/api/notion-image?page=${pageId}&prop=${prop}`;
}

function proxyImageUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  // Proxy all external URLs through our API so NextImage can serve them
  // without needing every domain in remotePatterns
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return `/api/notion-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// Replace Notion S3 image URLs in markdown — these still use URL-based proxy
// since we don't have block IDs in markdown content
function proxyMarkdownImages(content: string): string {
  return content.replace(
    /!\[([^\]]*)\]\((https:\/\/[^\s)]*s3[^\s)]*amazonaws\.com[^\s)]*)\)/g,
    (_, alt, url) => `![${alt}](/api/notion-image?url=${encodeURIComponent(url)})`
  );
}

const n2m = new NotionToMarkdown({ notionClient: notion });

// Custom block transformers for rich Notion formatting

// Callout: render as <Callout> component with icon and color
// Note: children with has_children are NOT processed by n2m when custom transformer is set,
// so we fetch and convert children manually for callouts with nested content.
n2m.setCustomTransformer("callout", async (block: any) => {
  const callout = block.callout;
  if (!callout) return "";
  const icon = callout.icon?.emoji || callout.icon?.external?.url || "";
  const color = callout.color || "default";
  const text = callout.rich_text?.map((t: any) => t.plain_text).join("") || "";

  let childContent = "";
  if (block.has_children) {
    try {
      const children = await withRetry(() => notion.blocks.children.list({ block_id: block.id }));
      const childMd = await n2m.blocksToMarkdown(children.results);
      const childStr = n2m.toMarkdownString(childMd);
      childContent = childStr.parent || "";
    } catch { /* ignore child fetch errors */ }
  }

  const content = [text, childContent].filter(Boolean).join("\n\n");
  return `<Callout icon="${icon}" type="${color}">\n\n${content}\n\n</Callout>`;
});

// Toggle: let notion-to-md handle natively (<details><summary>) — do NOT override.
// It already produces correct HTML with children included.

// Toggle headings: heading_1/2/3 with is_toggleable=true
// n2m renders these as plain headings, losing the toggle behavior.
// We override heading types to check is_toggleable.
for (const level of [1, 2, 3] as const) {
  const blockType = `heading_${level}` as any;
  n2m.setCustomTransformer(blockType, async (block: any) => {
    const heading = block[`heading_${level}`];
    if (!heading) return false; // fallback to default
    const text = heading.rich_text?.map((t: any) => t.plain_text).join("") || "";

    if (heading.is_toggleable) {
      let childContent = "";
      if (block.has_children) {
        try {
          const children = await withRetry(() => notion.blocks.children.list({ block_id: block.id }));
          const childMd = await n2m.blocksToMarkdown(children.results);
          const childStr = n2m.toMarkdownString(childMd);
          childContent = childStr.parent || "";
        } catch { /* ignore */ }
      }
      return `<details>\n<summary>${"#".repeat(level)} ${text}</summary>\n\n${childContent}\n\n</details>`;
    }

    return false; // not toggleable — use default heading behavior
  });
}

// Bookmark: render with caption or URL as link text
n2m.setCustomTransformer("bookmark", async (block: any) => {
  const bookmark = block.bookmark;
  if (!bookmark?.url) return "";
  const caption = bookmark.caption?.map((t: any) => t.plain_text).join("") || bookmark.url;
  return `[${caption}](${bookmark.url})`;
});

// File attachments: 3D models (.glb/.gltf) become an inline viewer; other
// files render as a plain link. Notion file URLs expire after ~1h, so models
// go through the stable block-based proxy instead of the raw S3 URL.
n2m.setCustomTransformer("file", async (block: any) => {
  const f = block.file;
  const rawUrl = f?.type === "external" ? f.external?.url : f?.file?.url;
  const name: string =
    f?.name || rawUrl?.split("/").pop()?.split("?")[0] || "fil";
  if (/\.(glb|gltf)$/i.test(name)) {
    return `<ModelViewer src="/api/notion-image?block=${block.id}" alt="${name.replace(/"/g, "")}" disableZoom disablePan />`;
  }
  if (!rawUrl) return "";
  return `[${name}](${rawUrl})`;
});

// Equation: render as displayable math block
n2m.setCustomTransformer("equation", async (block: any) => {
  const equation = block.equation;
  if (!equation?.expression) return "";
  return `<MathBlock expression="${equation.expression.replace(/"/g, '&quot;')}" />`;
});

export const VALID_TYPES = ["skriving", "bok", "prosjekt", "lenkje", "interaktiv", "bilete", "presentasjon"];

const TYPE_MAPPING: Record<string, "Skriving" | "Bok" | "Prosjekt" | "Lenkje" | "Interaktiv" | "Bilete" | "Presentasjon"> = {
  "Skriving": "Skriving",
  "Bok": "Bok",
  "Prosjekt": "Prosjekt",
  "Lenkje": "Lenkje",
  "Interaktiv": "Interaktiv",
  "Bilete": "Bilete",
  "Presentasjon": "Presentasjon",
  "Writing": "Skriving",
  "Book": "Bok",
  "Project": "Prosjekt",
  "Link": "Lenkje",
  "Interactive": "Interaktiv",
  "Images": "Bilete",
  "Bilder": "Bilete",
  "Slides": "Presentasjon",
  "Presentation": "Presentasjon",
  "Slide": "Presentasjon"
};

export function formatNorwegianDate(dateStr: string): { day: number, month: string, year: number } {
  const dateObj = new Date(dateStr)
  const day = dateObj.getDate()
  const year = dateObj.getFullYear()
  
  const monthsFull = [
    "januar", "februar", "mars", "april", "mai", "juni", 
    "juli", "august", "september", "oktober", "november", "desember"
  ]
  
  const monthsShort = [
    "jan.", "feb.", "mars", "apr.", "mai", "juni", 
    "juli", "aug.", "sep.", "okt.", "nov.", "des."
  ]
  
  const monthIdx = dateObj.getMonth()
  const monthName = monthsFull[monthIdx]
  const month = monthName.length > 4 ? monthsShort[monthIdx] : monthName
  
  return { day, month, year }
}

function getDatabaseId() {
    let dbId = process.env.NOTION_DATABASE_ID;
    if (!dbId) {
        throw new Error("Missing NOTION_DATABASE_ID");
    }
    if (!dbId.includes('-')) {
        dbId = dbId.replace(
            /^([a-f0-9]{8})([a-f0-9]{4})([a-f0-9]{4})([a-f0-9]{4})([a-f0-9]{12})$/,
            '$1-$2-$3-$4-$5'
        );
    }
    return dbId;
}

function getPageProperties(page: any) {
  const props = page.properties || {};

  const findProp = (name: string) => {
    const key = Object.keys(props).find(k => k.toLowerCase() === name.toLowerCase());
    return key ? props[key] : null;
  };

  const getRichText = (names: string[]) => {
    for (const name of names) {
      const prop = findProp(name);
      if (prop && prop.rich_text && Array.isArray(prop.rich_text)) {
        return prop.rich_text[0]?.plain_text || "";
      }
    }
    return "";
  };

  const getTitle = () => {
    const namnProp = findProp("Namn");
    if (namnProp && namnProp.type === 'title' && namnProp.title?.[0]) {
      return namnProp.title[0].plain_text;
    }
    const titleKey = Object.keys(props).find(key => props[key] && props[key].type === 'title');
    if (!titleKey || !props[titleKey].title || !Array.isArray(props[titleKey].title)) return "Untitled";
    return props[titleKey].title[0]?.plain_text || "Untitled";
  };

  const getSelect = (name: string) => {
    const prop = findProp(name);
    return prop?.select?.name || prop?.status?.name;
  };

  const getDate = (name: string) => {
    const prop = findProp(name);
    return prop?.date?.start;
  };

  const getMultiSelect = (names: string[]) => {
    for (const name of names) {
      const prop = findProp(name);
      if (prop && prop.multi_select && Array.isArray(prop.multi_select)) {
        return prop.multi_select.map((t: any) => t.name) || [];
      }
    }
    return [];
  };

  const getUrl = (names: string[]) => {
    for (const name of names) {
      const prop = findProp(name);
      if (prop && prop.url) return prop.url;
    }
    return "";
  };

  // Notion checkbox → boolean. Absent property (or non-checkbox) reads as false,
  // so newly-added columns default off across the whole database.
  const getCheckbox = (names: string[]) => {
    for (const name of names) {
      const prop = findProp(name);
      if (prop && typeof prop.checkbox === "boolean") return prop.checkbox;
    }
    return false;
  };

  const getAnyImageUrl = () => {
    for (const key in props) {
      const prop = props[key];
      if (prop.type === 'url' && prop.url && (prop.url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || prop.url.includes('covers.openlibrary.org'))) {
        return prop.url;
      }
    }
    return null;
  };

  const title = getTitle();
  let slug = getRichText(["Slug"]);
  if (!slug) {
     slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  
  const date = getDate("Dato") || getDate("Date") || page.created_time.split('T')[0];
  const description = getRichText(["Samandrag", "Summary", "Description"]);
  
  let typeRaw = getSelect("Type") || "Skriving";
  const type = TYPE_MAPPING[typeRaw] || "Skriving";

  const tags = getMultiSelect(["Merkelappar", "Tags"]);
  let url = getUrl(["URL", "Link", "Lenkje"]);

  // For Lenkje: if no URL but title looks like a domain, derive URL from title
  if (!url && type === "Lenkje" && title && /^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(title)) {
    url = title.startsWith('http') ? title : `https://${title}`;
  }
  
  // Prøv å finne eit bilete (omslag) på fleire måtar
  let image = proxyImageUrl(getUrl(["Omslag", "Cover", "Bilete", "Thumbnail"]) || getAnyImageUrl() || undefined);

  if (!image && page.cover) {
    if (page.cover.type === "external") {
      image = proxyPageImage(page.id, 'cover');
    } else if (page.cover.type === "file") {
      // S3 URL expires — use stable page-based proxy
      image = proxyPageImage(page.id, 'cover');
    }
  }

  let icon: string | undefined = undefined;
  if (page.icon) {
    if (page.icon.type === "external") {
      icon = page.icon.external.url;
    } else if (page.icon.type === "file") {
      icon = proxyPageImage(page.id, 'icon');
    } else if (page.icon.type === "emoji") {
      icon = page.icon.emoji;
    }
  }

  // Lyd (audio) — files property from Notion
  const getLyd = () => {
    const lydProp = findProp("lyd");
    if (!lydProp || !lydProp.files || !Array.isArray(lydProp.files) || lydProp.files.length === 0) return undefined;
    const file = lydProp.files[0];
    if (file.type === "file") return file.file.url;
    if (file.type === "external") return file.external.url;
    return undefined;
  };
  const lyd = getLyd();

  // Sosialbilete (social image override) — optional file property. When set,
  // Lenkje cards use this instead of the link target's og:image. Empty = no
  // change, so only rows with an uploaded image are overridden. Served via
  // the stable prop proxy so the URL survives S3 signature expiry.
  const getFileUrl = (name: string): string | undefined => {
    const prop = findProp(name);
    if (!prop || !prop.files || !Array.isArray(prop.files) || prop.files.length === 0) return undefined;
    const file = prop.files[0];
    if (file.type === "file") return file.file?.url;
    if (file.type === "external") return file.external?.url;
    return undefined;
  };
  const sosialbilete = getFileUrl("sosialbilete") ? proxyPageProp(page.id, "sosialbilete") : undefined;

  // Opt-in "Les meir" expansion. New Notion checkbox, defaults off everywhere.
  const lesMeir = getCheckbox(["Les meir", "LesMeir", "Les meir?", "Utvid", "Expandable"]);

  const uid = `${type}-${slug}`;

  return {
    uid,
    id: page.id,
    title,
    slug,
    date,
    description,
    type,
    tags,
    image,
    url,
    lyd,
    icon,
    sosialbilete,
    lesMeir
  };
}

export function getSafeScope(content: string): Record<string, string> {
  const scope: Record<string, string> = {
    material: "",
    tid: "",
  };
  const matches = content.match(/(?<!\\)\{([a-zA-ZæøåÆØÅ][a-zA-ZæøåÆØÅ0-9_]*)\}/g);
  if (matches) {
    matches.forEach(match => {
      const word = match.slice(1, -1);
      scope[word] = "";
    });
  }
  return scope;
}

async function fetchOgMetadata(url: string): Promise<{ ogTitle?: string; ogDescription?: string; ogImage?: string }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000), headers: { 'User-Agent': 'bot' } });
    if (!res.ok) return {};
    const html = await res.text();
    const get = (property: string) => {
      const match = html.match(new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${property}["']`, 'i'));
      return match?.[1] || '';
    };
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return {
      ogTitle: get('title') || titleMatch?.[1]?.trim() || '',
      ogDescription: get('description') || (html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1]) || '',
      ogImage: get('image') || '',
    };
  } catch {
    return {};
  }
}

// Cache OG metadata across requests — link targets rarely change, so avoid
// re-fetching and re-parsing external HTML on every list regeneration.
const fetchOgMetadataCached = unstable_cache(
  fetchOgMetadata,
  ['og-metadata'],
  { revalidate: 3600 }
);

export const getPublishedPosts = cache(async (): Promise<Post[]> => {
  const databaseId = getDatabaseId();
  try {
    const response = await withRetry(() => notion.databases.query({
      database_id: databaseId,
      filter: {
        or: [
          { property: "Status", status: { equals: "Ferdig" } },
          { property: "Status", status: { equals: "Complete" } }
        ]
      },
      sorts: [
        {
          property: "Dato",
          direction: "descending",
        },
      ],
    }));

    // Skissebok rows live in the same database but are drawings, not posts —
    // keep them out of the timeline and gallery.
    const visible = response.results.filter(
      (page: any) => (page.properties?.Type?.select?.name || "").toLowerCase() !== "skissebok"
    );

    // One body scan per post, a few at a time (see createLimiter).
    const limitBodyMedia = createLimiter(4);

    const posts = await Promise.all(visible
      .map(async (page: any): Promise<Post | null> => {
        try {
          const props = getPageProperties(page);

          // Every post gets its body images/models collected, so the gallery
          // can show in-post media immediately. Cached per last_edited_time.
          const bodyMedia = await limitBodyMedia(() =>
            fetchBodyMediaCached(page.id, props.title, page.last_edited_time || "")
          );

          let thumbnails = props.image ? [{ src: props.image, alt: props.title }] : [];
          if (props.type === "Bilete" && bodyMedia.images.length > 0) {
            thumbnails = bodyMedia.images;
          }

          // Fetch OG metadata for Lenkje posts
          let ogData: { ogTitle?: string; ogDescription?: string; ogImage?: string } = {};
          if (props.type === "Lenkje" && props.url) {
            ogData = await fetchOgMetadataCached(props.url);
          }

          // Model-only pages (body = a single .glb attachment) render as a
          // bare 3D frame. Only descriptionless pages qualify.
          const modelSrc =
            !props.description && props.type !== "Bilete" && props.type !== "Lenkje"
              ? bodyMedia.modelOnlySrc
              : undefined;

          return {
            ...props,
            content: "",
            thumbnails,
            bodyImages: bodyMedia.images,
            bodyModels: bodyMedia.models,
            imageDims: bodyMedia.dims,
            ...ogData,
            modelSrc,
          };
        } catch (e) {
          console.error(`Error processing Notion page ${page.id}:`, e);
          return null;
        }
      }));

    return posts.filter((post): post is Post => post !== null);
  } catch (error: any) {
    console.error("Notion API error:", error);
    throw error;
  }
});

// ── Skissebok ───────────────────────────────────────────────────────────────
// Sketchbook drawings live in the same Notion database as Type = "Skissebok".
// Each row carries a Dato, a Format (page | spread), an Nr, and the drawing
// itself (a Teikning/Bilete file property, else the page cover).
export type SkissebokDrawing = { date: string; format: "page" | "spread"; nr: number; src: string };

export const getSkissebokDrawings = cache(async (): Promise<SkissebokDrawing[]> => {
  let databaseId: string;
  try {
    databaseId = getDatabaseId();
  } catch {
    return [];
  }
  try {
    const response = await withRetry(() => notion.databases.query({
      database_id: databaseId,
      filter: {
        and: [
          { property: "Type", select: { equals: "Skissebok" } },
          { or: [
            { property: "Status", status: { equals: "Ferdig" } },
            { property: "Status", status: { equals: "Complete" } },
          ] },
        ],
      },
      sorts: [{ property: "Dato", direction: "descending" }],
    }));

    return response.results
      .map((page: any): SkissebokDrawing | null => {
        const props = page.properties || {};
        const find = (name: string) => {
          const key = Object.keys(props).find(k => k.toLowerCase() === name.toLowerCase());
          return key ? props[key] : null;
        };

        const dateStart = find("Dato")?.date?.start || find("Date")?.date?.start;
        if (!dateStart) return null;
        const date = dateStart.replace(/-/g, "").slice(0, 8); // YYYY-MM-DD → YYYYMMDD

        const format = (find("Format")?.select?.name || "page").toLowerCase() === "spread" ? "spread" : "page";
        const nr = find("Nr")?.number ?? 0;

        // Prefer an uploaded file property, fall back to the page cover.
        let src: string | undefined;
        const fileProp = find("Teikning") || find("Bilete") || find("Fil");
        if (fileProp?.files?.length) {
          const f = fileProp.files[0];
          src = proxyImageUrl(f.type === "file" ? f.file?.url : f.external?.url);
        }
        if (!src && page.cover) src = proxyPageImage(page.id, "cover");
        if (!src) return null;

        return { date, format, nr, src };
      })
      .filter((d): d is SkissebokDrawing => d !== null);
  } catch (error) {
    console.error("Notion skissebok error:", error);
    return [];
  }
});

export async function getPostContent(pageId: string): Promise<string> {
  const mdblocks = await n2m.pageToMarkdown(pageId);
  const mdObject = n2m.toMarkdownString(mdblocks);
  return proxyMarkdownImages(mdObject.parent || "");
}

// Shared MDX serialization — single source of truth for all serialize calls
export async function serializeMarkdown(content: string): Promise<MDXRemoteSerializeResult> {
  return serialize(content, {
    mdxOptions: {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [[rehypePrismPlus, { ignoreMissing: true }]],
      format: 'mdx',
    },
    scope: getSafeScope(content),
  });
}

export async function serializePostContent(post: Post): Promise<Post & { serialized?: MDXRemoteSerializeResult }> {
  if (!post.id) return post;
  try {
    // Reuse already-fetched content when available to avoid a second Notion API round-trip
    const content = post.content || await getPostContent(post.id);
    const serialized = await serializeMarkdown(content);
    return { ...post, content, serialized };
  } catch (e) {
    console.error(`Error serializing post ${post.id}:`, e);
    return post;
  }
}

// ── Body media ──────────────────────────────────────────────────────────────
// One pass over a page's blocks collecting every image and attached 3D model,
// so the gallery can show in-post images without the client having to fetch
// and parse each post's markdown first. Also probes image dimensions (a few
// header bytes per image) so frames can use real aspect ratios immediately.

export type BodyMedia = {
  images: { src: string; alt: string }[];
  models: string[];
  // Set when the body is nothing but (blank paragraphs and) one .glb file —
  // such pages render as a bare 3D frame instead of a card.
  modelOnlySrc?: string;
  // Pixel dimensions keyed by the stable proxy src (body images, page cover,
  // sosialbilete). Best-effort — absent entries just fall back to on-load
  // measurement in the client.
  dims: Record<string, { w: number; h: number }>;
};

// Read just enough bytes of an image to learn its pixel size.
async function probeDims(url: string | undefined): Promise<{ w: number; h: number } | undefined> {
  if (!url) return undefined;
  try {
    const probe = (await import("probe-image-size")).default;
    const r = await probe(url, { timeout: 2500 });
    if (r?.width && r?.height) return { w: r.width, h: r.height };
  } catch { /* dimension stays unknown */ }
  return undefined;
}

function fileUrlOf(f: any): string | undefined {
  if (!f) return undefined;
  return f.type === "external" ? f.external?.url : f.file?.url;
}

// Container blocks whose children can hold images (columns, toggles, …).
const CONTAINER_BLOCK_TYPES = new Set([
  "column_list", "column", "toggle", "callout", "quote", "synced_block",
  "bulleted_list_item", "numbered_list_item", "to_do",
]);

function glbFileBlockName(b: any): string {
  const f = b.file;
  return (
    f?.name ||
    (f?.type === "external" ? f.external?.url : f?.file?.url)?.split("/").pop()?.split("?")[0] ||
    ""
  );
}

async function listAllChildren(blockId: string, maxPages = 3): Promise<any[]> {
  const results: any[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const res: any = await withRetry(() =>
      notion.blocks.children.list({ block_id: blockId, page_size: 100, start_cursor: cursor })
    );
    results.push(...res.results);
    if (!res.has_more || !res.next_cursor) break;
    cursor = res.next_cursor;
  }
  return results;
}

async function fetchBodyMedia(pageId: string, fallbackAlt: string): Promise<BodyMedia> {
  const images: { src: string; alt: string }[] = [];
  const models: string[] = [];
  // Raw (short-lived) file URLs per proxy src, used only for probing below.
  const rawUrls = new Map<string, string | undefined>();
  // Recursion budget: a handful of extra child-list calls per post, so deeply
  // nested pages can't fan the API out.
  let budget = 6;

  const collect = async (parentId: string, depth: number): Promise<any[]> => {
    const blocks = await listAllChildren(parentId);
    for (const b of blocks) {
      if (b.type === "image") {
        const src = proxyBlockImage(b.id);
        images.push({ src, alt: b.image?.caption?.[0]?.plain_text || fallbackAlt });
        rawUrls.set(src, fileUrlOf(b.image));
      } else if (b.type === "file" && /\.(glb|gltf)$/i.test(glbFileBlockName(b))) {
        models.push(proxyBlockImage(b.id));
      }
      if (b.has_children && depth < 2 && CONTAINER_BLOCK_TYPES.has(b.type) && budget > 0) {
        budget--;
        try {
          await collect(b.id, depth + 1);
        } catch { /* nested fetch errors just mean fewer images */ }
      }
    }
    return blocks;
  };

  let rootBlocks: any[] = [];
  try {
    rootBlocks = await collect(pageId, 0);
  } catch {
    return { images: [], models: [], dims: {} };
  }

  // The page cover and sosialbilete also show in the gallery — fetch the page
  // once so their dimensions can be probed alongside the body images.
  try {
    const page: any = await withRetry(() => notion.pages.retrieve({ page_id: pageId }));
    if (page?.cover) rawUrls.set(proxyPageImage(pageId, "cover"), fileUrlOf(page.cover));
    const sosialProp = Object.entries(page?.properties || {}).find(
      ([k]) => k.toLowerCase() === "sosialbilete"
    )?.[1] as any;
    const sosialFile = sosialProp?.files?.[0];
    if (sosialFile) rawUrls.set(proxyPageProp(pageId, "sosialbilete"), fileUrlOf(sosialFile));
  } catch { /* covers just miss their dims */ }

  // Probe dimensions a few at a time (each reads only the image header).
  const dims: Record<string, { w: number; h: number }> = {};
  const limitProbe = createLimiter(4);
  await Promise.all(
    Array.from(rawUrls.entries()).map(([src, raw]) =>
      limitProbe(async () => {
        const d = await probeDims(raw);
        if (d) dims[src] = d;
      })
    )
  );

  // Model-only detection: blank paragraphs are ignored; one .glb file block
  // qualifies; any other content disqualifies.
  let modelOnlySrc: string | undefined;
  for (const b of rootBlocks) {
    if (b.type === "paragraph" && (b.paragraph?.rich_text?.length ?? 0) === 0) continue;
    if (b.type === "file" && /\.(glb|gltf)$/i.test(glbFileBlockName(b)) && !modelOnlySrc) {
      modelOnlySrc = proxyBlockImage(b.id);
      continue;
    }
    modelOnlySrc = undefined;
    break;
  }

  return { images, models, modelOnlySrc, dims };
}

// Cache keyed by page id + last_edited_time: a page that hasn't changed reuses
// its cached media for an hour, so steady-state regenerations barely touch the
// Notion API. The extra parameter exists purely to vary the cache key.
const fetchBodyMediaCached = unstable_cache(
  async (pageId: string, fallbackAlt: string, _lastEdited: string) =>
    fetchBodyMedia(pageId, fallbackAlt),
  ["body-media"],
  { revalidate: 3600 }
);

// Shared Bilete thumbnail extraction
async function fetchBileteThumbnails(
  pageId: string,
  fallbackTitle: string,
  fallbackImage?: string
): Promise<{ src: string; alt: string }[]> {
  let thumbnails = fallbackImage ? [{ src: fallbackImage, alt: fallbackTitle }] : [];
  const blocks = await withRetry(() => notion.blocks.children.list({ block_id: pageId }));
  const images = blocks.results
    .filter((b: any) => b.type === 'image')
    .map((b: any) => ({
      src: proxyBlockImage(b.id),
      alt: b.image.caption?.[0]?.plain_text || fallbackTitle,
    }));
  if (images.length > 0) thumbnails = images;
  return thumbnails;
}

export async function getPostIdBySlug(slug: string): Promise<string | null> {
    const databaseId = getDatabaseId();
    const response = await withRetry(() => notion.databases.query({
        database_id: databaseId,
        filter: {
            and: [
                {
                  or: [
                    { property: "Status", status: { equals: "Ferdig" } },
                    { property: "Status", status: { equals: "Complete" } }
                  ]
                },
                { property: "Slug", rich_text: { equals: slug } }
            ]
        }
    }));
    if (response.results.length > 0) return response.results[0].id;
    return null;
}

export const getPostBySlug = cache(async (slug: string): Promise<Post | null> => {
  const databaseId = getDatabaseId();
  const response = await withRetry(() => notion.databases.query({
    database_id: databaseId,
    filter: {
      and: [
        {
          or: [
            { property: "Status", status: { equals: "Ferdig" } },
            { property: "Status", status: { equals: "Complete" } }
          ]
        },
        { property: "Slug", rich_text: { equals: slug } }
      ]
    }
  }));
  if (response.results.length === 0) return null;
  const page = response.results[0];
  const props = getPageProperties(page);
  const content = await getPostContent(page.id);
  let thumbnails = props.image ? [{ src: props.image, alt: props.title }] : [];
  if (props.type === "Bilete") {
    thumbnails = await fetchBileteThumbnails(page.id, props.title, props.image);
  }
  return {
    ...props,
    content,
    thumbnails,
  };
});

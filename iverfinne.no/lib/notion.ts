// Notion API client library
import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { Post } from "@/types/post";
import { unstable_cache } from 'next/cache';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

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
      const children = await notion.blocks.children.list({ block_id: block.id });
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
          const children = await notion.blocks.children.list({ block_id: block.id });
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
  let image = getUrl(["Omslag", "Cover", "Bilete", "Thumbnail"]) || getAnyImageUrl() || undefined;
  
  if (!image && page.cover) {
    if (page.cover.type === "external") {
      image = page.cover.external.url;
    } else if (page.cover.type === "file") {
      image = page.cover.file.url;
    }
  }

  let icon: string | undefined = undefined;
  if (page.icon) {
    if (page.icon.type === "external") {
      icon = page.icon.external.url;
    } else if (page.icon.type === "file") {
      icon = page.icon.file.url;
    } else if (page.icon.type === "emoji") {
      icon = page.icon.emoji;
    }
  }

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
    icon
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
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'bot' } });
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

export const getPublishedPosts = unstable_cache(
  async (): Promise<Post[]> => {
    const databaseId = getDatabaseId();
    try {
      const response = await notion.databases.query({
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
      });

      const posts = await Promise.all(response.results
        .map(async (page): Promise<Post | null> => {
          try {
            const props = getPageProperties(page);
            let thumbnails = props.image ? [{ src: props.image, alt: props.title }] : [];
            if (props.type === "Bilete") {
              const blocks = await notion.blocks.children.list({ block_id: page.id });
              const images = blocks.results
                .filter((b: any) => b.type === 'image')
                .map((b: any) => ({
                  src: b.image.type === 'external' ? b.image.external.url : b.image.file.url,
                  alt: b.image.caption?.[0]?.plain_text || props.title
                }));
              if (images.length > 0) thumbnails = images;
            }
            // Fetch OG metadata for Lenkje posts
            let ogData: { ogTitle?: string; ogDescription?: string; ogImage?: string } = {};
            if (props.type === "Lenkje" && props.url) {
              ogData = await fetchOgMetadata(props.url);
            }

            return {
              ...props,
              content: "",
              thumbnails,
              ...ogData,
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
  },
  ['published-posts'],
  { revalidate: 60, tags: ['posts'] }
);

export const getPostContent = unstable_cache(
  async (pageId: string): Promise<string> => {
    const mdblocks = await n2m.pageToMarkdown(pageId);
    const mdObject = n2m.toMarkdownString(mdblocks);
    return mdObject.parent || "";
  },
  ['post-content'],
  { revalidate: 60, tags: ['posts'] }
);

export async function getPostContentDirect(pageId: string): Promise<string> {
  const mdblocks = await n2m.pageToMarkdown(pageId);
  const mdObject = n2m.toMarkdownString(mdblocks);
  return mdObject.parent || "";
}

export async function getPostIdBySlug(slug: string): Promise<string | null> {
    const databaseId = getDatabaseId();
    const response = await notion.databases.query({
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
    });
    if (response.results.length > 0) return response.results[0].id;
    return null;
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const databaseId = getDatabaseId();
  const response = await notion.databases.query({
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
  });
  if (response.results.length === 0) return null;
  const page = response.results[0];
  const props = getPageProperties(page);
  const content = await getPostContent(page.id);
  let thumbnails = props.image ? [{ src: props.image, alt: props.title }] : [];
  if (props.type === "Bilete") {
    const blocks = await notion.blocks.children.list({ block_id: page.id });
    const images = blocks.results
      .filter((b: any) => b.type === 'image')
      .map((b: any) => ({
        src: b.image.type === 'external' ? b.image.external.url : b.image.file.url,
        alt: b.image.caption?.[0]?.plain_text || props.title
      }));
    if (images.length > 0) thumbnails = images;
  }
  return {
    ...props,
    content,
    thumbnails,
  };
}

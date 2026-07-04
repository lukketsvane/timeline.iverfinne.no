import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string): string {
  const d = new Date(date)
  const day = d.getDate().toString().padStart(2, '0')
  const monthsFull = [
    "januar", "februar", "mars", "april", "mai", "juni", 
    "juli", "august", "september", "oktober", "november", "desember"
  ]
  const monthsShort = [
    "jan.", "feb.", "mars", "apr.", "mai", "juni", 
    "juli", "aug.", "sep.", "okt.", "nov.", "des."
  ]
  const monthIdx = d.getMonth()
  const monthName = monthsFull[monthIdx]
  const month = monthName.length > 4 ? monthsShort[monthIdx] : monthName
  const year = d.getFullYear()
  return `${day}. ${month} ${year}`
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function truncate(str: string, length: number): string {
  return str.length > length ? str.substring(0, length) + '...' : str
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function getRandomColor(): string {
  return `#${Math.floor(Math.random() * 16777215).toString(16)}`
}

export function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

export function isValidEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

export function generateUniqueId(): string {
  return Math.random().toString(36).substr(2, 9)
}

// ── Notion image proxy sizing ────────────────────────────────────────────────
// The proxy (/api/notion-image) resizes on demand via ?w=. These helpers keep
// non-proxy URLs untouched so external images never gain bogus params.

export function notionImgSrc(src: string, w: number): string {
  return src.startsWith('/api/notion-image?') ? `${src}&w=${w}` : src
}

export function notionImgSrcSet(src: string, widths: number[] = [320, 640, 960, 1280]): string | undefined {
  if (!src.startsWith('/api/notion-image?')) return undefined
  return widths.map((w) => `${src}&w=${w} ${w}w`).join(', ')
}
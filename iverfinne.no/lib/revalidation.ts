import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { NOTION_CACHE_TAG } from './notion-client';

export function validateSecret(secret: unknown): boolean {
  const expected = process.env.REVALIDATION_SECRET;
  if (!expected || typeof secret !== 'string' || !secret) return false;
  const receivedBytes = Buffer.from(secret);
  const expectedBytes = Buffer.from(expected);
  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
}

export function refreshNotion() {
  // SWR keeps the last successful data available while refreshing. Expiring
  // the entire route tree here discards that protection and causes bursts.
  // Image URL caches deliberately have a separate, time-based lifetime.
  revalidateTag(NOTION_CACHE_TAG, 'max');
}

import { NextResponse } from 'next/server';
import { execSlackCli, handleSlackError, withTiming } from '../client';
import type { SlackEmoji } from '../types';

interface EmojiCache {
  data: Record<string, string>;
  timestamp: number;
}

const CACHE_TTL = 24 * 60 * 60 * 1000;
let cache: EmojiCache | null = null;

export async function GET() {
  const startTime = Date.now();
  const now = Date.now();

  if (cache && (now - cache.timestamp) < CACHE_TTL) {
    return NextResponse.json(withTiming({
      emoji: cache.data,
      cached: true,
      cache_age_ms: now - cache.timestamp,
    }, startTime));
  }

  try {
    const emojiList = await execSlackCli<SlackEmoji[]>('emoji -j');

    const emoji: Record<string, string> = {};
    for (const e of emojiList) {
      if (e.name && e.url) {
        emoji[e.name] = e.url;
      }
    }

    cache = { data: emoji, timestamp: now };

    return NextResponse.json(withTiming({
      emoji,
      cached: false,
    }, startTime));
  } catch (error) {
    return handleSlackError(error);
  }
}

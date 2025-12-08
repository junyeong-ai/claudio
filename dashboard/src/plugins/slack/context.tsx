'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import type { SlackUser, SlackChannel } from './api';
import { getStandardEmoji } from '@/lib/emoji';

export interface SlackContextValue {
  getUser: (id: string) => Promise<SlackUser | null>;
  getChannel: (id: string) => Promise<SlackChannel | null>;
  getEmoji: (name: string) => string | null;
  resolveUserName: (userId: string) => string | null;
  prefetchUsers: (userIds: string[]) => Promise<void>;
  isEmojiLoaded: boolean;
  showUserDetail: (userId: string) => void;
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
}

const SlackContext = createContext<SlackContextValue | null>(null);

const userCache = new Map<string, SlackUser | null>();
const channelCache = new Map<string, SlackChannel | null>();
let emojiCache: Record<string, string> = {};
let emojiLoaded = false;

async function fetchUser(id: string): Promise<SlackUser | null> {
  if (userCache.has(id)) return userCache.get(id) ?? null;

  try {
    const res = await fetch(`/api/plugins/slack/users/${encodeURIComponent(id)}`);
    if (!res.ok) return null;

    const data = await res.json();
    userCache.set(id, data.user ?? null);
    return data.user ?? null;
  } catch {
    userCache.set(id, null);
    return null;
  }
}

async function fetchChannel(id: string): Promise<SlackChannel | null> {
  if (channelCache.has(id)) return channelCache.get(id) ?? null;

  try {
    const params = new URLSearchParams({ q: id, limit: '1' });
    const res = await fetch(`/api/plugins/slack/channels?${params}`);
    if (!res.ok) return null;

    const data = await res.json();
    const channel = data.channels?.find((c: SlackChannel) => c.id === id) ?? null;
    channelCache.set(id, channel);
    return channel;
  } catch {
    channelCache.set(id, null);
    return null;
  }
}

async function loadEmoji(): Promise<void> {
  if (emojiLoaded) return;

  try {
    const res = await fetch('/api/plugins/slack/emoji');
    if (res.ok) {
      const data = await res.json();
      emojiCache = data.emoji || {};
      emojiLoaded = true;
    }
  } catch {
    // Emoji is optional
  }
}

export function SlackProvider({ children }: { children: ReactNode }) {
  const [isEmojiLoaded, setIsEmojiLoaded] = useState(emojiLoaded);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    loadEmoji().then(() => setIsEmojiLoaded(true));
  }, []);

  const getUser = useCallback(async (id: string) => fetchUser(id), []);
  const getChannel = useCallback(async (id: string) => fetchChannel(id), []);

  const getEmoji = useCallback((name: string) => {
    const customEmoji = emojiCache[name];
    if (customEmoji) return customEmoji;
    return getStandardEmoji(name);
  }, []);

  const resolveUserName = useCallback((userId: string): string | null => {
    const user = userCache.get(userId);
    if (!user) return null;
    return user.display_name || user.real_name || user.name;
  }, []);

  const prefetchUsers = useCallback(async (userIds: string[]) => {
    const uncached = userIds.filter((id) => !userCache.has(id));
    if (uncached.length === 0) return;
    await Promise.all(uncached.map((id) => fetchUser(id)));
  }, []);

  const showUserDetail = useCallback(
    (userId: string) => setSelectedUserId(userId),
    []
  );

  return (
    <SlackContext.Provider
      value={{
        getUser,
        getChannel,
        getEmoji,
        resolveUserName,
        prefetchUsers,
        isEmojiLoaded,
        showUserDetail,
        selectedUserId,
        setSelectedUserId,
      }}
    >
      {children}
    </SlackContext.Provider>
  );
}

export function useSlackContext(): SlackContextValue {
  const ctx = useContext(SlackContext);
  if (!ctx) throw new Error('useSlackContext must be used within SlackProvider');
  return ctx;
}

export function useSlackContextOptional(): SlackContextValue | null {
  return useContext(SlackContext);
}

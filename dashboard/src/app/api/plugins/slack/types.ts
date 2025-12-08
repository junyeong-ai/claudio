export type {
  SlackUser,
  SlackChannel,
  SlackMessage,
  SlackEmoji,
} from '@/types/slack';

export interface RawSlackUser {
  id: string;
  name: string;
  real_name?: string;
  display_name?: string;
  email?: string;
  avatar?: string;
  title?: string;
  status?: string;
  status_emoji?: string;
  timezone?: string;
  is_admin?: boolean;
  is_bot?: boolean;
  deleted?: boolean;
}

export interface RawSlackChannel {
  id: string;
  name: string;
  topic?: string | { value?: string };
  purpose?: string | { value?: string };
  type?: string; // "Private" | "Public"
  is_private?: boolean;
  is_archived?: boolean;
  members?: number;
  num_members?: number;
  created?: number;
}

export interface RawSlackMessage {
  ts: string;
  user?: string;
  user_name?: string;
  user_image?: string;
  text: string;
  thread_ts?: string;
  reply_count?: number;
  reactions?: Array<{ name: string; count: number }>;
  subtype?: string;
  bot_id?: string;
}

import type { SlackUser, SlackChannel } from '@/types/slack';

export function mapRawUser(raw: RawSlackUser): SlackUser {
  return {
    id: raw.id,
    name: raw.name,
    real_name: raw.real_name,
    display_name: raw.display_name,
    email: raw.email,
    image_48: raw.avatar,
    image_72: raw.avatar,
    title: raw.title,
    status_text: raw.status,
    status_emoji: raw.status_emoji,
    timezone: raw.timezone,
    is_admin: raw.is_admin,
    is_bot: raw.is_bot,
    deleted: raw.deleted,
  };
}

export function mapRawChannel(raw: RawSlackChannel): SlackChannel {
  // slack-cli returns type: "Private" | "Public" instead of is_private boolean
  const isPrivate = raw.type === 'Private' || raw.is_private === true;

  return {
    id: raw.id,
    name: raw.name,
    topic: typeof raw.topic === 'string' ? raw.topic : raw.topic?.value,
    purpose: typeof raw.purpose === 'string' ? raw.purpose : raw.purpose?.value,
    is_private: isPrivate,
    is_archived: raw.is_archived ?? false,
    num_members: raw.members ?? raw.num_members,
    created: raw.created,
  };
}

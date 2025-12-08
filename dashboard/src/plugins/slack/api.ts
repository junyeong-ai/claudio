import type { SlackUser, SlackChannel, SlackMessage } from '@/types/slack';

export type { SlackUser, SlackChannel, SlackMessage } from '@/types/slack';

export interface UsersResponse {
  users: SlackUser[];
  query: string;
  duration_ms: number;
}

export interface ChannelsResponse {
  channels: SlackChannel[];
  query: string;
  duration_ms: number;
}

export interface MembersResponse {
  members: SlackUser[];
  channel: string;
  duration_ms: number;
}

export interface MessagesResponse {
  messages: SlackMessage[];
  channel: string;
  duration_ms: number;
}

export interface ThreadResponse {
  messages: SlackMessage[];
  channel: string;
  thread_ts: string;
  duration_ms: number;
}

async function fetchApi<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export async function searchUsers(query: string, limit = 10): Promise<UsersResponse> {
  const params = new URLSearchParams({ q: query, limit: limit.toString() });
  return fetchApi(`/api/plugins/slack/users?${params}`);
}

export async function searchChannels(query: string, limit = 10): Promise<ChannelsResponse> {
  const params = new URLSearchParams({ q: query, limit: limit.toString() });
  return fetchApi(`/api/plugins/slack/channels?${params}`);
}

export async function getChannelMembers(channelId: string): Promise<MembersResponse> {
  return fetchApi(`/api/plugins/slack/channels/${encodeURIComponent(channelId)}/members`);
}

export async function getChannelMessages(channelId: string, limit = 20): Promise<MessagesResponse> {
  const params = new URLSearchParams({ limit: limit.toString() });
  return fetchApi(`/api/plugins/slack/channels/${encodeURIComponent(channelId)}/messages?${params}`);
}

export async function getThreadMessages(channelId: string, ts: string): Promise<ThreadResponse> {
  return fetchApi(`/api/plugins/slack/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(ts)}/thread`);
}

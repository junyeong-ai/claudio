export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  display_name?: string;
  email?: string;
  image_48?: string;
  image_72?: string;
  title?: string;
  status_text?: string;
  status_emoji?: string;
  timezone?: string;
  is_admin?: boolean;
  is_bot?: boolean;
  deleted?: boolean;
}

export interface SlackChannel {
  id: string;
  name: string;
  topic?: string;
  purpose?: string;
  is_private?: boolean;
  is_archived?: boolean;
  num_members?: number;
  created?: number;
}

export interface SlackMessage {
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

export interface SlackEmoji {
  name: string;
  url: string;
}

import { exec } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';
import {
  type SlackUser,
  type SlackMessage,
  type RawSlackUser,
  type RawSlackMessage,
  mapRawUser,
} from './types';

const execAsync = promisify(exec);
const DEFAULT_TIMEOUT = 30000;

export class SlackCliError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_FOUND' | 'CLI_MISSING' | 'TIMEOUT' | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'SlackCliError';
  }
}

interface ExecOptions {
  timeout?: number;
}

export async function execSlackCli<T>(
  command: string,
  options: ExecOptions = {}
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT } = options;

  try {
    const { stdout, stderr } = await execAsync(`slack-cli ${command}`, { timeout });

    if (stderr && !stdout) {
      throw new SlackCliError('Command returned error', 'UNKNOWN');
    }

    return JSON.parse(stdout) as T;
  } catch (error) {
    if (error instanceof SlackCliError) throw error;

    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        throw new SlackCliError('slack-cli not found', 'CLI_MISSING');
      }
      if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
        throw new SlackCliError('Request timed out', 'TIMEOUT');
      }
    }

    throw new SlackCliError(
      error instanceof Error ? error.message : 'Unknown error',
      'UNKNOWN'
    );
  }
}

export function handleSlackError(error: unknown): NextResponse {
  if (error instanceof SlackCliError) {
    switch (error.code) {
      case 'CLI_MISSING':
        return NextResponse.json(
          { error: 'slack-cli not found. Please install slack-cli.' },
          { status: 500 }
        );
      case 'NOT_FOUND':
        return NextResponse.json({ error: error.message }, { status: 404 });
      case 'TIMEOUT':
        return NextResponse.json({ error: 'Request timed out' }, { status: 504 });
      default:
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Unknown error' },
    { status: 500 }
  );
}

export async function fetchUser(userId: string): Promise<SlackUser | null> {
  try {
    const users = await execSlackCli<RawSlackUser[]>(
      `users --id ${JSON.stringify(userId)} --expand avatar,display_name,title,status,status_emoji,timezone,is_admin,is_bot,deleted -j`,
      { timeout: 10000 }
    );
    return users[0] ? mapRawUser(users[0]) : null;
  } catch {
    return null;
  }
}

export async function fetchUserBasic(userId: string): Promise<Pick<SlackUser, 'id' | 'name' | 'display_name' | 'real_name' | 'image_48'> | null> {
  try {
    const users = await execSlackCli<RawSlackUser[]>(
      `users --id ${JSON.stringify(userId)} --expand avatar,display_name -j`,
      { timeout: 10000 }
    );
    if (users[0]) {
      const u = users[0];
      return {
        id: u.id,
        name: u.name,
        display_name: u.display_name,
        real_name: u.real_name,
        image_48: u.avatar,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function enrichMessages(messages: RawSlackMessage[]): Promise<SlackMessage[]> {
  const userIds = [...new Set(messages.map(m => m.user).filter((id): id is string => !!id))];
  const userMap = new Map<string, { name: string; avatar?: string }>();

  const batchSize = 10;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(fetchUserBasic));
    batch.forEach((id, j) => {
      const user = results[j];
      if (user) {
        userMap.set(id, {
          name: user.display_name || user.real_name || user.name,
          avatar: user.image_48,
        });
      }
    });
  }

  return messages.map(m => {
    const info = m.user ? userMap.get(m.user) : undefined;
    return {
      ...m,
      user_name: info?.name || m.user_name,
      user_image: info?.avatar,
    };
  });
}

export { withTiming } from '../../utils';

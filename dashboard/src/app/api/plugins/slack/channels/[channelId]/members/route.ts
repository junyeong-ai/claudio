import { NextRequest, NextResponse } from 'next/server';
import { execSlackCli, fetchUserBasic, handleSlackError, withTiming } from '../../../client';
import type { SlackUser } from '../../../types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const startTime = Date.now();

  try {
    const rawMembers = await execSlackCli<(string | { id: string })[]>(
      `members ${JSON.stringify(channelId)} -j`
    );

    const memberIds = rawMembers.map(m => typeof m === 'string' ? m : m.id);
    const members: Partial<SlackUser>[] = [];

    const batchSize = 10;
    for (let i = 0; i < memberIds.length; i += batchSize) {
      const batch = memberIds.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(fetchUserBasic));
      batch.forEach((id, j) => {
        members.push(results[j] || { id, name: id });
      });
    }

    return NextResponse.json(withTiming({
      members,
      channel: channelId,
    }, startTime));
  } catch (error) {
    return handleSlackError(error);
  }
}

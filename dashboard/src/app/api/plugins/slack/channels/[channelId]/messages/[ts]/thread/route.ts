import { NextRequest, NextResponse } from 'next/server';
import { execSlackCli, enrichMessages, handleSlackError, withTiming } from '../../../../../client';
import type { RawSlackMessage } from '../../../../../types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ channelId: string; ts: string }> }
) {
  const { channelId, ts } = await params;
  const startTime = Date.now();

  try {
    const rawMessages = await execSlackCli<RawSlackMessage[]>(
      `thread ${JSON.stringify(channelId)} ${JSON.stringify(ts)} -j`
    );

    const messages = await enrichMessages(rawMessages);

    return NextResponse.json(withTiming({
      messages,
      channel: channelId,
      thread_ts: ts,
    }, startTime));
  } catch (error) {
    return handleSlackError(error);
  }
}
